-- 037: Breadcrumb trail snapshots for route replay
-- Stores compressed polyline JSON after delivery for historical replay

CREATE TABLE IF NOT EXISTS breadcrumb_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_number   text NOT NULL,
  driver_id     uuid NOT NULL REFERENCES profiles(id),
  polyline      jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_points  integer NOT NULL DEFAULT 0,
  start_time    timestamptz,
  end_time      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_breadcrumb_snapshots_load ON breadcrumb_snapshots(load_number);
CREATE INDEX idx_breadcrumb_snapshots_driver ON breadcrumb_snapshots(driver_id);

-- RLS: authenticated users can read, system inserts
ALTER TABLE breadcrumb_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read breadcrumb snapshots"
  ON breadcrumb_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert breadcrumb snapshots"
  ON breadcrumb_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);
