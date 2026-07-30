# FreightX — Implementation Status

**Last Updated:** 2026-04-12
**Audit basis:** Source code in `apps/web/src/`, `database/migrations/`, `supabase/functions/`, `apps/web/package.json`, `apps/web/tailwind.config.ts`

This document records what is actually built. Do not use it as a roadmap. For unbuilt items, see `DEVELOPMENT_ROADMAP.md`. For the full feature inventory, see `FEATURE_CATALOG.md`.

---

## Tech Stack (Actual)

| Layer            | What is used                                                                                                               | Notes                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | React 19 + Vite 6 (TypeScript strict)                                                                                      | SPA, not Next.js                                                                                                                   |
| Routing          | react-router-dom v6                                                                                                        | File-based pages in `apps/web/src/pages/`                                                                                          |
| Styling          | Tailwind CSS v3                                                                                                            | Custom `fx-*` token namespace (orange, bg, surface, border, text) defined in `tailwind.config.ts` — NOT shadcn/ui, NOT Tailwind v4 |
| Design tokens    | `fx-orange`, `fx-bg`, `fx-surface`, `fx-surface-2`, `fx-surface-3`, `fx-border`, `fx-text`, `fx-text-muted`, `fx-text-dim` | iOS-inspired dark theme                                                                                                            |
| UI components    | Custom components in `apps/web/src/shared/components/ui/` — Badge, Button, BottomSheet, etc.                               | No shadcn/ui installed                                                                                                             |
| State management | React state + Supabase subscriptions                                                                                       | No TanStack Query / React Query installed                                                                                          |
| Database         | Supabase (PostgreSQL) — direct `@supabase/supabase-js` client                                                              | No ORM layer in web app                                                                                                            |
| Auth             | Supabase Auth (email/password + Google OAuth)                                                                              | JWT managed in `AuthContext.tsx`                                                                                                   |
| Real-time        | Supabase Realtime (postgres_changes + broadcast channels)                                                                  | Used for load board, notifications, live tracking                                                                                  |
| File storage     | Supabase Storage                                                                                                           | Documents, avatars, signatures                                                                                                     |
| Maps             | Leaflet + react-leaflet v5                                                                                                 | Stadia Alidade Smooth Dark tiles, custom SVG markers                                                                               |
| Payments         | Stripe (subscriptions via Checkout, invoicing)                                                                             | `@stripe/stripe-js`, `create-checkout-session` edge function                                                                       |
| Email            | Resend (via `send-notification-email` edge function)                                                                       | Queued through `notification_queue` table                                                                                          |
| SMS              | Twilio (via `send-sms` edge function)                                                                                      | Critical events only, opt-in                                                                                                       |
| AI               | Anthropic Claude (Haiku for load parsing, Sonnet for rate suggestion)                                                      | Via `ai-load-search` edge function                                                                                                 |
| PDF generation   | jsPDF                                                                                                                      | Rate confirmation PDF                                                                                                              |
| Rate limiting    | Upstash Redis + `@upstash/ratelimit` (Vercel KV sliding window)                                                            | Edge Middleware                                                                                                                    |
| Monitoring       | Sentry (`@sentry/react`) + Vercel Speed Insights                                                                           |                                                                                                                                    |
| Monorepo         | pnpm + Turborepo                                                                                                           | `apps/web`, `packages/shared`, `packages/typescript-config`                                                                        |
| CI/CD            | GitHub Actions → Vercel                                                                                                    | Auto-deploy on main merge                                                                                                          |

---

## Implemented Features by Domain

### Authentication and User Management

- Email/password and Google OAuth sign-in and sign-up
- Password reset flow (`/forgot-password`, `/reset-password`)
- Multi-step onboarding: email → role selection → company info
- Onboarding checklist component (profile, company, first action)
- Roles: carrier, broker, shipper, driver, admin
- Protected routes with role enforcement
- User profile editing (name, avatar, phone)
- Company creation and editing
- Multi-user company teams: invite by email, assign role, revoke access
- Company member roles: owner, admin, dispatcher, accounting, viewer
- Driver role linked to carrier company (separate from owner/admin)
- Avatar upload to Supabase Storage
- Broker+carrier hybrid role capabilities with view switcher
- Company logo upload and display (owner-only, auto-save to Supabase Storage)

### Load Board

- Post a load form (multi-field: equipment, origin/dest, rates, dates, commodity)
- Load templates (save and apply any form state as a named template)
- Load status lifecycle: posted → awarded → dispatched → in_transit → delivered
- Load expiration (auto-expire edge functions: `load-expiry`, `auto-expiry-check`)
- Load cancellation
- Full pickup and delivery address fields on loads
- Server-side paginated load list (25 rows/page using `.range()`)
- Filters: equipment type, status, origin state, destination state, min rate/mile
- Full-text search with GIN indexes and `search_vector` generated column
- Load detail sheet (bottom drawer with full load info, bid actions, docs)
- Load status stepper component
- Role-specific load pages: carrier (`/carrier/loads`), broker (`/broker/loads`), shipper (`/shipper/loads`), driver (`/driver/loads`)
- Carrier load board tabs: My Loads / All Loads / Matches
- Co-driver assignment (`040-co-driver.sql`)
- Load editing — update posted loads before bid acceptance
- Broker can edit loads until a bid is accepted
- Canceled loads excluded from `getLoads()` query
- Canceled load UX improvements across all role views
- Date-based filtering for recent loads
- Quick load preview on dashboard recent loads cards
- "All Loads" as default tab on carrier load board
- Assign driver directly from load detail sheet
- Allow dispatch before driver assignment
- Drivers can mark loads as in transit
- Dispatch permissions removed from broker role
- Load cancellation restricted to broker/shipper only
- Enterprise load detail enhancement (richer detail sheet)

### AI-Powered Load Search

- AI search bar with example prompt chips on carrier load board
- `ai-load-search` Supabase Edge Function using Claude Haiku with keyword fallback
- Structured filter extraction from natural language (equipment, states, dates, min rate/mile)
- Load match scoring: 0–100 score across 5 weighted categories
- `MatchBadge` component (color-coded pill: green ≥80, orange 60–79, gray <60)
- `useMatchScores` hook re-ranks on load list changes
- AI rate suggestion chip on post-load form using Claude Sonnet

### Truck / Fleet Management

- Post a truck form (type, availability, specs)
- Truck list and CRUD (carrier fleet page)
- Delete truck
- Fleet map with live GPS pins (Leaflet, dark tiles, animated markers)
- Carrier team and team settings pages

### Bidding and Booking

- Carrier bid submission with amount, notes
- Broker bid management: accept / counter / decline
- Counter-offer multi-round negotiation
- Book-It-Now (instant booking at posted rate)
- Bid list sheet showing all bids on a load
- Bid expiration (stale bids auto-expire)
- Booking confirmation email and SMS to all parties
- Digital e-signature via canvas pad — stored as PNG in Supabase Storage
- Signature timestamp and signatory name written to bid record
- BOL e-signature sheet
- Rate confirmation PDF generation (jsPDF)

### GPS Tracking and Maps

- Driver GPS location pinging via Web Geolocation API
- Smart ping interval: every 30 seconds or every 50 meters of movement
- `useLiveTracking` hook: Supabase Realtime channel updates on INSERT to `location_pings`
- Breadcrumb trail: historical route replay with slider
- Predictive ETA: speed average from last 10 pings × road factor × time-of-day adjustment
- Geofencing: create radius zones for pickup/delivery stops, alert on entry/exit
- Dwell time tracking: enter/exit timestamps, detention flag on long dwell
- GPS consent modal before activating driver location
- Public shareable tracking link (token-based, no login required, 7-day expiry)
- `location-cleanup` edge function (deletes pings >24 hours old, runs hourly via pg_cron)
- Stadia Alidade Smooth Dark tile theme
- SVG teardrop load pins with route glow
- Animated truck markers with direction indicator
- `DwellTimeCard` component showing dwell status on tracking page
- Enterprise GPS architecture — security hardening, geocoding, fleet tracking

### Documents

- Upload and store: BOL, POD, rate confirmation, insurance certificate, W-9
- Document viewer
- Documents page for driver and carrier/broker verification
- BOL electronic signature triggered on delivered status
- "View Signed BOL" button shown only when BOL exists and is signed
- Signature embedded into BOL PDF for portable proof
- Document uploads locked after BOL is signed
- BOL signature bug fix — restrict load cancellation after signing

### Carrier Verification

- FMCSA SAFER lookup via MC number or DOT number
- Insurance certificate upload with expiry date tracking
- W-9 upload
- CSA safety score stored on verification record
- Verified badge component shown on carrier/broker cards
- Stepped verification panel (FMCSA → insurance → W-9 → done)
- Auto-alert on insurance expiry (unconfirmed — service scaffolding exists, dedicated edge function not confirmed)

### Payments, Invoicing, and Subscriptions

- Stripe subscription plans: free, carrier_pro, broker_starter, broker_growth, shipper
- Stripe Checkout redirect via `create-checkout-session` edge function
- Stripe webhook processing via `stripe-webhook` edge function
- Subscription gate component (feature gating by plan tier)
- Invoice auto-generated on load completion
- Invoice status workflow: invoiced → approved → processing → paid → overdue
- Quick Pay option (2% fee for expedited payment)
- Accessorial charges: detention, lumper, layover, TONU, fuel_surcharge
- Carrier submits accessorials; broker approves or denies each
- Invoice total reflects approved accessorials

### Ratings

- Post-load rating prompt banner shown after load delivery
- Rating modal with 5-star overall + sub-ratings (communication, reliability, professionalism)
- Rating submitted for both carrier and broker after each load
- Broker credit badge: displays avg days-to-pay and on-time payment percentage

### Notifications

- In-app notification bell with real-time unread count (all dashboards)
- Notification sheet (list, mark all read)
- Email notifications via Resend for: new bid, bid accepted, bid declined, booking confirmed, load status change
- SMS notifications via Twilio for critical events (opt-in)
- Background notification queue with exponential backoff retry and dead-letter
- Notification preferences page with per-channel toggles (push/email/SMS)
- Lane alerts: in-app + email + SMS when a matching load is posted

### Messaging

- Per-load conversation threads
- Direct messaging between any two users
- Real-time message delivery (Supabase Realtime)
- Conversation list with unread count badges
- New Message flow: select "about a load" or "message a user"
- User search for starting conversations

### Rate Intelligence

- Lane rate history auto-recorded on every booking
- `get_lane_stats()` RPC: avg/min/max rate per mile for any origin-dest-equipment window
- `get_lane_trend()` RPC: daily data points for sparkline chart
- Market rate displayed on load posting form before publishing

### Saved Searches and Lane Alerts

- Save any filter combination with a user-defined name
- Toggle email and SMS alert per saved search
- `lane-alert` edge function fires when a new load matches a saved search

### Preferred Carriers and Relationships

- Mark carrier companies as preferred or blocked
- Carrier relationships sheet for managing list
- Blocked carriers excluded from seeing or bidding on company loads (enforced at RLS level)

### Audit Trail

- `audit_log` table records every load, bid, booking, and payment action
- Stores user, action type, entity, before/after diff, IP address
- DB triggers auto-populate audit log on key table changes
- Admin audit trail page with search and filters

### Admin and Dashboards

- Admin dashboard
- Admin audit log page
- Carrier dashboard
- Broker dashboard
- Shipper dashboard
- Driver dashboard
- View switcher on dashboards for broker+carrier hybrid users
- Quick load preview cards on all role dashboards

### Driver-Specific Tools

- Driver dashboard (active loads, GPS consent and pinging)
- Receipt capture (photo or manual, categorized: fuel, maintenance, tolls, meals, lodging, parking, supplies, other)
- Expense summary (monthly totals by category, combined with tire incidents)
- Tire incident log (flat, blowout, low_pressure, damage) with position selector
- Driver score calculation (speed compliance, route adherence, dwell time)
- Driver load page (assigned loads, status filters)
- Driver team page (visible to carriers)
- Driver documents page

### Webhooks

- Webhook event delivery to external URLs (load status, bookings, bids)
- Retry logic on failed delivery

### Infrastructure and Platform

- Edge rate limiting via Upstash Redis on Vercel KV (sliding window)
- Sentry error monitoring
- Vercel Speed Insights
- Health check edge function
- GPS location pings RLS tightened
- Company members RLS fixed and visibility corrected
- Profile company visibility migration
- Help Center page (FAQ accordion)

---

## Known Gaps and Unconfirmed Items

The following items appear in older phase guides or service scaffolding but cannot be confirmed as complete from source inspection:

| Item                                                      | Status                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Auto-alert emails for insurance expiry (60/30/7 day)      | Unconfirmed — verification service records expiry dates; no dedicated alert edge function confirmed |
| Invoice total UI auto-updating with accessorial approvals | Unconfirmed — service layer exists; UI linkage end-to-end not verified                              |
| File sharing within message threads                       | No file attachment UI found in `pages/messages.tsx`                                                 |
| Vitest unit tests and Playwright E2E tests                | `vitest` and `@playwright/test` are devDependencies; test file coverage unconfirmed                 |
| Redis / BullMQ job queue                                  | Upstash client in package.json; BullMQ not found — queue is the Supabase `notification_queue` table |
| Sentry configuration                                      | Package installed; active DSN configuration unconfirmed                                             |
| FMCSA SAFER API key                                       | Placeholder guard exists in `VerificationPanel.tsx` — live API key may not be configured            |
| Stripe price IDs                                          | Placeholder values in `stripe.service.ts` — live price IDs may not be configured                    |
| ACH carrier payout via Stripe Connect                     | Stripe Checkout exists for subscriptions; direct ACH payout to carriers not confirmed               |

---

## What is NOT Built

These features are referenced in older documentation but have no source code:

- Native iOS/Android app (no React Native / Expo)
- ELD / telematics integration (Samsara, Motive, Macropoint)
- Factoring partner integration
- QuickBooks / accounting software integration
- DAT / Truckstop cross-posting
- Multi-language / i18n support
- Open REST API for external partners
- FreightX Academy / learning platform (no academy app in monorepo)
- Automated IFTA mileage / quarterly tax export
- Payment escrow / Guaranteed Pay
- HOS (Hours of Service) compliance tracking
- HAZMAT certification tracking
- Market heatmap / capacity forecasting
- Custom report builder
- Referral program
- Redis-backed BullMQ job queues (queue is Supabase-native)
