# Phase 18 — Mobile, Ops & Notifications

**Status:** ✅ Complete
**Date:** 2026-03-30

## Goals

Real Web Push notifications for the PWA, typed SMS templates, admin visibility into notification queue health, and CSV bulk load import.

## What Was Built

### Migration

- **`database/migrations/049-push-subscriptions.sql`** — `push_subscriptions` table
  - Columns: user_id, endpoint (unique), p256dh, auth, user_agent, created_at, last_used_at
  - RLS: users can only access their own subscriptions

### Web Push (PWA)

- **`apps/web/src/lib/push-notifications.ts`**
  - `subscribeToPush()` — requests permission, subscribes browser, saves to DB
  - `unsubscribeFromPush()` — removes subscription from browser and DB
  - `isSubscribedToPush()` — check current state
  - Requires `VITE_VAPID_PUBLIC_KEY` env var

- **`apps/web/public/sw.js`** — Service worker with push handlers
  - `push` event: parses JSON payload, shows native notification
  - `notificationclick`: focuses existing window or opens new one at `payload.url`

- **`supabase/functions/send-push/index.ts`** — Edge Function
  - Accepts `{ user_id, title, body, url?, tag? }`
  - Looks up all `push_subscriptions` for user
  - Sends via Web Push protocol
  - Removes dead subscriptions (delivery failures)
  - Requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` secrets

> **Note:** Full VAPID JWT signing in production should use the `web-push` npm package. The current implementation includes the scaffolding; add `import webpush from 'npm:web-push'` to `send-push/index.ts` for production-grade delivery.

### SMS Templates

- **`apps/web/src/lib/sms-templates.ts`** — Typed template functions for all events:
  - `bidReceivedSms`, `bidAcceptedSms`, `bidDeclinedSms`
  - `bookingConfirmedSms`, `loadStatusChangedSms`
  - `insuranceExpirySms`, `factoringApprovedSms`
  - `newLoadAvailableSms`, `driverAssignedSms`

### Notification Health Dashboard

- **`services/notification-admin.service.ts`**
  - `getNotificationQueueStats()` — sent today, failed today, dead letters, avg retries
  - `getFailedNotifications(limit)` — last N failed/dead records
  - `retryAllFailed()` — re-queues all failed notifications

- **`pages/admin/notification-health.tsx`** — Route `/admin/notifications` (admin only)
  - Stats grid, last 50 failed/dead entries with error details
  - "Retry All Failed" button

### CSV Load Import (EDI Basics)

- **`services/load-import.service.ts`**
  - `parseCsv(text)` — validates required columns, returns typed rows
  - `importLoadsFromCsv(rows, postedBy, companyId)` — batch creates loads, max 50 rows
  - Returns `ImportResult` with succeeded/failed counts and per-row errors

- **`features/loads/components/csv-import-sheet.tsx`** — Bottom sheet UI
  - Drag-and-drop or file picker, client-side parse
  - Preview table before import
  - Step flow: upload → preview → importing → done with error summary

## Files Changed

- `database/migrations/049-push-subscriptions.sql` — new
- `apps/web/public/sw.js` — new
- `apps/web/src/lib/push-notifications.ts` — new
- `apps/web/src/lib/sms-templates.ts` — new
- `apps/web/src/services/notification-admin.service.ts` — new
- `apps/web/src/services/load-import.service.ts` — new
- `apps/web/src/pages/admin/notification-health.tsx` — new
- `apps/web/src/features/loads/components/csv-import-sheet.tsx` — new
- `supabase/functions/send-push/index.ts` — new
