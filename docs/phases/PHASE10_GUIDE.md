# Phase 10 — Interactive Maps & Profiles

**Status:** Complete

**Migrations:** None

**Key files added:**

- `apps/web/src/pages/profile/help-center.tsx` — Help Center with categorized FAQ accordion and support contact cards
- `apps/web/src/pages/profile/notifications.tsx` — notification settings with per-channel toggles saved to DB
- `apps/web/src/pages/profile/documents.tsx` — document upload and verification status (insurance cert, W-9, MC)
- `apps/web/src/features/profile/components/edit-profile-sheet.tsx` (updated) — avatar upload to Supabase Storage `avatars` bucket
- `apps/web/src/pages/messages.tsx` (updated) — New Message FAB + load or user search modal
- `apps/web/src/features/tracking/components/enhanced-tracking-map.tsx` — progress overlay, load info card, live route polyline
- `apps/web/src/lib/rate-limit.ts` — client-side sliding-window rate limiter utility
- `apps/web/src/services/loads.service.ts` (updated) — notifyCarriersOfNewLoad() triggered on load creation

**Features delivered:**

- Help Center: categorized FAQ accordion (general, billing, technical), live chat / email / phone support
- Notification settings: per-event-type toggles (push/email/SMS) persisted to database
- Documents page: upload and verification status for insurance cert, W-9, and MC verification
- Avatar upload and profile image management via Supabase Storage
- New Message FAB with modal for targeting loads or users with search
- Enhanced tracking map with progress percentage overlay and load info card
- Automatic in-app notifications to all carriers when a new load is posted
- Direct messaging between any two users (not only load parties)
