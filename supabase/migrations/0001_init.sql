-- Stiamo — initial schema.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It is idempotent: running it again is safe.
--
-- Every collection is a table of JSON documents owned by one user:
--   id          the record's id (a UUID string made by the app)
--   user_id     the owner; filled from the signed-in session
--   data        the whole record (the app's domain model, as JSON)
-- Row-level security means a signed-in user can only ever see and change their own rows.

do $$
declare
  t text;
  tables text[] := array[
    'tasks', 'meetings', 'follow_ups', 'cases', 'hearings',
    'plans', 'goals', 'links', 'activity', 'attachments'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create table if not exists public.%I (
        id         text        not null,
        user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
        data       jsonb       not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )$f$, t);

    execute format('alter table public.%I enable row level security', t);

    -- (select auth.uid()) is evaluated once per statement instead of once per row.
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format($f$
      create policy "owner full access" on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))$f$, t);

    -- Deletes must carry the owner column so realtime can route them to the right user.
    execute format('alter table public.%I replica identity full', t);

    -- Live sync: broadcast changes on this table.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Private bucket for supporting documents; each user can only touch files under their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400) -- 25 MB
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "attachments: owner read" on storage.objects;
drop policy if exists "attachments: owner upload" on storage.objects;
drop policy if exists "attachments: owner delete" on storage.objects;

create policy "attachments: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
