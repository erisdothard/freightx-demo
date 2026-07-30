/**
 * Redis Location Cache
 *
 * Caches driver GPS locations in Redis to reduce database load from
 * dashboard queries. Fleet dashboards typically refresh every 3-5 seconds,
 * which would hammer PostgreSQL without caching.
 *
 * Performance improvement:
 * - Before: 1000 dashboard refreshes/min = 1000 DB queries/min
 * - After: 1000 dashboard refreshes/min = ~20 DB queries/min (only on cache miss)
 *
 * Setup:
 * 1. Sign up for Upstash Redis: https://upstash.com
 * 2. Create a database, copy REST URL and token
 * 3. Add to .env.local:
 *    VITE_UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
 *    VITE_UPSTASH_REDIS_REST_TOKEN=your-token-here
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client (serverless-friendly, uses REST API)
const redis = new Redis({
  url: import.meta.env.VITE_UPSTASH_REDIS_REST_URL,
  token: import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN,
});

export interface CachedLocationPing {
  driver_id: string;
  load_number: string | null;
  latitude: number;
  longitude: number;
  speed_ms: number | null;
  heading_deg: number | null;
  accuracy_m: number | null;
  recorded_at: string; // ISO timestamp
}

/**
 * Cache a driver's latest GPS ping
 *
 * @param driverId - Driver UUID
 * @param ping - GPS ping data
 * @param ttl - Time-to-live in seconds (default 60s)
 */
export async function cacheDriverLocation(
  driverId: string,
  ping: CachedLocationPing,
  ttl: number = 60,
): Promise<void> {
  const key = `driver:location:${driverId}`;

  try {
    await redis.setex(key, ttl, JSON.stringify(ping));
  } catch (error) {
    console.error('[RedisCache] Failed to cache driver location:', error);
    // Don't throw - caching is non-critical
  }
}

/**
 * Get a driver's cached location
 *
 * @param driverId - Driver UUID
 * @returns Cached ping or null if not found/expired
 */
export async function getDriverLocation(driverId: string): Promise<CachedLocationPing | null> {
  const key = `driver:location:${driverId}`;

  try {
    const cached = await redis.get<string>(key);
    if (!cached) return null;

    return JSON.parse(cached);
  } catch (error) {
    console.error('[RedisCache] Failed to get driver location:', error);
    return null;
  }
}

/**
 * Cache multiple driver locations in batch
 *
 * More efficient than calling cacheDriverLocation multiple times
 *
 * @param pings - Array of driver pings to cache
 * @param ttl - Time-to-live in seconds
 */
export async function cacheDriverLocationsBatch(
  pings: CachedLocationPing[],
  ttl: number = 60,
): Promise<void> {
  try {
    const pipeline = redis.pipeline();

    for (const ping of pings) {
      const key = `driver:location:${ping.driver_id}`;
      pipeline.setex(key, ttl, JSON.stringify(ping));
    }

    await pipeline.exec();
  } catch (error) {
    console.error('[RedisCache] Failed to batch cache driver locations:', error);
  }
}

/**
 * Get multiple driver locations in batch
 *
 * @param driverIds - Array of driver UUIDs
 * @returns Map of driver ID to cached ping (missing drivers excluded)
 */
export async function getDriverLocationsBatch(
  driverIds: string[],
): Promise<Map<string, CachedLocationPing>> {
  const results = new Map<string, CachedLocationPing>();

  if (driverIds.length === 0) return results;

  try {
    const keys = driverIds.map((id) => `driver:location:${id}`);
    const values = await redis.mget<string[]>(...keys);

    for (let i = 0; i < driverIds.length; i++) {
      const value = values[i];
      if (value) {
        try {
          results.set(driverIds[i], JSON.parse(value));
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return results;
  } catch (error) {
    console.error('[RedisCache] Failed to batch get driver locations:', error);
    return results;
  }
}

/**
 * Invalidate a driver's cached location
 *
 * Use when driver goes off-duty or data becomes stale
 *
 * @param driverId - Driver UUID
 */
export async function invalidateDriverLocation(driverId: string): Promise<void> {
  const key = `driver:location:${driverId}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('[RedisCache] Failed to invalidate driver location:', error);
  }
}

/**
 * Cache load tracking data (for broker/shipper dashboards)
 *
 * @param loadNumber - Load number
 * @param data - Tracking data (GPS, ETA, status)
 * @param ttl - Time-to-live in seconds
 */
export async function cacheLoadTracking(
  loadNumber: string,
  data: {
    current_location: { lat: number; lng: number } | null;
    eta_minutes: number | null;
    status: string;
    last_ping_at: string | null;
  },
  ttl: number = 30,
): Promise<void> {
  const key = `load:tracking:${loadNumber}`;

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('[RedisCache] Failed to cache load tracking:', error);
  }
}

/**
 * Get cached load tracking data
 *
 * @param loadNumber - Load number
 * @returns Cached tracking data or null
 */
export async function getLoadTracking(loadNumber: string): Promise<{
  current_location: { lat: number; lng: number } | null;
  eta_minutes: number | null;
  status: string;
  last_ping_at: string | null;
} | null> {
  const key = `load:tracking:${loadNumber}`;

  try {
    const cached = await redis.get<string>(key);
    if (!cached) return null;

    return JSON.parse(cached);
  } catch (error) {
    console.error('[RedisCache] Failed to get load tracking:', error);
    return null;
  }
}

/**
 * Monitor cache hit rate
 *
 * Call this periodically to track cache effectiveness
 *
 * @returns Cache statistics
 */
export async function getCacheStats(): Promise<{
  total_keys: number;
  driver_location_keys: number;
  load_tracking_keys: number;
  memory_used_mb: number | null;
}> {
  try {
    // Count keys by pattern
    const allKeys = await redis.keys('*');
    const driverKeys = allKeys.filter((k) => k.startsWith('driver:location:'));
    const loadKeys = allKeys.filter((k) => k.startsWith('load:tracking:'));

    // Get memory usage (Upstash REST API doesn't support INFO command)
    // Memory stats would need to be fetched from Upstash dashboard

    return {
      total_keys: allKeys.length,
      driver_location_keys: driverKeys.length,
      load_tracking_keys: loadKeys.length,
      memory_used_mb: null, // Not available via REST API
    };
  } catch (error) {
    console.error('[RedisCache] Failed to get cache stats:', error);
    return {
      total_keys: 0,
      driver_location_keys: 0,
      load_tracking_keys: 0,
      memory_used_mb: null,
    };
  }
}

/**
 * Flush all cached location data
 *
 * Use only for debugging/testing
 */
export async function flushLocationCache(): Promise<void> {
  try {
    const keys = await redis.keys('driver:location:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    const loadKeys = await redis.keys('load:tracking:*');
    if (loadKeys.length > 0) {
      await redis.del(...loadKeys);
    }

    console.log('[RedisCache] Flushed all location cache keys');
  } catch (error) {
    console.error('[RedisCache] Failed to flush location cache:', error);
  }
}
