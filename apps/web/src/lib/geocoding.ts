// Simple in-memory cache to avoid redundant Mapbox Geocoding requests
const cache = new Map<string, [number, number] | null>();

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

async function mapboxGeocode(query: string, cacheKey: string): Promise<[number, number] | null> {
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  if (!MAPBOX_TOKEN) {
    console.warn('[geocoding] VITE_MAPBOX_TOKEN is not set');
    cache.set(cacheKey, null);
    return null;
  }

  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?country=us&limit=1&access_token=${MAPBOX_TOKEN}`,
    );
    if (!res.ok) {
      cache.set(cacheKey, null);
      return null;
    }
    const data = await res.json();
    const feature = data?.features?.[0];
    if (feature) {
      // Mapbox returns [lng, lat] — we store as [lat, lng] for our interface
      const [lng, lat] = feature.center as [number, number];
      const coords: [number, number] = [lat, lng];
      cache.set(cacheKey, coords);
      return coords;
    }
  } catch {
    // network error — don't cache, allow retry
    return null;
  }

  cache.set(cacheKey, null);
  return null;
}

export async function geocodeCity(city: string, state: string): Promise<[number, number] | null> {
  const key = `${city},${state}`.toLowerCase().trim();
  return mapboxGeocode(`${city}, ${state}`, key);
}

/** Geocode a full street address; falls back to city-level if address query returns nothing. */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
): Promise<[number, number] | null> {
  const key = `${address},${city},${state}`.toLowerCase().trim();
  const result = await mapboxGeocode(`${address}, ${city}, ${state}`, key);
  if (result) return result;
  // Fallback to city-level
  return geocodeCity(city, state);
}
