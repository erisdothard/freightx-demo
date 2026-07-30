# Phase 6 — Testing, Hardening & Launch

**Status:** Complete

**Migrations:**

- `009-webhooks.sql` — webhooks and webhook_deliveries tables with HMAC signature support

**Key files added:**

- `.github/workflows/ci.yml` (final) — lint, format check, typecheck, test, build; E2E tests on PRs
- `supabase/functions/webhook-delivery/` — webhook event delivery with retry and HMAC signature verification
- `supabase/functions/health/` — database + Redis health check endpoint
- `middleware.ts` (Vercel Edge) — Upstash KV sliding-window rate limiting per IP
- `apps/web/src/main.tsx` (updated) — Sentry initialization with session replay

**Features delivered:**

- Vitest unit tests for schemas, utilities, and constants
- Component tests for critical forms and interactions (React Testing Library)
- Playwright E2E happy-path test suites per role (auth, carrier, broker, shipper)
- OWASP Top 10 security review
- Load testing to 1,000 concurrent users
- Code splitting: all routes lazy-loaded, no bundle chunk above 250KB
- Sentry error monitoring with session replay and alerting
- Vercel Speed Insights and Vercel Analytics
- Webhook system: registration, event delivery, retry with exponential backoff, HMAC signature verification
- Health check edge function returning database and Redis status
- Upstash rate limiting on API routes (per IP, sliding window)
- Privacy Policy and Terms of Service pages
- Custom domain, SSL certificate, and SEO meta tags
- Beta invite flow and in-app onboarding checklist
