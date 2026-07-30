-- 039: Geofences and geofence events
-- Alerts-only geofencing — never auto-changes load status

CREATE TABLE IF NOT EXISTS geofences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_number text NOT NULL,
  stop_type   text NOT NULL CHECK (stop_type IN ('pickup', 'delivery')),
  label       text NOT NULL DEFAULT '',
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  radius_m    integer NOT NULL DEFAULT 500,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_geofences_load ON geofences(load_number);

ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read geofences"
  ON geofences FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert geofences"
  ON geofences FOR INSERT TO authenticated WITH CHECK (true);

-- Geofence events log
CREATE TABLE IF NOT EXISTS geofence_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id  uuid NOT NULL REFERENCES geofences(id),
  load_number  text NOT NULL,
  driver_id    uuid NOT NULL REFERENCES profiles(id),
  event_type   text NOT NULL CHECK (event_type IN ('enter', 'exit')),
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_geofence_events_load ON geofence_events(load_number);
CREATE INDEX idx_geofence_events_geofence ON geofence_events(geofence_id);

ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read geofence events"
  ON geofence_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert geofence events"
  ON geofence_events FOR INSERT TO authenticated WITH CHECK (true);
