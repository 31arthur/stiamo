-- Stiamo — adds the `clients` and `projects` tables (FSA's clients, and the work done for them).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.
-- Same shape and protections as the other tables: one JSON document per row, owner-only via
-- row-level security, broadcast to open devices through Realtime.
--
-- Nothing else needs changing: documents linked from Google Docs are stored as ordinary rows in the
-- existing `attachments` table (no file is uploaded), and plans that cover several cases or hearings
-- are still one document in `plans`.

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'projects'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id         text        not null,
        user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
        data       jsonb       not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )$f$, t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format($f$
      create policy "owner full access" on public.%1$I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))$f$, t);

    execute format('alter table public.%I replica identity full', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
