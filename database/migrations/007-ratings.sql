-- Migration 007: Ratings
-- Run in Supabase SQL Editor

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  rater_id uuid not null references public.profiles(id),
  rated_company_id uuid not null references public.companies(id),

  overall integer not null check (overall between 1 and 5),
  communication integer check (communication between 1 and 5),
  reliability integer check (reliability between 1 and 5),
  professionalism integer check (professionalism between 1 and 5),
  comment text check (char_length(comment) <= 500),

  created_at timestamptz not null default now(),

  unique(load_id, rater_id)  -- one rating per person per load
);

create index ratings_rated_company_id_idx on public.ratings(rated_company_id);
create index ratings_load_id_idx on public.ratings(load_id);

-- RLS
alter table public.ratings enable row level security;

create policy "Authenticated users can view ratings"
  on public.ratings for select
  using (auth.role() = 'authenticated');

create policy "Load parties can rate after completion"
  on public.ratings for insert
  with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.loads
      where id = load_id and status = 'completed'
        and (posted_by = auth.uid())
    )
  );

-- Update company average rating when a new rating is inserted
create or replace function update_company_rating()
returns trigger language plpgsql security definer as $$
declare
  v_avg numeric;
  v_count integer;
begin
  select avg(overall)::numeric(3,2), count(*)
    into v_avg, v_count
    from public.ratings
    where rated_company_id = new.rated_company_id;

  update public.companies
    set rating = v_avg,
        total_loads = v_count
    where id = new.rated_company_id;

  return new;
end;
$$;

create trigger on_rating_insert
  after insert on public.ratings
  for each row execute procedure update_company_rating();
