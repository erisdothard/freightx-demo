# Phase 8 — Study Guide & Learning Platform

**Status:** Complete

**Migrations:** None

**Key files added:**

- `freightx-academy/` — standalone Next.js 15 app (not in main monorepo); architecture explorer, feature catalog, API docs, CEO presentation deck, developer onboarding
- `apps/web/src/pages/profile/help-center.tsx` — FAQ accordion with category tabs and contact support card
- `apps/web/src/pages/profile/notifications.tsx` — push/email/SMS toggle settings per event type
- `apps/web/src/pages/tracking.tsx` (updated) — live tracking map with route polyline and "LIVE" overlay
- `apps/web/src/features/profile/components/edit-profile-sheet.tsx` (updated) — avatar upload to Supabase Storage `avatars` bucket
- `apps/web/src/pages/messages.tsx` (updated) — New Message FAB with load or user targeting modal

**Features delivered:**

- FreightX Academy app: interactive system diagram, database schema explorer, API explorer with live request builder, CEO executive presentation mode with slides
- Help Center page: categorized FAQ accordion, live chat / email / phone contact options
- Notification settings page: per-event-type toggles (new bid, bid accepted, load status, etc.)
- Avatar upload and profile image display via Supabase Storage
- New Message FAB on messages page: "message about a load" or "message a user" with search UI
- Live tracking map: route polyline, origin/destination markers, LIVE pulsing badge
- Automatic in-app notifications to all carriers when a new load is posted
