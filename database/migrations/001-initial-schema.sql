-- ─────────────────────────────────────────────────────────────
-- FreightX — Initial Schema
-- Run in Supabase SQL Editor: supabase.com → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── 1. PROFILES ───────────────────────────────────────────────
-- One row per auth.users account. Lean — just identity + role.
-- Company details live in the companies table.
create table if not exists profiles (
  id                  uuid primary key references auth.users on delete cascade,
  email               text not null,
  full_name           text,
  role                text not null default 'carrier'
                        check (role in ('carrier','broker','shipper','admin')),
  phone               text,
  avatar_url          text,
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Auto-create a profile row on every new auth signup.
-- Reads full_name and role out of signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'carrier')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. COMPANIES ──────────────────────────────────────────────
-- One company per owner (expandable to multi-user in Phase 4).
-- Carriers: mc_number + dot_number
-- Brokers:  mc_number + broker_authority
-- Shippers: name + contact info
create table if not exists companies (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  type             text not null check (type in ('carrier','broker','shipper')),
  name             text not null,
  mc_number        text,
  dot_number       text,
  broker_authority text,
  address          text,
  city             text,
  state            char(2),
  zip              text,
  phone            text,
  email            text,
  website          text,
  logo_url         text,
  verified         boolean not null default false,
  rating           numeric(3,2),
  total_loads      integer not null default 0,
  on_time_percent  integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists companies_owner_id_idx on companies(owner_id);
create index if not exists companies_type_idx     on companies(type);
create unique index if not exists companies_mc_number_idx
  on companies(mc_number) where mc_number is not null;

-- ── 3. LOADS ──────────────────────────────────────────────────
create table if not exists loads (
  id                  uuid primary key default gen_random_uuid(),
  load_number         text unique not null,
  posted_by           uuid references profiles(id) on delete set null,
  company_id          uuid references companies(id) on delete set null,
  company_name        text not null,            -- denormalized for fast display
  origin_city         text not null,
  origin_state        text not null,
  dest_city           text not null,
  dest_state          text not null,
  pickup_date         date not null,
  delivery_date       date not null,
  equipment           text not null,
  commodity           text not null,
  weight_lbs          integer not null,
  rate_usd            numeric(10,2) not null,
  rate_per_mile       numeric(6,2),
  total_miles         integer,
  status              text not null default 'posted'
                        check (status in ('draft','posted','bid_received','awarded',
                                          'dispatched','in_transit','delivered',
                                          'completed','cancelled','expired')),
  bid_count           integer not null default 0,
  hazmat              boolean not null default false,
  temp_controlled     boolean not null default false,
  posted_at           timestamptz not null default now(),
  broker_credit_score integer,
  created_at          timestamptz not null default now()
);

-- ── 4. TRUCKS ─────────────────────────────────────────────────
create table if not exists trucks (
  id                  uuid primary key default gen_random_uuid(),
  posted_by           uuid references profiles(id) on delete set null,
  company_id          uuid references companies(id) on delete set null,
  company_name        text not null,            -- denormalized for fast display
  origin_city         text not null,
  origin_state        text not null,
  dest_city           text,
  dest_state          text,
  available_date      date not null,
  equipment           text not null,
  length_ft           integer,
  weight_capacity_lbs integer,
  driver_name         text,
  driver_phone        text,
  status              text not null default 'available'
                        check (status in ('available','booked','inactive')),
  created_at          timestamptz not null default now()
);

-- ── 5. CONVERSATIONS ──────────────────────────────────────────
create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  load_number      text,
  participant_a    uuid references profiles(id) on delete set null,
  participant_b    uuid references profiles(id) on delete set null,
  other_party      text not null,
  other_party_role text not null,
  last_message     text,
  last_message_at  timestamptz not null default now(),
  unread_count     integer not null default 0,
  created_at       timestamptz not null default now()
);

-- ── 6. MESSAGES ───────────────────────────────────────────────
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid references profiles(id) on delete set null,
  text            text not null,
  from_me         boolean not null default false,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── 7. TRACKING MILESTONES ────────────────────────────────────
create table if not exists tracking_milestones (
  id                   uuid primary key default gen_random_uuid(),
  load_number          text not null,
  label                text not null,
  location             text not null,
  milestone_timestamp  text,
  completed            boolean not null default false,
  current              boolean not null default false,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);

-- ── 8. ROW LEVEL SECURITY ─────────────────────────────────────
alter table profiles             enable row level security;
alter table companies            enable row level security;
alter table loads                enable row level security;
alter table trucks               enable row level security;
alter table conversations        enable row level security;
alter table messages             enable row level security;
alter table tracking_milestones  enable row level security;

-- Profiles
create policy "profiles_select_own"   on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own"   on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"   on profiles for update using (auth.uid() = id);

-- Companies: owner manages; all authenticated users can read
create policy "companies_manage_own"  on companies for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "companies_select_all"  on companies for select
  using (auth.role() = 'authenticated');

-- Loads: authenticated can read; poster can mutate
create policy "loads_select_all"      on loads for select using (auth.role() = 'authenticated');
create policy "loads_insert_auth"     on loads for insert with check (auth.role() = 'authenticated');
create policy "loads_update_own"      on loads for update using (auth.uid() = posted_by);
create policy "loads_delete_own"      on loads for delete using (auth.uid() = posted_by);

-- Trucks
create policy "trucks_select_all"     on trucks for select using (auth.role() = 'authenticated');
create policy "trucks_insert_auth"    on trucks for insert with check (auth.role() = 'authenticated');
create policy "trucks_update_own"     on trucks for update using (auth.uid() = posted_by);
create policy "trucks_delete_own"     on trucks for delete using (auth.uid() = posted_by);

-- Conversations
create policy "convos_select_own"     on conversations for select
  using (auth.uid() = participant_a or auth.uid() = participant_b or participant_a is null);
create policy "convos_insert_auth"    on conversations for insert with check (auth.role() = 'authenticated');
create policy "convos_update_own"     on conversations for update
  using (auth.uid() = participant_a or auth.uid() = participant_b);

-- Messages
create policy "messages_select_auth"  on messages for select using (auth.role() = 'authenticated');
create policy "messages_insert_auth"  on messages for insert with check (auth.role() = 'authenticated');

-- Tracking: public read, auth write
create policy "tracking_select_all"   on tracking_milestones for select using (true);
create policy "tracking_insert_auth"  on tracking_milestones for insert with check (auth.role() = 'authenticated');

-- ── 9. SEED — DEMO LOADS ──────────────────────────────────────
-- Insert after the schema is created. No user IDs needed for seed data.
insert into loads (load_number, company_name, origin_city, origin_state, dest_city, dest_state,
  pickup_date, delivery_date, equipment, commodity, weight_lbs, rate_usd, rate_per_mile,
  total_miles, status, bid_count, hazmat, temp_controlled, posted_at, broker_credit_score)
values
  ('FX-20260217-0042','Apex Freight Solutions','Chicago','IL','Dallas','TX',
   '2026-02-19','2026-02-21','van','General Freight',42000,3200,2.98,1074,'posted',3,false,false,'2026-02-17T12:14:00Z',91),
  ('FX-20260217-0043','Meridian Transport Group','Atlanta','GA','Miami','FL',
   '2026-02-20','2026-02-21','reefer','Fresh Produce',38000,1850,3.42,662,'posted',1,false,true,'2026-02-17T09:45:00Z',78),
  ('FX-20260217-0044','Pacific Rim Logistics','Los Angeles','CA','Phoenix','AZ',
   '2026-02-18','2026-02-19','flatbed','Steel Coils',47500,2100,3.18,370,'posted',5,false,false,'2026-02-17T07:20:00Z',95),
  ('FX-20260217-0045','Keystone Freight','Houston','TX','Memphis','TN',
   '2026-02-19','2026-02-20','van','Auto Parts',34000,2800,3.05,566,'bid_received',2,false,false,'2026-02-17T14:55:00Z',62),
  ('FX-20260217-0046','Apex Freight Solutions','Charlotte','NC','New York','NY',
   '2026-02-21','2026-02-22','reefer','Pharmaceuticals',28000,4200,4.15,634,'posted',0,false,true,'2026-02-17T15:30:00Z',88),
  ('FX-20260217-0047','Redwood Distribution','Denver','CO','Kansas City','MO',
   '2026-02-20','2026-02-21','van','Electronics',22000,1950,2.87,601,'posted',4,false,false,'2026-02-16T18:00:00Z',84)
on conflict (load_number) do nothing;

-- ── 10. SEED — TRACKING MILESTONES ───────────────────────────
insert into tracking_milestones (load_number, label, location, milestone_timestamp, completed, current, sort_order)
values
  ('FX-20260217-0042','Processed at Chicago DC',  'Chicago, IL',  'Feb 17, 2026 · 9:00 AM',  true,  false, 1),
  ('FX-20260217-0042','Departed Origin',           'Chicago, IL',  'Feb 17, 2026 · 11:30 AM', true,  false, 2),
  ('FX-20260217-0042','En Route to Destination',   'St. Louis, MO','Feb 18, 2026 · 2:15 PM',  true,  true,  3),
  ('FX-20260217-0042','Approaching Delivery',      'Dallas, TX',   'Feb 19, 2026 · 9:00 AM',  false, false, 4),
  ('FX-20260217-0042','Delivered',                 'Dallas, TX',   'Est. Feb 19, 2026 · 11:00 AM', false, false, 5)
on conflict do nothing;
