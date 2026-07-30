import { haversineM } from './geofence';

export type AnomalyType =
  | 'teleport'
  | 'excessive_speed'
  | 'signal_loss'
  | 'rate_anomaly'
  | 'double_post'
  | 'weight_mismatch';
export type AnomalySeverity = 'critical' | 'warning';

export interface AnomalyResult {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
}

interface Ping {
  latitude: number;
  longitude: number;
  speed_ms?: number | null;
  recorded_at: string;
}

/**
 * Detect GPS anomalies by comparing current ping to previous.
 * Returns detected anomalies (can be multiple).
 */
export function detectAnomalies(current: Ping, previous: Ping | null): AnomalyResult[] {
  if (!previous) return [];

  const anomalies: AnomalyResult[] = [];

  const distM = haversineM(
    previous.latitude,
    previous.longitude,
    current.latitude,
    current.longitude,
  );
  const timeDiffS =
    (new Date(current.recorded_at).getTime() - new Date(previous.recorded_at).getTime()) / 1000;

  // Teleport detection: >50km in <30 seconds + speed > 130 km/h
  if (timeDiffS > 0 && timeDiffS < 30 && distM > 50_000) {
    const speedKmh = (distM / timeDiffS) * 3.6;
    if (speedKmh > 130) {
      anomalies.push({
        type: 'teleport',
        severity: 'critical',
        message: `Suspicious location jump: ${Math.round(distM / 1000)}km in ${Math.round(timeDiffS)}s (${Math.round(speedKmh)} km/h)`,
      });
    }
  }

  // Excessive speed: >130 km/h (80 mph)
  if (current.speed_ms != null && current.speed_ms * 3.6 > 130) {
    anomalies.push({
      type: 'excessive_speed',
      severity: 'warning',
      message: `Excessive speed detected: ${Math.round(current.speed_ms * 3.6)} km/h`,
    });
  }

  // Signal loss: >5 minute gap
  if (timeDiffS > 300) {
    anomalies.push({
      type: 'signal_loss',
      severity: 'warning',
      message: `GPS signal gap: ${Math.round(timeDiffS / 60)} minutes without signal`,
    });
  }

  return anomalies;
}

// ── Financial / Load-Level Fraud Detection ──────────────────────────────

interface LaneStats {
  avg_rate_per_mile: number | null;
  sample_count: number;
}

interface LoadForAnomaly {
  id: string;
  rate_usd: number;
  rate_per_mile?: number | null;
  total_miles?: number | null;
  weight_lbs?: number | null;
  equipment?: string | null;
  origin_city: string;
  origin_state: string;
  dest_city: string;
  dest_state: string;
  pickup_date: string;
  posted_by: string;
}

interface RecentLoad {
  id: string;
  origin_city: string;
  origin_state: string;
  dest_city: string;
  dest_state: string;
  pickup_date: string;
  posted_by: string;
}

// Max weight capacity by equipment type (lbs)
const EQUIPMENT_MAX_WEIGHT: Record<string, number> = {
  van: 45_000,
  reefer: 44_000,
  flatbed: 48_000,
  step_deck: 43_000,
  lowboy: 40_000,
  tanker: 45_000,
  box_truck: 10_000,
  sprinter: 3_000,
};

/**
 * Detect rate anomaly — flag if rate is <50% or >200% of lane average.
 */
export function detectRateAnomaly(
  load: LoadForAnomaly,
  laneStats: LaneStats,
): AnomalyResult | null {
  if (!laneStats.avg_rate_per_mile || laneStats.sample_count < 3) return null;

  const ratePerMile =
    load.rate_per_mile ?? (load.total_miles ? load.rate_usd / load.total_miles : null);
  if (!ratePerMile) return null;

  const ratio = ratePerMile / laneStats.avg_rate_per_mile;

  if (ratio < 0.5) {
    return {
      type: 'rate_anomaly',
      severity: 'critical',
      message: `Rate $${ratePerMile.toFixed(2)}/mi is ${Math.round((1 - ratio) * 100)}% below lane avg ($${laneStats.avg_rate_per_mile.toFixed(2)}/mi)`,
    };
  }

  if (ratio > 2.0) {
    return {
      type: 'rate_anomaly',
      severity: 'warning',
      message: `Rate $${ratePerMile.toFixed(2)}/mi is ${Math.round((ratio - 1) * 100)}% above lane avg ($${laneStats.avg_rate_per_mile.toFixed(2)}/mi)`,
    };
  }

  return null;
}

/**
 * Detect double-posted loads — same origin/dest/date by the same poster.
 */
export function detectDoublePost(
  load: LoadForAnomaly,
  recentLoads: RecentLoad[],
): AnomalyResult | null {
  const duplicate = recentLoads.find(
    (rl) =>
      rl.id !== load.id &&
      rl.posted_by === load.posted_by &&
      rl.origin_city === load.origin_city &&
      rl.origin_state === load.origin_state &&
      rl.dest_city === load.dest_city &&
      rl.dest_state === load.dest_state &&
      rl.pickup_date === load.pickup_date,
  );

  if (duplicate) {
    return {
      type: 'double_post',
      severity: 'warning',
      message: `Possible duplicate: load ${duplicate.id.slice(0, 8)} has same origin/dest/date by same poster`,
    };
  }

  return null;
}

/**
 * Detect weight mismatch — weight exceeds equipment capacity.
 */
export function detectWeightMismatch(load: LoadForAnomaly): AnomalyResult | null {
  if (!load.weight_lbs || !load.equipment) return null;

  const maxWeight = EQUIPMENT_MAX_WEIGHT[load.equipment];
  if (!maxWeight) return null;

  if (load.weight_lbs > maxWeight) {
    return {
      type: 'weight_mismatch',
      severity: 'critical',
      message: `Weight ${load.weight_lbs.toLocaleString()} lbs exceeds ${load.equipment} capacity (${maxWeight.toLocaleString()} lbs)`,
    };
  }

  return null;
}

/**
 * Run all financial/load-level fraud checks on a load.
 * Returns array of detected anomalies (empty if clean).
 */
export function detectLoadAnomalies(
  load: LoadForAnomaly,
  laneStats: LaneStats,
  recentLoads: RecentLoad[],
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];

  const rate = detectRateAnomaly(load, laneStats);
  if (rate) anomalies.push(rate);

  const dup = detectDoublePost(load, recentLoads);
  if (dup) anomalies.push(dup);

  const weight = detectWeightMismatch(load);
  if (weight) anomalies.push(weight);

  return anomalies;
}
