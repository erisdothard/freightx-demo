-- 040: Dwell time tracking
-- Records time spent at each facility, auto-flags detention (>2hrs)

CREATE TABLE IF NOT EXISTS dwell_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_number       text NOT NULL,
  geofence_id       uuid NOT NULL REFERENCES geofences(id),
  stop_type         text NOT NULL CHECK (stop_type IN ('pickup', 'delivery')),
  label             text NOT NULL DEFAULT '',
  entered_at        timestamptz NOT NULL DEFAULT now(),
  exited_at         timestamptz,
  dwell_minutes     integer GENERATED ALWAYS AS (
    CASE WHEN exited_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (exited_at - entered_at)) / 60
      ELSE NULL
    END
  ) STORED,
  detention_flagged boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dwell_records_load ON dwell_records(load_number);
CREATE INDEX idx_dwell_records_geofence ON dwell_records(geofence_id);

ALTER TABLE dwell_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read dwell records"
  ON dwell_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert dwell records"
  ON dwell_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update dwell records"
  ON dwell_records FOR UPDATE TO authenticated USING (true);
