# Phase 19 — Live Load Operations (Production Readiness)

**Status:** ✅ Complete
**Date:** 2026-03-30

## Goals

Five surgical fixes/additions required before go-live with live loads: street-level GPS accuracy, a mobile-safe equipment picker, team member assignment to loads, a signed BOL download for both parties, and a general-purpose incident log replacing the tire-only form.

---

## What Was Built

### Migration 050 — Load Assignee

- **`database/migrations/050-load-assignee.sql`**
  - `ALTER TABLE loads ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL`
  - Allows a broker/dispatcher team member to be assigned as responsible party for a load

### Migration 051 — Driver Incidents Table

- **`database/migrations/051-driver-incidents.sql`**
  - New `driver_incidents` table — replaces the narrower `tire_incidents` table for general vehicle/driver incident tracking
  - Columns: `id`, `driver_id`, `load_number`, `incident_type`, `severity`, `description`, `location_text`, `lat`, `lng`, `incident_date`, `resolution_notes`, `resolved_at`, `photos[]`, `created_at`
  - `incident_type` enum: `tire | engine | brake | lights | body_damage | accident | driver_illness | cargo | fuel | other`
  - `severity` enum: `minor | moderate | severe | critical`
  - RLS policies: driver owns own rows; company members with same company can read

---

### 1. GPS Map Accuracy — Street-Level Pin Geocoding

**Problem:** `MapView` geocoded `{ city, state }` → city-center lat/lng. Pins landed at city level, not at the actual pickup/delivery address.

- **`apps/web/src/lib/geocoding.ts`**
  - Refactored internal `nominatimQuery()` helper (shared by both functions)
  - Added `geocodeAddress(address, city, state)` — queries Nominatim with full street address; falls back to city-level geocoding if the address query returns nothing
  - Cache keyed on full query string (address+city+state) — no redundant requests

- **`apps/web/src/shared/components/map-view.tsx`**
  - Added optional props: `originAddress?: string`, `destAddress?: string`
  - When provided, calls `geocodeAddress()` instead of `geocodeCity()` for origin/dest pins
  - Effect dep array updated to re-geocode when addresses change

- **`apps/web/src/pages/tracking.tsx`** — passes `originAddress` + `destAddress` from load when `gpsEligible`
- **`apps/web/src/pages/public-tracking.tsx`** — same

---

### 2. Signed BOL Viewer — Printable Download for Both Parties

**Problem:** After signing, neither driver, carrier, nor broker could get a single file with the signature image embedded.

- **`apps/web/src/features/documents/components/signed-bol-viewer.tsx`** (new)
  - Modal component compositing: load details, equipment/dates/rate, signatory name, signed timestamp, signature PNG
  - "Download / Print" button triggers `window.print()` with print CSS that hides all UI chrome and renders the BOL content in black-on-white
  - "View Original BOL File" link to underlying document URL

- **`apps/web/src/pages/driver/documents.tsx`**
  - Signed BOL doc actions now show "View Signed BOL" button (green) instead of the generic download icon
  - Added `viewingSignedBol` state + `SignedBolViewer` rendered at bottom of page

- **`apps/web/src/features/loads/components/load-detail-sheet.tsx`**
  - Imported `SignedBolViewer` and `getDocumentsForLoad`
  - Added "View Signed BOL" button in documents section (visible whenever `showDocs` is true for broker/carrier)
  - Fetches documents on click, finds the signed BOL, renders viewer in portal

---

### 3. Equipment Pill Selector — iOS Mobile Fix

**Problem:** Native `<select>` for equipment type doesn't render options reliably on iOS dark mode (options appear invisible or with wrong backgrounds).

- **`apps/web/src/features/loads/components/post-load-sheet.tsx`** (lines 363–380)
  - Replaced `<select>` with a `flex flex-wrap` pill grid — one `<button>` per equipment type
  - Selected pill: orange bg + border (`rgba(232,96,48,0.18)` / `rgba(232,96,48,0.6)`)
  - Unselected pill: subtle dark bg, dim text
  - No iOS color-scheme issues — fully custom rendered

---

### 4. Broker Portal — Team Member Assignment

**Problem:** No way to assign a company dispatcher/member to manage a load after posting.

- **`apps/web/src/features/loads/components/post-load-sheet.tsx`**
  - Added `EMPTY_FORM.assigneeId: string | null`
  - Added `CompanyMember` interface
  - On open, fetches `company_members` joined with `profiles` for the current company
  - Renders single-select member pill list ("Assign To (Optional)" section), tap to toggle
  - Passes `assignee_id: form.assigneeId` to `createLoad()`

- **`apps/web/src/lib/schemas/loads.schema.ts`** — added `assignee_id: z.string().uuid().optional().nullable()` to `CreateLoadInputSchema`

- **`apps/web/src/lib/database.types.ts`** — added `assignee_id: string | null` to loads `Row`, `Insert`, `Update` types

- **`packages/shared/src/types/index.ts`** — added `assigneeId?: string | null` to `Load` interface

- **`apps/web/src/lib/mappers.ts`** — maps `row.assignee_id ?? null` → `assigneeId`

- **`apps/web/src/features/loads/components/load-card.tsx`** — shows "Assigned" sky-blue badge when `load.assigneeId` is set

---

### 5. Driver Incident Log — Expanded from Tire-Only

**Problem:** Tire log only covered tire incidents. Drivers needed to document all vehicle/driver issues with the same GPS + photo + load-association UX.

- **`apps/web/src/services/driver-incidents.service.ts`** (new)
  - Types: `IncidentType`, `IncidentSeverity`, `DriverIncident`
  - `getDriverIncidents(driverId)` — fetches all incidents, newest first
  - `createDriverIncident(params)` — inserts new row into `driver_incidents`
  - `uploadIncidentPhoto(file, driverId)` — uploads to `incident-photos` bucket; falls back to `tire-photos/incidents/` if bucket doesn't exist yet

- **`apps/web/src/features/driver/components/incident-form.tsx`** (new)
  - Replaces `TireIncidentForm` as the primary incident capture UI
  - 10 incident types displayed as emoji + label 2-column pill grid
  - 4 severity pills color-coded (green/yellow/orange/red)
  - Auto-fills GPS coordinates and location text on open
  - Active load selector (pill list of `in_transit | dispatched | awarded` loads)
  - Description textarea + photo capture (file picker + camera)
  - Saves to `driver_incidents` via service

- **`apps/web/src/pages/driver/tire-log.tsx`** — fully repurposed to "Incident Log"
  - Now imports from `driver-incidents.service.ts` and `IncidentForm`
  - Page title: "Incident Log"
  - Cards display incident type (emoji + label), severity badge, resolved badge, date, location, description, load number, photos
  - FAB opens `IncidentForm` (not `TireIncidentForm`)
  - Old tire-specific display logic removed

---

## Files Changed

- `database/migrations/050-load-assignee.sql` — new
- `database/migrations/051-driver-incidents.sql` — new
- `apps/web/src/lib/geocoding.ts` — geocodeAddress() + refactor
- `apps/web/src/shared/components/map-view.tsx` — originAddress/destAddress props
- `apps/web/src/pages/tracking.tsx` — pass address props to MapView
- `apps/web/src/pages/public-tracking.tsx` — pass address props to MapView
- `apps/web/src/features/loads/components/post-load-sheet.tsx` — equipment pills + assignee picker
- `apps/web/src/lib/schemas/loads.schema.ts` — assignee_id field
- `apps/web/src/lib/database.types.ts` — assignee_id on loads types
- `packages/shared/src/types/index.ts` — assigneeId on Load interface
- `apps/web/src/lib/mappers.ts` — map assignee_id
- `apps/web/src/features/loads/components/load-card.tsx` — Assigned badge
- `apps/web/src/features/documents/components/signed-bol-viewer.tsx` — new
- `apps/web/src/pages/driver/documents.tsx` — View Signed BOL button
- `apps/web/src/features/loads/components/load-detail-sheet.tsx` — View Signed BOL button
- `apps/web/src/services/driver-incidents.service.ts` — new
- `apps/web/src/features/driver/components/incident-form.tsx` — new
- `apps/web/src/pages/driver/tire-log.tsx` — repurposed to Incident Log
