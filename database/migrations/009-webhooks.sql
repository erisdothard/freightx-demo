-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 009: Webhooks
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── 1. WEBHOOKS ───────────────────────────────────────────────
create table if not exists webhooks (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  url             text not null,
  events          text[] not null, -- array of event types
  secret          text not null,   -- for HMAC signature
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists webhooks_company_id_idx on webhooks(company_id);
create index if not exists webhooks_active_idx on webhooks(active) where active = true;

-- ── 2. WEBHOOK DELIVERIES ────────────────────────────────────
create table if not exists webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  webhook_id      uuid not null references webhooks(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null,
  response_status integer,
  response_body   text,
  attempts        integer not null default 0,
  next_retry_at   timestamptz,
  delivered_at    timestamptz,
  failed_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists webhook_deliveries_webhook_id_idx on webhook_deliveries(webhook_id);
create index if not exists webhook_deliveries_next_retry_idx on webhook_deliveries(next_retry_at) 
  where delivered_at is null and failed_at is null;
create index if not exists webhook_deliveries_created_at_idx on webhook_deliveries(created_at desc);

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────
alter table webhooks enable row level security;
alter table webhook_deliveries enable row level security;

-- Webhooks: company owners can manage their own webhooks
create policy "webhooks_manage_own"
  on webhooks for all
  using (
    exists (
      select 1 from companies where id = company_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from companies where id = company_id and owner_id = auth.uid()
    )
  );

-- Webhook deliveries: company owners can view their webhook deliveries
create policy "webhook_deliveries_view_own"
  on webhook_deliveries for select
  using (
    exists (
      select 1 from webhooks w
      join companies c on c.id = w.company_id
      where w.id = webhook_id and c.owner_id = auth.uid()
    )
  );

-- ── 4. HELPER FUNCTIONS ───────────────────────────────────────

-- Generate webhook secret
create or replace function generate_webhook_secret()
returns text language plpgsql as $$
begin
  return encode(gen_random_bytes(32), 'hex');
end;
$$;

-- Trigger webhook delivery (called by app code)
create or replace function trigger_webhook_event(
  p_event_type text,
  p_payload jsonb
)
returns void language plpgsql security definer as $$
declare
  v_webhook record;
begin
  -- Find all active webhooks subscribed to this event
  for v_webhook in
    select * from webhooks
    where active = true
    and p_event_type = any(events)
  loop
    -- Create delivery record
    insert into webhook_deliveries (
      webhook_id,
      event_type,
      payload,
      next_retry_at
    ) values (
      v_webhook.id,
      p_event_type,
      p_payload,
      now() -- Immediate delivery
    );
  end loop;
end;
$$;

-- ── 5. WEBHOOK EVENT TYPES ────────────────────────────────────
-- Document the supported event types
comment on table webhooks is 'Webhook subscriptions for external integrations';
comment on column webhooks.events is 'Supported events: load.created, load.updated, load.deleted, bid.created, bid.accepted, bid.declined, booking.created, load.dispatched, load.delivered, document.uploaded, payment.processed';
