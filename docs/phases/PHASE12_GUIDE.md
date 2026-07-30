# Phase 12 — GPS Real-Time Tracking

**Status:** Complete

**Migrations:**

- `012-location-pings.sql` — location_pings table (lat, lng, accuracy_m, heading_deg, speed_ms); composite index on (load_number, recorded_at desc); RLS: drivers insert own pings, authenticated users read

**Key files added:**

- `apps/web/src/features/loads/hooks/use-driver-location.ts` — watches browser Geolocation API; smart interval: write ping only when 30s elapsed OR ≥50m moved (Haversine distance)
- `apps/web/src/features/loads/hooks/use-live-tracking.ts` — fetches latest ping on mount; subscribes to Supabase Realtime INSERT events per load
- `apps/web/src/features/loads/lib/location.ts` — LocationPing interface and insertLocationPing() utility
- `apps/web/src/features/loads/components/gps-consent-modal.tsx` — driver GPS permission consent modal shown before tracking starts
- `supabase/functions/location-cleanup/index.ts` — deletes pings older than 24 hours; scheduled via pg_cron hourly

**Features delivered:**

- Driver GPS position streaming via Web Geolocation API (watchPosition)
- Smart ping threshold: only writes when 30 seconds elapsed OR ≥50 metres moved
- Graceful no-op when browser denies geolocation permission
- Live tracking map updates in real time as driver moves (Supabase Realtime postgres_changes)
- Most recent ping fetched on initial load for immediate map display
- GPS consent modal shown to driver before pinging starts
- Cleanup edge function prunes raw pings older than 24 hours hourly via pg_cron
- Permanent route history stored in tracking_milestones table (separate from raw pings)
