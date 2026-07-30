-- Migration 057: Schema hardening — CHECK constraints, BRIN index, RPC function

-- ── CHECK constraints ──────────────────────────────────────────
-- Prevent invalid financial/weight values at the DB level.
ALTER TABLE loads ADD CONSTRAINT chk_rate_positive CHECK (rate_usd > 0);
ALTER TABLE loads ADD CONSTRAINT chk_weight_positive CHECK (weight_lbs > 0);
ALTER TABLE bids ADD CONSTRAINT chk_bid_positive CHECK (amount_usd > 0);

-- ── BRIN index on location_pings ───────────────────────────────
-- Efficient time-range scans on append-only location data.
CREATE INDEX IF NOT EXISTS idx_location_pings_recorded_at_brin
  ON location_pings USING BRIN (recorded_at);

-- ── RPC: get_latest_truck_locations ────────────────────────────
-- Returns the most recent ping per driver for a given company.
-- Joins through profiles to resolve company membership since
-- location_pings does not have a direct company_id column.
CREATE OR REPLACE FUNCTION get_latest_truck_locations(p_company_id UUID)
RETURNS TABLE (
  truck_id    UUID,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ
)
AS $$
  SELECT DISTINCT ON (lp.driver_id)
    lp.driver_id AS truck_id,
    lp.latitude::double precision AS lat,
    lp.longitude::double precision AS lng,
    lp.recorded_at
  FROM location_pings lp
  INNER JOIN company_members cm ON cm.user_id = lp.driver_id
  WHERE cm.company_id = p_company_id
  ORDER BY lp.driver_id, lp.recorded_at DESC;
$$ LANGUAGE sql STABLE;
