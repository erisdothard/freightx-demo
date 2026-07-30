-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 003: Bids
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

create table if not exists bids (
  id             uuid primary key default gen_random_uuid(),
  load_id        uuid not null references loads(id) on delete cascade,
  carrier_id     uuid not null references profiles(id),
  company_id     uuid references companies(id),
  company_name   text not null default '',

  amount_usd     numeric(10,2) not null,
  notes          text,
  status         text not null default 'pending', -- pending | accepted | declined | countered | expired | cancelled

  -- Counter-offer chain
  parent_bid_id  uuid references bids(id),
  round          integer not null default 1,

  expires_at     timestamptz not null default (now() + interval '4 hours'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists bids_load_id_idx    on bids(load_id);
create index if not exists bids_carrier_id_idx on bids(carrier_id);
create index if not exists bids_status_idx     on bids(status);

alter table bids enable row level security;

-- Carriers can see and create their own bids
create policy "carriers_manage_own_bids"
  on bids for all
  using (carrier_id = auth.uid())
  with check (carrier_id = auth.uid());

-- Load posters can see all bids on their loads
create policy "load_posters_view_bids"
  on bids for select
  using (
    exists (
      select 1 from loads where id = load_id and posted_by = auth.uid()
    )
  );

-- Load posters can update bid status (accept/decline)
create policy "load_posters_update_bids"
  on bids for update
  using (
    exists (
      select 1 from loads where id = load_id and posted_by = auth.uid()
    )
  );

-- ── accept_bid RPC ──────────────────────────────────────────
-- Atomically: accept one bid, decline others, award load
create or replace function public.accept_bid(bid_id uuid)
returns void language plpgsql security definer as $$
declare
  v_bid  record;
  v_load record;
begin
  select * into v_bid from bids where id = bid_id;
  if not found then raise exception 'Bid not found'; end if;

  select * into v_load from loads where id = v_bid.load_id;
  if v_load.posted_by != auth.uid() then
    raise exception 'Not authorized — you did not post this load';
  end if;

  -- Accept the winning bid
  update bids set status = 'accepted', updated_at = now() where id = bid_id;

  -- Decline all other pending bids on this load
  update bids set status = 'declined', updated_at = now()
    where load_id = v_bid.load_id
      and id != bid_id
      and status = 'pending';

  -- Award the load
  update loads
    set status    = 'awarded',
        bid_count = (select count(*) from bids where load_id = v_bid.load_id)
    where id = v_bid.load_id;
end;
$$;

-- ── Enable Realtime ─────────────────────────────────────────
-- alter publication supabase_realtime add table bids;
