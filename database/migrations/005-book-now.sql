-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 005: Book-It-Now RPC
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- Carrier calls this to instantly book a load at the asking rate,
-- skipping the bidding process entirely.
create or replace function public.book_now(p_load_id uuid)
returns void language plpgsql security definer as $$
declare
  v_load     record;
  v_company  record;
begin
  select * into v_load from loads where id = p_load_id;
  if not found then
    raise exception 'Load not found';
  end if;
  if v_load.status != 'posted' then
    raise exception 'Load is not available for booking (status: %)', v_load.status;
  end if;

  -- Look up carrier company (may not exist — that's ok)
  select * into v_company from companies where owner_id = auth.uid() limit 1;

  -- Insert a pre-accepted bid at the asking rate
  insert into bids (
    load_id, carrier_id, company_id, company_name,
    amount_usd, status
  ) values (
    p_load_id,
    auth.uid(),
    v_company.id,
    coalesce(v_company.name, 'Independent Carrier'),
    v_load.rate_usd,
    'accepted'
  );

  -- Decline all other pending bids
  update bids
    set status = 'declined', updated_at = now()
    where load_id = p_load_id
      and carrier_id != auth.uid()
      and status = 'pending';

  -- Award the load
  update loads
    set status    = 'awarded',
        bid_count = bid_count + 1
    where id = p_load_id;
end;
$$;
