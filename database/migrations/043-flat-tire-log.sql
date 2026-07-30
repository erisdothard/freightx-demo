-- 043: Flat tire incident log for drivers
-- Tracks tire incidents with photos, location, severity, and resolution

CREATE TABLE IF NOT EXISTS tire_incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL REFERENCES profiles(id),
  load_number     text,
  incident_date   date NOT NULL DEFAULT CURRENT_DATE,
  location_text   text NOT NULL DEFAULT '',
  lat             double precision,
  lng             double precision,
  tire_position   text NOT NULL CHECK (tire_position IN (
    'front_left', 'front_right',
    'rear_outer_left', 'rear_outer_right',
    'rear_inner_left', 'rear_inner_right',
    'trailer_left_1', 'trailer_right_1',
    'trailer_left_2', 'trailer_right_2'
  )),
  severity        text NOT NULL CHECK (severity IN ('flat', 'blowout', 'low_pressure', 'damage')),
  description     text,
  resolution      text CHECK (resolution IN ('changed_spare', 'roadside_service', 'patched', 'replaced', 'other')),
  resolved_at     timestamptz,
  photos          text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tire_incidents_driver ON tire_incidents(driver_id);
CREATE INDEX idx_tire_incidents_load ON tire_incidents(load_number);

ALTER TABLE tire_incidents ENABLE ROW LEVEL SECURITY;

-- Drivers can manage their own incidents
CREATE POLICY "Drivers can read own tire incidents"
  ON tire_incidents FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Drivers can insert own tire incidents"
  ON tire_incidents FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can update own tire incidents"
  ON tire_incidents FOR UPDATE TO authenticated
  USING (driver_id = auth.uid());

-- Carrier/admin can read all (company drivers)
CREATE POLICY "Carriers can read tire incidents"
  ON tire_incidents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'dispatcher')
    )
  );

-- Storage bucket for tire photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tire-photos', 'tire-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload tire photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tire-photos');

CREATE POLICY "Public can read tire photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tire-photos');
