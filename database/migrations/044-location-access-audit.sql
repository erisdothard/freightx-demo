-- 044: Location access audit logging for GDPR compliance
-- Tracks who accessed location data (GPS pings, breadcrumbs, etc.)
-- Enables "right to know" queries: "Who viewed my GPS data?"

-- =============================================================================
-- Audit log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_id UUID REFERENCES profiles(id),       -- Who accessed the data
  accessor_role TEXT,                              -- Their role at time of access
  accessed_driver_id UUID REFERENCES profiles(id), -- Whose location was viewed
  accessed_load_number TEXT,                       -- Which load's data
  access_type TEXT NOT NULL CHECK (
    access_type IN (
      'view_ping',        -- Viewed location_pings
      'view_breadcrumb',  -- Viewed breadcrumb_snapshots
      'view_geofence',    -- Viewed geofences
      'view_dwell',       -- Viewed dwell_records
      'export_data'       -- Exported location data
    )
  ),
  access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast lookups
CREATE INDEX idx_location_audit_driver ON location_access_audit(accessed_driver_id, access_timestamp DESC);
CREATE INDEX idx_location_audit_load ON location_access_audit(accessed_load_number, access_timestamp DESC);
CREATE INDEX idx_location_audit_accessor ON location_access_audit(accessor_id, access_timestamp DESC);
CREATE INDEX idx_location_audit_timestamp ON location_access_audit(access_timestamp DESC);

-- Enable RLS (only admins and the accessed driver can see audit logs)
ALTER TABLE location_access_audit ENABLE ROW LEVEL SECURITY;

-- Drivers can see who accessed their location data
CREATE POLICY "Drivers can read own access logs"
  ON location_access_audit FOR SELECT
  TO authenticated
  USING (accessed_driver_id = auth.uid());

-- Admins can see all audit logs
CREATE POLICY "Admins can read all access logs"
  ON location_access_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON location_access_audit FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- =============================================================================
-- Helper function: Log location access
-- =============================================================================

CREATE OR REPLACE FUNCTION log_location_access(
  p_accessed_driver_id UUID,
  p_accessed_load_number TEXT,
  p_access_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accessor_id UUID;
  v_accessor_role TEXT;
BEGIN
  -- Get current user info
  v_accessor_id := auth.uid();

  -- Get accessor role
  SELECT role INTO v_accessor_role
  FROM profiles
  WHERE id = v_accessor_id;

  -- Insert audit log (async, non-blocking)
  INSERT INTO location_access_audit (
    accessor_id,
    accessor_role,
    accessed_driver_id,
    accessed_load_number,
    access_type,
    metadata
  ) VALUES (
    v_accessor_id,
    v_accessor_role,
    p_accessed_driver_id,
    p_accessed_load_number,
    p_access_type,
    p_metadata
  );

  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the query if audit logging fails
    RETURN true;
END;
$$;

-- =============================================================================
-- Batch audit log function (for bulk reads)
-- =============================================================================

CREATE OR REPLACE FUNCTION log_location_access_batch(
  p_accessed_driver_ids UUID[],
  p_accessed_load_number TEXT,
  p_access_type TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accessor_id UUID;
  v_accessor_role TEXT;
  driver_id UUID;
BEGIN
  v_accessor_id := auth.uid();

  SELECT role INTO v_accessor_role
  FROM profiles
  WHERE id = v_accessor_id;

  -- Log access for each driver
  FOREACH driver_id IN ARRAY p_accessed_driver_ids
  LOOP
    INSERT INTO location_access_audit (
      accessor_id,
      accessor_role,
      accessed_driver_id,
      accessed_load_number,
      access_type
    ) VALUES (
      v_accessor_id,
      v_accessor_role,
      driver_id,
      p_accessed_load_number,
      p_access_type
    );
  END LOOP;

  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RETURN true;
END;
$$;

-- =============================================================================
-- RPC function: Get my location access history (for drivers)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_location_access_history(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  access_timestamp TIMESTAMPTZ,
  accessor_name TEXT,
  accessor_role TEXT,
  access_type TEXT,
  load_number TEXT,
  ip_address INET
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.access_timestamp,
    p.full_name AS accessor_name,
    a.accessor_role,
    a.access_type,
    a.accessed_load_number AS load_number,
    a.ip_address
  FROM location_access_audit a
  LEFT JOIN profiles p ON p.id = a.accessor_id
  WHERE a.accessed_driver_id = auth.uid()
  ORDER BY a.access_timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================================================
-- RPC function: Get load access history (for admins)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_load_access_history(
  p_load_number TEXT,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  access_timestamp TIMESTAMPTZ,
  accessor_name TEXT,
  accessor_role TEXT,
  access_type TEXT,
  accessed_driver_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    a.access_timestamp,
    p1.full_name AS accessor_name,
    a.accessor_role,
    a.access_type,
    p2.full_name AS accessed_driver_name
  FROM location_access_audit a
  LEFT JOIN profiles p1 ON p1.id = a.accessor_id
  LEFT JOIN profiles p2 ON p2.id = a.accessed_driver_id
  WHERE a.accessed_load_number = p_load_number
  ORDER BY a.access_timestamp DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- Cleanup policy: Auto-delete audit logs older than 2 years
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM location_access_audit
  WHERE access_timestamp < NOW() - INTERVAL '2 years';
END;
$$;

-- Schedule cleanup (requires pg_cron extension)
-- Run monthly on the 1st at 1 AM
-- SELECT cron.schedule(
--   'cleanup-location-audit',
--   '0 1 1 * *',
--   'SELECT cleanup_old_audit_logs();'
-- );

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE location_access_audit IS 'GDPR compliance: Tracks who accessed location data. Enables "right to know" queries.';
COMMENT ON FUNCTION log_location_access IS 'Helper function to log location data access. Called by application code when viewing GPS data.';
COMMENT ON FUNCTION get_my_location_access_history IS 'RPC: Drivers can query who accessed their location data (GDPR Article 15 compliance).';
COMMENT ON FUNCTION get_load_access_history IS 'RPC: Admins can query access history for a specific load (audit trail).';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Auto-delete audit logs older than 2 years (retention policy).';
