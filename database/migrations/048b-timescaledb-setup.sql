-- 048: TimescaleDB setup for location_pings time-series optimization
-- Converts location_pings table to TimescaleDB hypertable for better performance at scale
-- Requires: TimescaleDB extension enabled (contact Supabase support for enterprise plans)

-- =============================================================================
-- IMPORTANT: Prerequisites
-- =============================================================================
-- 1. TimescaleDB extension must be enabled on your Supabase project
-- 2. This is only available on Supabase Pro/Enterprise plans
-- 3. Contact Supabase support to enable: https://supabase.com/dashboard/support
-- 4. Verify extension is available: SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';

-- =============================================================================
-- Enable TimescaleDB extension
-- =============================================================================

-- Check if TimescaleDB is available
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'
  ) THEN
    RAISE EXCEPTION 'TimescaleDB extension is not available. Contact Supabase support to enable it for your plan.';
  END IF;
END $$;

-- Enable the extension (requires superuser - run via Supabase support or SQL editor)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- =============================================================================
-- Convert location_pings to hypertable
-- =============================================================================

-- Convert the table to a TimescaleDB hypertable
-- Partitioned by recorded_at with 1-day chunks
SELECT create_hypertable(
  'location_pings',
  'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE,
  migrate_data => TRUE  -- Migrate existing data to new hypertable structure
);

-- =============================================================================
-- Compression policy
-- =============================================================================

-- Enable compression on the hypertable
ALTER TABLE location_pings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'driver_id, load_number',  -- Group by driver and load
  timescaledb.compress_orderby = 'recorded_at DESC'            -- Order by time (most recent first)
);

-- Auto-compress chunks older than 7 days
SELECT add_compression_policy(
  'location_pings',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- =============================================================================
-- Retention policy
-- =============================================================================

-- Auto-drop chunks older than 90 days (enforce retention policy at DB level)
SELECT add_retention_policy(
  'location_pings',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

-- =============================================================================
-- Continuous aggregates (pre-computed stats)
-- =============================================================================

-- Create a continuous aggregate for hourly GPS ping stats
-- This pre-computes aggregates as data arrives, making dashboard queries instant
CREATE MATERIALIZED VIEW IF NOT EXISTS location_pings_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', recorded_at) AS hour,
  driver_id,
  load_number,
  COUNT(*) AS ping_count,
  AVG(speed_ms) AS avg_speed_ms,
  MAX(speed_ms) AS max_speed_ms,
  AVG(accuracy_m) AS avg_accuracy_m
FROM location_pings
GROUP BY hour, driver_id, load_number;

-- Refresh policy: Update the aggregate every 15 minutes
SELECT add_continuous_aggregate_policy(
  'location_pings_hourly',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

-- =============================================================================
-- Performance indexes (optimized for TimescaleDB)
-- =============================================================================

-- Composite index for load-based queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_location_pings_load_time
  ON location_pings (load_number, recorded_at DESC)
  WHERE load_number IS NOT NULL;

-- Driver-based queries (for fleet tracking)
CREATE INDEX IF NOT EXISTS idx_location_pings_driver_time
  ON location_pings (driver_id, recorded_at DESC);

-- Spatial index for "find pings near location" queries
CREATE INDEX IF NOT EXISTS idx_location_pings_location
  ON location_pings USING GIST (
    ll_to_earth(latitude::float8, longitude::float8)
  );

-- =============================================================================
-- Functions: Query helpers for common patterns
-- =============================================================================

-- Get latest ping for a driver (optimized for TimescaleDB)
CREATE OR REPLACE FUNCTION get_latest_driver_ping(p_driver_id UUID)
RETURNS TABLE (
  latitude DECIMAL,
  longitude DECIMAL,
  speed_ms DECIMAL,
  heading_deg INT,
  accuracy_m INT,
  recorded_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT latitude, longitude, speed_ms, heading_deg, accuracy_m, recorded_at
  FROM location_pings
  WHERE driver_id = p_driver_id
  ORDER BY recorded_at DESC
  LIMIT 1;
$$;

-- Get ping statistics for a load (uses continuous aggregate)
CREATE OR REPLACE FUNCTION get_load_ping_stats(
  p_load_number TEXT,
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  hour TIMESTAMPTZ,
  ping_count BIGINT,
  avg_speed_ms DECIMAL,
  max_speed_ms DECIMAL,
  avg_accuracy_m DECIMAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT hour, ping_count, avg_speed_ms, max_speed_ms, avg_accuracy_m
  FROM location_pings_hourly
  WHERE load_number = p_load_number
    AND hour >= p_start_time
    AND hour <= p_end_time
  ORDER BY hour DESC;
$$;

-- =============================================================================
-- Performance comparison query
-- =============================================================================

-- Run this to compare query performance before/after TimescaleDB
-- Query: "Get all pings for a load in the last 24 hours"
CREATE OR REPLACE FUNCTION benchmark_location_query(p_load_number TEXT)
RETURNS TABLE (
  query_type TEXT,
  execution_time_ms NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  -- Benchmark: Full table scan (slow)
  start_time := clock_timestamp();
  PERFORM * FROM location_pings
  WHERE load_number = p_load_number
    AND recorded_at >= NOW() - INTERVAL '24 hours';
  end_time := clock_timestamp();

  RETURN QUERY SELECT
    'full_scan'::TEXT,
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::NUMERIC;

  -- Benchmark: Continuous aggregate (fast)
  start_time := clock_timestamp();
  PERFORM * FROM location_pings_hourly
  WHERE load_number = p_load_number
    AND hour >= NOW() - INTERVAL '24 hours';
  end_time := clock_timestamp();

  RETURN QUERY SELECT
    'continuous_aggregate'::TEXT,
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::NUMERIC;
END;
$$;

-- =============================================================================
-- Monitoring queries
-- =============================================================================

-- Check hypertable status
CREATE OR REPLACE FUNCTION check_timescaledb_status()
RETURNS TABLE (
  table_name TEXT,
  is_hypertable BOOLEAN,
  compression_enabled BOOLEAN,
  total_chunks INT,
  compressed_chunks INT,
  total_size TEXT
)
LANGUAGE sql
AS $$
  SELECT
    ht.table_name::TEXT,
    TRUE AS is_hypertable,
    (SELECT compression_enabled FROM timescaledb_information.compression_settings
     WHERE hypertable_name = ht.table_name LIMIT 1) AS compression_enabled,
    (SELECT COUNT(*)::INT FROM timescaledb_information.chunks
     WHERE hypertable_name = ht.table_name) AS total_chunks,
    (SELECT COUNT(*)::INT FROM timescaledb_information.chunks
     WHERE hypertable_name = ht.table_name AND is_compressed = TRUE) AS compressed_chunks,
    pg_size_pretty(hypertable_size(format('%I.%I', ht.schema_name, ht.table_name)::regclass)) AS total_size
  FROM timescaledb_information.hypertables ht
  WHERE ht.table_name = 'location_pings';
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON MATERIALIZED VIEW location_pings_hourly IS 'TimescaleDB continuous aggregate: Pre-computed hourly GPS ping statistics for fast dashboard queries';
COMMENT ON FUNCTION get_latest_driver_ping IS 'Get most recent GPS ping for a driver (optimized with TimescaleDB index)';
COMMENT ON FUNCTION get_load_ping_stats IS 'Get hourly ping statistics for a load (uses continuous aggregate for speed)';
COMMENT ON FUNCTION benchmark_location_query IS 'Compare query performance before/after TimescaleDB optimization';
COMMENT ON FUNCTION check_timescaledb_status IS 'Monitor TimescaleDB hypertable status, compression, and storage';

-- =============================================================================
-- Migration verification
-- =============================================================================

-- Run this to verify migration was successful
DO $$
DECLARE
  v_is_hypertable BOOLEAN;
BEGIN
  -- Check if location_pings is now a hypertable
  SELECT TRUE INTO v_is_hypertable
  FROM timescaledb_information.hypertables
  WHERE table_name = 'location_pings';

  IF v_is_hypertable THEN
    RAISE NOTICE 'SUCCESS: location_pings is now a TimescaleDB hypertable';
  ELSE
    RAISE WARNING 'FAILED: location_pings is not a hypertable. Check if TimescaleDB extension is enabled.';
  END IF;
END $$;
