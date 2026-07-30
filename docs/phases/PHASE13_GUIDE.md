# Phase 13 — Enterprise Completion

**Status:** Complete

**Migrations:**

- `011-carrier-preferences.sql` — carrier preferences table (Phase 11 gap fix)
- `013-company-members.sql` — company_members + company_invites tables; accept_company_invite() RPC; backfills existing owners
- `014-load-templates.sql` — load_templates table (name + template_data JSONB)
- `015-accessorial-charges.sql` — accessorial_charges table; signed_at, signature_url, signatory_name columns on bids
- `016-saved-searches.sql` — saved_searches table with alert_enabled and last_alerted_at
- `017-broker-payment-metrics.sql` — broker_payment_metrics table; record_broker_payment() rolling-average RPC
- `018-carrier-relationships.sql` — carrier_relationships (preferred/blocked); preferred_carriers_only on loads; RLS excludes blocked carriers
- `019-rate-history.sql` — rate_history table; get_lane_stats() and get_lane_trend() RPCs
- `020-audit-log.sql` — audit_log table; write_audit_log() RPC; DB triggers on loads, bids, and bookings
- `021-notification-queue.sql` — notification_preferences + notification_queue tables; pg_cron worker every 30s
- `022-fulltext-search.sql` — GIN indexes, search_vector GENERATED ALWAYS column, search_loads() RPC
- `023-audit-triggers.sql` — additional audit trigger coverage

**Key files added:**

- `services/email-notifications.service.ts` — 7 Resend templates (new_bid, bid_accepted, bid_declined, booking_confirmed, load_status_change, new_message, lane_alert)
- `services/company-members.service.ts` — invite, manage, and revoke company team members
- `services/saved-searches.service.ts` — save, apply, and alert on filter combinations
- `services/rate-intelligence.service.ts` — getLaneStats, getLaneTrend, recordLaneRate, getRateSuggestion (Claude Sonnet)
- `services/accessorials.service.ts` — addAccessorial, approveAccessorial, denyAccessorial, getApprovedAccessorialTotal
- `features/loads/components/accessorials-sheet.tsx` — carrier submit + broker approve/deny with live invoice total
- `features/loads/components/broker-credit-badge.tsx` — inline broker payment trust signal (avg days-to-pay, on-time %)
- `features/bookings/components/signature-modal.tsx` — canvas e-signature exported to PNG → Supabase Storage
- `supabase/functions/send-notification-email/` — Resend email dispatch
- `supabase/functions/send-sms/` — Twilio SMS dispatch
- `supabase/functions/lane-alert/` — matches new loads against saved searches on INSERT
- `supabase/functions/notification-worker/` — background queue processor with exponential backoff and dead-letter
- `middleware.ts` (project root) — Vercel Edge rate limiting (Upstash KV, per-IP sliding window)
- `pages/admin/audit-log.tsx` — paginated audit trail with entity filter and diff viewer
- `pages/carrier/team.tsx`, `pages/carrier/team-settings.tsx` — company team management

**Features delivered:**

- Email notifications via Resend for all critical events; SMS via Twilio for booking and delivery
- Server-side pagination on all lists (25 rows/page using .range())
- Audit log on load, bid, and booking mutations with admin viewer page
- Multi-user company teams: invite by email, 5 roles (owner/admin/dispatcher/accounting/viewer)
- Load posting templates: save form state, apply with one tap
- Digital e-signature on rate confirmations (canvas pad, stored in Supabase Storage)
- Accessorial charges (detention, lumper, layover, TONU, fuel surcharge) with broker approve/deny; invoice total auto-updates
- Saved searches with per-search email+SMS lane alerts; fires on new load INSERT
- Broker credit score badge (avg days-to-pay, on-time %)
- Preferred/blocked carrier lists enforced at RLS level
- Lane rate history recorded on every booking; get_lane_stats() and get_lane_trend() RPCs
- AI rate suggestion via Claude Sonnet (Low/Mid/High range + confidence + reasoning)
- Full-text search on loads with GIN indexes and search_loads() RPC targeting <50ms at 100k rows
- Background notification queue with retry and dead-letter (pg_cron every 30s)
- Vercel Edge rate limiting per IP via Upstash KV sliding window
