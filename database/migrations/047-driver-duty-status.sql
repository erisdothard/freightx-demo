-- 047: Driver duty status for between-load tracking
-- Enables continuous GPS tracking when driver is on-duty (not just in-transit)
-- Powers deadhead optimization and fleet availability features

-- =============================================================================
-- Duty status enum
-- =============================================================================

CREATE TYPE duty_status AS ENUM (
  'on_duty',    -- Driver is working but not currently in transit
  'off_duty',   -- Driver is off-shift (GPS tracking disabled)
  'sleeper',    -- Driver is in sleeper berth (HOS compliance)
  'driving'     -- Driver is actively driving (in-transit or deadhead)
);

-- =============================================================================
-- Add duty status columns to profiles table
-- =============================================================================

ALTER TABLE profiles
  -- Current duty status
  ADD COLUMN IF NOT EXISTS current_duty_status duty_status DEFAULT 'off_duty',

  -- When duty status was last changed
  ADD COLUMN IF NOT EXISTS duty_status_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Last known GPS location (for "where are my trucks?" queries)
  ADD COLUMN IF NOT EXISTS last_known_location GEOGRAPHY(POINT, 4326),

  -- When last GPS ping was received
  ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- =============================================================================
-- Indexes for performance
-- =============================================================================

-- Find on-duty drivers near a location (deadhead optimization)
CREATE INDEX IF NOT EXISTS idx_profiles_last_known_location
  ON profiles USING GIST(last_known_location)
  WHERE role = 'driver' AND current_duty_status IN ('on_duty', 'driving');

-- Find all on-duty drivers for a carrier
CREATE INDEX IF NOT EXISTS idx_profiles_duty_status
  ON profiles(company_id, current_duty_status)
  WHERE role = 'driver';

-- Track duty status history
CREATE INDEX IF NOT EXISTS idx_profiles_duty_updated
  ON profiles(duty_status_updated_at DESC)
  WHERE role = 'driver';

-- =============================================================================
-- Function: Update driver location (called on GPS ping)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET
    last_known_location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    last_location_update = NOW()
  WHERE id = p_driver_id;
END;
$$;

-- =============================================================================
-- Function: Set driver duty status
-- =============================================================================

CREATE OR REPLACE FUNCTION set_driver_duty_status(
  p_driver_id UUID,
  p_duty_status duty_status
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only the driver themselves can change their duty status
  IF auth.uid() != p_driver_id THEN
    RAISE EXCEPTION 'Access denied: you can only change your own duty status';
  END IF;

  UPDATE profiles
  SET
    current_duty_status = p_duty_status,
    duty_status_updated_at = NOW()
  WHERE id = p_driver_id;
END;
$$;

-- =============================================================================
-- Function: Find nearest available drivers (deadhead optimization)
-- =============================================================================

CREATE OR REPLACE FUNCTION find_nearest_available_drivers(
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_max_distance_miles DOUBLE PRECISION DEFAULT 100,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  distance_miles DOUBLE PRECISION,
  duty_status duty_status,
  last_update TIMESTAMPTZ,
  coords_lat DOUBLE PRECISION,
  coords_lng DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pickup_point GEOGRAPHY;
  v_max_distance_meters DOUBLE PRECISION;
BEGIN
  -- Convert pickup location to geography point
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography;

  -- Convert miles to meters (1 mile = 1609.34 meters)
  v_max_distance_meters := p_max_distance_miles * 1609.34;

  RETURN QUERY
  SELECT
    p.id AS driver_id,
    p.full_name AS driver_name,
    (ST_Distance(p.last_known_location, v_pickup_point) / 1609.34) AS distance_miles,
    p.current_duty_status,
    p.last_location_update,
    ST_Y(p.last_known_location::geometry) AS coords_lat,
    ST_X(p.last_known_location::geometry) AS coords_lng
  FROM profiles p
  WHERE
    -- Only drivers
    p.role = 'driver'
    -- On-duty or driving (not off-duty or sleeper)
    AND p.current_duty_status IN ('on_duty', 'driving')
    -- Not currently assigned to an active load
    AND p.id NOT IN (
      SELECT DISTINCT assigned_driver_id
      FROM loads
      WHERE assigned_driver_id IS NOT NULL
        AND status IN ('in_transit', 'dispatched', 'awarded')
    )
    -- Within max distance
    AND ST_DWithin(p.last_known_location, v_pickup_point, v_max_distance_meters)
    -- Has recent GPS update (within last 30 minutes)
    AND p.last_location_update > NOW() - INTERVAL '30 minutes'
  ORDER BY ST_Distance(p.last_known_location, v_pickup_point) ASC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- Function: Get fleet availability summary (for carrier dashboard)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_fleet_availability_summary(
  p_company_id UUID
)
RETURNS TABLE (
  duty_status duty_status,
  driver_count BIGINT,
  avg_time_in_status INTERVAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only carrier can view their own fleet
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'carrier'
      AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Access denied: you can only view your own fleet';
  END IF;

  RETURN QUERY
  SELECT
    p.current_duty_status,
    COUNT(*) AS driver_count,
    AVG(NOW() - p.duty_status_updated_at) AS avg_time_in_status
  FROM profiles p
  WHERE
    p.role = 'driver'
    AND p.company_id = p_company_id
  GROUP BY p.current_duty_status
  ORDER BY driver_count DESC;
END;
$$;

-- =============================================================================
-- Function: Get on-duty drivers for carrier (fleet map)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_onduty_drivers_for_carrier(
  p_carrier_id UUID
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  duty_status duty_status,
  coords_lat DOUBLE PRECISION,
  coords_lng DOUBLE PRECISION,
  last_update TIMESTAMPTZ,
  current_load_number TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get carrier's company ID
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = p_carrier_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Carrier not found or not associated with a company';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS driver_id,
    p.full_name AS driver_name,
    p.current_duty_status,
    ST_Y(p.last_known_location::geometry) AS coords_lat,
    ST_X(p.last_known_location::geometry) AS coords_lng,
    p.last_location_update,
    l.load_number AS current_load_number
  FROM profiles p
  LEFT JOIN loads l ON l.assigned_driver_id = p.id
    AND l.status IN ('in_transit', 'dispatched', 'awarded')
  WHERE
    p.role = 'driver'
    AND p.company_id = v_company_id
    AND p.current_duty_status IN ('on_duty', 'driving')
    AND p.last_known_location IS NOT NULL
  ORDER BY p.last_location_update DESC;
END;
$$;

-- =============================================================================
-- Trigger: Auto-update last_known_location on GPS ping
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_update_last_known_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update driver's last known location
  UPDATE profiles
  SET
    last_known_location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography,
    last_location_update = NEW.recorded_at
  WHERE id = NEW.driver_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_last_known_location_on_ping
  AFTER INSERT ON location_pings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_last_known_location();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TYPE duty_status IS 'Driver duty status for HOS compliance and fleet management';
COMMENT ON COLUMN profiles.current_duty_status IS 'Current duty status (on_duty, off_duty, sleeper, driving). GPS tracks on_duty + driving.';
COMMENT ON COLUMN profiles.duty_status_updated_at IS 'When duty status was last changed';
COMMENT ON COLUMN profiles.last_known_location IS 'Last GPS location (PostGIS geography point). Used for deadhead optimization.';
COMMENT ON COLUMN profiles.last_location_update IS 'Timestamp of last GPS ping. Stale if >30 min old.';

COMMENT ON FUNCTION find_nearest_available_drivers IS 'Deadhead optimization: Find closest on-duty drivers to a pickup location';
COMMENT ON FUNCTION get_fleet_availability_summary IS 'Carrier dashboard: Summary of driver availability by duty status';
COMMENT ON FUNCTION get_onduty_drivers_for_carrier IS 'Fleet map: Get all on-duty drivers for a carrier with GPS coords';
COMMENT ON FUNCTION update_driver_location IS 'Update driver last known location (called on GPS ping)';
COMMENT ON FUNCTION set_driver_duty_status IS 'Driver changes their duty status (triggers GPS on/off)';
