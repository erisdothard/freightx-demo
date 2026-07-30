import { supabase } from '@/lib/supabase';

export interface RateForecast {
  has_data: boolean;
  avg_7d: number | null;
  avg_14d: number | null;
  avg_30d: number | null;
  avg_90d: number | null;
  trend_slope: number | null;
  trend_direction: 'rising' | 'falling' | 'stable';
  confidence_low: number | null;
  confidence_high: number | null;
  weekly_breakdown: { week: string; avg_rate: number; count: number }[];
  sample_count: number;
}

export async function forecastLaneRate(params: {
  originState: string;
  destState: string;
  equipment: string;
}): Promise<RateForecast> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('forecast_lane_rate', {
    p_origin_state: params.originState,
    p_dest_state: params.destState,
    p_equipment: params.equipment,
  });

  if (error || !data) {
    return {
      has_data: false,
      avg_7d: null,
      avg_14d: null,
      avg_30d: null,
      avg_90d: null,
      trend_slope: null,
      trend_direction: 'stable',
      confidence_low: null,
      confidence_high: null,
      weekly_breakdown: [],
      sample_count: 0,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      has_data: false,
      avg_7d: null,
      avg_14d: null,
      avg_30d: null,
      avg_90d: null,
      trend_slope: null,
      trend_direction: 'stable',
      confidence_low: null,
      confidence_high: null,
      weekly_breakdown: [],
      sample_count: 0,
    };
  }

  const slope = row.trend_slope != null ? Number(row.trend_slope) : null;
  let direction: RateForecast['trend_direction'] = 'stable';
  if (slope != null) {
    if (slope > 0.01) direction = 'rising';
    else if (slope < -0.01) direction = 'falling';
  }

  return {
    has_data: true,
    avg_7d: row.avg_7d != null ? Number(row.avg_7d) : null,
    avg_14d: row.avg_14d != null ? Number(row.avg_14d) : null,
    avg_30d: row.avg_30d != null ? Number(row.avg_30d) : null,
    avg_90d: row.avg_90d != null ? Number(row.avg_90d) : null,
    trend_slope: slope,
    trend_direction: direction,
    confidence_low: row.confidence_low != null ? Number(row.confidence_low) : null,
    confidence_high: row.confidence_high != null ? Number(row.confidence_high) : null,
    weekly_breakdown: Array.isArray(row.weekly_breakdown) ? row.weekly_breakdown : [],
    sample_count: Number(row.sample_count ?? 0),
  };
}

export interface RateHeatmapLane {
  origin_state: string;
  dest_state: string;
  avg_rate_per_mile: number;
  trend_direction: 'rising' | 'falling' | 'stable';
  sample_count: number;
}

export async function getRateHeatmap(params: {
  equipment: string;
  days?: number;
}): Promise<RateHeatmapLane[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_rate_heatmap', {
    p_equipment: params.equipment,
    p_days: params.days ?? 30,
  });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    origin_state: row.origin_state as string,
    dest_state: row.dest_state as string,
    avg_rate_per_mile: Number(row.avg_rate_per_mile),
    trend_direction: (row.trend_direction as string) || 'stable',
    sample_count: Number(row.sample_count ?? 0),
  })) as RateHeatmapLane[];
}
