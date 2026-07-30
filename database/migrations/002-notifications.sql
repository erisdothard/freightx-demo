-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 002: Notifications
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,        -- 'new_bid' | 'bid_accepted' | 'new_message' | 'load_status_change' | etc.
  title      text not null,
  body       text,
  load_id    uuid references loads(id) on delete set null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_unread_idx  on notifications(user_id, read) where read = false;

alter table notifications enable row level security;

create policy "users_view_own_notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "users_update_own_notifications"
  on notifications for update
  using (user_id = auth.uid());

-- Allow server/edge functions to insert notifications for any user
create policy "service_insert_notifications"
  on notifications for insert
  with check (true);

-- ── Enable Realtime ────────────────────────────────────────────
-- Run these in Supabase Dashboard → Database → Replication,
-- OR uncomment and run here if your Supabase plan supports it:
--
-- alter publication supabase_realtime add table notifications;
-- alter publication supabase_realtime add table loads;
-- alter publication supabase_realtime add table trucks;
-- alter publication supabase_realtime add table messages;
--
-- Alternatively enable per-table in:
-- Supabase Dashboard → Database → Replication → Tables
