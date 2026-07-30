-- Allow carriers to update loads they've been awarded (via accepted bids).
-- Without this, RLS silently blocks the carrier's assignDriver() call
-- because the existing loads_update_own policy only allows posted_by = auth.uid().
CREATE POLICY "carrier_update_awarded" ON loads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.load_id = loads.id
        AND bids.carrier_id = auth.uid()
        AND bids.status = 'accepted'
    )
  );
