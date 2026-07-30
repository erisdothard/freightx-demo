-- Migration 051: Driver incidents table (replaces tire-only log)
CREATE TABLE IF NOT EXISTS driver_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  load_number TEXT,
  incident_type TEXT NOT NULL, -- tire|engine|brake|lights|body_damage|accident|driver_illness|cargo|fuel|other
  severity TEXT NOT NULL DEFAULT 'minor', -- minor|moderate|severe|critical
  description TEXT,
  location_text TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE driver_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_incidents_own" ON driver_incidents
  FOR ALL TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "driver_incidents_company_read" ON driver_incidents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.company_id = (
      SELECT company_id FROM company_members WHERE user_id = driver_incidents.driver_id LIMIT 1
    )
  ));
