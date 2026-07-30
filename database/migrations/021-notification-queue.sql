-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 021: Notification Queue + Worker (Phase 13D)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Notification preferences ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings  JSONB NOT NULL DEFAULT '{
    "new_loads":    {"push": true,  "email": true,  "sms": false},
    "bid_updates":  {"push": true,  "email": true,  "sms": true},
    "load_status":  {"push": true,  "email": false, "sms": false},
    "messages":     {"push": true,  "email": false, "sms": false},
    "reminders":    {"push": true,  "email": true,  "sms": false},
    "marketing":    {"push": false, "email": true,  "sms": false}
  }',
  phone_number TEXT,   -- E.164 format for SMS
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_notif_prefs" ON public.notification_preferences
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Notification queue ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,     -- email|sms
  recipient     TEXT NOT NULL,     -- email address or E.164 phone
  subject       TEXT,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed|dead
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_queue_type   CHECK (type   IN ('email', 'sms')),
  CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'sent', 'failed', 'dead'))
);

CREATE INDEX IF NOT EXISTS notif_queue_status_idx ON public.notification_queue(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS notif_queue_created_idx ON public.notification_queue(created_at DESC);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Service role manages queue
CREATE POLICY "service_manage_queue" ON public.notification_queue
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- App can enqueue notifications
CREATE POLICY "authenticated_enqueue" ON public.notification_queue
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── RPC: enqueue_notification ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_type      TEXT,
  p_recipient TEXT,
  p_subject   TEXT,
  p_payload   JSONB
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notification_queue (type, recipient, subject, payload)
  VALUES (p_type, p_recipient, p_subject, p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── pg_cron: schedule notification worker (run in SQL Editor separately) ─────
-- Requires pg_cron extension + net extension enabled in your Supabase project.
--
-- SELECT cron.schedule(
--   'notification-worker',
--   '*/30 * * * * *',   -- every 30 seconds (use '*/1 * * * *' for 1-minute if 30s not supported)
--   $$SELECT net.http_post(
--       url:='https://qeovhjdrwihnyfcbnujk.supabase.co/functions/v1/notification-worker',
--       headers:='{"Authorization":"Bearer <service_role_key>","Content-Type":"application/json"}'::jsonb,
--       body:='{}'::jsonb
--   )$$
-- );
--
-- pg_cron: schedule location cleanup (Phase 12 gap — 0B fix)
--
-- SELECT cron.schedule(
--   'location-cleanup',
--   '0 * * * *',
--   $$SELECT net.http_post(
--       url:='https://qeovhjdrwihnyfcbnujk.supabase.co/functions/v1/location-cleanup',
--       headers:='{"Authorization":"Bearer <service_role_key>"}'::jsonb,
--       body:='{}'::jsonb
--   )$$
-- );
