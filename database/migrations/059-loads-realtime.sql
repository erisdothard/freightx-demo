-- Migration 059: Add loads table to Supabase Realtime publication
-- Enables instant load board updates when a bid is accepted (load disappears),
-- a load is cancelled, or any status change occurs.
-- Existing use-loads.ts Realtime subscriptions handle INSERT/UPDATE events.

ALTER PUBLICATION supabase_realtime ADD TABLE loads;
