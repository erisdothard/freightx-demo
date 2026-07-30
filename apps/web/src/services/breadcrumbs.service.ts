import { supabase } from '@/lib/supabase';
import type { BreadcrumbPoint } from '@freightx/shared';

// breadcrumb_snapshots table not yet in generated DB types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Get breadcrumb trail for a load.
 * - Active loads: returns live pings from location_pings
 * - Delivered loads: returns compressed snapshot from breadcrumb_snapshots
 */
export async function getBreadcrumbsForLoad(loadNumber: string): Promise<BreadcrumbPoint[]> {
  // Try snapshot first (delivered loads)
  const { data: snapshot } = await db
    .from('breadcrumb_snapshots')
    .select('polyline')
    .eq('load_number', loadNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (snapshot?.polyline) {
    return snapshot.polyline as BreadcrumbPoint[];
  }

  // Fall back to live pings (active loads)
  const { data: pings, error } = await supabase
    .from('location_pings')
    .select('latitude, longitude, speed_ms, recorded_at')
    .eq('load_number', loadNumber)
    .order('recorded_at', { ascending: true });

  if (error || !pings) return [];

  return pings.map((p) => ({
    lat: p.latitude as number,
    lng: p.longitude as number,
    ts: new Date(p.recorded_at as string).getTime(),
    speed_ms: (p.speed_ms as number) ?? undefined,
  }));
}

/**
 * Snapshot breadcrumbs for a delivered load.
 * Called when a load transitions to 'delivered'.
 */
export async function snapshotBreadcrumbs(loadNumber: string, driverId: string): Promise<void> {
  const { data: pings } = await supabase
    .from('location_pings')
    .select('latitude, longitude, speed_ms, recorded_at')
    .eq('load_number', loadNumber)
    .order('recorded_at', { ascending: true });

  if (!pings || pings.length === 0) return;

  const polyline: BreadcrumbPoint[] = pings.map((p) => ({
    lat: p.latitude as number,
    lng: p.longitude as number,
    ts: new Date(p.recorded_at as string).getTime(),
    speed_ms: (p.speed_ms as number) ?? undefined,
  }));

  await db.from('breadcrumb_snapshots').insert({
    load_number: loadNumber,
    driver_id: driverId,
    polyline,
    total_points: polyline.length,
    start_time: pings[0].recorded_at,
    end_time: pings[pings.length - 1].recorded_at,
  });
}
