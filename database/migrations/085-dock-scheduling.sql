-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 085: Dock Scheduling (P3-05)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Shipper stickiness feature. Reduces detention, improves facility throughput.
--
-- Tables:
--   facilities — shipper warehouse/dock locations
--   dock_slots — individual dock doors with operating hours
--   dock_appointments — scheduled pickup/delivery time slots
--
-- RPCs:
--   get_available_dock_slots() — check availability for a date/time
--   book_dock_appointment() — reserve a slot
--   check_in_appointment() — driver arrival
--   check_out_appointment() — driver departure (captures dwell time)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Facilities ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text,
  city            text NOT NULL,
  state           text NOT NULL,
  zip             text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  operating_hours jsonb DEFAULT '{"mon":{"open":"06:00","close":"18:00"},"tue":{"open":"06:00","close":"18:00"},"wed":{"open":"06:00","close":"18:00"},"thu":{"open":"06:00","close":"18:00"},"fri":{"open":"06:00","close":"18:00"}}'::jsonb,
  timezone        text NOT NULL DEFAULT 'America/Chicago',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facilities_company ON facilities(company_id);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_manage_facilities" ON facilities
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Authenticated users can view facilities (for appointment booking)
CREATE POLICY "authenticated_view_facilities" ON facilities
  FOR SELECT USING (auth.role() = 'authenticated' AND active = true);

-- ── Dock slots ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dock_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id   uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  slot_name     text NOT NULL,              -- e.g., 'Dock 1', 'Door A'
  slot_type     text NOT NULL DEFAULT 'both'
                  CHECK (slot_type IN ('inbound', 'outbound', 'both')),
  equipment_types text[],                   -- e.g., {'van', 'reefer'}
  slot_duration_minutes integer NOT NULL DEFAULT 60,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (facility_id, slot_name)
);

ALTER TABLE dock_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_manage_slots" ON dock_slots
  FOR ALL USING (
    facility_id IN (
      SELECT id FROM facilities WHERE company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "authenticated_view_slots" ON dock_slots
  FOR SELECT USING (auth.role() = 'authenticated' AND active = true);

-- ── Dock appointments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dock_appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  dock_slot_id      uuid NOT NULL REFERENCES dock_slots(id) ON DELETE CASCADE,
  load_id           uuid REFERENCES loads(id) ON DELETE SET NULL,
  appointment_type  text NOT NULL CHECK (appointment_type IN ('pickup', 'delivery')),
  scheduled_start   timestamptz NOT NULL,
  scheduled_end     timestamptz NOT NULL,
  carrier_company_id uuid REFERENCES companies(id),
  driver_name       text,
  truck_number      text,
  trailer_number    text,

  status            text NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'checked_in', 'loading',
                                        'completed', 'cancelled', 'no_show')),
  checked_in_at     timestamptz,
  loading_started_at timestamptz,
  checked_out_at    timestamptz,
  dwell_minutes     integer GENERATED ALWAYS AS (
    CASE WHEN checked_out_at IS NOT NULL AND checked_in_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (checked_out_at - checked_in_at))::integer / 60
      ELSE NULL
    END
  ) STORED,
  notes             text,
  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Prevent double-booking
  EXCLUDE USING gist (
    dock_slot_id WITH =,
    tstzrange(scheduled_start, scheduled_end) WITH &&
  ) WHERE (status != 'cancelled')
);

CREATE INDEX IF NOT EXISTS idx_dock_appts_facility ON dock_appointments(facility_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_dock_appts_load ON dock_appointments(load_id);
CREATE INDEX IF NOT EXISTS idx_dock_appts_carrier ON dock_appointments(carrier_company_id);

ALTER TABLE dock_appointments ENABLE ROW LEVEL SECURITY;

-- Facility owners manage appointments
CREATE POLICY "facility_manage_appts" ON dock_appointments
  FOR ALL USING (
    facility_id IN (
      SELECT id FROM facilities WHERE company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Carriers can view and update their own appointments
CREATE POLICY "carrier_view_appts" ON dock_appointments
  FOR SELECT USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "carrier_update_appts" ON dock_appointments
  FOR UPDATE USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- ── RPC: Get available dock slots ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_available_dock_slots(
  p_facility_id      uuid,
  p_date             date,
  p_appointment_type text DEFAULT 'both',
  p_equipment        text DEFAULT NULL
)
RETURNS TABLE (
  slot_id       uuid,
  slot_name     text,
  slot_type     text,
  time_start    timestamptz,
  time_end      timestamptz,
  available     boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_facility record;
  v_slot     record;
  v_start    timestamptz;
  v_end      timestamptz;
  v_hour     integer;
BEGIN
  SELECT * INTO v_facility FROM public.facilities WHERE id = p_facility_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_slot IN
    SELECT ds.* FROM public.dock_slots ds
    WHERE ds.facility_id = p_facility_id
      AND ds.active = true
      AND (p_appointment_type = 'both' OR ds.slot_type IN (p_appointment_type, 'both'))
      AND (p_equipment IS NULL OR p_equipment = ANY(ds.equipment_types) OR ds.equipment_types IS NULL)
  LOOP
    -- Generate hourly slots from 6 AM to 6 PM (simplified)
    FOR v_hour IN 6..17 LOOP
      v_start := (p_date || ' ' || v_hour || ':00:00')::timestamptz;
      v_end := v_start + (v_slot.slot_duration_minutes || ' minutes')::interval;

      slot_id := v_slot.id;
      slot_name := v_slot.slot_name;
      slot_type := v_slot.slot_type;
      time_start := v_start;
      time_end := v_end;
      available := NOT EXISTS (
        SELECT 1 FROM public.dock_appointments da
        WHERE da.dock_slot_id = v_slot.id
          AND da.status != 'cancelled'
          AND tstzrange(da.scheduled_start, da.scheduled_end) && tstzrange(v_start, v_end)
      );

      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

-- ── RPC: Book dock appointment ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.book_dock_appointment(
  p_dock_slot_id     uuid,
  p_load_id          uuid,
  p_scheduled_start  timestamptz,
  p_scheduled_end    timestamptz,
  p_appointment_type text,
  p_driver_name      text DEFAULT NULL,
  p_truck_number     text DEFAULT NULL,
  p_notes            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slot        record;
  v_carrier_co  uuid;
  v_appt_id     uuid;
BEGIN
  SELECT ds.*, f.company_id AS facility_company_id
    INTO v_slot
    FROM public.dock_slots ds
    JOIN public.facilities f ON f.id = ds.facility_id
   WHERE ds.id = p_dock_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dock slot not found');
  END IF;

  -- Check for conflicts
  IF EXISTS (
    SELECT 1 FROM public.dock_appointments
    WHERE dock_slot_id = p_dock_slot_id
      AND status != 'cancelled'
      AND tstzrange(scheduled_start, scheduled_end) && tstzrange(p_scheduled_start, p_scheduled_end)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Time slot already booked');
  END IF;

  -- Get carrier company
  SELECT company_id INTO v_carrier_co
    FROM public.company_members WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.dock_appointments (
    facility_id, dock_slot_id, load_id, appointment_type,
    scheduled_start, scheduled_end,
    carrier_company_id, driver_name, truck_number,
    notes, created_by
  ) VALUES (
    v_slot.facility_id, p_dock_slot_id, p_load_id, p_appointment_type,
    p_scheduled_start, p_scheduled_end,
    v_carrier_co, p_driver_name, p_truck_number,
    p_notes, auth.uid()
  )
  RETURNING id INTO v_appt_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appt_id,
    'slot_name', v_slot.slot_name,
    'scheduled_start', p_scheduled_start,
    'scheduled_end', p_scheduled_end
  );
END;
$$;

-- ── RPC: Check in / check out ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dock_check_in(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.dock_appointments
  SET status = 'checked_in', checked_in_at = now()
  WHERE id = p_appointment_id AND status = 'scheduled';
END;
$$;

CREATE OR REPLACE FUNCTION public.dock_check_out(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appt record;
BEGIN
  UPDATE public.dock_appointments
  SET status = 'completed', checked_out_at = now()
  WHERE id = p_appointment_id AND status IN ('checked_in', 'loading')
  RETURNING * INTO v_appt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appointment not found or not checked in');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dwell_minutes', v_appt.dwell_minutes
  );
END;
$$;

COMMIT;
