-- Allow carriers with an accepted bid to update loads they're assigned to.
-- Previously only the poster (broker) could update via loads_update_own.
-- Carriers need to advance status: dispatched → in_transit → delivered.

create policy "loads_update_carrier"
  on loads for update
  using (
    exists (
      select 1 from bids
      where bids.load_id = loads.id
        and bids.carrier_id = auth.uid()
        and bids.status = 'accepted'
    )
  );
