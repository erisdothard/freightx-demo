import { supabase } from '@/lib/supabase';

export interface LaneStats {
  avg_rate_per_mile: number | null;
  min_rate_per_mile: number | null;
  max_rate_per_mile: number | null;
  sample_count: number;
  last_recorded_at: string | null;
}

export interface LaneTrendPoint {
  day: string;
  avg_rate_per_mile: number;
}

export interface RateSuggestion {
  suggested_low: number;
  suggested_mid: number;
  suggested_high: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  sample_count: number;
}

export async function getLaneStats(params: {
  originState: string;
  destState: string;
  equipment: string;
  days?: number;
}): Promise<LaneStats> {
  const { data, error } = await supabase.rpc('get_lane_stats', {
    p_origin_state: params.originState,
    p_dest_state: params.destState,
    p_equipment: params.equipment,
    p_days: params.days ?? 90,
  });

  if (error) {
    return {
      avg_rate_per_mile: null,
      min_rate_per_mile: null,
      max_rate_per_mile: null,
      sample_count: 0,
      last_recorded_at: null,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    avg_rate_per_mile: row?.avg_rate_per_mile ? Number(row.avg_rate_per_mile) : null,
    min_rate_per_mile: row?.min_rate_per_mile ? Number(row.min_rate_per_mile) : null,
    max_rate_per_mile: row?.max_rate_per_mile ? Number(row.max_rate_per_mile) : null,
    sample_count: Number(row?.sample_count ?? 0),
    last_recorded_at: row?.last_recorded_at ?? null,
  };
}

export async function getLaneTrend(params: {
  originState: string;
  destState: string;
  equipment: string;
}): Promise<LaneTrendPoint[]> {
  const { data, error } = await supabase.rpc('get_lane_trend', {
    p_origin_state: params.originState,
    p_dest_state: params.destState,
    p_equipment: params.equipment,
  });

  if (error || !data) return [];
  return (data as LaneTrendPoint[]).map((row) => ({
    day: row.day,
    avg_rate_per_mile: Number(row.avg_rate_per_mile),
  }));
}

export async function recordLaneRate(params: {
  originState: string;
  destState: string;
  equipment: string;
  rateUsd: number;
  totalMiles?: number | null;
  loadId?: string;
}): Promise<void> {
  const ratePerMile =
    params.totalMiles && params.totalMiles > 0
      ? +(params.rateUsd / params.totalMiles).toFixed(2)
      : null;

  const laneHash = `${params.originState}-${params.destState}-${params.equipment}`;

  const { error } = await supabase.from('rate_history').insert({
    lane_hash: laneHash,
    origin_state: params.originState,
    dest_state: params.destState,
    equipment: params.equipment,
    rate_usd: params.rateUsd,
    total_miles: params.totalMiles ?? null,
    rate_per_mile: ratePerMile,
    load_id: params.loadId ?? null,
  });

  if (error) {
    // Non-fatal: rate history write failure should never block a booking
    console.warn('[rate-intelligence] Failed to record lane rate:', error.message);
  }
}

/**
 * Ask Claude Sonnet for a smart rate suggestion for a given lane.
 * Routes to the ai-load-search edge function with action='suggest_rate'.
 */
export async function suggestRate(params: {
  originState: string;
  destState: string;
  equipment: string;
  totalMiles: number;
  laneStats: LaneStats;
}): Promise<RateSuggestion | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const resp = await fetch(`${supabaseUrl}/functions/v1/ai-load-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action: 'suggest_rate',
        origin_state: params.originState,
        dest_state: params.destState,
        equipment: params.equipment,
        total_miles: params.totalMiles,
        lane_stats: params.laneStats,
      }),
    });

    if (!resp.ok) return null;
    return (await resp.json()) as RateSuggestion;
  } catch {
    return null;
  }
}

export interface RateFairness {
  rate_per_mile: number;
  market_avg: number;
  market_min: number;
  market_max: number;
  percentile: number;
  sample_count: number;
  fairness_label: 'Excellent' | 'Above Average' | 'Fair' | 'Below Market';
  confidence: 'high' | 'medium' | 'low';
}

export async function getRateFairness(loadId: string): Promise<RateFairness | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_rate_fairness', { p_load_id: loadId });

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = Array.isArray(data) ? (data as any[])[0] : data;
  if (!row) return null;

  return {
    rate_per_mile: Number(row.rate_per_mile),
    market_avg: Number(row.market_avg),
    market_min: Number(row.market_min),
    market_max: Number(row.market_max),
    percentile: Number(row.percentile),
    sample_count: Number(row.sample_count),
    fairness_label: row.fairness_label as RateFairness['fairness_label'],
    confidence: row.confidence as RateFairness['confidence'],
  };
}

export interface PopularLane {
  origin_state: string;
  dest_state: string;
  equipment: string;
  load_count: number;
  avg_rate_per_mile: number | null;
  last_seen_at: string | null;
}

export async function getPopularLanes(limit = 10): Promise<PopularLane[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('popular_lanes')
    .select('origin_state, dest_state, equipment, load_count, avg_rate_per_mile, last_seen_at')
    .order('load_count', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => ({
    origin_state: row.origin_state as string,
    dest_state: row.dest_state as string,
    equipment: row.equipment as string,
    load_count: Number(row.load_count),
    avg_rate_per_mile: row.avg_rate_per_mile != null ? Number(row.avg_rate_per_mile) : null,
    last_seen_at: row.last_seen_at as string | null,
  }));
}
