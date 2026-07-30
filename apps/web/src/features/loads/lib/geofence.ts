import type { Geofence } from '@freightx/shared';

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in metres between two lat/lng pairs. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Check if a point is inside a geofence */
export function isInsideGeofence(lat: number, lng: number, fence: Geofence): boolean {
  return haversineM(lat, lng, fence.lat, fence.lng) <= fence.radiusM;
}

export interface GeofenceCheckResult {
  entered: Geofence[];
  exited: Geofence[];
}

/**
 * Check which geofences were entered/exited given previous and current positions.
 * `previouslyInside` is the set of geofence IDs the driver was inside on the last check.
 */
export function checkGeofences(
  lat: number,
  lng: number,
  geofences: Geofence[],
  previouslyInside: Set<string>,
): GeofenceCheckResult {
  const entered: Geofence[] = [];
  const exited: Geofence[] = [];

  for (const fence of geofences) {
    const inside = isInsideGeofence(lat, lng, fence);
    const wasInside = previouslyInside.has(fence.id);

    if (inside && !wasInside) entered.push(fence);
    if (!inside && wasInside) exited.push(fence);
  }

  return { entered, exited };
}
