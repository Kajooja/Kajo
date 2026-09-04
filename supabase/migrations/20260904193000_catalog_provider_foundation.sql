-- Sprint 014A / #182
-- Generic provider-backed catalog foundation.
--
-- The canonical recommendable entity remains public.items. Provider payloads and
-- external identifiers live behind a server-only boundary. Existing KAJO_MOCK
-- items remain discoverable until real provider data has passed acceptance.

alter table public.items
  add column if not exists discoverable boolean not null default true,
  add column if not exists creators text[] not null default '{}',
  add column if not exists release_year integer,
  add column if not exists image_url text,
  add column if not exists original_language text;

alter table public.items
  drop constraint if exists items_original_language_not_blank,
  add constraint items_original_language_not_blank
    check (original_language is null or btrim(original_language) <> '');

create index if not exists items_discoverable_item_type_idx
  on public.items (item_type, id)
  where discoverable;

create table if not exists private.item_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete restrict,
  provider_key text not null,
  provider_item_id text not null,
  source_url text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  source_hash text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_sources_provider_key_valid
    check (provider_key ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
  constraint item_sources_provider_item_id_not_blank
    check (btrim(provider_item_id) <> ''),
  constraint item_sources_payload_is_object
    check (jsonb_typeof(source_payload) = 'object'),
  constraint item_sources_provider_item_unique
    unique (provider_key, provider_item_id)
);

create index if not exists item_sources_item_id_idx
  on private.item_sources (item_id);

create index if not exists item_sources_provider_synced_idx
  on private.item_sources (provider_key, synced_at desc);

create table if not exists private.item_external_ids (
  namespace text not null,
  external_id text not null,
  item_id uuid not null references public.items (id) on delete restrict,
  first_seen_provider text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (namespace, external_id),
  constraint item_external_ids_namespace_valid
    check (namespace ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
  constraint item_external_ids_external_id_not_blank
    check (btrim(external_id) <> ''),
  constraint item_external_ids_provider_valid
    check (
      first_seen_provider is null
      or first_seen_provider ~ '^[a-z0-9][a-z0-9._-]{1,63}$'
    )
);

create index if not exists item_external_ids_item_id_idx
  on private.item_external_ids (item_id);

alter table private.item_sources enable row level security;
alter table private.item_external_ids enable row level security;

revoke all on table private.item_sources from public, anon, authenticated;
revoke all on table private.item_external_ids from public, anon, authenticated;

grant usage on schema private to service_role;
grant select, insert, update, delete on table private.item_sources to service_role;
grant select, insert, update, delete on table private.item_external_ids to service_role;

-- Reuse the existing private timestamp helper without exposing it.
drop trigger if exists item_sources_set_updated_at on private.item_sources;
create trigger item_sources_set_updated_at
before update on private.item_sources
for each row execute function private.set_updated_at();

-- Backfill durable provenance for the existing seeded mock catalog. Do not mark
-- these rows non-discoverable until real provider data has been accepted.
insert into private.item_sources (
  item_id,
  provider_key,
  provider_item_id,
  source_payload,
  synced_at
)
select
  item.id,
  'kajo_mock',
  item.metadata ->> 'slug',
  item.metadata,
  now()
from public.items as item
where item.metadata ->> 'source' = 'KAJO_MOCK'
  and btrim(coalesce(item.metadata ->> 'slug', '')) <> ''
on conflict (provider_key, provider_item_id) do update
set
  source_payload = excluded.source_payload,
  synced_at = excluded.synced_at;

insert into private.item_external_ids (
  namespace,
  external_id,
  item_id,
  first_seen_provider,
  last_seen_at
)
select
  'kajo_mock_slug',
  item.metadata ->> 'slug',
  item.id,
  'kajo_mock',
  now()
from public.items as item
where item.metadata ->> 'source' = 'KAJO_MOCK'
  and btrim(coalesce(item.metadata ->> 'slug', '')) <> ''
on conflict (namespace, external_id) do update
set last_seen_at = excluded.last_seen_at;

-- Server-only canonical upsert. It is deliberately SECURITY INVOKER and only the
-- service role may execute it. Provider secrets remain in server-side callers.
create or replace function public.upsert_catalog_item_v1(
  provider_key text,
  provider_item_id text,
  item_type text,
  title text,
  description text default null,
  tags text[] default '{}'::text[],
  metadata jsonb default '{}'::jsonb,
  creators text[] default '{}'::text[],
  release_year integer default null,
  image_url text default null,
  original_language text default null,
  external_ids jsonb default '{}'::jsonb,
  source_url text default null,
  source_updated_at timestamptz default null,
  source_hash text default null,
  source_payload jsonb default '{}'::jsonb,
  discoverable boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_item_id uuid;
  existing_source_item_id uuid;
  matching_alias_item_id uuid;
  matching_alias_item_count integer;
  normalized_tags text[];
  normalized_creators text[];
begin
  provider_key := lower(btrim(provider_key));
  provider_item_id := btrim(provider_item_id);
  title := btrim(title);

  if provider_key is null
     or provider_key !~ '^[a-z0-9][a-z0-9._-]{1,63}$' then
    raise exception 'Invalid provider key' using errcode = '22023';
  end if;

  if provider_item_id is null or provider_item_id = '' then
    raise exception 'Provider item id is required' using errcode = '22023';
  end if;

  if item_type is null or item_type not in ('BOOK', 'MOVIE') then
    raise exception 'Unsupported item type' using errcode = '22023';
  end if;

  if title is null or title = '' then
    raise exception 'Title is required' using errcode = '22023';
  end if;

  if metadata is null or jsonb_typeof(metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object' using errcode = '22023';
  end if;

  if external_ids is null or jsonb_typeof(external_ids) <> 'object' then
    raise exception 'External ids must be a JSON object' using errcode = '22023';
  end if;

  if source_payload is null or jsonb_typeof(source_payload) <> 'object' then
    raise exception 'Source payload must be a JSON object' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each_text(external_ids) as entry(namespace, external_id)
    where entry.namespace !~ '^[a-z0-9][a-z0-9._-]{1,63}$'
       or btrim(entry.external_id) = ''
  ) then
    raise exception 'External id namespace/value is invalid' using errcode = '22023';
  end if;

  select array(
    select distinct btrim(value)
    from unnest(coalesce(tags, '{}'::text[])) as tag(value)
    where btrim(value) <> ''
    order by btrim(value)
  ) into normalized_tags;

  select array(
    select distinct btrim(value)
    from unnest(coalesce(creators, '{}'::text[])) as creator(value)
    where btrim(value) <> ''
    order by btrim(value)
  ) into normalized_creators;

  select source.item_id
  into existing_source_item_id
  from private.item_sources as source
  where source.provider_key = upsert_catalog_item_v1.provider_key
    and source.provider_item_id = upsert_catalog_item_v1.provider_item_id;

  if existing_source_item_id is not null then
    target_item_id := existing_source_item_id;
  else
    select
      min(alias.item_id),
      count(distinct alias.item_id)::integer
    into matching_alias_item_id, matching_alias_item_count
    from private.item_external_ids as alias
    join jsonb_each_text(external_ids) as entry(namespace, external_id)
      on alias.namespace = entry.namespace
     and alias.external_id = btrim(entry.external_id);

    if coalesce(matching_alias_item_count, 0) > 1 then
      raise exception 'External ids resolve to multiple Kajo Items'
        using errcode = '23505';
    end if;

    target_item_id := matching_alias_item_id;
  end if;

  if target_item_id is not null and exists (
    select 1
    from private.item_external_ids as alias
    join jsonb_each_text(external_ids) as entry(namespace, external_id)
      on alias.namespace = entry.namespace
     and alias.external_id = btrim(entry.external_id)
    where alias.item_id <> target_item_id
  ) then
    raise exception 'External id already belongs to another Kajo Item'
      using errcode = '23505';
  end if;

  if target_item_id is null then
    insert into public.items (
      item_type,
      title,
      description,
      tags,
      metadata,
      creators,
      release_year,
      image_url,
      original_language,
      discoverable
    )
    values (
      item_type,
      title,
      nullif(btrim(description), ''),
      normalized_tags,
      metadata,
      normalized_creators,
      release_year,
      nullif(btrim(image_url), ''),
      nullif(btrim(original_language), ''),
      discoverable
    )
    returning id into target_item_id;
  else
    update public.items as item
    set
      item_type = upsert_catalog_item_v1.item_type,
      title = upsert_catalog_item_v1.title,
      description = nullif(btrim(upsert_catalog_item_v1.description), ''),
      tags = normalized_tags,
      metadata = upsert_catalog_item_v1.metadata,
      creators = normalized_creators,
      release_year = upsert_catalog_item_v1.release_year,
      image_url = nullif(btrim(upsert_catalog_item_v1.image_url), ''),
      original_language = nullif(btrim(upsert_catalog_item_v1.original_language), ''),
      discoverable = upsert_catalog_item_v1.discoverable
    where item.id = target_item_id;
  end if;

  insert into private.item_sources (
    item_id,
    provider_key,
    provider_item_id,
    source_url,
    source_updated_at,
    synced_at,
    source_hash,
    source_payload
  )
  values (
    target_item_id,
    provider_key,
    provider_item_id,
    nullif(btrim(source_url), ''),
    source_updated_at,
    now(),
    nullif(btrim(source_hash), ''),
    source_payload
  )
  on conflict (provider_key, provider_item_id) do update
  set
    source_url = excluded.source_url,
    source_updated_at = excluded.source_updated_at,
    synced_at = excluded.synced_at,
    source_hash = excluded.source_hash,
    source_payload = excluded.source_payload;

  insert into private.item_external_ids (
    namespace,
    external_id,
    item_id,
    first_seen_provider,
    last_seen_at
  )
  select
    entry.namespace,
    btrim(entry.external_id),
    target_item_id,
    provider_key,
    now()
  from jsonb_each_text(external_ids) as entry(namespace, external_id)
  on conflict (namespace, external_id) do update
  set last_seen_at = excluded.last_seen_at;

  return target_item_id;
end;
$$;

revoke all on function public.upsert_catalog_item_v1(
  text, text, text, text, text, text[], jsonb, text[], integer, text, text,
  jsonb, text, timestamptz, text, jsonb, boolean
) from public, anon, authenticated;

grant execute on function public.upsert_catalog_item_v1(
  text, text, text, text, text, text[], jsonb, text[], integer, text, text,
  jsonb, text, timestamptz, text, jsonb, boolean
) to service_role;

-- Make discoverability part of the single canonical baseline candidate generator.
-- The deployed function remains the same function/serving architecture; this
-- guarded forward rewrite adds only the lifecycle eligibility predicate.
do $$
declare
  function_oid oid;
  function_definition text;
  expected_fragment text :=
    'where requested_item_type is null or candidate.item_type = requested_item_type';
  replacement_fragment text :=
    'where candidate.discoverable and (requested_item_type is null or candidate.item_type = requested_item_type)';
begin
  select p.oid
  into function_oid
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'rank_items_v0'
    and pg_get_function_identity_arguments(p.oid) =
      'target_profile_id uuid, requested_mode text, requested_item_type text, result_limit integer, request_context jsonb';

  if function_oid is null then
    raise exception 'Expected private.rank_items_v0 signature was not found';
  end if;

  function_definition := pg_get_functiondef(function_oid);

  if position(expected_fragment in function_definition) = 0 then
    raise exception 'Expected rank_items_v0 candidate filter was not found';
  end if;

  execute replace(
    function_definition,
    expected_fragment,
    replacement_fragment
  );
end;
$$;
