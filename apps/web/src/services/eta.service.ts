import { supabase } from '@/lib/supabase';
import { haversineM } from '@/features/loads/lib/geofence';
import type { ETAResult } from '@freightx/shared';

/**
 * Calculate predictive ETA using:
 * - Average speed from last 10 pings
 * - Straight-line distance to destination × 1.3 road factor
 * - Time-of-day adjustment (rush hour penalty)
 */
export async function calculateETA(
  loadNumber: string,
  destLat: number,
  destLng: number,
): Promise<ETAResult | null> {
  // Get last 10 pings for speed averaging
  const { data: pings } = await supabase
    .from('location_pings')
    .select('latitude, longitude, speed_ms, recorded_at')
    .eq('load_number', loadNumber)
    .order('recorded_at', { ascending: false })
    .limit(10);

  if (!pings || pings.length === 0) return null;

  const latest = pings[0];
  const latestLat = latest.latitude as number;
  const latestLng = latest.longitude as number;

  // Average speed from pings that have speed data
  const speeds = pings
    .map((p) => p.speed_ms as number | null)
    .filter((s): s is number => s != null && s > 0);

  // Fallback: compute speed from distance between first and last ping
  let avgSpeedMs: number;
  if (speeds.length >= 3) {
    avgSpeedMs = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  } else if (pings.length >= 2) {
    const oldest = pings[pings.length - 1];
    const dist = haversineM(
      oldest.latitude as number,
      oldest.longitude as number,
      latestLat,
      latestLng,
    );
    const timeDiffS =
      (new Date(latest.recorded_at as string).getTime() -
        new Date(oldest.recorded_at as string).getTime()) /
      1000;
    avgSpeedMs = timeDiffS > 0 ? dist / timeDiffS : 25; // ~56 mph default
  } else {
    avgSpeedMs = 25; // ~56 mph default
  }

  // Clamp speed to reasonable range (5 mph to 75 mph)
  avgSpeedMs = Math.max(2.2, Math.min(avgSpeedMs, 33.5));

  // Straight-line distance to destination
  const straightLineM = haversineM(latestLat, latestLng, destLat, destLng);

  // Road factor: roads are ~1.3x longer than straight line
  const roadDistM = straightLineM * 1.3;
  const remainingMiles = roadDistM / 1609.34;

  // Time-of-day adjustment
  const hour = new Date().getHours();
  let rushHourFactor = 1.0;
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
    rushHourFactor = 1.2; // 20% slower during rush hour
  } else if (hour >= 22 || hour <= 5) {
    rushHourFactor = 0.95; // Slightly faster at night
  }

  // Calculate remaining time
  const remainingSeconds = (roadDistM / avgSpeedMs) * rushHourFactor;
  const remainingMinutes = Math.round(remainingSeconds / 60);
  const estimatedArrival = new Date(Date.now() + remainingSeconds * 1000).toISOString();

  // Confidence based on data quality
  let confidencePercent = 70;
  if (speeds.length >= 5) confidencePercent = 85;
  if (speeds.length >= 8) confidencePercent = 90;
  if (remainingMiles < 50) confidencePercent = Math.min(confidencePercent + 5, 95);
  if (remainingMiles > 500) confidencePercent = Math.max(confidencePercent - 10, 50);

  return {
    estimatedArrival,
    confidencePercent,
    remainingMiles: Math.round(remainingMiles),
    remainingMinutes,
  };
}
