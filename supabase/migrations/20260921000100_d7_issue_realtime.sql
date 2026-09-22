-- Only authorized issue INSERT/UPDATE notifications are needed in D7.
-- Keep existing SELECT RLS and RPC-only writes; receipts/profiles stay unpublished.
do $migration$
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'issues'
  ) then
    alter publication supabase_realtime add table public.issues;
  end if;
end;
$migration$;
