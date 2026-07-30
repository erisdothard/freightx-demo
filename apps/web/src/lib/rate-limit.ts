/**
 * Rate Limiting Utility
 *
 * Uses Upstash Redis for serverless-friendly rate limiting.
 *
 * Setup:
 * 1. Sign up at https://upstash.com (free tier available)
 * 2. Create a Redis database
 * 3. Add credentials to .env.local:
 *    VITE_UPSTASH_REDIS_REST_URL=https://...
 *    VITE_UPSTASH_REDIS_REST_TOKEN=...
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: import.meta.env.VITE_UPSTASH_REDIS_REST_URL || '',
  token: import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || '',
});

// Rate limiters for different use cases
export const rateLimiters = {
  // API calls: 100 requests per minute per user
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  // Authentication: 5 attempts per 15 minutes per IP
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Load posting: 20 posts per hour per user
  loadPost: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'ratelimit:load-post',
  }),

  // Bid submission: 50 bids per hour per user
  bidSubmit: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 h'),
    analytics: true,
    prefix: 'ratelimit:bid-submit',
  }),

  // Message sending: 100 messages per hour per user
  message: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 h'),
    analytics: true,
    prefix: 'ratelimit:message',
  }),
};

/**
 * Check rate limit for a given identifier
 *
 * @param limiter - The rate limiter to use
 * @param identifier - Unique identifier (user ID, IP address, etc.)
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    return {
      success,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting service is down
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public remaining: number,
    public reset: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Enforce rate limit - throws error if limit exceeded
 *
 * @param limiter - The rate limiter to use
 * @param identifier - Unique identifier
 * @throws RateLimitError if rate limit exceeded
 */
export async function enforceRateLimit(limiter: Ratelimit, identifier: string): Promise<void> {
  const result = await checkRateLimit(limiter, identifier);

  if (!result.success) {
    throw new RateLimitError(
      'Rate limit exceeded. Please try again later.',
      result.limit,
      result.remaining,
      result.reset,
    );
  }
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: number;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Example usage in a service:
 *
 * ```typescript
 * import { rateLimiters, enforceRateLimit } from '@/lib/rate-limit';
 *
 * export async function createLoad(userId: string, data: LoadData) {
 *   // Check rate limit
 *   await enforceRateLimit(rateLimiters.loadPost, userId);
 *
 *   // Proceed with load creation
 *   const load = await supabase.from('loads').insert(data);
 *   return load;
 * }
 * ```
 */
