-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 010: Ensure all feature tables exist
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────

-- ── NOTIFICATIONS ─────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  message    text not null,
  data       jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx    on notifications(user_id, read);

alter table notifications enable row level security;

drop policy if exists "users_manage_own_notifications" on notifications;
create policy "users_manage_own_notifications"
  on notifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Allow services to insert notifications for any user
drop policy if exists "service_insert_notifications" on notifications;
create policy "service_insert_notifications"
  on notifications for insert
  with check (true);

-- ── BIDS ──────────────────────────────────────────────────────
create table if not exists bids (
  id             uuid primary key default gen_random_uuid(),
  load_id        uuid not null references loads(id) on delete cascade,
  carrier_id     uuid not null references profiles(id),
  company_id     uuid references companies(id),
  company_name   text not null default '',
  amount_usd     numeric(10,2) not null,
  notes          text,
  status         text not null default 'pending',
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

drop policy if exists "carriers_manage_own_bids" on bids;
create policy "carriers_manage_own_bids"
  on bids for all
  using (carrier_id = auth.uid())
  with check (carrier_id = auth.uid());

drop policy if exists "load_posters_view_bids" on bids;
create policy "load_posters_view_bids"
  on bids for select
  using (
    exists (select 1 from loads where id = load_id and posted_by = auth.uid())
  );

drop policy if exists "load_posters_update_bids" on bids;
create policy "load_posters_update_bids"
  on bids for update
  using (
    exists (select 1 from loads where id = load_id and posted_by = auth.uid())
  );

-- ── accept_bid RPC ────────────────────────────────────────────
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

  update bids set status = 'accepted', updated_at = now() where id = bid_id;

  update bids set status = 'declined', updated_at = now()
    where load_id = v_bid.load_id
      and id != bid_id
      and status = 'pending';

  update loads
    set status    = 'awarded',
        bid_count = (select count(*) from bids where load_id = v_bid.load_id)
    where id = v_bid.load_id;
end;
$$;

-- ── increment_bid_count RPC ───────────────────────────────────
create or replace function public.increment_bid_count(load_id uuid)
returns void language plpgsql security definer as $$
begin
  update loads set bid_count = coalesce(bid_count, 0) + 1 where id = load_id;
end;
$$;

-- ── book_now RPC ──────────────────────────────────────────────
create or replace function public.book_now(p_load_id uuid)
returns void language plpgsql security definer as $$
declare
  v_load    record;
  v_company record;
begin
  select * into v_load from loads where id = p_load_id;
  if not found then raise exception 'Load not found'; end if;
  if v_load.status != 'posted' then
    raise exception 'Load is not available for booking (status: %)', v_load.status;
  end if;

  select * into v_company from companies where owner_id = auth.uid() limit 1;

  insert into bids (load_id, carrier_id, company_id, company_name, amount_usd, status)
  values (
    p_load_id,
    auth.uid(),
    v_company.id,
    coalesce(v_company.name, 'Independent Carrier'),
    v_load.rate_usd,
    'accepted'
  );

  update bids
    set status = 'declined', updated_at = now()
    where load_id = p_load_id
      and carrier_id != auth.uid()
      and status = 'pending';

  update loads
    set status    = 'awarded',
        bid_count = bid_count + 1
    where id = p_load_id;
end;
$$;

-- ── DOCUMENTS ─────────────────────────────────────────────────
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid references loads(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  type        text not null,
  file_name   text not null,
  file_url    text not null,
  file_size   integer,
  created_at  timestamptz not null default now()
);

create index if not exists documents_load_id_idx on documents(load_id);

alter table documents enable row level security;

drop policy if exists "authenticated_view_documents" on documents;
create policy "authenticated_view_documents"
  on documents for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated_upload_documents" on documents;
create policy "authenticated_upload_documents"
  on documents for insert
  with check (auth.role() = 'authenticated');

-- ── TRACKING MILESTONES (ensure sample data if empty) ─────────
-- Table should already exist from 001. This is a safety net.
create table if not exists tracking_milestones (
  id                  uuid primary key default gen_random_uuid(),
  load_number         text not null,
  label               text not null,
  location            text,
  milestone_timestamp text,
  completed           boolean not null default false,
  current             boolean not null default false,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists tracking_milestones_load_number_idx on tracking_milestones(load_number);

alter table tracking_milestones enable row level security;

drop policy if exists "tracking_select_all" on tracking_milestones;
create policy "tracking_select_all"
  on tracking_milestones for select using (true);

drop policy if exists "tracking_insert_auth" on tracking_milestones;
create policy "tracking_insert_auth"
  on tracking_milestones for insert with check (auth.role() = 'authenticated');
