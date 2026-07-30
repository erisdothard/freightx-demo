import type { EquipmentType, Load } from '@freightx/shared';

// Approximate national spot market averages (Feb 2026 mock)
const MARKET_RATES: Record<EquipmentType, number> = {
  van: 2.82,
  reefer: 3.1,
  flatbed: 3.0,
  step_deck: 3.15,
  lowboy: 3.4,
  tanker: 3.2,
  box_truck: 2.6,
  sprinter: 2.9,
};

export type RateHealth = 'hot' | 'good' | 'fair' | 'low';

export interface RateAnalysis {
  health: RateHealth;
  label: string;
  delta: string; // e.g. "+18% vs mkt"
  color: string;
}

export function analyzeRate(load: Load): RateAnalysis {
  const market = MARKET_RATES[load.equipment] ?? 2.8;
  const pct = ((load.ratePerMile - market) / market) * 100;

  if (pct >= 15)
    return { health: 'hot', label: 'Hot Rate', delta: `+${pct.toFixed(0)}% mkt`, color: '#34D399' };
  if (pct >= 3)
    return {
      health: 'good',
      label: 'Good Rate',
      delta: `+${pct.toFixed(0)}% mkt`,
      color: '#60A5FA',
    };
  if (pct >= -8)
    return {
      health: 'fair',
      label: 'Fair Rate',
      delta: `${pct.toFixed(0)}% mkt`,
      color: '#F59E0B',
    };
  return { health: 'low', label: 'Below Mkt', delta: `${pct.toFixed(0)}% mkt`, color: '#F87171' };
}

export function getLoadAge(postedAt?: string): string {
  if (!postedAt) return '';
  const diffMs = Date.now() - new Date(postedAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getBrokerCreditLabel(score?: number): { label: string; color: string } | null {
  if (!score) return null;
  if (score >= 85) return { label: `Credit A+`, color: '#34D399' };
  if (score >= 70) return { label: `Credit B`, color: '#60A5FA' };
  if (score >= 55) return { label: `Credit C`, color: '#F59E0B' };
  return { label: 'Credit D', color: '#F87171' };
}

export function calcGrossProfit(load: Load): string | null {
  if (!load.totalMiles) return null;
  // rough: $0.65/mi fuel + driver pay
  const cost = load.totalMiles * 1.45;
  const profit = load.rateUsd - cost;
  const margin = Math.round((profit / load.rateUsd) * 100);
  return `~${margin}% margin`;
}
