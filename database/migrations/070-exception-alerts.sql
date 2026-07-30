-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 070: Proactive Exception Alerts (P1-06)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Alert shippers/brokers when loads hit exceptions:
--   - Late pickup (past pickup_date with no status change)
--   - Delivery delay (past delivery_date while in_transit)
--   - Detention threshold (dwell time > 2 hours at facility)
--   - Unresponsive carrier (no GPS ping in 30+ minutes while in_transit)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Exception alert rules table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS load_exception_alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id        uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  alert_type     text NOT NULL CHECK (alert_type IN (
    'late_pickup', 'delivery_delay', 'detention_risk',
    'carrier_unresponsive', 'route_deviation'
  )),
  severity       text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message        text NOT NULL,
  acknowledged   boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exception_alerts_load ON load_exception_alerts(load_id);
CREATE INDEX IF NOT EXISTS idx_exception_alerts_unack
  ON load_exception_alerts(load_id) WHERE acknowledged = false;

ALTER TABLE load_exception_alerts ENABLE ROW LEVEL SECURITY;

-- Load poster (broker/shipper) and admin can see alerts for their loads
CREATE POLICY "poster_view_alerts" ON load_exception_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM loads WHERE id = load_exception_alerts.load_id
        AND posted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can acknowledge their own load alerts
CREATE POLICY "poster_ack_alerts" ON load_exception_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM loads WHERE id = load_exception_alerts.load_id
        AND posted_by = auth.uid()
    )
  );

-- System insert (via triggers/functions)
CREATE POLICY "system_insert_alerts" ON load_exception_alerts
  FOR INSERT WITH CHECK (true);

-- ── RPC: Check for late pickups ────────────────────────────────────────────
-- Call periodically (e.g., via pg_cron or edge function every 15 min)
CREATE OR REPLACE FUNCTION public.check_late_pickups()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
  v_load  record;
BEGIN
  FOR v_load IN
    SELECT l.id, l.load_number, l.origin_city, l.origin_state,
           l.pickup_date, l.posted_by
    FROM public.loads l
    WHERE l.status IN ('awarded', 'dispatched')
      AND l.pickup_date < CURRENT_DATE
      AND l.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.load_exception_alerts a
        WHERE a.load_id = l.id AND a.alert_type = 'late_pickup'
      )
  LOOP
    INSERT INTO public.load_exception_alerts (load_id, alert_type, severity, message)
    VALUES (
      v_load.id, 'late_pickup', 'warning',
      format('Load %s — pickup was scheduled for %s at %s, %s but load has not departed.',
        v_load.load_number, v_load.pickup_date,
        v_load.origin_city, v_load.origin_state)
    );

    -- Notify the poster
    IF v_load.posted_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
      VALUES (
        v_load.posted_by, 'load_status_change',
        'Late Pickup Alert',
        format('Load %s has not departed — pickup was scheduled for %s.',
          v_load.load_number, v_load.pickup_date),
        v_load.id, false
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── RPC: Check for delivery delays ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_delivery_delays()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
  v_load  record;
BEGIN
  FOR v_load IN
    SELECT l.id, l.load_number, l.dest_city, l.dest_state,
           l.delivery_date, l.posted_by
    FROM public.loads l
    WHERE l.status = 'in_transit'
      AND l.delivery_date < CURRENT_DATE
      AND l.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.load_exception_alerts a
        WHERE a.load_id = l.id AND a.alert_type = 'delivery_delay'
      )
  LOOP
    INSERT INTO public.load_exception_alerts (load_id, alert_type, severity, message)
    VALUES (
      v_load.id, 'delivery_delay', 'critical',
      format('Load %s — delivery to %s, %s was expected by %s but load is still in transit.',
        v_load.load_number, v_load.dest_city, v_load.dest_state, v_load.delivery_date)
    );

    IF v_load.posted_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
      VALUES (
        v_load.posted_by, 'load_status_change',
        'Delivery Delay Alert',
        format('Load %s has not arrived — delivery was expected by %s.',
          v_load.load_number, v_load.delivery_date),
        v_load.id, false
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── RPC: Acknowledge an alert ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acknowledge_alert(p_alert_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.load_exception_alerts
  SET acknowledged = true,
      acknowledged_by = auth.uid(),
      acknowledged_at = now()
  WHERE id = p_alert_id
    AND EXISTS (
      SELECT 1 FROM public.loads
      WHERE id = load_exception_alerts.load_id
        AND posted_by = auth.uid()
    );
END;
$$;

-- ── RPC: Get unacknowledged alerts for a user's loads ──────────────────────
CREATE OR REPLACE FUNCTION public.get_my_alerts()
RETURNS SETOF load_exception_alerts
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT a.*
    FROM public.load_exception_alerts a
    JOIN public.loads l ON l.id = a.load_id
    WHERE l.posted_by = auth.uid()
      AND a.acknowledged = false
    ORDER BY a.created_at DESC
    LIMIT 50;
END;
$$;

COMMIT;
