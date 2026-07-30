/**
 * Vercel Edge Middleware — FreightX Phase 13D
 * Real sliding-window rate limiting for API-adjacent routes.
 * Runs at the edge before the request reaches the origin.
 *
 * Limits (per IP, per minute window):
 *   - /api/loads/post   → 10 requests
 *   - /api/bids         → 30 requests
 *   - /api/ai-search    → 20 requests
 *   - /api/messages     → 60 requests
 *
 * Storage: Supabase (via direct REST) or Vercel KV if available.
 * Falls back to passthrough if storage unavailable (never blocks legitimate traffic).
 */

import { NextRequest, NextResponse } from 'next/server';

// Rate limit rules: [path prefix, max requests per window, window seconds]
const RULES: [string, number, number][] = [
  ['/api/loads/post', 10, 60],
  ['/api/bids', 30, 60],
  ['/api/ai-search', 20, 60],
  ['/api/messages', 60, 60],
];

export const config = {
  matcher: ['/api/:path*'],
};

export default async function middleware(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const path = req.nextUrl.pathname;

  const rule = RULES.find(([prefix]) => path.startsWith(prefix));
  if (!rule) return NextResponse.next();

  const [prefix, maxRequests, windowSeconds] = rule;
  const key = `rl:${ip}:${prefix}`;

  try {
    // Use Vercel KV if available (set KV_REST_API_URL env in Vercel dashboard)
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (kvUrl && kvToken) {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSeconds;

      // Sliding window using sorted set in Vercel KV
      const headers = {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      };

      // ZADD current timestamp, ZREMRANGEBYSCORE old entries, ZCARD count
      const pipeline = [
        ['ZADD', key, now, `${now}-${Math.random()}`],
        ['ZREMRANGEBYSCORE', key, '-inf', windowStart],
        ['ZCARD', key],
        ['EXPIRE', key, windowSeconds],
      ];

      const resp = await fetch(`${kvUrl}/pipeline`, {
        method: 'POST',
        headers,
        body: JSON.stringify(pipeline),
      });

      if (resp.ok) {
        const results = (await resp.json()) as { result: number }[];
        const count = results[2]?.result ?? 0;

        if (count > maxRequests) {
          return new NextResponse(
            JSON.stringify({ error: 'Rate limit exceeded', retryAfter: windowSeconds }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(windowSeconds),
                'X-RateLimit-Limit': String(maxRequests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(now + windowSeconds),
              },
            },
          );
        }

        const response = NextResponse.next();
        response.headers.set('X-RateLimit-Limit', String(maxRequests));
        response.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
        response.headers.set('X-RateLimit-Reset', String(now + windowSeconds));
        return response;
      }
    }
  } catch {
    // Rate limit storage unavailable — passthrough (fail open)
    console.warn('[rate-limit] Storage unavailable, passthrough');
  }

  return NextResponse.next();
}
