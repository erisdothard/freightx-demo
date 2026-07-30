-- 045: Data retention policy and GDPR "right to forget"
-- Implements automatic cleanup of old location data
-- Provides GDPR Article 17 compliance (right to erasure)

-- =============================================================================
-- Cleanup function: Location pings (90-day retention)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_location_pings()
RETURNS TABLE (deleted_count BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete location pings older than 90 days
  DELETE FROM location_pings
  WHERE recorded_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- =============================================================================
-- Cleanup function: Breadcrumb snapshots (7-day retention)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_breadcrumb_snapshots()
RETURNS TABLE (deleted_count BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete breadcrumb snapshots older than 7 days
  -- Route replay data not needed long-term
  DELETE FROM breadcrumb_snapshots
  WHERE created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- =============================================================================
-- Cleanup function: Geofence events (90-day retention)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_geofence_events()
RETURNS TABLE (deleted_count BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete geofence enter/exit events older than 90 days
  DELETE FROM geofence_events
  WHERE recorded_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- =============================================================================
-- Cleanup function: Dwell records (90-day retention)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_dwell_records()
RETURNS TABLE (deleted_count BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete dwell time records older than 90 days
  DELETE FROM dwell_records
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- =============================================================================
-- Master cleanup function: Run all retention policies
-- =============================================================================

CREATE OR REPLACE FUNCTION run_location_data_retention_policy()
RETURNS TABLE (
  table_name TEXT,
  deleted_count BIGINT,
  executed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pings_deleted BIGINT;
  v_breadcrumbs_deleted BIGINT;
  v_geofence_events_deleted BIGINT;
  v_dwell_deleted BIGINT;
  v_timestamp TIMESTAMPTZ;
BEGIN
  v_timestamp := NOW();

  -- Run all cleanup functions
  SELECT * INTO v_pings_deleted FROM cleanup_old_location_pings();
  SELECT * INTO v_breadcrumbs_deleted FROM cleanup_old_breadcrumb_snapshots();
  SELECT * INTO v_geofence_events_deleted FROM cleanup_old_geofence_events();
  SELECT * INTO v_dwell_deleted FROM cleanup_old_dwell_records();

  -- Return summary
  RETURN QUERY
  SELECT 'location_pings'::TEXT, v_pings_deleted, v_timestamp
  UNION ALL
  SELECT 'breadcrumb_snapshots'::TEXT, v_breadcrumbs_deleted, v_timestamp
  UNION ALL
  SELECT 'geofence_events'::TEXT, v_geofence_events_deleted, v_timestamp
  UNION ALL
  SELECT 'dwell_records'::TEXT, v_dwell_deleted, v_timestamp;
END;
$$;

-- =============================================================================
-- Schedule automated cleanup (requires pg_cron extension)
-- =============================================================================

-- NOTE: Uncomment these lines if pg_cron extension is installed
-- This runs daily at 2 AM UTC

-- SELECT cron.schedule(
--   'cleanup-location-pings',
--   '0 2 * * *',  -- Daily at 2 AM
--   'SELECT cleanup_old_location_pings();'
-- );

-- SELECT cron.schedule(
--   'cleanup-breadcrumb-snapshots',
--   '0 3 * * *',  -- Daily at 3 AM
--   'SELECT cleanup_old_breadcrumb_snapshots();'
-- );

-- SELECT cron.schedule(
--   'cleanup-geofence-events',
--   '0 4 * * *',  -- Daily at 4 AM
--   'SELECT cleanup_old_geofence_events();'
-- );

-- SELECT cron.schedule(
--   'cleanup-dwell-records',
--   '0 5 * * *',  -- Daily at 5 AM
--   'SELECT cleanup_old_dwell_records();'
-- );

-- =============================================================================
-- GDPR Article 17: Right to erasure ("right to forget")
-- =============================================================================

-- Table to track deletion requests
CREATE TABLE IF NOT EXISTS gdpr_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  deletion_type TEXT NOT NULL CHECK (
    deletion_type IN (
      'location_data',      -- All location-related data
      'full_account',       -- Entire user account (triggers cascade)
      'partial_date_range'  -- Location data within specific date range
    )
  ),
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID REFERENCES profiles(id), -- Admin who processed the request
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_gdpr_deletion_log_user ON gdpr_deletion_log(user_id, deleted_at DESC);

ALTER TABLE gdpr_deletion_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read deletion logs
CREATE POLICY "Admins can read deletion logs"
  ON gdpr_deletion_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- Function: Anonymize driver location data (GDPR right to forget)
-- =============================================================================

CREATE OR REPLACE FUNCTION anonymize_driver_location_data(
  p_driver_id UUID,
  p_date_range_start TIMESTAMPTZ DEFAULT NULL,
  p_date_range_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  table_name TEXT,
  rows_deleted BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pings_deleted BIGINT := 0;
  v_breadcrumbs_deleted BIGINT := 0;
  v_geofence_events_deleted BIGINT := 0;
  v_dwell_deleted BIGINT := 0;
  v_audit_deleted BIGINT := 0;
BEGIN
  -- Only admins or the driver themselves can anonymize
  IF NOT (
    auth.uid() = p_driver_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: you can only delete your own data or must be admin';
  END IF;

  -- Delete location pings
  IF p_date_range_start IS NOT NULL AND p_date_range_end IS NOT NULL THEN
    -- Partial deletion (date range)
    DELETE FROM location_pings
    WHERE driver_id = p_driver_id
      AND recorded_at >= p_date_range_start
      AND recorded_at <= p_date_range_end;
  ELSE
    -- Full deletion (all time)
    DELETE FROM location_pings WHERE driver_id = p_driver_id;
  END IF;
  GET DIAGNOSTICS v_pings_deleted = ROW_COUNT;

  -- Delete breadcrumb snapshots
  IF p_date_range_start IS NOT NULL AND p_date_range_end IS NOT NULL THEN
    DELETE FROM breadcrumb_snapshots
    WHERE driver_id = p_driver_id
      AND created_at >= p_date_range_start
      AND created_at <= p_date_range_end;
  ELSE
    DELETE FROM breadcrumb_snapshots WHERE driver_id = p_driver_id;
  END IF;
  GET DIAGNOSTICS v_breadcrumbs_deleted = ROW_COUNT;

  -- Delete geofence events
  IF p_date_range_start IS NOT NULL AND p_date_range_end IS NOT NULL THEN
    DELETE FROM geofence_events
    WHERE driver_id = p_driver_id
      AND recorded_at >= p_date_range_start
      AND recorded_at <= p_date_range_end;
  ELSE
    DELETE FROM geofence_events WHERE driver_id = p_driver_id;
  END IF;
  GET DIAGNOSTICS v_geofence_events_deleted = ROW_COUNT;

  -- Delete dwell records (via load linkage)
  IF p_date_range_start IS NOT NULL AND p_date_range_end IS NOT NULL THEN
    DELETE FROM dwell_records
    WHERE load_number IN (
      SELECT load_number FROM loads WHERE assigned_driver_id = p_driver_id
    )
    AND entered_at >= p_date_range_start
    AND entered_at <= p_date_range_end;
  ELSE
    DELETE FROM dwell_records
    WHERE load_number IN (
      SELECT load_number FROM loads WHERE assigned_driver_id = p_driver_id
    );
  END IF;
  GET DIAGNOSTICS v_dwell_deleted = ROW_COUNT;

  -- Delete audit logs related to this driver
  IF p_date_range_start IS NULL THEN
    DELETE FROM location_access_audit WHERE accessed_driver_id = p_driver_id;
    GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;
  END IF;

  -- Clear last_known_location from users table (only if full deletion)
  IF p_date_range_start IS NULL THEN
    UPDATE profiles
    SET last_known_location = NULL,
        last_location_update = NULL
    WHERE id = p_driver_id;
  END IF;

  -- Log the deletion
  INSERT INTO gdpr_deletion_log (
    user_id,
    deletion_type,
    date_range_start,
    date_range_end,
    deleted_by,
    metadata
  ) VALUES (
    p_driver_id,
    CASE
      WHEN p_date_range_start IS NOT NULL THEN 'partial_date_range'
      ELSE 'location_data'
    END,
    p_date_range_start,
    p_date_range_end,
    auth.uid(),
    jsonb_build_object(
      'pings_deleted', v_pings_deleted,
      'breadcrumbs_deleted', v_breadcrumbs_deleted,
      'geofence_events_deleted', v_geofence_events_deleted,
      'dwell_deleted', v_dwell_deleted,
      'audit_deleted', v_audit_deleted
    )
  );

  -- Return summary
  RETURN QUERY
  SELECT 'location_pings'::TEXT, v_pings_deleted
  UNION ALL
  SELECT 'breadcrumb_snapshots'::TEXT, v_breadcrumbs_deleted
  UNION ALL
  SELECT 'geofence_events'::TEXT, v_geofence_events_deleted
  UNION ALL
  SELECT 'dwell_records'::TEXT, v_dwell_deleted
  UNION ALL
  SELECT 'location_access_audit'::TEXT, v_audit_deleted;
END;
$$;

-- =============================================================================
-- Function: Get retention policy status (for monitoring)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_location_data_retention_status()
RETURNS TABLE (
  table_name TEXT,
  total_rows BIGINT,
  rows_eligible_for_deletion BIGINT,
  oldest_record TIMESTAMPTZ,
  newest_record TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- location_pings (90-day retention)
  SELECT
    'location_pings'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE recorded_at < NOW() - INTERVAL '90 days')::BIGINT,
    MIN(recorded_at),
    MAX(recorded_at)
  FROM location_pings

  UNION ALL

  -- breadcrumb_snapshots (7-day retention)
  SELECT
    'breadcrumb_snapshots'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days')::BIGINT,
    MIN(created_at),
    MAX(created_at)
  FROM breadcrumb_snapshots

  UNION ALL

  -- geofence_events (90-day retention)
  SELECT
    'geofence_events'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE recorded_at < NOW() - INTERVAL '90 days')::BIGINT,
    MIN(recorded_at),
    MAX(recorded_at)
  FROM geofence_events

  UNION ALL

  -- dwell_records (90-day retention)
  SELECT
    'dwell_records'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days')::BIGINT,
    MIN(created_at),
    MAX(created_at)
  FROM dwell_records;
END;
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION cleanup_old_location_pings IS 'Delete location pings older than 90 days (retention policy).';
COMMENT ON FUNCTION cleanup_old_breadcrumb_snapshots IS 'Delete breadcrumb snapshots older than 7 days (not needed for long-term storage).';
COMMENT ON FUNCTION run_location_data_retention_policy IS 'Master cleanup function - runs all retention policies and returns summary.';
COMMENT ON FUNCTION anonymize_driver_location_data IS 'GDPR Article 17: Right to erasure. Deletes all location data for a driver. Can be full or date-range scoped.';
COMMENT ON FUNCTION get_location_data_retention_status IS 'Monitoring: Shows how many rows are eligible for deletion across location tables.';
COMMENT ON TABLE gdpr_deletion_log IS 'Audit trail of GDPR deletion requests. Tracks when data was deleted and by whom.';
