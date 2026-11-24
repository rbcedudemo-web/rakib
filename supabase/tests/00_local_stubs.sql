-- Test harness only (never applied to the real project).
-- The bare supabase/postgres image has an older auth schema and no storage
-- tables; add what the migrations and tests touch.
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists phone_confirmed_at timestamptz;

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Behave like a new hosted project: no automatic grants to the API roles on
-- new tables, sequences or functions. The migrations must grant what they need.
alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role supabase_admin revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
