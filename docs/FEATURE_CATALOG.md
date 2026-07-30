# FreightX — Feature Catalog

**Last audited:** 2026-04-12 (updated Phase 20)
**Audit basis:** Source code in `apps/web/src/features/`, `apps/web/src/services/`, `apps/web/src/pages/`, `database/migrations/`, and `supabase/functions/`

This catalog reflects only what exists in code. It is not a wishlist.

---

## Priority Legend

| Priority          | Meaning                                   |
| ----------------- | ----------------------------------------- |
| **P0 — Critical** | MVP cannot ship without this              |
| **P1 — High**     | Must ship within 90 days of launch        |
| **P2 — Medium**   | Growth phase (v1.1–v1.3)                  |
| **P3 — Low**      | Scale phase / competitive differentiation |

---

## Phase Map

| Phase    | Focus                                                                                           | Status      |
| -------- | ----------------------------------------------------------------------------------------------- | ----------- |
| Phase 0  | Repo, CI/CD, Tooling                                                                            | ✅ Complete |
| Phase 1  | Auth, registration, profiles, companies                                                         | ✅ Complete |
| Phase 2  | Load CRUD, truck CRUD, search, dashboards                                                       | ✅ Complete |
| Phase 3  | Real-time board, chat, notifications                                                            | ✅ Complete |
| Phase 4  | Bidding, booking, rate con, lifecycle, documents                                                | ✅ Complete |
| Phase 5  | Carrier verification, Stripe billing, invoicing, payments, ratings                              | ✅ Complete |
| Phase 6  | Testing, performance, monitoring, launch                                                        | ✅ Complete |
| Phase 7  | Elite Automation Scripts                                                                        | ✅ Complete |
| Phase 8  | Study Guide & Learning Platform                                                                 | ✅ Complete |
| Phase 9  | Apple Maps-Style Live Maps                                                                      | ✅ Complete |
| Phase 10 | Interactive Maps & Profiles                                                                     | ✅ Complete |
| Phase 11 | AI Assisted Load Seeking                                                                        | ✅ Complete |
| Phase 12 | GPS Real-Time Tracking                                                                          | ✅ Complete |
| Phase 13 | Enterprise Completion (email/SMS, teams, templates, e-sig, rate intelligence, scale infra)      | ✅ Complete |
| Phase 14 | Driver Tools, Advanced Tracking, RLS Hardening                                                  | ✅ Complete |
| Phase 15 | Infra hardening (Zod schemas, React Query, realtime dedup)                                      | ✅ Complete |
| Phase 16 | Lane Intelligence (trend charts, popular lanes, market badge)                                   | ✅ Complete |
| Phase 17 | Carrier Finance (risk score, insurance monitoring, factoring)                                   | ✅ Complete |
| Phase 18 | Mobile, Ops & Notifications (Web Push, SMS templates, CSV import)                               | ✅ Complete |
| Phase 19 | Live Load Operations — GPS accuracy, BOL download, equipment pills, assignee, incident log      | ✅ Complete |
| Phase 20 | Enterprise polish — hybrid roles, load editing, BOL signatures, company branding, GPS hardening | ✅ Complete |

---

## Status Legend

| Symbol | Meaning                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------- |
| ✅     | Built and live — component/service/page confirmed in source                                              |
| 🔧     | Partially built — service or component exists but UI/integration is incomplete or unconfirmed end-to-end |
| ❌     | Not built — no code found                                                                                |

---

## 1. Authentication and User Management

**Domain:** Auth, Profiles, Companies

| Feature                                                             | Status | Roles                    | Priority | Phase | Source                                                                                      |
| ------------------------------------------------------------------- | ------ | ------------------------ | -------- | ----- | ------------------------------------------------------------------------------------------- |
| Email/password sign-up and sign-in                                  | ✅     | All                      | P0       | 1     | `AuthContext.tsx`, `pages/login.tsx`                                                        |
| Google OAuth sign-in                                                | ✅     | All                      | P0       | 1     | `AuthContext.tsx`                                                                           |
| Password reset flow                                                 | ✅     | All                      | P0       | 1     | `pages/forgot-password.tsx`, `pages/reset-password.tsx`                                     |
| Multi-step onboarding (email → role → company)                      | ✅     | All                      | P0       | 1     | `pages/onboarding.tsx`, `features/onboarding/`                                              |
| Onboarding checklist for new users                                  | ✅     | All                      | P1       | 1     | `features/onboarding/components/OnboardingChecklist.tsx`                                    |
| Role-based access control (carrier, broker, shipper, driver, admin) | ✅     | All                      | P0       | 1     | `AuthContext.tsx`, `lib/database.types.ts`                                                  |
| Protected routes with role enforcement                              | ✅     | All                      | P0       | 1     | `AuthContext.tsx`                                                                           |
| User profile — view and edit                                        | ✅     | All                      | P0       | 1     | `pages/profile.tsx`, `features/profile/components/edit-profile-sheet.tsx`                   |
| Avatar upload (Supabase Storage)                                    | ✅     | All                      | P1       | 10    | `features/profile/components/edit-profile-sheet.tsx`                                        |
| Company creation and editing                                        | ✅     | Carrier, Broker, Shipper | P0       | 1     | `features/profile/components/edit-company-sheet.tsx`                                        |
| Multi-user company teams (invite by email, role assignment, revoke) | ✅     | Carrier, Broker, Shipper | P1       | 13    | `services/company-members.service.ts`, `features/profile/components/edit-company-sheet.tsx` |
| Company member roles: owner, admin, dispatcher, accounting, viewer  | ✅     | Carrier, Broker, Shipper | P1       | 13    | `services/company-members.service.ts`                                                       |
| Driver role — assigned to carrier company, limited access           | ✅     | Driver                   | P1       | 14    | `database/migrations/026-driver-role.sql`, `AuthContext.tsx`                                |
| Broker+carrier hybrid role capabilities                             | ✅     | Broker, Carrier          | P1       | 20    | `pages/broker/dashboard.tsx`, `pages/carrier/dashboard.tsx`                                 |
| View switcher for broker+carrier hybrid users                       | ✅     | Broker, Carrier          | P1       | 20    | Dashboard pages                                                                             |
| Company logo upload and display (owner-only, auto-save)             | ✅     | Carrier, Broker, Shipper | P2       | 20    | `features/profile/components/edit-company-sheet.tsx`                                        |

---

## 2. Load Board

**Domain:** Loads — Broker/Shipper posting; Carrier/Driver consumption

| Feature                                                                                                                                | Status | Roles                    | Priority | Phase | Source                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------ | -------- | ----- | -------------------------------------------------------------------------------------------- |
| Post a load (multi-field form)                                                                                                         | ✅     | Broker, Shipper          | P0       | 2     | `features/loads/components/post-load-sheet.tsx`                                              |
| Load templates — save and apply                                                                                                        | ✅     | Broker, Shipper          | P1       | 13    | `services/loads.service.ts`, `database/migrations/014-load-templates.sql`                    |
| Load status lifecycle: posted → awarded → dispatched → in_transit → delivered                                                          | ✅     | All                      | P0       | 2     | `services/loads.service.ts`, `lib/database.types.ts`                                         |
| Load expiration (auto-expire via edge function)                                                                                        | ✅     | Broker, Shipper          | P1       | 4     | `supabase/functions/load-expiry/`, `supabase/functions/auto-expiry-check/`                   |
| Load cancellation                                                                                                                      | ✅     | Broker, Shipper          | P0       | 4     | `services/loads.service.ts`                                                                  |
| Full-address fields on loads (full pickup/delivery address)                                                                            | ✅     | Broker, Shipper          | P1       | 14    | `database/migrations/035-load-full-address.sql`                                              |
| Load detail sheet (drawer)                                                                                                             | ✅     | All                      | P0       | 2     | `features/loads/components/load-detail-sheet.tsx`                                            |
| Load card (list item)                                                                                                                  | ✅     | All                      | P0       | 2     | `features/loads/components/load-card.tsx`                                                    |
| Load status stepper                                                                                                                    | ✅     | All                      | P0       | 4     | `features/loads/components/load-status-stepper.tsx`                                          |
| Load status stepper role-based advancement rules (carrier: in_transit/delivered; broker: dispatched/completed; driver: delivered only) | ✅     | All                      | P0       | 4     | `features/loads/components/load-status-stepper.tsx`, `services/loads.service.ts`             |
| notifyLoadStatusChange() — email broker on every load status change                                                                    | ✅     | Broker                   | P0       | 4     | `services/email-notifications.service.ts`                                                    |
| Server-side paginated load list (25 rows/page)                                                                                         | ✅     | All                      | P1       | 13    | `services/loads.service.ts` (PAGE_SIZE=25, `.range()`)                                       |
| Filter loads by equipment type, status, origin state, dest state, rate/mile                                                            | ✅     | Carrier, Broker, Shipper | P1       | 2     | `services/loads.service.ts` (LoadFilters)                                                    |
| Full-text search on loads                                                                                                              | ✅     | All                      | P1       | 13    | `services/loads.service.ts`, `database/migrations/022-fulltext-search.sql`                   |
| Carrier load board with tabs: My Loads / All / Matches                                                                                 | ✅     | Carrier                  | P0       | 2     | `pages/carrier/loads.tsx`                                                                    |
| Broker load management page                                                                                                            | ✅     | Broker                   | P0       | 2     | `pages/broker/loads.tsx`                                                                     |
| Shipper load management page                                                                                                           | ✅     | Shipper                  | P0       | 2     | `pages/shipper/loads.tsx`                                                                    |
| Driver assigned loads page                                                                                                             | ✅     | Driver                   | P1       | 14    | `pages/driver/loads.tsx`                                                                     |
| Co-driver assignment                                                                                                                   | ✅     | Carrier, Admin           | P2       | 14    | `database/migrations/040-co-driver.sql`                                                      |
| Equipment type pill selector on post-load form (replaces native select — iOS dark mode fix)                                            | ✅     | Broker, Shipper          | P1       | 19    | `features/loads/components/post-load-sheet.tsx`                                              |
| Team member (assignee) assignment when posting a load                                                                                  | ✅     | Broker, Shipper          | P1       | 19    | `features/loads/components/post-load-sheet.tsx`, `database/migrations/050-load-assignee.sql` |
| "Assigned" badge on load card when assignee_id is set                                                                                  | ✅     | Broker, Shipper          | P2       | 19    | `features/loads/components/load-card.tsx`                                                    |
| Load editing (update posted loads)                                                                                                     | ✅     | Broker, Shipper          | P0       | 20    | `services/loads.service.ts`, `features/loads/components/post-load-sheet.tsx`                 |
| Broker can edit loads until bid is accepted                                                                                            | ✅     | Broker                   | P0       | 20    | `services/loads.service.ts`                                                                  |
| Canceled loads excluded from getLoads() query                                                                                          | ✅     | All                      | P1       | 20    | `services/loads.service.ts`                                                                  |
| Canceled load UX improvements across all views                                                                                         | ✅     | All                      | P1       | 20    | `services/loads.service.ts`, load pages                                                      |
| Date-based filtering for recent loads                                                                                                  | ✅     | All                      | P1       | 20    | `services/loads.service.ts`                                                                  |
| Quick load preview on dashboard recent loads                                                                                           | ✅     | All                      | P1       | 20    | Dashboard pages                                                                              |
| "All Loads" as default tab on carrier load board                                                                                       | ✅     | Carrier                  | P1       | 20    | `pages/carrier/loads.tsx`                                                                    |
| Assign driver from load detail sheet                                                                                                   | ✅     | Carrier                  | P1       | 20    | `features/loads/components/load-detail-sheet.tsx`                                            |
| Allow dispatch before driver assignment                                                                                                | ✅     | Carrier, Broker          | P1       | 20    | `services/loads.service.ts`                                                                  |
| Drivers can mark loads as in transit                                                                                                   | ✅     | Driver                   | P1       | 20    | `features/loads/components/load-status-stepper.tsx`                                          |
| Dispatch permissions removed from broker role                                                                                          | ✅     | Broker                   | P1       | 20    | `features/loads/components/load-status-stepper.tsx`                                          |
| Load cancellation restricted to broker/shipper only                                                                                    | ✅     | Broker, Shipper          | P1       | 20    | `services/loads.service.ts`                                                                  |
| Enterprise load detail enhancement                                                                                                     | ✅     | All                      | P1       | 20    | `features/loads/components/load-detail-sheet.tsx`                                            |

---

## 3. AI-Powered Load Search

**Domain:** Loads — Carrier discovery

| Feature                                                                        | Status | Roles           | Priority | Phase | Source                                                                        |
| ------------------------------------------------------------------------------ | ------ | --------------- | -------- | ----- | ----------------------------------------------------------------------------- |
| AI natural-language search bar with example chips                              | ✅     | Carrier         | P1       | 11    | `features/loads/components/ai-search-bar.tsx`                                 |
| `ai-load-search` edge function (Claude Haiku + keyword fallback)               | ✅     | Carrier         | P1       | 11    | `supabase/functions/ai-load-search/`                                          |
| Structured filter extraction (equipment, states, pickup window, min rate/mile) | ✅     | Carrier         | P1       | 11    | `supabase/functions/ai-load-search/`                                          |
| AI rate suggestion chip on post-load form (Claude Sonnet, suggest_rate mode)   | ✅     | Broker, Shipper | P2       | 13    | `services/rate-intelligence.service.ts`, `supabase/functions/ai-load-search/` |
| Load match scoring (0–100 across 5 weighted categories)                        | ✅     | Carrier         | P1       | 11    | `features/loads/lib/` (scoreLoad, rankLoads)                                  |
| Match badge on load cards (color-coded: green/orange/gray)                     | ✅     | Carrier         | P1       | 11    | `features/loads/components/match-badge.tsx`                                   |
| `useMatchScores` hook (re-ranks on load list updates)                          | ✅     | Carrier         | P1       | 11    | `features/loads/hooks/use-match-scores`                                       |
| Carrier preferences sheet (home states, equipment types, preferred lanes)      | ✅     | Carrier         | P1       | 11    | `features/loads/components/carrier-preferences-sheet.tsx`                     |

---

## 4. Truck / Fleet Management

**Domain:** Trucks — Carrier side

| Feature                                            | Status | Roles   | Priority | Phase | Source                                                      |
| -------------------------------------------------- | ------ | ------- | -------- | ----- | ----------------------------------------------------------- |
| Post a truck (equipment type, availability, specs) | ✅     | Carrier | P0       | 2     | `features/trucks/components/post-truck-sheet.tsx`           |
| Truck list and management                          | ✅     | Carrier | P0       | 2     | `pages/carrier/fleet.tsx`, `services/trucks.service.ts`     |
| Fleet map view with live GPS pins                  | ✅     | Carrier | P1       | 9     | `pages/carrier/fleet.tsx`, `shared/components/fleet-map`    |
| Delete truck                                       | ✅     | Carrier | P1       | 2     | `services/trucks.service.ts`                                |
| Carrier team management page                       | ✅     | Carrier | P1       | 13    | `pages/carrier/team.tsx`, `pages/carrier/team-settings.tsx` |

---

## 5. Bidding and Booking

**Domain:** Bids, Bookings

| Feature                                                                            | Status | Roles           | Priority | Phase | Source                                                                                                   |
| ---------------------------------------------------------------------------------- | ------ | --------------- | -------- | ----- | -------------------------------------------------------------------------------------------------------- |
| Carrier bid submission                                                             | ✅     | Carrier         | P0       | 4     | `features/bids/components/bid-sheet.tsx`, `services/bids.service.ts`                                     |
| Broker bid management (accept / counter / decline)                                 | ✅     | Broker          | P0       | 4     | `services/bids.service.ts` (acceptBid, declineBid, counterBid)                                           |
| Counter-offer flow (multi-round negotiation)                                       | ✅     | Carrier, Broker | P1       | 4     | `services/bids.service.ts`                                                                               |
| Book-It-Now (instant booking at posted rate)                                       | ✅     | Carrier         | P1       | 4     | `services/loads.service.ts` (bookNow), `database/migrations/005-book-now.sql`                            |
| Bid list sheet (all bids on a load)                                                | ✅     | Broker          | P0       | 4     | `features/bids/components/bid-list-sheet.tsx`                                                            |
| Bid expiration (auto-expiry edge function)                                         | ✅     | Carrier, Broker | P1       | 4     | `supabase/functions/auto-expiry-check/`                                                                  |
| Booking confirmation notification (email + SMS)                                    | ✅     | Carrier, Broker | P1       | 13    | `services/email-notifications.service.ts` (notifyBookingConfirmed, smsBookingConfirmed)                  |
| Digital e-signature on rate confirmations (canvas pad, stored in Supabase Storage) | ✅     | Carrier, Broker | P1       | 13    | `features/bids/components/signature-modal.tsx`, `database/migrations/034-document-signature-columns.sql` |
| BOL e-signature sheet                                                              | ✅     | Carrier, Driver | P1       | 13    | `features/bookings/components/bol-signature-sheet.tsx`                                                   |
| Rate confirmation PDF generation (jsPDF)                                           | ✅     | Broker          | P1       | 4     | `apps/web/package.json` (jspdf dependency), `services/bids.service.ts`                                   |

---

## 6. GPS Tracking and Maps

**Domain:** Tracking, Location, Maps

| Feature                                                                                                                 | Status | Roles                    | Priority | Phase | Source                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------ | -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Driver GPS location pinging (Web Geolocation API, smart interval: 30s or 50m movement)                                  | ✅     | Driver                   | P0       | 12    | `features/loads/hooks/use-driver-location`                                                                                                       |
| Live tracking map (Supabase Realtime, Leaflet/react-leaflet)                                                            | ✅     | All                      | P1       | 12    | `pages/tracking.tsx`, `features/loads/hooks/use-live-tracking`                                                                                   |
| Breadcrumb trail (historical route visualization)                                                                       | ✅     | Carrier, Broker, Shipper | P2       | 14    | `features/loads/components/route-replay-slider.tsx`, `features/loads/hooks/use-breadcrumb-trail`, `database/migrations/037-breadcrumb-trail.sql` |
| Route replay slider                                                                                                     | ✅     | Carrier, Broker, Shipper | P2       | 14    | `features/loads/components/route-replay-slider.tsx`                                                                                              |
| Predictive ETA (speed average + road factor + time-of-day)                                                              | ✅     | All                      | P2       | 12    | `services/eta.service.ts`, `features/loads/hooks/use-predictive-eta`                                                                             |
| Geofencing (auto-alert on zone entry/exit)                                                                              | ✅     | Carrier, Broker, Shipper | P2       | 14    | `services/geofence.service.ts`, `database/migrations/039-geofences.sql`                                                                          |
| Dwell time tracking (detention detection)                                                                               | ✅     | Carrier, Driver          | P2       | 14    | `services/dwell-time.service.ts`, `features/loads/components/dwell-time-card.tsx`, `database/migrations/040-dwell-time.sql`                      |
| GPS consent modal                                                                                                       | ✅     | Driver                   | P0       | 12    | `features/loads/components/gps-consent-modal.tsx`                                                                                                |
| Public shareable tracking link (token-based, no login required)                                                         | ✅     | All                      | P2       | 14    | `pages/public-tracking.tsx`, `services/tracking-tokens.service.ts`, `database/migrations/038-public-tracking-tokens.sql`                         |
| Location pings cleanup edge function (pg_cron, hourly)                                                                  | ✅     | Admin                    | P1       | 12    | `supabase/functions/location-cleanup/`                                                                                                           |
| Fleet map (dark Leaflet tiles, animated truck markers, teardrop pins)                                                   | ✅     | Carrier, Broker, Shipper | P1       | 9     | `shared/components/fleet-map`, `shared/components/map-view`                                                                                      |
| Stadia Alidade Smooth Dark tile theme                                                                                   | ✅     | All                      | P1       | 9     | `shared/components/map-view`                                                                                                                     |
| Tracking milestones — customer-visible progress labels (Picked Up, In Transit, Delivered) separate from GPS breadcrumbs | ✅     | All                      | P0       | 9     | `database/migrations/001-initial-schema.sql` (tracking_milestones table)                                                                         |
| Street-level geocoding for map pins (geocodeAddress() with city-level fallback)                                         | ✅     | All                      | P1       | 19    | `lib/geocoding.ts` (geocodeAddress), `shared/components/map-view.tsx` (originAddress/destAddress props)                                          |
| Enterprise GPS architecture — security hardening, geocoding, fleet tracking                                             | ✅     | All                      | P1       | 20    | GPS services, migrations                                                                                                                         |

---

## 7. Documents

**Domain:** Documents — BOL, POD, Rate Confirmation, Insurance, W-9

| Feature                                                                                                                       | Status | Roles                   | Priority | Phase | Source                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- | -------- | ----- | ------------------------------------------------------------------------------------------------- |
| Document upload (BOL, POD, rate confirmation, insurance cert, W-9)                                                            | ✅     | All                     | P0       | 4     | `features/documents/components/document-upload.tsx`, `services/documents.service.ts`              |
| Document viewer                                                                                                               | ✅     | All                     | P0       | 4     | `services/documents.service.ts`                                                                   |
| Documents page (driver)                                                                                                       | ✅     | Driver                  | P1       | 14    | `pages/driver/documents.tsx`                                                                      |
| Insurance certificate upload and expiry tracking                                                                              | ✅     | Carrier                 | P0       | 5     | `services/verification.service.ts` (uploadInsuranceCert)                                          |
| W-9 upload                                                                                                                    | ✅     | Carrier                 | P0       | 5     | `services/verification.service.ts` (uploadW9)                                                     |
| BOL workflow: driver upload → canvas signature capture → markBolSigned() → notifyBolSignedParties() email to broker + carrier | ✅     | Driver, Carrier, Broker | P0       | 4     | `features/bookings/components/bol-signature-sheet.tsx`, `services/email-notifications.service.ts` |
| getBolStatusForLoads() — bulk BOL status check across multiple loads                                                          | ✅     | Carrier, Broker         | P1       | 4     | `services/documents.service.ts`                                                                   |
| "Already signed at dock" toggle on driver BOL upload                                                                          | ✅     | Driver                  | P1       | 4     | `features/bookings/components/bol-signature-sheet.tsx`                                            |
| Signed BOL viewer — printable modal with signature image, signatory, timestamp (window.print())                               | ✅     | Driver, Carrier, Broker | P1       | 19    | `features/documents/components/signed-bol-viewer.tsx`                                             |
| BOL electronic signature triggered on delivered status                                                                        | ✅     | Driver, Carrier         | P0       | 20    | `features/bookings/components/bol-signature-sheet.tsx`                                            |
| "View Signed BOL" button shown only when BOL exists and is signed                                                             | ✅     | Driver, Carrier, Broker | P1       | 20    | `features/loads/components/load-detail-sheet.tsx`                                                 |
| Signature embedded into BOL PDF for portable proof                                                                            | ✅     | All                     | P1       | 20    | `features/bookings/components/bol-signature-sheet.tsx`                                            |
| Document uploads locked after BOL is signed                                                                                   | ✅     | All                     | P1       | 20    | `features/documents/components/document-upload.tsx`                                               |

---

## 8. Carrier Verification

**Domain:** Verification, Compliance

| Feature                                                  | Status | Roles           | Priority | Phase | Source                                                                           |
| -------------------------------------------------------- | ------ | --------------- | -------- | ----- | -------------------------------------------------------------------------------- |
| FMCSA SAFER lookup (MC/DOT verification)                 | ✅     | Carrier         | P0       | 5     | `features/verification/lib/fmcsa.ts`, `services/verification.service.ts`         |
| Insurance certificate upload and expiry tracking         | ✅     | Carrier         | P0       | 5     | `services/verification.service.ts`                                               |
| CSA safety score display                                 | ✅     | Carrier         | P1       | 5     | `services/verification.service.ts`                                               |
| Verified badge on carrier/broker cards                   | ✅     | Carrier, Broker | P1       | 5     | `features/verification/components/VerifiedBadge.tsx`                             |
| Verification panel (stepped UI: FMCSA → insurance → W-9) | ✅     | Carrier         | P0       | 5     | `features/verification/components/VerificationPanel.tsx`                         |
| Auto-alert on insurance expiry (60/30/7 days)            | 🔧     | Carrier, Admin  | P1       | 5     | `supabase/functions/health/` exists; dedicated expiry alert function unconfirmed |

---

## 9. Payments, Invoicing, and Subscriptions

**Domain:** Payments, Stripe, Subscriptions

| Feature                                                                | Status | Roles           | Priority | Phase | Source                                                                                                                                    |
| ---------------------------------------------------------------------- | ------ | --------------- | -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe subscription billing (monthly/annual, tier enforcement)         | ✅     | All             | P0       | 5     | `services/stripe.service.ts`, `features/payments/components/SubscriptionPlans.tsx`, `database/migrations/008-subscriptions.sql`           |
| Subscription gate (feature gating by plan)                             | ✅     | All             | P0       | 5     | `features/payments/components/SubscriptionGate.tsx`                                                                                       |
| Stripe Checkout redirect (via `create-checkout-session` edge function) | ✅     | All             | P0       | 5     | `services/stripe.service.ts`, `supabase/functions/create-checkout-session/`                                                               |
| Stripe webhook processing                                              | ✅     | Admin           | P0       | 5     | `supabase/functions/stripe-webhook/`                                                                                                      |
| Invoice auto-generation on load completion                             | ✅     | Carrier, Broker | P1       | 5     | `services/stripe.service.ts` (getInvoice), `database/migrations/008-subscriptions.sql`                                                    |
| Invoice approval workflow (invoiced → approved → processing → paid)    | ✅     | Carrier, Broker | P1       | 5     | `features/payments/components/InvoiceCard.tsx`                                                                                            |
| Quick Pay option (2% fee for expedited payment)                        | ✅     | Carrier         | P2       | 5     | `features/payments/components/InvoiceCard.tsx` (selectPaymentMethod)                                                                      |
| Accessorial charges (detention, lumper, layover, TONU, fuel surcharge) | ✅     | Carrier, Broker | P1       | 13    | `services/accessorials.service.ts`, `features/loads/components/accessorials-sheet.tsx`, `database/migrations/015-accessorial-charges.sql` |
| Broker approves/denies accessorial charges                             | ✅     | Broker          | P1       | 13    | `services/accessorials.service.ts`                                                                                                        |
| Invoice total auto-updates with approved accessorials                  | 🔧     | Carrier, Broker | P1       | 13    | Logic exists in service; UI linkage unconfirmed end-to-end                                                                                |

---

## 10. Ratings

**Domain:** Ratings — post-load, both directions

| Feature                                                                            | Status | Roles           | Priority | Phase | Source                                                                                                    |
| ---------------------------------------------------------------------------------- | ------ | --------------- | -------- | ----- | --------------------------------------------------------------------------------------------------------- |
| Post-load rating prompt banner                                                     | ✅     | Carrier, Broker | P1       | 5     | `features/ratings/components/RatingPromptBanner.tsx`                                                      |
| 5-star rating modal with sub-ratings (communication, reliability, professionalism) | ✅     | Carrier, Broker | P1       | 5     | `features/ratings/components/RatingModal.tsx`, `features/ratings/components/StarRating.tsx`               |
| Rating submission                                                                  | ✅     | Carrier, Broker | P1       | 5     | `services/ratings.service.ts`                                                                             |
| Rating display on profiles/cards                                                   | ✅     | All             | P1       | 5     | `services/ratings.service.ts`                                                                             |
| Broker credit score display (avg days-to-pay, on-time %)                           | ✅     | Carrier, Broker | P2       | 13    | `features/loads/components/broker-credit-badge.tsx`, `database/migrations/017-broker-payment-metrics.sql` |

---

## 11. Notifications

**Domain:** Notifications — in-app, email, SMS

| Feature                                                                                                     | Status | Roles           | Priority | Phase | Source                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------ | --------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| In-app notification bell with real-time unread count                                                        | ✅     | All             | P0       | 3     | `features/notifications/hooks/use-notifications`, `features/notifications/components/notification-sheet.tsx` |
| Notification sheet (list, mark read)                                                                        | ✅     | All             | P0       | 3     | `features/notifications/components/notification-sheet.tsx`                                                   |
| Supabase Realtime notifications subscription                                                                | ✅     | All             | P0       | 3     | `features/notifications/hooks/use-notifications`                                                             |
| Email notifications via Resend (new_bid, bid_accepted, bid_declined, booking_confirmed, load_status_change) | ✅     | All             | P1       | 13    | `services/email-notifications.service.ts`, `supabase/functions/send-notification-email/`                     |
| SMS notifications via Twilio (critical events)                                                              | ✅     | Carrier, Broker | P2       | 13    | `supabase/functions/send-sms/`                                                                               |
| Background notification queue with retry (dead-letter)                                                      | ✅     | Admin           | P1       | 13    | `supabase/functions/notification-worker/`, `database/migrations/021-notification-queue.sql`                  |
| Notification preferences page (per-channel toggles: push/email/SMS)                                         | ✅     | All             | P1       | 13    | `pages/profile/notifications.tsx`                                                                            |
| Lane alerts (email + SMS + in-app when matching load is posted)                                             | ✅     | Carrier         | P1       | 13    | `supabase/functions/lane-alert/`, `database/migrations/016-saved-searches.sql`                               |

---

## 12. Messaging

**Domain:** Messages — real-time per-load and direct

| Feature                                                      | Status | Roles           | Priority | Phase | Source                                                                |
| ------------------------------------------------------------ | ------ | --------------- | -------- | ----- | --------------------------------------------------------------------- |
| Per-load conversation threads                                | ✅     | Carrier, Broker | P0       | 3     | `services/messages.service.ts`, `pages/messages.tsx`                  |
| Direct messaging between users                               | ✅     | All             | P1       | 10    | `services/messages.service.ts` (searchUsers, getOrCreateConversation) |
| Real-time message delivery (Supabase Realtime)               | ✅     | All             | P0       | 3     | `pages/messages.tsx`                                                  |
| Conversation list with unread count badges                   | ✅     | All             | P0       | 3     | `pages/messages.tsx`                                                  |
| New Message flow (select "about a load" or "message a user") | ✅     | All             | P1       | 10    | `pages/messages.tsx`                                                  |
| Message search (user and load selection)                     | ✅     | All             | P1       | 10    | `pages/messages.tsx`                                                  |

---

## 13. Rate Intelligence

**Domain:** Rates, Market Data

| Feature                                                       | Status | Roles           | Priority | Phase | Source                                                                              |
| ------------------------------------------------------------- | ------ | --------------- | -------- | ----- | ----------------------------------------------------------------------------------- |
| Lane rate history (auto-recorded on every booking)            | ✅     | Admin           | P2       | 13    | `services/rate-intelligence.service.ts`, `database/migrations/019-rate-history.sql` |
| `get_lane_stats()` RPC (avg/min/max over configurable window) | ✅     | Broker, Carrier | P2       | 13    | `services/rate-intelligence.service.ts`                                             |
| `get_lane_trend()` RPC (daily sparkline data)                 | ✅     | Broker, Carrier | P2       | 13    | `services/rate-intelligence.service.ts`                                             |
| Market rate display on load posting form                      | ✅     | Broker, Shipper | P2       | 13    | `features/loads/components/post-load-sheet.tsx`                                     |
| AI rate suggestion (low/mid/high range, confidence level)     | ✅     | Broker, Shipper | P2       | 13    | `services/rate-intelligence.service.ts` (getRateSuggestion)                         |

---

## 14. Saved Searches and Lane Alerts

**Domain:** Search, Alerts

| Feature                                            | Status | Roles   | Priority | Phase | Source                                                                                     |
| -------------------------------------------------- | ------ | ------- | -------- | ----- | ------------------------------------------------------------------------------------------ |
| Save any filter combination with a name            | ✅     | Carrier | P1       | 13    | `services/saved-searches.service.ts`, `features/loads/components/saved-searches-sheet.tsx` |
| Enable/disable email + SMS alerts per saved search | ✅     | Carrier | P1       | 13    | `services/saved-searches.service.ts` (alert_enabled field)                                 |
| In-app notification when matching load is posted   | ✅     | Carrier | P1       | 13    | `supabase/functions/lane-alert/`                                                           |

---

## 15. Preferred Carriers and Carrier Relationships

**Domain:** Carriers — trust and access control

| Feature                                                      | Status | Roles           | Priority | Phase | Source                                                         |
| ------------------------------------------------------------ | ------ | --------------- | -------- | ----- | -------------------------------------------------------------- |
| Mark carrier as preferred or blocked                         | ✅     | Broker, Shipper | P2       | 13    | `services/carrier-relationships.service.ts`                    |
| Carrier relationships sheet (UI to manage preferred/blocked) | ✅     | Broker, Shipper | P2       | 13    | `features/carriers/components/carrier-relationships-sheet.tsx` |
| Blocked carriers excluded from loads at RLS level            | ✅     | Broker, Shipper | P2       | 13    | `database/migrations/018-carrier-relationships.sql`            |

---

## 16. Audit Trail

**Domain:** Admin, Compliance

| Feature                                                    | Status | Roles | Priority | Phase | Source                                                                                |
| ---------------------------------------------------------- | ------ | ----- | -------- | ----- | ------------------------------------------------------------------------------------- |
| Audit log table (every load, bid, booking, payment action) | ✅     | Admin | P1       | 13    | `database/migrations/020-audit-log.sql`, `database/migrations/023-audit-triggers.sql` |
| `write_audit_log()` RPC                                    | ✅     | Admin | P1       | 13    | `database/migrations/020-audit-log.sql`                                               |
| Admin audit trail page with filters                        | ✅     | Admin | P1       | 13    | `pages/admin/audit-log.tsx`                                                           |

---

## 17. Admin Dashboard

**Domain:** Admin

| Feature           | Status | Roles   | Priority | Phase | Source                        |
| ----------------- | ------ | ------- | -------- | ----- | ----------------------------- |
| Admin dashboard   | ✅     | Admin   | P0       | 2     | `pages/admin/dashboard.tsx`   |
| Audit log viewer  | ✅     | Admin   | P1       | 13    | `pages/admin/audit-log.tsx`   |
| Broker dashboard  | ✅     | Broker  | P0       | 2     | `pages/broker/dashboard.tsx`  |
| Shipper dashboard | ✅     | Shipper | P0       | 2     | `pages/shipper/dashboard.tsx` |
| Carrier dashboard | ✅     | Carrier | P0       | 2     | `pages/carrier/dashboard.tsx` |
| Driver dashboard  | ✅     | Driver  | P1       | 14    | `pages/driver/dashboard.tsx`  |

---

## 18. Driver-Specific Tools

**Domain:** Driver — mobile workflow

| Feature                                                                                                 | Status | Roles           | Priority | Phase | Source                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ------ | --------------- | -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driver dashboard (active loads, GPS pinger, status)                                                     | ✅     | Driver          | P1       | 14    | `pages/driver/dashboard.tsx`                                                                                                                                                     |
| Driver loads page (view assigned loads, filter by status)                                               | ✅     | Driver          | P1       | 14    | `pages/driver/loads.tsx`                                                                                                                                                         |
| GPS pinging from driver dashboard (consent modal)                                                       | ✅     | Driver          | P1       | 12    | `pages/driver/dashboard.tsx`, `features/loads/components/gps-consent-modal.tsx`                                                                                                  |
| Receipt capture (photo or manual entry, categorized)                                                    | ✅     | Driver          | P2       | 14    | `pages/driver/receipts.tsx`, `features/driver/components/receipt-capture-sheet.tsx`, `services/receipts.service.ts`                                                              |
| Expense summary (by category with totals)                                                               | ✅     | Driver          | P2       | 14    | `pages/driver/expenses.tsx`, `services/receipts.service.ts`                                                                                                                      |
| Tire incident log (flat, blowout, low_pressure, damage) — original, tire-only                           | ✅     | Driver          | P2       | 14    | `services/tire-incidents.service.ts`, `database/migrations/043-flat-tire-log.sql`                                                                                                |
| Tire position selector                                                                                  | ✅     | Driver          | P2       | 14    | `features/driver/components/tire-position-selector.tsx`                                                                                                                          |
| General incident log (10 types: tire/engine/brake/lights/body_damage/accident/illness/cargo/fuel/other) | ✅     | Driver          | P1       | 19    | `pages/driver/tire-log.tsx` (repurposed), `features/driver/components/incident-form.tsx`, `services/driver-incidents.service.ts`, `database/migrations/051-driver-incidents.sql` |
| Incident severity levels (minor / moderate / severe / critical)                                         | ✅     | Driver          | P1       | 19    | `features/driver/components/incident-form.tsx`                                                                                                                                   |
| Incident form: auto-GPS, photo capture, active-load association                                         | ✅     | Driver          | P1       | 19    | `features/driver/components/incident-form.tsx`                                                                                                                                   |
| Driver score calculation (speed, route, dwell)                                                          | ✅     | Driver, Carrier | P2       | 14    | `services/driver-score.service.ts`, `database/migrations/041-driver-scores.sql`                                                                                                  |
| Driver assignment to loads                                                                              | ✅     | Carrier, Admin  | P1       | 14    | `database/migrations/027-driver-assignment.sql`                                                                                                                                  |
| Driver team page (carrier view)                                                                         | ✅     | Carrier         | P1       | 14    | `pages/driver/team.tsx`                                                                                                                                                          |
| Driver documents page                                                                                   | ✅     | Driver          | P1       | 14    | `pages/driver/documents.tsx`                                                                                                                                                     |

---

## 19. Webhooks

**Domain:** Integrations, Automation

| Feature                                              | Status | Roles                    | Priority | Phase | Source                                                                         |
| ---------------------------------------------------- | ------ | ------------------------ | -------- | ----- | ------------------------------------------------------------------------------ |
| Webhook event delivery (load status, bookings, bids) | ✅     | Carrier, Broker, Shipper | P2       | 6     | `supabase/functions/webhook-delivery/`, `database/migrations/009-webhooks.sql` |
| Webhook retry logic                                  | ✅     | Admin                    | P2       | 6     | `supabase/functions/webhook-delivery/`                                         |

---

## 20. Infrastructure and Platform

**Domain:** CI/CD, Monitoring, Rate Limiting

| Feature                                       | Status | Roles          | Priority | Phase | Source                                                                      |
| --------------------------------------------- | ------ | -------------- | -------- | ----- | --------------------------------------------------------------------------- |
| Edge rate limiting (Vercel KV sliding window) | ✅     | Admin          | P1       | 13    | `@upstash/ratelimit` and `@upstash/redis` in `package.json`                 |
| Sentry error monitoring                       | ✅     | Admin          | P1       | 6     | `@sentry/react` in `package.json`                                           |
| Vercel Speed Insights                         | ✅     | Admin          | P1       | 6     | `@vercel/speed-insights` in `package.json`                                  |
| Health check edge function                    | ✅     | Admin          | P1       | 6     | `supabase/functions/health/`                                                |
| GPS location pings RLS tightening             | ✅     | Admin          | P1       | 14    | `database/migrations/042-location-pings-rls-tighten.sql`                    |
| Company members visibility fix (RLS)          | ✅     | Admin          | P1       | 14    | `database/migrations/045-fix-company-members-visibility.sql`                |
| Help Center page (FAQ)                        | ✅     | All            | P2       | 10    | `pages/profile/help-center.tsx`                                             |
| Zod validation at service boundaries          | ✅     | All            | P1       | 15    | `lib/schemas/` (loads, bids, trucks, profiles)                              |
| React Query (TanStack Query) integration      | ✅     | All            | P1       | 15    | `main.tsx` QueryClientProvider, `use-loads.ts` migrated                     |
| Realtime subscription deduplication           | ✅     | All            | P1       | 15    | `lib/realtime-manager.ts`                                                   |
| Lane Intelligence page                        | ✅     | Broker/Carrier | P1       | 16    | `pages/lane-intelligence.tsx`                                               |
| Lane trend sparkline chart                    | ✅     | Broker/Carrier | P2       | 16    | `features/loads/components/lane-trend-chart.tsx`                            |
| Popular Lanes widget                          | ✅     | Broker/Carrier | P2       | 16    | `features/loads/components/popular-lanes-card.tsx`                          |
| Load card market rate badge                   | ✅     | Carrier        | P2       | 16    | `features/loads/components/load-card.tsx` (MarketBadge)                     |
| Lane benchmarks migration                     | ✅     | Admin          | P1       | 16    | `database/migrations/046-lane-benchmarks.sql`                               |
| Carrier risk score                            | ✅     | Admin          | P1       | 17    | `supabase/functions/carrier-health-check/` + `048-insurance-monitoring.sql` |
| Insurance expiry monitoring                   | ✅     | Admin/Carrier  | P1       | 17    | `carrier-health-check` Edge Function                                        |
| FMCSA periodic re-verification                | ✅     | Admin          | P1       | 17    | `carrier-health-check` Edge Function + `verification_schedule` table        |
| Factoring request flow (QuickPay)             | ✅     | Carrier        | P1       | 17    | `features/payments/components/factoring-sheet.tsx`                          |
| Carrier Payments hub page                     | ✅     | Carrier        | P1       | 17    | `pages/carrier-payments.tsx`                                                |
| Web Push notifications (PWA)                  | ✅     | All            | P1       | 18    | `lib/push-notifications.ts`, `public/sw.js`, `send-push` Edge Function      |
| SMS template system                           | ✅     | All            | P2       | 18    | `lib/sms-templates.ts`                                                      |
| Notification health dashboard                 | ✅     | Admin          | P1       | 18    | `pages/admin/notification-health.tsx`                                       |
| CSV load import (EDI basics)                  | ✅     | Broker         | P2       | 18    | `features/loads/components/csv-import-sheet.tsx`                            |

---

## 21. Not Built (confirmed absent from source)

These features appear in older documentation but have no corresponding source code:

| Feature                                        | Notes                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Native iOS/Android app                         | No React Native / Expo code found                                          |
| ELD / telematics integration (Samsara, Motive) | No integration code found                                                  |
| Factoring partner API integration              | QuickPay flow exists; no real factor partner API wired yet                 |
| QuickBooks / accounting software integration   | No code found                                                              |
| DAT / Truckstop cross-posting                  | No code found                                                              |
| Multi-language support                         | No i18n setup found                                                        |
| Open REST API for external partners            | No public API layer found                                                  |
| FreightX Academy / Learning Platform           | No Next.js academy app found in monorepo                                   |
| Automated IFTA mileage / tax reporting         | No code found                                                              |
| Payment escrow / Guaranteed Pay                | No escrow logic found                                                      |
| Direct ACH carrier payment (Stripe Connect)    | Stripe Checkout exists for subscriptions; ACH carrier payout not confirmed |
| HOS (Hours of Service) compliance tracking     | No code found                                                              |
| HAZMAT certification tracking                  | No code found                                                              |
| Market heatmap / capacity forecasting          | No code found                                                              |
| Custom report builder                          | No code found                                                              |
| Referral program                               | No code found                                                              |
