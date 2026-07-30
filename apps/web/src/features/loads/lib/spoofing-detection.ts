export interface SpoofingResult {
  spoofed: boolean;
  reasons: string[];
}

interface PingData {
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  speed_ms?: number | null;
}

/**
 * Detect potential GPS spoofing.
 * Checks:
 * 1. Accuracy > 500m = unreliable (possibly mocked)
 * 2. Suspiciously consistent speed (same value ±0.1 for 5+ pings)
 * 3. Coordinate precision anomalies (too few decimals = fake)
 */
export function isSpoofed(current: PingData, recentSpeeds?: number[]): SpoofingResult {
  const reasons: string[] = [];

  // Check accuracy
  if (current.accuracy_m != null && current.accuracy_m > 500) {
    reasons.push(`GPS accuracy too low: ${current.accuracy_m}m`);
  }

  // Suspiciously consistent speed
  if (recentSpeeds && recentSpeeds.length >= 5 && current.speed_ms != null) {
    const allSimilar = recentSpeeds.every((s) => Math.abs(s - current.speed_ms!) < 0.1);
    if (allSimilar) {
      reasons.push('Suspiciously consistent speed across multiple pings');
    }
  }

  // Coordinate precision: real GPS has ~6+ decimal places
  const latStr = current.latitude.toString();
  const lngStr = current.longitude.toString();
  const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
  const lngDecimals = lngStr.includes('.') ? lngStr.split('.')[1].length : 0;

  if (latDecimals < 4 || lngDecimals < 4) {
    reasons.push(
      `Suspiciously low coordinate precision: lat=${latDecimals} lng=${lngDecimals} decimals`,
    );
  }

  return {
    spoofed: reasons.length > 0,
    reasons,
  };
}
