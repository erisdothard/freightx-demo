-- Migration 058: Fix accept_bid race condition
-- Adds FOR UPDATE row lock + status guard to prevent double-award.
-- Also hardens book_now with the same pattern.

CREATE OR REPLACE FUNCTION public.accept_bid(bid_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bid  record;
  v_load record;
BEGIN
  -- Lock the bid row
  SELECT * INTO v_bid FROM bids WHERE id = bid_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

  IF v_bid.status != 'pending' THEN
    RAISE EXCEPTION 'Bid is no longer pending (current status: %)', v_bid.status;
  END IF;

  -- Lock the load row to prevent concurrent accept_bid / book_now races
  SELECT * INTO v_load FROM loads WHERE id = v_bid.load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Load not found'; END IF;

  IF v_load.posted_by != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized — you did not post this load';
  END IF;

  -- Guard: load must still be in a biddable state
  IF v_load.status NOT IN ('posted', 'bid_received') THEN
    RAISE EXCEPTION 'Load is no longer available (current status: %)', v_load.status;
  END IF;

  -- Accept this bid
  UPDATE bids SET status = 'accepted', updated_at = now() WHERE id = bid_id;

  -- Decline all other pending bids on this load
  UPDATE bids SET status = 'declined', updated_at = now()
    WHERE load_id = v_bid.load_id
      AND id != bid_id
      AND status = 'pending';

  -- Award the load
  UPDATE loads
    SET status    = 'awarded',
        bid_count = (SELECT count(*) FROM bids WHERE load_id = v_bid.load_id)
    WHERE id = v_bid.load_id;
END;
$$;

-- Also harden book_now with FOR UPDATE lock
CREATE OR REPLACE FUNCTION public.book_now(p_load_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_load    record;
  v_company record;
BEGIN
  -- Lock the load row
  SELECT * INTO v_load FROM loads WHERE id = p_load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Load not found'; END IF;

  IF v_load.status != 'posted' THEN
    RAISE EXCEPTION 'Load is no longer available (current status: %)', v_load.status;
  END IF;

  SELECT * INTO v_company FROM companies WHERE owner_id = auth.uid() LIMIT 1;

  INSERT INTO bids (load_id, carrier_id, company_id, company_name, amount_usd, status)
  VALUES (
    p_load_id,
    auth.uid(),
    v_company.id,
    coalesce(v_company.name, 'Independent Carrier'),
    v_load.rate_usd,
    'accepted'
  );

  UPDATE bids
    SET status = 'declined', updated_at = now()
    WHERE load_id = p_load_id
      AND carrier_id != auth.uid()
      AND status = 'pending';

  UPDATE loads
    SET status    = 'awarded',
        bid_count = bid_count + 1
    WHERE id = p_load_id;
END;
$$;
