/**
 * Enterprise-grade geocoding with Google Maps API + Nominatim fallback
 *
 * Fixes the "Nashville → Portland" geocoding issue by using commercial-grade
 * address validation with confidence scoring.
 *
 * Usage:
 *   const result = await geocodeAddressGoogle('123 Main St', 'Nashville', 'TN');
 *   if (result.confidence === 'rooftop') {
 *     // High-accuracy geocoding (exact address)
 *   }
 */

import { geocodeAddress as nominatimFallback } from './geocoding';

// Get API key from environment (set in .env.local)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface GeocodingResult {
  coords: [number, number]; // [latitude, longitude]
  normalized_address: string; // Google-validated address
  confidence: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
  place_id: string; // Google Place ID (unique identifier)
  components: {
    street_number?: string;
    route?: string; // Street name
    locality?: string; // City
    administrative_area_level_1?: string; // State
    postal_code?: string;
    country?: string;
  };
}

/**
 * Geocode an address using Google Maps Geocoding API
 *
 * @param address - Street address (e.g., "123 Main St")
 * @param city - City name (e.g., "Nashville")
 * @param state - State code (e.g., "TN")
 * @returns Geocoding result with coordinates, normalized address, and confidence
 */
export async function geocodeAddressGoogle(
  address: string,
  city: string,
  state: string,
): Promise<GeocodingResult | null> {
  // If no API key, fall back to Nominatim
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
    console.warn('[geocoding] Google Maps API key not configured, falling back to Nominatim');
    const nominatimResult = await nominatimFallback(address, city, state);
    if (!nominatimResult) return null;

    // Map Nominatim result to GeocodingResult interface
    return {
      coords: nominatimResult,
      normalized_address: `${address}, ${city}, ${state}`,
      confidence: 'APPROXIMATE', // Nominatim doesn't provide confidence
      place_id: '', // Nominatim doesn't have Place IDs
      components: {},
    };
  }

  try {
    const query = `${address}, ${city}, ${state}, USA`;
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('[geocoding] Google Maps API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // Check for API errors
    if (data.status === 'ZERO_RESULTS') {
      console.warn('[geocoding] No results found for:', query);
      return null;
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      console.error('[geocoding] Google Maps quota exceeded, falling back to Nominatim');
      const nominatimResult = await nominatimFallback(address, city, state);
      if (!nominatimResult) return null;
      return {
        coords: nominatimResult,
        normalized_address: `${address}, ${city}, ${state}`,
        confidence: 'APPROXIMATE',
        place_id: '',
        components: {},
      };
    }

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('[geocoding] Google Maps API returned status:', data.status);
      return null;
    }

    const result = data.results[0];

    // Extract address components
    const components: GeocodingResult['components'] = {};
    for (const component of result.address_components || []) {
      const type = component.types[0];
      const value = component.long_name;

      if (type === 'street_number') components.street_number = value;
      else if (type === 'route') components.route = value;
      else if (type === 'locality') components.locality = value;
      else if (type === 'administrative_area_level_1')
        components.administrative_area_level_1 = component.short_name; // e.g., "TN"
      else if (type === 'postal_code') components.postal_code = value;
      else if (type === 'country') components.country = component.short_name;
    }

    return {
      coords: [result.geometry.location.lat, result.geometry.location.lng],
      normalized_address: result.formatted_address,
      confidence: result.geometry.location_type,
      place_id: result.place_id,
      components,
    };
  } catch (error) {
    console.error('[geocoding] Google Maps API exception:', error);
    return null;
  }
}

/**
 * Geocode a city-level location (no street address)
 *
 * @param city - City name
 * @param state - State code
 * @returns Geocoding result for city center
 */
export async function geocodeCityGoogle(
  city: string,
  state: string,
): Promise<GeocodingResult | null> {
  return geocodeAddressGoogle('', city, state);
}

/**
 * Reverse geocode coordinates to an address
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Closest address to the given coordinates
 */
export async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
): Promise<GeocodingResult | null> {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
    console.warn('[geocoding] Google Maps API key not configured');
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('[geocoding] Google Maps API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];

    // Extract components
    const components: GeocodingResult['components'] = {};
    for (const component of result.address_components || []) {
      const type = component.types[0];
      const value = component.long_name;

      if (type === 'street_number') components.street_number = value;
      else if (type === 'route') components.route = value;
      else if (type === 'locality') components.locality = value;
      else if (type === 'administrative_area_level_1')
        components.administrative_area_level_1 = component.short_name;
      else if (type === 'postal_code') components.postal_code = value;
      else if (type === 'country') components.country = component.short_name;
    }

    return {
      coords: [lat, lng],
      normalized_address: result.formatted_address,
      confidence: result.geometry.location_type,
      place_id: result.place_id,
      components,
    };
  } catch (error) {
    console.error('[geocoding] Reverse geocoding exception:', error);
    return null;
  }
}

/**
 * Validate an address and get suggestions
 *
 * Returns multiple geocoding results if the address is ambiguous.
 * Useful for "Did you mean?" UI flows.
 *
 * @param address - Address to validate
 * @param city - City
 * @param state - State
 * @param maxResults - Maximum number of results to return (default 3)
 * @returns Array of geocoding results, sorted by confidence
 */
export async function validateAddress(
  address: string,
  city: string,
  state: string,
  maxResults: number = 3,
): Promise<GeocodingResult[]> {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
    const result = await geocodeAddressGoogle(address, city, state);
    return result ? [result] : [];
  }

  try {
    const query = `${address}, ${city}, ${state}, USA`;
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return [];
    }

    // Convert all results to GeocodingResult format
    const results: GeocodingResult[] = data.results.slice(0, maxResults).map((result: any) => {
      const components: GeocodingResult['components'] = {};
      for (const component of result.address_components || []) {
        const type = component.types[0];
        const value = component.long_name;

        if (type === 'street_number') components.street_number = value;
        else if (type === 'route') components.route = value;
        else if (type === 'locality') components.locality = value;
        else if (type === 'administrative_area_level_1')
          components.administrative_area_level_1 = component.short_name;
        else if (type === 'postal_code') components.postal_code = value;
        else if (type === 'country') components.country = component.short_name;
      }

      return {
        coords: [result.geometry.location.lat, result.geometry.location.lng],
        normalized_address: result.formatted_address,
        confidence: result.geometry.location_type,
        place_id: result.place_id,
        components,
      };
    });

    // Sort by confidence (ROOFTOP > RANGE_INTERPOLATED > GEOMETRIC_CENTER > APPROXIMATE)
    const confidenceOrder: Record<string, number> = {
      ROOFTOP: 0,
      RANGE_INTERPOLATED: 1,
      GEOMETRIC_CENTER: 2,
      APPROXIMATE: 3,
    };

    results.sort((a, b) => {
      return (confidenceOrder[a.confidence] ?? 99) - (confidenceOrder[b.confidence] ?? 99);
    });

    return results;
  } catch (error) {
    console.error('[geocoding] Address validation exception:', error);
    return [];
  }
}

/**
 * Get confidence level as human-readable text
 */
export function getConfidenceLabel(confidence: GeocodingResult['confidence']): string {
  switch (confidence) {
    case 'ROOFTOP':
      return 'Exact address';
    case 'RANGE_INTERPOLATED':
      return 'Approximate (interpolated)';
    case 'GEOMETRIC_CENTER':
      return 'Geometric center';
    case 'APPROXIMATE':
      return 'City-level';
    default:
      return 'Unknown';
  }
}
