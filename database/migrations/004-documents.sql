-- ─────────────────────────────────────────────────────────────
-- FreightX — Migration 004: Documents
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  load_id         uuid references loads(id) on delete cascade,
  company_id      uuid references companies(id),
  uploaded_by     uuid not null references profiles(id),

  type            text not null, -- bill_of_lading | proof_of_delivery | rate_confirmation | other
  file_name       text not null,
  file_url        text not null,
  file_size_bytes integer,
  mime_type       text,

  created_at      timestamptz not null default now()
);

create index if not exists documents_load_id_idx    on documents(load_id);
create index if not exists documents_company_id_idx on documents(company_id);

alter table documents enable row level security;

-- Uploader or load parties can view
create policy "load_parties_view_documents"
  on documents for select
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from loads
      where id = load_id and posted_by = auth.uid()
    )
    or exists (
      select 1 from bids
      where load_id = documents.load_id and carrier_id = auth.uid() and status = 'accepted'
    )
  );

-- Authenticated users can upload
create policy "authenticated_upload_documents"
  on documents for insert
  with check (uploaded_by = auth.uid());

-- ── Supabase Storage Buckets ────────────────────────────────
-- Run in Supabase Dashboard → Storage → New bucket:
--   Name: documents   Public: false
--   Name: profile-photos  Public: true
--
-- Then add these Storage RLS policies in SQL Editor:

-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', true) on conflict do nothing;

-- create policy "auth_users_upload_docs"
--   on storage.objects for insert
--   with check (bucket_id = 'documents' and auth.role() = 'authenticated');

-- create policy "auth_users_read_docs"
--   on storage.objects for select
--   using (bucket_id = 'documents' and auth.role() = 'authenticated');

-- create policy "public_read_profile_photos"
--   on storage.objects for select
--   using (bucket_id = 'profile-photos');

-- create policy "auth_users_upload_profile_photos"
--   on storage.objects for insert
--   with check (bucket_id = 'profile-photos' and auth.role() = 'authenticated');
