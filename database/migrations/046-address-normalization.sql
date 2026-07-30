-- 046: Address normalization for enterprise geocoding
-- Stores both raw user input and Google Maps validated addresses
-- Fixes "Nashville → Portland" geocoding issue

-- =============================================================================
-- Add normalized address columns to loads table
-- =============================================================================

ALTER TABLE loads
  -- Origin address fields
  ADD COLUMN IF NOT EXISTS origin_address_raw TEXT,                 -- What user typed
  ADD COLUMN IF NOT EXISTS origin_address_normalized TEXT,          -- Google validated
  ADD COLUMN IF NOT EXISTS origin_place_id TEXT,                    -- Google Place ID
  ADD COLUMN IF NOT EXISTS origin_geocode_confidence TEXT           -- ROOFTOP, RANGE_INTERPOLATED, etc.
    CHECK (origin_geocode_confidence IN (
      'ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE'
    )),

  -- Destination address fields
  ADD COLUMN IF NOT EXISTS dest_address_raw TEXT,
  ADD COLUMN IF NOT EXISTS dest_address_normalized TEXT,
  ADD COLUMN IF NOT EXISTS dest_place_id TEXT,
  ADD COLUMN IF NOT EXISTS dest_geocode_confidence TEXT
    CHECK (dest_geocode_confidence IN (
      'ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE'
    ));

-- =============================================================================
-- Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_loads_origin_place_id ON loads(origin_place_id)
  WHERE origin_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loads_dest_place_id ON loads(dest_place_id)
  WHERE dest_place_id IS NOT NULL;

-- =============================================================================
-- Backfill existing loads with raw address data
-- =============================================================================

-- Copy existing address data to _raw fields (one-time migration)
UPDATE loads
SET
  origin_address_raw = COALESCE(origin_address, ''),
  dest_address_raw = COALESCE(dest_address, '')
WHERE origin_address_raw IS NULL OR dest_address_raw IS NULL;

-- =============================================================================
-- Function: Validate geocoding quality
-- =============================================================================

CREATE OR REPLACE FUNCTION get_geocoding_quality_report()
RETURNS TABLE (
  confidence_level TEXT,
  origin_count BIGINT,
  dest_count BIGINT,
  total_count BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    COALESCE(origin_geocode_confidence, 'NOT_GEOCODED') AS confidence_level,
    COUNT(*) FILTER (WHERE origin_geocode_confidence IS NOT NULL) AS origin_count,
    COUNT(*) FILTER (WHERE dest_geocode_confidence IS NOT NULL) AS dest_count,
    COUNT(*) AS total_count
  FROM loads
  GROUP BY COALESCE(origin_geocode_confidence, 'NOT_GEOCODED')
  ORDER BY
    CASE COALESCE(origin_geocode_confidence, 'NOT_GEOCODED')
      WHEN 'ROOFTOP' THEN 1
      WHEN 'RANGE_INTERPOLATED' THEN 2
      WHEN 'GEOMETRIC_CENTER' THEN 3
      WHEN 'APPROXIMATE' THEN 4
      ELSE 5
    END;
$$;

-- =============================================================================
-- Function: Find loads with low-quality geocoding
-- =============================================================================

CREATE OR REPLACE FUNCTION find_loads_needing_regeocoding(
  p_min_confidence TEXT DEFAULT 'GEOMETRIC_CENTER'
)
RETURNS TABLE (
  load_number TEXT,
  origin_address TEXT,
  dest_address TEXT,
  origin_confidence TEXT,
  dest_confidence TEXT
)
LANGUAGE sql
AS $$
  SELECT
    load_number,
    origin_address,
    dest_address,
    origin_geocode_confidence,
    dest_geocode_confidence
  FROM loads
  WHERE
    -- Origin has low confidence or missing
    (
      origin_geocode_confidence IS NULL
      OR (
        p_min_confidence = 'ROOFTOP' AND origin_geocode_confidence != 'ROOFTOP'
      )
      OR (
        p_min_confidence = 'RANGE_INTERPOLATED' AND origin_geocode_confidence NOT IN ('ROOFTOP', 'RANGE_INTERPOLATED')
      )
      OR (
        p_min_confidence = 'GEOMETRIC_CENTER' AND origin_geocode_confidence IN ('APPROXIMATE')
      )
    )
    OR
    -- Destination has low confidence or missing
    (
      dest_geocode_confidence IS NULL
      OR (
        p_min_confidence = 'ROOFTOP' AND dest_geocode_confidence != 'ROOFTOP'
      )
      OR (
        p_min_confidence = 'RANGE_INTERPOLATED' AND dest_geocode_confidence NOT IN ('ROOFTOP', 'RANGE_INTERPOLATED')
      )
      OR (
        p_min_confidence = 'GEOMETRIC_CENTER' AND dest_geocode_confidence IN ('APPROXIMATE')
      )
    )
  ORDER BY created_at DESC
  LIMIT 100;
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN loads.origin_address_raw IS 'Original address as entered by user (before validation)';
COMMENT ON COLUMN loads.origin_address_normalized IS 'Google Maps validated/formatted address';
COMMENT ON COLUMN loads.origin_place_id IS 'Google Place ID (unique identifier for location)';
COMMENT ON COLUMN loads.origin_geocode_confidence IS 'Geocoding accuracy: ROOFTOP (best) > RANGE_INTERPOLATED > GEOMETRIC_CENTER > APPROXIMATE';

COMMENT ON COLUMN loads.dest_address_raw IS 'Original destination address as entered by user';
COMMENT ON COLUMN loads.dest_address_normalized IS 'Google Maps validated destination address';
COMMENT ON COLUMN loads.dest_place_id IS 'Google Place ID for destination';
COMMENT ON COLUMN loads.dest_geocode_confidence IS 'Destination geocoding accuracy level';

COMMENT ON FUNCTION get_geocoding_quality_report IS 'Returns summary of geocoding quality across all loads (how many ROOFTOP vs APPROXIMATE, etc.)';
COMMENT ON FUNCTION find_loads_needing_regeocoding IS 'Finds loads with low-quality geocoding that should be re-validated with Google Maps API';
