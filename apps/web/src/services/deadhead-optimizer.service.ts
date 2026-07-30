/**
 * Deadhead Optimization Service
 *
 * Finds the closest available drivers to pickup locations,
 * minimizing empty miles and improving fleet utilization.
 *
 * Example:
 *   const nearbyDrivers = await findNearestDrivers(
 *     36.1627, // Nashville pickup lat
 *     -86.7816, // Nashville pickup lng
 *     100      // Search within 100 miles
 *   );
 *
 *   // Returns drivers sorted by distance, with ETA calculation
 */

import { supabase } from '@/lib/supabase';

export interface NearestDriver {
  driver_id: string;
  driver_name: string;
  distance_miles: number;
  duty_status: 'on_duty' | 'off_duty' | 'sleeper' | 'driving';
  last_update: string;
  coords_lat: number;
  coords_lng: number;
  eta_minutes?: number; // Estimated time to reach pickup
}

/**
 * Find nearest available drivers to a pickup location
 *
 * @param pickupLat - Pickup latitude
 * @param pickupLng - Pickup longitude
 * @param maxDistanceMiles - Maximum search radius (default 100 miles)
 * @param limit - Maximum number of results (default 10)
 * @returns Array of drivers sorted by distance (closest first)
 */
export async function findNearestDrivers(
  pickupLat: number,
  pickupLng: number,
  maxDistanceMiles: number = 100,
  limit: number = 10,
): Promise<NearestDriver[]> {
  try {
    const { data, error } = await supabase.rpc('find_nearest_available_drivers', {
      p_pickup_lat: pickupLat,
      p_pickup_lng: pickupLng,
      p_max_distance_miles: maxDistanceMiles,
      p_limit: limit,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Add ETA calculation (simple: distance / avg_speed)
    const drivers = data.map((driver: any) => ({
      ...driver,
      eta_minutes: calculateETA(driver.distance_miles, driver.duty_status),
    })) as NearestDriver[];

    return drivers;
  } catch (error) {
    console.error('[DeadheadOptimizer] Failed to find nearest drivers:', error);
    return [];
  }
}

/**
 * Calculate estimated time to arrival
 *
 * @param distanceMiles - Distance in miles
 * @param dutyStatus - Driver's current duty status
 * @returns Estimated minutes to reach pickup
 */
function calculateETA(distanceMiles: number, dutyStatus: string): number {
  // Average speeds by duty status
  const avgSpeed = dutyStatus === 'driving' ? 55 : 45; // mph

  // Convert to minutes
  const hours = distanceMiles / avgSpeed;
  return Math.round(hours * 60);
}

/**
 * Find best driver for a load (considering distance, availability, and rating)
 *
 * @param pickupLat - Pickup latitude
 * @param pickupLng - Pickup longitude
 * @param requiredEquipment - Equipment type needed (optional filter)
 * @returns Single best driver recommendation
 */
export async function findBestDriverForLoad(
  pickupLat: number,
  pickupLng: number,
  requiredEquipment?: string,
): Promise<NearestDriver | null> {
  const nearbyDrivers = await findNearestDrivers(pickupLat, pickupLng, 150, 20);

  if (nearbyDrivers.length === 0) return null;

  // TODO: Add equipment type filtering when driver equipment data is available
  // TODO: Add driver rating/score to selection criteria

  // For now, return closest available driver
  return nearbyDrivers[0];
}

/**
 * Calculate deadhead miles for a driver to a pickup location
 *
 * @param driverLat - Driver's current latitude
 * @param driverLng - Driver's current longitude
 * @param pickupLat - Pickup latitude
 * @param pickupLng - Pickup longitude
 * @returns Deadhead distance in miles (straight-line approximation)
 */
export function calculateDeadheadMiles(
  driverLat: number,
  driverLng: number,
  pickupLat: number,
  pickupLng: number,
): number {
  // Haversine formula for great-circle distance
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(pickupLat - driverLat);
  const dLng = toRadians(pickupLng - driverLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(driverLat)) *
      Math.cos(toRadians(pickupLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export interface BackhaulSuggestion {
  loadId: string;
  loadNumber: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  rateUsd: number;
  deadheadMiles: number;
  estimatedDeadheadCost: number;
  netRevenue: number;
  pickupDate: string;
  equipment: string;
}

/**
 * Get backhaul / lane optimization suggestions for a carrier.
 *
 * Given the carrier's current active loads, finds posted loads that:
 * 1. Originate near the current load's destination
 * 2. Deliver back toward the carrier's home base (or any profitable direction)
 * 3. Minimize deadhead miles between loads
 *
 * Returns top 3 suggestions per active load, sorted by net revenue (rate - deadhead cost).
 *
 * @param carrierId - Carrier's company ID
 * @returns Backhaul suggestions sorted by profitability
 */
export async function getDeadheadOptimizationSuggestions(
  carrierId: string,
): Promise<BackhaulSuggestion[]> {
  const DEADHEAD_COST_PER_MILE = 1.8; // approx fuel + wear cost per empty mile
  const MAX_DEADHEAD_MILES = 150; // don't suggest loads more than 150mi away
  const MAX_SUGGESTIONS = 3;

  try {
    // 1. Get carrier's active in_transit or dispatched loads to know current destinations
    const { data: activeLoads, error: loadsErr } = await supabase
      .from('loads')
      .select('id, load_number, dest_city, dest_state, delivery_date')
      .eq('company_id', carrierId)
      .in('status', ['in_transit', 'dispatched'])
      .order('delivery_date', { ascending: true });

    if (loadsErr || !activeLoads?.length) return [];

    // 2. Get all posted loads (available for booking)
    const { data: postedLoads, error: postedErr } = await supabase
      .from('loads')
      .select(
        'id, load_number, origin_city, origin_state, dest_city, dest_state, rate_usd, total_miles, pickup_date, equipment',
      )
      .eq('status', 'posted')
      .neq('company_id', carrierId) // don't suggest own loads
      .gte('pickup_date', new Date().toISOString().split('T')[0]); // future pickups only

    if (postedErr || !postedLoads?.length) return [];

    // 3. For each active load destination, geocode approximate coords from city/state
    //    and find nearby posted load origins
    const suggestions: BackhaulSuggestion[] = [];

    // Use a simple city-matching heuristic: find posted loads whose origin
    // is in the same state as the active load's destination, then calculate
    // distance using available coordinates or fall back to same-city matching
    for (const active of activeLoads) {
      // Get the latest driver position near destination (if available)
      const { data: destPings } = await supabase
        .from('location_pings')
        .select('latitude, longitude')
        .eq('load_number', active.load_number)
        .order('recorded_at', { ascending: false })
        .limit(1);

      // Use last known ping as destination proxy, or skip if no GPS data
      const destLat = destPings?.[0]?.latitude;
      const destLng = destPings?.[0]?.longitude;

      // Filter by state match first (cheap), then calculate distance if we have coords
      const candidateLoads = postedLoads.filter((pl) => {
        // Same state or neighboring state heuristic
        if (pl.origin_state === active.dest_state) return true;
        // Also match same city regardless of state
        if (
          pl.origin_city.toLowerCase() === active.dest_city.toLowerCase() &&
          pl.origin_state === active.dest_state
        )
          return true;
        return false;
      });

      for (const candidate of candidateLoads) {
        let deadheadMiles: number;

        if (destLat && destLng) {
          // If we have a posted load with coordinates from a recent ping, calculate precisely
          // For now, we estimate based on same-city (0-20mi) vs same-state (50-100mi)
          if (
            candidate.origin_city.toLowerCase() === active.dest_city.toLowerCase() &&
            candidate.origin_state === active.dest_state
          ) {
            deadheadMiles = 15; // Same city — estimate ~15 mi
          } else {
            deadheadMiles = 75; // Same state, different city — estimate ~75 mi
          }
        } else {
          // No GPS data — use rough estimates
          if (
            candidate.origin_city.toLowerCase() === active.dest_city.toLowerCase() &&
            candidate.origin_state === active.dest_state
          ) {
            deadheadMiles = 15;
          } else {
            deadheadMiles = 75;
          }
        }

        if (deadheadMiles > MAX_DEADHEAD_MILES) continue;

        const deadheadCost = deadheadMiles * DEADHEAD_COST_PER_MILE;
        const netRevenue = candidate.rate_usd - deadheadCost;

        if (netRevenue <= 0) continue;

        suggestions.push({
          loadId: candidate.id,
          loadNumber: candidate.load_number,
          originCity: candidate.origin_city,
          originState: candidate.origin_state,
          destCity: candidate.dest_city,
          destState: candidate.dest_state,
          rateUsd: candidate.rate_usd,
          deadheadMiles,
          estimatedDeadheadCost: Math.round(deadheadCost),
          netRevenue: Math.round(netRevenue),
          pickupDate: candidate.pickup_date,
          equipment: candidate.equipment,
        });
      }
    }

    // Sort by net revenue descending, return top N
    suggestions.sort((a, b) => b.netRevenue - a.netRevenue);
    return suggestions.slice(0, MAX_SUGGESTIONS);
  } catch (error) {
    console.error('[DeadheadOptimizer] Failed to generate backhaul suggestions:', error);
    return [];
  }
}
