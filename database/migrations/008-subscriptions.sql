-- Migration 008: Subscriptions
-- Run in Supabase SQL Editor

create type subscription_tier as enum (
  'free',
  'carrier_pro',
  'broker_starter',
  'broker_growth',
  'shipper',
  'enterprise'
);

create type subscription_status as enum (
  'active',
  'past_due',
  'cancelled',
  'trialing'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  tier subscription_tier not null default 'free',
  status subscription_status not null default 'active',

  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_company_id_idx on public.subscriptions(company_id);
create index subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);

-- RLS
alter table public.subscriptions enable row level security;

create policy "Companies can view own subscription"
  on public.subscriptions for select
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

-- Upsert subscription from webhook (admin/service role only)
-- The actual inserts/updates come from the Stripe webhook Edge Function
-- using the service role key, so no insert/update policy needed for anon/user.

-- Auto-update updated_at
create or replace function update_subscription_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure update_subscription_timestamp();

-- invoices table — tracks payment lifecycle per load
create type invoice_status as enum (
  'invoiced',
  'approved',
  'processing',
  'paid',
  'disputed',
  'void'
);

create type payment_method as enum (
  'standard_net30',
  'quick_pay'
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id),
  broker_id uuid not null references public.profiles(id),
  carrier_id uuid not null references public.profiles(id),

  amount_usd integer not null,          -- cents
  quick_pay_fee_usd integer,            -- cents (2% of amount)
  payment_method payment_method,

  stripe_payment_intent_id text,
  stripe_transfer_id text,

  status invoice_status not null default 'invoiced',
  approved_at timestamptz,
  paid_at timestamptz,
  due_date date,                        -- net-30 or 2-business-day

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(load_id)                       -- one invoice per load
);

create index invoices_carrier_id_idx on public.invoices(carrier_id);
create index invoices_broker_id_idx on public.invoices(broker_id);

-- RLS
alter table public.invoices enable row level security;

create policy "Invoice parties can view"
  on public.invoices for select
  using (
    broker_id = auth.uid()
    or carrier_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Invoice parties can update"
  on public.invoices for update
  using (
    broker_id = auth.uid()
    or carrier_id = auth.uid()
  );

-- Auto-generate invoice when load reaches 'completed'
create or replace function auto_create_invoice()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    insert into public.invoices (
      load_id, broker_id, carrier_id, amount_usd, due_date
    )
    select
      new.id,
      new.posted_by,
      b.carrier_id,
      (new.rate_usd * 100)::integer,
      (now() + interval '30 days')::date
    from public.bids b
    where b.load_id = new.id and b.status = 'accepted'
    limit 1
    on conflict (load_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_load_completed
  after update of status on public.loads
  for each row execute procedure auto_create_invoice();
