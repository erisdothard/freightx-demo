import { analyzeRate } from '@/shared/lib/freight';
import type { Load, EquipmentType } from '@freightx/shared';

export interface CarrierPreferences {
  userId: string;
  preferredEquipment: EquipmentType[];
  preferredOriginStates: string[]; // e.g. ['TX', 'OK', 'LA']
  preferredDestStates: string[];
  minRatePerMile: number; // 0 = no minimum
  homeCity: string;
  homeState: string;
}

export interface ScoredLoad extends Load {
  matchScore: number; // 0–100
  matchBreakdown: MatchBreakdown;
}

interface MatchBreakdown {
  equipmentPts: number; // 0 or 40
  ratePts: number; // 5 | 12 | 20 | 25
  lanePts: number; // 0–20
  urgencyPts: number; // 3 | 7 | 10
  creditPts: number; // 0 | 1 | 3 | 5
}

/**
 * Scores a single load against the carrier's saved preferences.
 * Total possible: 100 pts.
 */
export function scoreLoad(load: Load, prefs: CarrierPreferences): ScoredLoad {
  // 1. Equipment match — 40 pts (hard filter, but scored not excluded)
  const equipmentPts =
    prefs.preferredEquipment.length === 0 || prefs.preferredEquipment.includes(load.equipment)
      ? 40
      : 0;

  // 2. Rate health — 25 pts
  const rateHealth = analyzeRate(load).health;
  const rateMap = { hot: 25, good: 20, fair: 12, low: 5 } as const;
  const ratePts = rateMap[rateHealth];

  // 3. Lane preference — 20 pts (10 origin + 10 dest)
  const originMatch =
    prefs.preferredOriginStates.length === 0 ||
    prefs.preferredOriginStates.includes(load.originState);
  const destMatch =
    prefs.preferredDestStates.length === 0 || prefs.preferredDestStates.includes(load.destState);
  const lanePts = (originMatch ? 10 : 0) + (destMatch ? 10 : 0);

  // 4. Pickup urgency — 10 pts (loads picking up soon score higher)
  const daysUntilPickup = (new Date(load.pickupDate).getTime() - Date.now()) / 86_400_000;
  const urgencyPts = daysUntilPickup <= 2 ? 10 : daysUntilPickup <= 5 ? 7 : 3;

  // 5. Broker credit — 5 pts
  const cs = load.brokerCreditScore ?? 0;
  const creditPts = cs >= 85 ? 5 : cs >= 70 ? 3 : cs >= 55 ? 1 : 0;

  const matchScore = equipmentPts + ratePts + lanePts + urgencyPts + creditPts;

  return {
    ...load,
    matchScore,
    matchBreakdown: { equipmentPts, ratePts, lanePts, urgencyPts, creditPts },
  };
}

/**
 * Scores and sorts a list of loads. Returns all loads with scores attached,
 * sorted highest score first.
 */
export function rankLoads(loads: Load[], prefs: CarrierPreferences): ScoredLoad[] {
  return loads.map((load) => scoreLoad(load, prefs)).sort((a, b) => b.matchScore - a.matchScore);
}

/** Returns only loads scoring above the given threshold (default 60). */
export function getTopMatches(
  loads: Load[],
  prefs: CarrierPreferences,
  threshold = 60,
): ScoredLoad[] {
  return rankLoads(loads, prefs).filter((l) => l.matchScore >= threshold);
}
