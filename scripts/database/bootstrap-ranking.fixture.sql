-- Isolated SQL unit fixture, not a Supabase migration replay or Auth emulator.
-- Only columns read by the functions under test are represented here.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.profiles (id uuid primary key, profile_type text not null);
create table public.profile_members (profile_id uuid, user_id uuid);
create table public.items (
  id uuid primary key, item_type text, title text, description text,
  tags text[], discoverable boolean not null default true
);
create table public.events (
  id uuid primary key default gen_random_uuid(), profile_id uuid,
  item_id uuid, event_type text, properties jsonb default '{}',
  occurred_at timestamptz default now()
);
create table public.item_interactions (
  profile_id uuid, item_id uuid, interest text, rating integer,
  not_interested boolean default false, saved boolean default false,
  consumed boolean default false
);
create table private.profile_bootstrap_evidence (
  id uuid primary key default gen_random_uuid(), profile_id uuid, item_id uuid,
  source_provider text, evidence_kind text, rating integer,
  source_occurred_at timestamptz, imported_at timestamptz default now(),
  active boolean default true
);
