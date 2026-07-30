-- 042: Tighten RLS on location_pings
-- Replace permissive "anyone authenticated can read" with scoped policies

-- Drop existing overly permissive read policy (if it exists)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read location pings" ON location_pings;
  DROP POLICY IF EXISTS "Anyone can read location pings" ON location_pings;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Driver who sent the ping can read their own pings
CREATE POLICY "Drivers can read own pings"
  ON location_pings FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Load poster can read pings for their loads
CREATE POLICY "Load poster can read pings"
  ON location_pings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.load_number = location_pings.load_number
        AND loads.posted_by = auth.uid()
    )
  );

-- Carrier with accepted bid can read pings
CREATE POLICY "Carrier with accepted bid can read pings"
  ON location_pings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bids
      JOIN loads ON loads.id = bids.load_id
      WHERE loads.load_number = location_pings.load_number
        AND bids.carrier_id = auth.uid()
        AND bids.status = 'accepted'
    )
  );

-- Anon read for valid (non-expired, non-revoked) tracking tokens
CREATE POLICY "Public tracking token holders can read pings"
  ON location_pings FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tracking_tokens
      WHERE tracking_tokens.load_number = location_pings.load_number
        AND tracking_tokens.revoked = false
        AND tracking_tokens.expires_at > now()
    )
  );
