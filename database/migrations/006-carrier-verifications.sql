-- Migration 006: Carrier Verifications
-- Run in Supabase SQL Editor

create type verification_status as enum ('pending', 'verified', 'failed', 'expired');

create table public.carrier_verifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- FMCSA data
  mc_number text,
  dot_number text,
  fmcsa_status text,               -- 'AUTHORIZED', 'NOT AUTHORIZED', 'PENDING'
  fmcsa_verified_at timestamptz,
  csa_score numeric(5,2),
  safety_rating text,              -- 'Satisfactory', 'Conditional', 'Unsatisfactory'

  -- Insurance
  insurance_carrier text,
  insurance_policy text,
  insurance_amount_usd integer,
  insurance_expires_at date,
  insurance_cert_url text,

  -- W-9
  w9_url text,
  w9_uploaded_at timestamptz,

  -- Overall status
  status verification_status not null default 'pending',
  verified_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index carrier_verifications_company_id_idx
  on public.carrier_verifications(company_id);

-- RLS
alter table public.carrier_verifications enable row level security;

create policy "Companies can view own verification"
  on public.carrier_verifications for select
  using (
    exists (
      select 1 from public.companies
      where id = company_id and owner_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Companies can insert own verification"
  on public.carrier_verifications for insert
  with check (
    exists (
      select 1 from public.companies
      where id = company_id and owner_id = auth.uid()
    )
  );

create policy "Companies can update own verification"
  on public.carrier_verifications for update
  using (
    exists (
      select 1 from public.companies
      where id = company_id and owner_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-sync company.verified flag when verification status changes
create or replace function sync_company_verified()
returns trigger language plpgsql security definer as $$
begin
  update public.companies
    set verified = (new.status = 'verified')
    where id = new.company_id;
  return new;
end;
$$;

create trigger on_verification_status_change
  after update of status on public.carrier_verifications
  for each row execute procedure sync_company_verified();
