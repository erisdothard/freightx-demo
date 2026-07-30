-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 082: ELD / HOS Compliance (P3-02)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Table stakes for enterprise freight. Implements:
--   - HOS duty log (every status transition with duration)
--   - HOS violations detection and tracking
--   - HOS daily summary (pre-aggregated for rolling calculations)
--   - ELD device registry for external integrations
--   - get_driver_hos_status() for real-time compliance dashboard
--
-- Regulatory: 49 CFR Part 395 (FMCSA Hours of Service)
--   - 11-hour driving limit
--   - 14-hour on-duty window
--   - 30-minute break after 8 hours driving
--   - 60/70-hour weekly limit
--   - 10-hour off-duty minimum
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── HOS duty status enum (extends existing) ──────────────────────────────────
DO $$ BEGIN
  CREATE TYPE hos_duty_status AS ENUM (
    'off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── HOS duty log ─────────────────────────────────────────────────────────────
-- Every status transition for audit trail and HOS calculations
CREATE TABLE IF NOT EXISTS hos_duty_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  duty_status    hos_duty_status NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  duration_minutes numeric(8,2) GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
      ELSE NULL
    END
  ) STORED,
  location_start text,              -- city, state at transition
  location_end   text,
  lat_start      numeric(9,6),
  lng_start      numeric(9,6),
  lat_end        numeric(9,6),
  lng_end        numeric(9,6),
  odometer_start numeric(10,1),     -- miles
  odometer_end   numeric(10,1),
  remarks        text CHECK (char_length(remarks) <= 500),
  source         text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual', 'eld_auto', 'eld_device', 'system')),
  eld_device_id  uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hos_duty_log_driver ON hos_duty_log(driver_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_hos_duty_log_company ON hos_duty_log(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_hos_duty_log_active ON hos_duty_log(driver_id)
  WHERE ended_at IS NULL;

ALTER TABLE hos_duty_log ENABLE ROW LEVEL SECURITY;

-- Drivers see their own logs; carrier admins see company logs
CREATE POLICY "driver_view_own_hos" ON hos_duty_log
  FOR SELECT USING (
    driver_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "system_insert_hos" ON hos_duty_log
  FOR INSERT WITH CHECK (true);

-- ── HOS violations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hos_violations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  violation_type  text NOT NULL CHECK (violation_type IN (
    '11_hour_driving',   -- Exceeded 11-hour driving limit
    '14_hour_window',    -- Exceeded 14-hour on-duty window
    '30_min_break',      -- No 30-minute break after 8 hours driving
    '60_hour_limit',     -- Exceeded 60-hour/7-day limit
    '70_hour_limit',     -- Exceeded 70-hour/8-day limit
    '10_hour_rest',      -- Insufficient off-duty rest period
    'missing_log'        -- Gap in duty log entries
  )),
  severity        text NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('warning', 'violation', 'critical')),
  message         text NOT NULL,
  hours_at_violation numeric(5,2),  -- How many hours were logged at time of violation
  acknowledged    boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hos_violations_driver ON hos_violations(driver_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_hos_violations_unacked ON hos_violations(driver_id)
  WHERE acknowledged = false;

ALTER TABLE hos_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_view_violations" ON hos_violations
  FOR SELECT USING (
    driver_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "driver_ack_violations" ON hos_violations
  FOR UPDATE USING (driver_id = auth.uid());

-- ── HOS daily summary ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hos_daily_summary (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date         date NOT NULL,
  drive_minutes    integer NOT NULL DEFAULT 0,
  on_duty_minutes  integer NOT NULL DEFAULT 0,
  off_duty_minutes integer NOT NULL DEFAULT 0,
  sleeper_minutes  integer NOT NULL DEFAULT 0,
  total_miles      numeric(8,1) DEFAULT 0,
  violations_count integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (driver_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_hos_daily_driver ON hos_daily_summary(driver_id, log_date DESC);

ALTER TABLE hos_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_view_daily_summary" ON hos_daily_summary
  FOR SELECT USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM company_members cm
      JOIN hos_daily_summary hs ON hs.driver_id = cm.user_id
      WHERE cm.company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ── ELD device registry ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eld_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_serial   text NOT NULL,
  provider        text NOT NULL CHECK (provider IN (
    'samsara', 'geotab', 'verizon_connect', 'keeptruckin', 'omnitracs',
    'platform_science', 'motive', 'other'
  )),
  vehicle_vin     text,
  truck_id        uuid REFERENCES trucks(id),
  assigned_driver uuid REFERENCES profiles(id),
  api_token_hash  text,            -- Hashed token for provider API
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'malfunction')),
  last_sync_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, device_serial)
);

ALTER TABLE eld_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_manage_eld" ON eld_devices
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── RPC: Get driver HOS status ───────────────────────────────────────────────
-- Returns real-time compliance dashboard data
CREATE OR REPLACE FUNCTION public.get_driver_hos_status(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today           date := CURRENT_DATE;
  v_current_status  record;
  v_today_drive     integer := 0;
  v_today_on_duty   integer := 0;
  v_window_start    timestamptz;
  v_last_rest_end   timestamptz;
  v_7day_total      integer := 0;
  v_8day_total      integer := 0;
  v_last_break      timestamptz;
  v_drive_since_break integer := 0;
BEGIN
  -- Current duty status
  SELECT duty_status, started_at INTO v_current_status
    FROM public.hos_duty_log
   WHERE driver_id = p_driver_id AND ended_at IS NULL
   ORDER BY started_at DESC LIMIT 1;

  -- Today's totals
  SELECT
    COALESCE(SUM(CASE WHEN duty_status = 'driving' THEN duration_minutes END), 0)::integer,
    COALESCE(SUM(CASE WHEN duty_status IN ('driving', 'on_duty_not_driving') THEN duration_minutes END), 0)::integer
  INTO v_today_drive, v_today_on_duty
  FROM public.hos_duty_log
  WHERE driver_id = p_driver_id
    AND started_at::date = v_today;

  -- Add current active period if driving/on-duty
  IF v_current_status.duty_status IN ('driving', 'on_duty_not_driving') THEN
    v_today_on_duty := v_today_on_duty + EXTRACT(EPOCH FROM (now() - v_current_status.started_at))::integer / 60;
    IF v_current_status.duty_status = 'driving' THEN
      v_today_drive := v_today_drive + EXTRACT(EPOCH FROM (now() - v_current_status.started_at))::integer / 60;
    END IF;
  END IF;

  -- 14-hour window: from first on-duty after last 10+ hour off-duty
  SELECT MAX(ended_at) INTO v_last_rest_end
    FROM public.hos_duty_log
   WHERE driver_id = p_driver_id
     AND duty_status IN ('off_duty', 'sleeper_berth')
     AND duration_minutes >= 600  -- 10 hours
     AND ended_at <= now();

  v_window_start := COALESCE(v_last_rest_end, v_today::timestamptz);

  -- 7-day / 8-day rolling totals
  SELECT
    COALESCE(SUM(drive_minutes + on_duty_minutes), 0)::integer
  INTO v_7day_total
  FROM public.hos_daily_summary
  WHERE driver_id = p_driver_id
    AND log_date >= v_today - 6;

  SELECT
    COALESCE(SUM(drive_minutes + on_duty_minutes), 0)::integer
  INTO v_8day_total
  FROM public.hos_daily_summary
  WHERE driver_id = p_driver_id
    AND log_date >= v_today - 7;

  -- Last 30-minute break
  SELECT MAX(started_at) INTO v_last_break
    FROM public.hos_duty_log
   WHERE driver_id = p_driver_id
     AND duty_status IN ('off_duty', 'sleeper_berth')
     AND duration_minutes >= 30
     AND started_at::date = v_today;

  -- Drive time since last break
  SELECT COALESCE(SUM(
    CASE WHEN duty_status = 'driving' THEN duration_minutes ELSE 0 END
  ), 0)::integer INTO v_drive_since_break
  FROM public.hos_duty_log
  WHERE driver_id = p_driver_id
    AND started_at > COALESCE(v_last_break, v_today::timestamptz)
    AND started_at::date = v_today;

  RETURN jsonb_build_object(
    'driver_id', p_driver_id,
    'current_status', COALESCE(v_current_status.duty_status::text, 'off_duty'),
    'current_since', v_current_status.started_at,
    'today', jsonb_build_object(
      'drive_minutes', v_today_drive,
      'drive_remaining', GREATEST(0, 660 - v_today_drive),  -- 11 hours
      'on_duty_minutes', v_today_on_duty,
      'window_remaining', GREATEST(0, 840 - EXTRACT(EPOCH FROM (now() - v_window_start))::integer / 60)  -- 14 hours
    ),
    'break', jsonb_build_object(
      'last_break_at', v_last_break,
      'drive_since_break', v_drive_since_break,
      'break_required', v_drive_since_break >= 480  -- 8 hours
    ),
    'weekly', jsonb_build_object(
      '7day_on_duty_minutes', v_7day_total,
      '7day_remaining', GREATEST(0, 3600 - v_7day_total),   -- 60 hours
      '8day_on_duty_minutes', v_8day_total,
      '8day_remaining', GREATEST(0, 4200 - v_8day_total)    -- 70 hours
    ),
    'compliance', jsonb_build_object(
      'drive_ok', v_today_drive < 660,
      'window_ok', EXTRACT(EPOCH FROM (now() - v_window_start))::integer / 60 < 840,
      'break_ok', v_drive_since_break < 480,
      'weekly_ok', v_7day_total < 3600 OR v_8day_total < 4200
    )
  );
END;
$$;

-- ── RPC: Log duty status transition ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_duty_transition(
  p_new_status   hos_duty_status,
  p_location     text DEFAULT NULL,
  p_lat          numeric DEFAULT NULL,
  p_lng          numeric DEFAULT NULL,
  p_remarks      text DEFAULT NULL,
  p_source       text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_id  uuid := auth.uid();
  v_company_id uuid;
  v_current    record;
  v_new_id     uuid;
BEGIN
  -- Get driver's company
  SELECT company_id INTO v_company_id
    FROM public.company_members
   WHERE user_id = v_driver_id LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Driver not associated with a company';
  END IF;

  -- Close the current active entry
  SELECT id, duty_status INTO v_current
    FROM public.hos_duty_log
   WHERE driver_id = v_driver_id AND ended_at IS NULL
   ORDER BY started_at DESC LIMIT 1;

  IF FOUND THEN
    UPDATE public.hos_duty_log
    SET ended_at = now(),
        location_end = p_location,
        lat_end = p_lat,
        lng_end = p_lng
    WHERE id = v_current.id;
  END IF;

  -- Open new entry
  INSERT INTO public.hos_duty_log (
    driver_id, company_id, duty_status,
    location_start, lat_start, lng_start,
    remarks, source
  ) VALUES (
    v_driver_id, v_company_id, p_new_status,
    p_location, p_lat, p_lng,
    p_remarks, p_source
  )
  RETURNING id INTO v_new_id;

  -- Update profile duty status
  UPDATE public.profiles
  SET current_duty_status = CASE p_new_status
        WHEN 'driving' THEN 'driving'
        WHEN 'on_duty_not_driving' THEN 'on_duty'
        WHEN 'sleeper_berth' THEN 'sleeper'
        WHEN 'off_duty' THEN 'off_duty'
      END::duty_status,
      duty_status_updated_at = now()
  WHERE id = v_driver_id;

  RETURN v_new_id;
END;
$$;

-- ── RPC: Aggregate daily summary ─────────────────────────────────────────────
-- Call at end of day or periodically via cron
CREATE OR REPLACE FUNCTION public.aggregate_hos_daily(
  p_driver_id uuid,
  p_date      date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stats record;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN duty_status = 'driving' THEN duration_minutes END), 0)::integer AS drive,
    COALESCE(SUM(CASE WHEN duty_status = 'on_duty_not_driving' THEN duration_minutes END), 0)::integer AS on_duty,
    COALESCE(SUM(CASE WHEN duty_status = 'off_duty' THEN duration_minutes END), 0)::integer AS off_duty,
    COALESCE(SUM(CASE WHEN duty_status = 'sleeper_berth' THEN duration_minutes END), 0)::integer AS sleeper,
    COALESCE(MAX(odometer_end) - MIN(odometer_start), 0) AS miles
  INTO v_stats
  FROM public.hos_duty_log
  WHERE driver_id = p_driver_id
    AND started_at::date = p_date
    AND ended_at IS NOT NULL;

  INSERT INTO public.hos_daily_summary (
    driver_id, log_date, drive_minutes, on_duty_minutes,
    off_duty_minutes, sleeper_minutes, total_miles
  ) VALUES (
    p_driver_id, p_date, v_stats.drive, v_stats.on_duty,
    v_stats.off_duty, v_stats.sleeper, v_stats.miles
  )
  ON CONFLICT (driver_id, log_date) DO UPDATE SET
    drive_minutes = EXCLUDED.drive_minutes,
    on_duty_minutes = EXCLUDED.on_duty_minutes,
    off_duty_minutes = EXCLUDED.off_duty_minutes,
    sleeper_minutes = EXCLUDED.sleeper_minutes,
    total_miles = EXCLUDED.total_miles,
    updated_at = now();
END;
$$;

COMMIT;
