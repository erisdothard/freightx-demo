-- Migration 063: Google Calendar Integration
-- Stores OAuth tokens for driver calendar sync.
-- Trigger fires the calendar-sync edge function when a driver is assigned to a load.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Calendar integrations table
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  calendar_id     TEXT,              -- Google Calendar ID to write events to
  access_token    TEXT NOT NULL,      -- encrypted OAuth access token
  refresh_token   TEXT NOT NULL,      -- encrypted OAuth refresh token
  token_expires_at TIMESTAMPTZ NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS calendar_integrations_user_idx
  ON public.calendar_integrations(user_id);

-- 2. RLS — users manage their own integrations only
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_calendar"
  ON public.calendar_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_calendar"
  ON public.calendar_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_calendar"
  ON public.calendar_integrations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_calendar"
  ON public.calendar_integrations FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass for edge functions (token refresh writes)
CREATE POLICY "service_role_manage_calendar"
  ON public.calendar_integrations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Trigger: fire calendar-sync edge function when a driver is assigned
CREATE OR REPLACE FUNCTION public.on_driver_assigned_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when assigned_driver_id is set (not cleared)
  IF NEW.assigned_driver_id IS NOT NULL
     AND (OLD.assigned_driver_id IS DISTINCT FROM NEW.assigned_driver_id)
  THEN
    -- Check if the driver has a calendar integration enabled
    IF EXISTS (
      SELECT 1 FROM calendar_integrations
       WHERE user_id = NEW.assigned_driver_id
         AND enabled = true
    ) THEN
      PERFORM net.http_post(
        url     := current_setting('app.settings.supabase_url', true)
                   || '/functions/v1/calendar-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body    := jsonb_build_object(
          'load_id',   NEW.id::TEXT,
          'driver_id', NEW.assigned_driver_id::TEXT
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_assigned_calendar ON loads;
CREATE TRIGGER trg_driver_assigned_calendar
  AFTER UPDATE OF assigned_driver_id ON loads
  FOR EACH ROW
  EXECUTE FUNCTION on_driver_assigned_calendar();
