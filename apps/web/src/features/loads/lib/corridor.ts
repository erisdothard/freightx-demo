import { haversineM } from './geofence';

/**
 * Build a corridor by generating waypoints along the great-circle route
 * from origin to destination.
 */
export function buildCorridor(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  numPoints = 20,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = originLat + (destLat - originLat) * t;
    const lng = originLng + (destLng - originLng) * t;
    points.push([lat, lng]);
  }
  return points;
}

/**
 * Check if a point is inside the corridor (within `bufferM` metres of any segment).
 */
export function isInsideCorridor(
  lat: number,
  lng: number,
  corridor: [number, number][],
  bufferM = 50_000, // 50km default buffer
): boolean {
  for (const [cLat, cLng] of corridor) {
    if (haversineM(lat, lng, cLat, cLng) <= bufferM) return true;
  }
  return false;
}

/**
 * Get the minimum deviation distance in km from the corridor.
 */
export function getDeviationKm(lat: number, lng: number, corridor: [number, number][]): number {
  let minDist = Infinity;
  for (const [cLat, cLng] of corridor) {
    const dist = haversineM(lat, lng, cLat, cLng);
    if (dist < minDist) minDist = dist;
  }
  return minDist / 1000;
}
