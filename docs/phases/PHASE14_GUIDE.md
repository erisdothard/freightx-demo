# Phase 14 — Driver Tools, Advanced Tracking, RLS Hardening

**Status:** Complete

**Migrations:**

- `026-driver-role.sql` — adds `driver` as a valid profile role
- `027-driver-assignment.sql` — assigned_driver_id FK on loads
- `034-document-signature-columns.sql` — signature columns on documents table
- `035-load-full-address.sql` — origin_address, origin_zip, dest_address, dest_zip on loads (hidden until booking)
- `037-breadcrumb-trail.sql` — breadcrumb_snapshots table (compressed polyline per completed load)
- `038-public-tracking-tokens.sql` — tracking_tokens table; anon RLS read for public tracking page
- `039-geofences.sql` — geofences + geofence_events tables; alert-only, no auto status change
- `040-dwell-time.sql` — dwell_records with GENERATED dwell_minutes; detention_flagged auto-set at ≥120 min
- `040-co-driver.sql` — second_driver_id FK on loads for team driving
- `041-driver-scores.sql` — driver_scores table (overall, speed, route, dwell scores per load)
- `042-location-pings-rls-tighten.sql` — restricts location ping reads to load parties only
- `043-flat-tire-log.sql` — tire_incidents table; tire-photos Storage bucket
- `044-receipts.sql` — receipts table with 8 expense categories; receipts Storage bucket
- `045-fix-company-members-visibility.sql` — SECURITY DEFINER get_my_company_ids() resolves circular RLS on company_members

**Key files added:**

- `pages/driver/dashboard.tsx` — active load, GPS pinger toggle, quick stats
- `pages/driver/loads.tsx` — assigned loads with status filter
- `pages/driver/documents.tsx` — BOL, POD, rate confirmation viewer
- `pages/driver/receipts.tsx` — receipt capture (camera or manual entry)
- `pages/driver/expenses.tsx` — expense summary grouped by category with totals
- `pages/driver/tire-log.tsx` — tire incident history and log
- `pages/driver/team.tsx` — carrier view of all company drivers
- `pages/public-tracking.tsx` — token-authenticated public tracking page (no login required)
- `features/loads/components/route-replay-slider.tsx` — breadcrumb timeline scrub slider (post-delivery)
- `features/loads/components/dwell-time-card.tsx` — live dwell clock and detention status indicator
- `features/driver/components/tire-incident-form.tsx` — log tire flat/blowout/low-pressure/damage with photo
- `features/driver/components/tire-position-selector.tsx` — visual truck diagram for tire position selection
- `features/driver/components/receipt-capture-sheet.tsx` — camera capture or manual receipt entry with categories
- `services/geofence.service.ts` — create geofences, detect crossings, fire in-app alerts
- `services/dwell-time.service.ts` — open/close dwell records, auto-flag detention at ≥120 min
- `services/driver-score.service.ts` — compute and store post-delivery scores (speed, route, dwell)
- `services/tire-incidents.service.ts` — tire incident CRUD and photo management
- `services/receipts.service.ts` — receipt CRUD and category expense totals
- `services/tracking-tokens.service.ts` — create, validate, and revoke public tracking tokens

**Features delivered:**

- Driver role with access scoped to assigned loads only
- Full street addresses on loads: visible only after booking (city/state only on board for carriers)
- Co-driver assignment (second_driver_id) for team driving
- Breadcrumb trail: compressed polyline snapshot on delivery; post-delivery route replay with timeline slider
- Public shareable tracking links: token-based, no login required, 7-day expiry, revokable
- Geofencing: virtual zones around pickup/delivery with in-app alert on zone crossing (does NOT auto-change load status)
- Dwell time tracking with automatic detention flag at ≥120 minutes
- Driver score per load (0–100 composite: speed adherence, route adherence, dwell efficiency)
- Tire incident log: flat/blowout/low-pressure/damage with position selector and photo upload
- Receipt capture (photo or manual) with category-grouped expense summary
- Full driver dashboard suite: 7 pages covering dashboard, loads, documents, receipts, expenses, tire log, team
- RLS hardened: location pings scoped to load parties; company members circular RLS resolved via SECURITY DEFINER helper function
