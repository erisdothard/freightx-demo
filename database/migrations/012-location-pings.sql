-- Migration 012: location_pings table for real-time GPS tracking (Phase 12)
-- Run this in Supabase SQL Editor before deploying Phase 12 code.

create table public.location_pings (
  id            uuid primary key default gen_random_uuid(),
  load_number   text not null,
  driver_id     uuid references public.profiles(id) on delete cascade,
  latitude      decimal(10,7) not null,
  longitude     decimal(10,7) not null,
  accuracy_m    int,
  heading_deg   int,        -- 0–360 direction of travel
  speed_ms      decimal(6,2),
  recorded_at   timestamptz not null default now()
);

create index on public.location_pings (load_number, recorded_at desc);

alter table public.location_pings enable row level security;

-- Drivers write their own pings
create policy "driver_insert" on public.location_pings
  for insert with check (auth.uid() = driver_id);

-- Anyone authenticated can read pings (tighten after launch if needed)
create policy "load_participant_read" on public.location_pings
  for select using (true);