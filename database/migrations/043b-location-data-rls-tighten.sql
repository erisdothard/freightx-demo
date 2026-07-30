-- 043: Tighten RLS on breadcrumb_snapshots, geofences, geofence_events, dwell_records
-- Restrict access to load participants only (posted_by, accepted_by, assigned_driver_id, bidders)
-- Prevents unauthorized cross-tenant data access

-- =============================================================================
-- Helper function: Check if user is load participant
-- =============================================================================

CREATE OR REPLACE FUNCTION is_load_participant(p_load_number text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM loads
    WHERE load_number = p_load_number
      AND (
        posted_by = auth.uid()                    -- Shipper/Broker who posted
        OR accepted_by = auth.uid()               -- Carrier who accepted
        OR assigned_driver_id = auth.uid()        -- Driver assigned to load
        OR id IN (                                -- Bidders on this load
          SELECT load_id FROM bids
          WHERE bidder_id = auth.uid()
        )
      )
  );
$$;

-- =============================================================================
-- breadcrumb_snapshots: Drop permissive policies and add scoped ones
-- =============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can read breadcrumb snapshots" ON breadcrumb_snapshots;
DROP POLICY IF EXISTS "Authenticated users can insert breadcrumb snapshots" ON breadcrumb_snapshots;

-- Driver who created the snapshot can read their own
CREATE POLICY "Drivers can read own breadcrumb snapshots"
  ON breadcrumb_snapshots FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Load participants can read breadcrumb snapshots for their loads
CREATE POLICY "Load participants can read breadcrumb snapshots"
  ON breadcrumb_snapshots FOR SELECT
  TO authenticated
  USING (is_load_participant(load_number));

-- Only drivers can insert breadcrumb snapshots for loads they're assigned to
CREATE POLICY "Assigned drivers can insert breadcrumb snapshots"
  ON breadcrumb_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM loads
      WHERE load_number = breadcrumb_snapshots.load_number
        AND assigned_driver_id = auth.uid()
    )
  );

-- Public read for valid tracking tokens
CREATE POLICY "Public tracking token holders can read breadcrumb snapshots"
  ON breadcrumb_snapshots FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tracking_tokens
      WHERE tracking_tokens.load_number = breadcrumb_snapshots.load_number
        AND tracking_tokens.revoked = false
        AND tracking_tokens.expires_at > now()
    )
  );

-- =============================================================================
-- geofences: Drop permissive policies and add scoped ones
-- =============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated can read geofences" ON geofences;
DROP POLICY IF EXISTS "Authenticated can insert geofences" ON geofences;

-- Load participants can read geofences for their loads
CREATE POLICY "Load participants can read geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (is_load_participant(load_number));

-- Only load poster (shipper/broker) or carrier can create geofences
CREATE POLICY "Load poster or carrier can insert geofences"
  ON geofences FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loads
      WHERE load_number = geofences.load_number
        AND (posted_by = auth.uid() OR accepted_by = auth.uid())
    )
  );

-- Public read for valid tracking tokens
CREATE POLICY "Public tracking token holders can read geofences"
  ON geofences FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tracking_tokens
      WHERE tracking_tokens.load_number = geofences.load_number
        AND tracking_tokens.revoked = false
        AND tracking_tokens.expires_at > now()
    )
  );

-- =============================================================================
-- geofence_events: Drop permissive policies and add scoped ones
-- =============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated can read geofence events" ON geofence_events;
DROP POLICY IF EXISTS "Authenticated can insert geofence events" ON geofence_events;

-- Driver who triggered the event can read their own events
CREATE POLICY "Drivers can read own geofence events"
  ON geofence_events FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Load participants can read geofence events for their loads
CREATE POLICY "Load participants can read geofence events"
  ON geofence_events FOR SELECT
  TO authenticated
  USING (is_load_participant(load_number));

-- Only assigned driver can insert geofence events
CREATE POLICY "Assigned drivers can insert geofence events"
  ON geofence_events FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM loads
      WHERE load_number = geofence_events.load_number
        AND assigned_driver_id = auth.uid()
    )
  );

-- Public read for valid tracking tokens
CREATE POLICY "Public tracking token holders can read geofence events"
  ON geofence_events FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tracking_tokens
      WHERE tracking_tokens.load_number = geofence_events.load_number
        AND tracking_tokens.revoked = false
        AND tracking_tokens.expires_at > now()
    )
  );

-- =============================================================================
-- dwell_records: Drop permissive policies and add scoped ones
-- =============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated can read dwell records" ON dwell_records;
DROP POLICY IF EXISTS "Authenticated can insert dwell records" ON dwell_records;
DROP POLICY IF EXISTS "Authenticated can update dwell records" ON dwell_records;

-- Load participants can read dwell records for their loads
CREATE POLICY "Load participants can read dwell records"
  ON dwell_records FOR SELECT
  TO authenticated
  USING (is_load_participant(load_number));

-- System (service role) can insert dwell records
-- Drivers can also insert for loads they're assigned to
CREATE POLICY "System and assigned drivers can insert dwell records"
  ON dwell_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loads
      WHERE load_number = dwell_records.load_number
        AND (assigned_driver_id = auth.uid() OR auth.uid() IS NULL) -- NULL = service role
    )
  );

-- System and assigned drivers can update dwell records (for exited_at)
CREATE POLICY "System and assigned drivers can update dwell records"
  ON dwell_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE load_number = dwell_records.load_number
        AND (assigned_driver_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- Public read for valid tracking tokens
CREATE POLICY "Public tracking token holders can read dwell records"
  ON dwell_records FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tracking_tokens
      WHERE tracking_tokens.load_number = dwell_records.load_number
        AND tracking_tokens.revoked = false
        AND tracking_tokens.expires_at > now()
    )
  );

-- =============================================================================
-- location_pings: Tighten INSERT policy to verify driver role
-- =============================================================================

-- Drop existing permissive INSERT policy
DROP POLICY IF EXISTS "driver_insert" ON location_pings;

-- Only users with driver role can insert their own pings
CREATE POLICY "Drivers can insert own pings"
  ON location_pings FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'driver'
    )
  );

-- Service role can also insert (for system operations)
CREATE POLICY "Service role can insert location pings"
  ON location_pings FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================================================
-- Comments for audit trail
-- =============================================================================

COMMENT ON FUNCTION is_load_participant IS 'Helper function to check if current user is participant in a load (poster, carrier, driver, or bidder). Used by RLS policies for location-related tables.';
COMMENT ON POLICY "Drivers can insert own pings" ON location_pings IS 'Restricts GPS ping insertion to users with driver role only. Prevents non-drivers from spoofing location data.';
COMMENT ON POLICY "Load participants can read breadcrumb snapshots" ON breadcrumb_snapshots IS 'Restricts breadcrumb snapshot access to load participants only. Prevents unauthorized cross-tenant data access.';
COMMENT ON POLICY "Load participants can read geofences" ON geofences IS 'Restricts geofence access to load participants only. Prevents unauthorized geofence viewing.';
COMMENT ON POLICY "Load participants can read geofence events" ON geofence_events IS 'Restricts geofence event access to load participants only. Prevents unauthorized event tracking.';
COMMENT ON POLICY "Load participants can read dwell records" ON dwell_records IS 'Restricts dwell record access to load participants only. Prevents unauthorized dwell time viewing.';
