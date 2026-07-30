-- Migration 055: Event-driven notification dispatch via pg_net
-- Fires the notification-worker edge function immediately on INSERT
-- instead of waiting for pg_cron's 30s polling cycle.

-- Ensure pg_net is enabled (Supabase projects have this by default)
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Fire-and-forget HTTP POST to the notification-worker edge function.
  -- pg_net runs asynchronously so this won't block the INSERT.
  PERFORM net.http_post(
    url    := current_setting('app.settings.supabase_url', true)
              || '/functions/v1/notification-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body   := jsonb_build_object('trigger', 'insert', 'notification_id', NEW.id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notification_instant ON notifications;
CREATE TRIGGER trg_notification_instant
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_insert();
