-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 025: Enable Realtime for notifications
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- Required for the useNotifications hook to receive instant updates
-- via Supabase Realtime (postgres_changes subscription)
alter publication supabase_realtime add table notifications;
