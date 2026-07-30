import { supabase } from '@/lib/supabase';
import type { DriverScore } from '@freightx/shared';

// Tables not yet in generated DB types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapRow(row: Record<string, unknown>): DriverScore {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    loadNumber: row.load_number as string,
    overallScore: row.overall_score as number,
    speedScore: row.speed_score as number,
    routeScore: row.route_score as number,
    dwellScore: row.dwell_score as number,
    details: (row.details as Record<string, unknown>) ?? undefined,
  };
}

/**
 * Calculate driver score after delivery.
 * Factors: speed compliance, route adherence, facility dwell time.
 */
export async function calculateDriverScore(params: {
  driverId: string;
  loadNumber: string;
}): Promise<DriverScore> {
  const { driverId, loadNumber } = params;

  // Get all pings for the load
  const { data: pings } = await db
    .from('location_pings')
    .select('speed_ms, recorded_at')
    .eq('load_number', loadNumber)
    .order('recorded_at', { ascending: true });

  // Speed score: % of pings under 130 km/h (80 mph)
  const speeds = (pings ?? [])
    .map((p: Record<string, unknown>) => p.speed_ms as number | null)
    .filter((s: number | null): s is number => s != null);
  const speedCompliant = speeds.filter((s: number) => s * 3.6 <= 130).length;
  const speedScore = speeds.length > 0 ? Math.round((speedCompliant / speeds.length) * 100) : 100;

  // Route score: default 90 (we check for route_deviation notifications)
  const { count: deviations } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'route_deviation')
    .ilike('body', `%${loadNumber}%`);
  const routeScore = Math.max(0, 100 - (deviations ?? 0) * 20);

  // Dwell score: based on detention flags
  const { data: dwells } = await db
    .from('dwell_records')
    .select('detention_flagged, dwell_minutes')
    .eq('load_number', loadNumber);
  const detentionCount = (dwells ?? []).filter(
    (d: Record<string, unknown>) => d.detention_flagged,
  ).length;
  const dwellScore = Math.max(0, 100 - detentionCount * 25);

  // Overall: weighted average
  const overallScore = Math.round(speedScore * 0.4 + routeScore * 0.35 + dwellScore * 0.25);

  const { data, error } = await db
    .from('driver_scores')
    .insert({
      driver_id: driverId,
      load_number: loadNumber,
      overall_score: overallScore,
      speed_score: speedScore,
      route_score: routeScore,
      dwell_score: dwellScore,
      details: {
        totalPings: pings?.length ?? 0,
        speedSamples: speeds.length,
        deviations: deviations ?? 0,
        detentionCount,
      },
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function getDriverScores(driverId: string): Promise<DriverScore[]> {
  const { data, error } = await db
    .from('driver_scores')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(mapRow);
}

export async function getAverageScore(driverId: string): Promise<number | null> {
  const scores = await getDriverScores(driverId);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length);
}
