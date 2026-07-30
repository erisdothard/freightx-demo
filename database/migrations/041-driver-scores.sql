-- 041: Driver behavior scoring
-- Computed after delivery based on speed, route adherence, dwell times

CREATE TABLE IF NOT EXISTS driver_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid NOT NULL REFERENCES profiles(id),
  load_number   text NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  speed_score   integer NOT NULL CHECK (speed_score BETWEEN 0 AND 100),
  route_score   integer NOT NULL CHECK (route_score BETWEEN 0 AND 100),
  dwell_score   integer NOT NULL CHECK (dwell_score BETWEEN 0 AND 100),
  details       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_scores_driver ON driver_scores(driver_id);
CREATE INDEX idx_driver_scores_load ON driver_scores(load_number);

ALTER TABLE driver_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read driver scores"
  ON driver_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert driver scores"
  ON driver_scores FOR INSERT TO authenticated WITH CHECK (true);
