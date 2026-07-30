# Phase 15 — Infrastructure Hardening

**Status:** ✅ Complete
**Date:** 2026-03-30

## Goals

Security and performance foundations before scaling: Zod validation at service boundaries, React Query for caching, and deduplication of Supabase Realtime subscriptions.

## What Was Built

### Zod Validation

- Installed `zod` in `apps/web/`
- Created `apps/web/src/lib/schemas/` with four domain schema files:
  - `loads.schema.ts` — `LoadFiltersSchema`, `CreateLoadInputSchema`
  - `bids.schema.ts` — `SubmitBidInputSchema`, `CounterOfferInputSchema`
  - `trucks.schema.ts` — `PostTruckInputSchema`, `TruckFiltersSchema`
  - `profiles.schema.ts` — `UpdateProfileInputSchema`
- Wired into `loads.service.ts`, `bids.service.ts`, `trucks.service.ts` — `Schema.parse(input)` at top of each mutating function
- Wired into `supabase/functions/ai-load-search/index.ts` — full request body schema validation with `safeParse` and structured error response

### React Query

- Installed `@tanstack/react-query` in `apps/web/`
- Wrapped `apps/web/src/main.tsx` with `QueryClientProvider` (`staleTime: 30s`, `gcTime: 5min`)
- Migrated `features/loads/hooks/use-loads.ts` to use `useQuery(['loads', filterKey], ...)` for initial page fetch; infinite scroll via manual `getLoadsPage()` calls; Realtime invalidates the query cache

### Realtime Manager

- Created `apps/web/src/lib/realtime-manager.ts` — singleton that tracks active channel subscriptions by key
- `use-loads.ts` now uses `realtimeSubscribe()` instead of raw `supabase.channel()` — prevents duplicate WebSocket channels when multiple components mount

## Files Changed

- `apps/web/package.json` — added `zod`, `@tanstack/react-query`
- `apps/web/src/main.tsx` — QueryClientProvider wraps the app
- `apps/web/src/lib/schemas/` — 4 new schema files
- `apps/web/src/lib/realtime-manager.ts` — new
- `apps/web/src/features/loads/hooks/use-loads.ts` — migrated to React Query
- `apps/web/src/services/loads.service.ts` — Zod validation added
- `apps/web/src/services/bids.service.ts` — Zod validation added
- `apps/web/src/services/trucks.service.ts` — Zod validation added
- `supabase/functions/ai-load-search/index.ts` — Zod body validation added
