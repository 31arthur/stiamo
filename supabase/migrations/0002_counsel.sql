-- Stiamo — adds the `counsel` table (outside advocates and law firms).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.
-- Same shape and protections as the other tables: one JSON document per row, owner-only via
-- row-level security, broadcast to open devices through Realtime.

create table if not exists public.counsel (
  id         text        not null,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.counsel enable row level security;

drop policy if exists "owner full access" on public.counsel;
create policy "owner full access" on public.counsel
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.counsel replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'counsel'
  ) then
    alter publication supabase_realtime add table public.counsel;
  end if;
end $$;
