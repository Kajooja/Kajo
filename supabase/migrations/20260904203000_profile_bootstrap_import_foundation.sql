-- Sprint 014B / #185
-- PersonalProfile history-import foundation.
--
-- Imported provider history is deliberately NOT appended as native Kajo Events.
-- It remains removable/idempotent bootstrap evidence that contributes only to
-- LongTerm taste and reacted-item eligibility. Native Kajo Events continue to
-- own Working/ShortTerm behaviour and progressively dominate the bootstrap.

create table private.profile_import_jobs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source_provider text not null,
  dataset_kind text not null,
  file_name text,
  file_fingerprint text not null,
  status text not null default 'CREATED',
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  ambiguous_rows integer not null default 0,
  unmatched_rows integer not null default 0,
  skipped_rows integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz,
  constraint profile_import_jobs_provider_valid check (
    source_provider in ('LETTERBOXD', 'IMDB', 'STORYGRAPH', 'GOODREADS', 'KAJO_CSV')
  ),
  constraint profile_import_jobs_dataset_kind_valid check (
    dataset_kind ~ '^[A-Z0-9][A-Z0-9_]{1,31}$'
  ),
  constraint profile_import_jobs_fingerprint_valid check (
    file_fingerprint ~ '^[a-zA-Z0-9:_-]{16,128}$'
  ),
  constraint profile_import_jobs_status_valid check (
    status in ('CREATED', 'STAGED', 'COMMITTED', 'REMOVED')
  ),
  constraint profile_import_jobs_counts_non_negative check (
    total_rows >= 0
    and matched_rows >= 0
    and ambiguous_rows >= 0
    and unmatched_rows >= 0
    and skipped_rows >= 0
  ),
  constraint profile_import_jobs_file_unique
    unique (profile_id, source_provider, dataset_kind, file_fingerprint)
);

create index profile_import_jobs_actor_created_idx
  on private.profile_import_jobs (actor_user_id, created_at desc, id);
create index profile_import_jobs_profile_created_idx
  on private.profile_import_jobs (profile_id, created_at desc, id);

create table private.profile_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references private.profile_import_jobs (id) on delete cascade,
  source_row_key text not null,
  item_type text not null,
  title text not null,
  release_year integer,
  creators text[] not null default '{}',
  external_ids jsonb not null default '{}'::jsonb,
  evidence_kind text not null,
  rating integer,
  source_occurred_at timestamptz,
  source_metadata jsonb not null default '{}'::jsonb,
  match_status text not null,
  match_resolution text,
  matched_item_id uuid references public.items (id) on delete restrict,
  candidate_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_import_rows_source_key_not_blank check (btrim(source_row_key) <> ''),
  constraint profile_import_rows_item_type_valid check (item_type in ('BOOK', 'MOVIE')),
  constraint profile_import_rows_title_not_blank check (btrim(title) <> ''),
  constraint profile_import_rows_external_ids_object check (jsonb_typeof(external_ids) = 'object'),
  constraint profile_import_rows_metadata_object check (jsonb_typeof(source_metadata) = 'object'),
  constraint profile_import_rows_evidence_kind_valid check (
    evidence_kind in ('RATED', 'CONSUMED', 'SAVED')
  ),
  constraint profile_import_rows_rating_valid check (
    (evidence_kind = 'RATED' and rating between 0 and 10)
    or (evidence_kind <> 'RATED' and rating is null)
  ),
  constraint profile_import_rows_match_status_valid check (
    match_status in ('MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'SKIPPED')
  ),
  constraint profile_import_rows_match_identity_valid check (
    (match_status = 'MATCHED' and matched_item_id is not null)
    or (match_status <> 'MATCHED' and matched_item_id is null)
  ),
  unique (job_id, source_row_key)
);

create index profile_import_rows_job_status_idx
  on private.profile_import_rows (job_id, match_status, id);
create index profile_import_rows_matched_item_idx
  on private.profile_import_rows (matched_item_id)
  where matched_item_id is not null;

create table private.profile_bootstrap_evidence (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  item_type text not null,
  source_provider text not null,
  dataset_kind text not null,
  source_job_id uuid not null references private.profile_import_jobs (id) on delete restrict,
  source_row_key text not null,
  evidence_kind text not null,
  rating integer,
  source_occurred_at timestamptz,
  imported_at timestamptz not null default now(),
  active boolean not null default true,
  source_metadata jsonb not null default '{}'::jsonb,
  constraint profile_bootstrap_evidence_item_type_valid check (item_type in ('BOOK', 'MOVIE')),
  constraint profile_bootstrap_evidence_provider_valid check (
    source_provider in ('LETTERBOXD', 'IMDB', 'STORYGRAPH', 'GOODREADS', 'KAJO_CSV')
  ),
  constraint profile_bootstrap_evidence_dataset_kind_valid check (
    dataset_kind ~ '^[A-Z0-9][A-Z0-9_]{1,31}$'
  ),
  constraint profile_bootstrap_evidence_kind_valid check (
    evidence_kind in ('RATED', 'CONSUMED', 'SAVED')
  ),
  constraint profile_bootstrap_evidence_rating_valid check (
    (evidence_kind = 'RATED' and rating between 0 and 10)
    or (evidence_kind <> 'RATED' and rating is null)
  ),
  constraint profile_bootstrap_evidence_metadata_object check (
    jsonb_typeof(source_metadata) = 'object'
  ),
  unique (profile_id, source_provider, dataset_kind, item_id)
);

create index profile_bootstrap_evidence_profile_active_idx
  on private.profile_bootstrap_evidence (profile_id, item_id, imported_at desc)
  where active;
create index profile_bootstrap_evidence_job_idx
  on private.profile_bootstrap_evidence (source_job_id);
create index profile_bootstrap_evidence_item_idx
  on private.profile_bootstrap_evidence (item_id, profile_id)
  where active;

alter table private.profile_import_jobs enable row level security;
alter table private.profile_import_rows enable row level security;
alter table private.profile_bootstrap_evidence enable row level security;

revoke all on table private.profile_import_jobs from public, anon, authenticated;
revoke all on table private.profile_import_rows from public, anon, authenticated;
revoke all on table private.profile_bootstrap_evidence from public, anon, authenticated;

grant select, insert, update, delete on table private.profile_import_jobs to service_role;
grant select, insert, update, delete on table private.profile_import_rows to service_role;
grant select, insert, update, delete on table private.profile_bootstrap_evidence to service_role;

create or replace function private.normalize_import_title_v1(source_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(source_title, '')), '\s+', ' ', 'g'));
$$;

create or replace function private.assert_personal_profile_owner_v1(target_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = target_profile_id
      and profile.profile_type = 'PERSONAL'
      and profile.owner_user_id = actor_id
  ) then
    raise exception 'PersonalProfile owner access required' using errcode = '42501';
  end if;

  return actor_id;
end;
$$;

create or replace function private.get_profile_import_job_v1(target_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  result jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from private.profile_import_jobs as job
    join public.profiles as profile on profile.id = job.profile_id
    where job.id = target_job_id
      and job.actor_user_id = actor_id
      and profile.profile_type = 'PERSONAL'
      and profile.owner_user_id = actor_id
  ) then
    raise exception 'Import job access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'jobId', job.id,
    'profileId', job.profile_id,
    'sourceProvider', job.source_provider,
    'datasetKind', job.dataset_kind,
    'fileName', job.file_name,
    'fileFingerprint', job.file_fingerprint,
    'status', job.status,
    'totalRows', job.total_rows,
    'matchedRows', job.matched_rows,
    'ambiguousRows', job.ambiguous_rows,
    'unmatchedRows', job.unmatched_rows,
    'skippedRows', job.skipped_rows,
    'committedAt', job.committed_at,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'rowId', row.id,
          'sourceRowKey', row.source_row_key,
          'itemType', row.item_type,
          'title', row.title,
          'releaseYear', row.release_year,
          'creators', row.creators,
          'evidenceKind', row.evidence_kind,
          'rating', row.rating,
          'sourceOccurredAt', row.source_occurred_at,
          'matchStatus', row.match_status,
          'matchResolution', row.match_resolution,
          'matchedItemId', row.matched_item_id,
          'candidateItemIds', row.candidate_item_ids
        ) order by row.created_at, row.id
      )
      from private.profile_import_rows as row
      where row.job_id = job.id
    ), '[]'::jsonb)
  )
  into result
  from private.profile_import_jobs as job
  where job.id = target_job_id;

  return result;
end;
$$;

create or replace function private.create_profile_import_job_v1(
  target_profile_id uuid,
  input_source_provider text,
  input_dataset_kind text,
  input_file_name text,
  input_file_fingerprint text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  normalized_provider text := upper(btrim(coalesce(input_source_provider, '')));
  normalized_dataset text := upper(btrim(coalesce(input_dataset_kind, '')));
  normalized_fingerprint text := btrim(coalesce(input_file_fingerprint, ''));
  job_id uuid;
begin
  actor_id := private.assert_personal_profile_owner_v1(target_profile_id);

  if normalized_provider not in ('LETTERBOXD', 'IMDB', 'STORYGRAPH', 'GOODREADS', 'KAJO_CSV') then
    raise exception 'Unsupported import provider' using errcode = '22023';
  end if;
  if normalized_dataset !~ '^[A-Z0-9][A-Z0-9_]{1,31}$' then
    raise exception 'Invalid dataset kind' using errcode = '22023';
  end if;
  if normalized_fingerprint !~ '^[a-zA-Z0-9:_-]{16,128}$' then
    raise exception 'Invalid file fingerprint' using errcode = '22023';
  end if;

  insert into private.profile_import_jobs (
    actor_user_id,
    profile_id,
    source_provider,
    dataset_kind,
    file_name,
    file_fingerprint
  ) values (
    actor_id,
    target_profile_id,
    normalized_provider,
    normalized_dataset,
    nullif(left(btrim(input_file_name), 255), ''),
    normalized_fingerprint
  )
  on conflict (profile_id, source_provider, dataset_kind, file_fingerprint)
  do update set
    file_name = excluded.file_name,
    status = case
      when private.profile_import_jobs.status = 'REMOVED' then 'CREATED'
      else private.profile_import_jobs.status
    end,
    updated_at = now()
  returning id into job_id;

  return job_id;
end;
$$;

create or replace function private.stage_profile_import_rows_v1(
  target_job_id uuid,
  input_rows jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  job_record private.profile_import_jobs%rowtype;
  source_row jsonb;
  row_key text;
  row_item_type text;
  row_title text;
  row_year integer;
  row_creators text[];
  row_external_ids jsonb;
  row_evidence_kind text;
  row_rating integer;
  row_occurred_at timestamptz;
  row_metadata jsonb;
  matched_ids uuid[];
  candidate_ids uuid[];
  candidate_count integer;
  resolved_item_id uuid;
  resolved_status text;
  resolved_method text;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if input_rows is null or jsonb_typeof(input_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(input_rows) < 1 or jsonb_array_length(input_rows) > 500 then
    raise exception 'Import batch must contain between 1 and 500 rows' using errcode = '22023';
  end if;

  select job.* into job_record
  from private.profile_import_jobs as job
  join public.profiles as profile on profile.id = job.profile_id
  where job.id = target_job_id
    and job.actor_user_id = actor_id
    and profile.profile_type = 'PERSONAL'
    and profile.owner_user_id = actor_id;

  if job_record.id is null then
    raise exception 'Import job access denied' using errcode = '42501';
  end if;

  delete from private.profile_import_rows where job_id = target_job_id;

  for source_row in select value from jsonb_array_elements(input_rows)
  loop
    if jsonb_typeof(source_row) <> 'object' then
      raise exception 'Each import row must be an object' using errcode = '22023';
    end if;

    row_key := btrim(coalesce(source_row ->> 'sourceRowKey', ''));
    row_item_type := upper(btrim(coalesce(source_row ->> 'itemType', '')));
    row_title := regexp_replace(btrim(coalesce(source_row ->> 'title', '')), '\s+', ' ', 'g');
    row_evidence_kind := upper(btrim(coalesce(source_row ->> 'evidenceKind', '')));
    row_external_ids := case
      when jsonb_typeof(source_row -> 'externalIds') = 'object' then source_row -> 'externalIds'
      else '{}'::jsonb
    end;
    row_metadata := case
      when jsonb_typeof(source_row -> 'sourceMetadata') = 'object' then source_row -> 'sourceMetadata'
      else '{}'::jsonb
    end;
    row_creators := array(
      select distinct regexp_replace(btrim(value), '\s+', ' ', 'g')
      from jsonb_array_elements_text(
        case when jsonb_typeof(source_row -> 'creators') = 'array'
          then source_row -> 'creators' else '[]'::jsonb end
      ) as creator(value)
      where btrim(value) <> ''
      order by regexp_replace(btrim(value), '\s+', ' ', 'g')
    );

    if source_row ? 'releaseYear' and source_row ->> 'releaseYear' ~ '^\d{4}$' then
      row_year := (source_row ->> 'releaseYear')::integer;
    else
      row_year := null;
    end if;

    if source_row ? 'rating' and source_row ->> 'rating' ~ '^(10|[0-9])$' then
      row_rating := (source_row ->> 'rating')::integer;
    else
      row_rating := null;
    end if;

    if nullif(btrim(source_row ->> 'sourceOccurredAt'), '') is null then
      row_occurred_at := null;
    else
      begin
        row_occurred_at := (source_row ->> 'sourceOccurredAt')::timestamptz;
      exception when others then
        raise exception 'Invalid sourceOccurredAt for row %', row_key using errcode = '22007';
      end;
    end if;

    if row_key = '' or length(row_key) > 255 then
      raise exception 'Invalid source row key' using errcode = '22023';
    end if;
    if row_item_type not in ('BOOK', 'MOVIE') then
      raise exception 'Unsupported import Item type' using errcode = '22023';
    end if;
    if row_title = '' or length(row_title) > 500 then
      raise exception 'Invalid import title' using errcode = '22023';
    end if;
    if row_year is not null and (row_year < 1400 or row_year > extract(year from now())::integer + 2) then
      raise exception 'Invalid release year' using errcode = '22023';
    end if;
    if row_evidence_kind not in ('RATED', 'CONSUMED', 'SAVED') then
      raise exception 'Unsupported import evidence kind' using errcode = '22023';
    end if;
    if row_evidence_kind = 'RATED' and row_rating is null then
      raise exception 'Rated import evidence requires a 0-10 rating' using errcode = '22023';
    end if;
    if row_evidence_kind <> 'RATED' then
      row_rating := null;
    end if;

    if exists (
      select 1
      from jsonb_each_text(row_external_ids) as external(namespace, external_id)
      where external.namespace not in (
        'tmdb_movie', 'imdb_title', 'isbn13', 'isbn10',
        'open_library_work', 'open_library_edition'
      )
         or btrim(external.external_id) = ''
         or length(external.external_id) > 128
    ) then
      raise exception 'Unsupported or invalid external identifier' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct alias.item_id order by alias.item_id), '{}'::uuid[])
      into matched_ids
    from private.item_external_ids as alias
    join jsonb_each_text(row_external_ids) as external(namespace, external_id)
      on alias.namespace = external.namespace
     and alias.external_id = btrim(external.external_id)
    join public.items as item
      on item.id = alias.item_id
     and item.item_type = row_item_type;

    candidate_count := coalesce(array_length(matched_ids, 1), 0);
    resolved_item_id := null;
    resolved_method := null;

    if candidate_count = 1 then
      resolved_item_id := matched_ids[1];
      resolved_status := 'MATCHED';
      resolved_method := 'EXTERNAL_ID';
      candidate_ids := matched_ids;
    elsif candidate_count > 1 then
      resolved_status := 'AMBIGUOUS';
      resolved_method := 'EXTERNAL_ID_CONFLICT';
      candidate_ids := matched_ids[1:8];
    else
      select
        coalesce(array_agg(item.id order by item.id), '{}'::uuid[])
      into candidate_ids
      from public.items as item
      where item.item_type = row_item_type
        and private.normalize_import_title_v1(item.title) = private.normalize_import_title_v1(row_title)
        and (row_year is null or item.release_year = row_year)
        and not exists (
          select 1
          from private.item_sources as source
          where source.item_id = item.id
            and source.provider_key = 'kajo_mock'
        );

      candidate_count := coalesce(array_length(candidate_ids, 1), 0);
      if candidate_count = 1 then
        resolved_item_id := candidate_ids[1];
        resolved_status := 'MATCHED';
        resolved_method := case when row_year is null
          then 'TITLE_UNIQUE' else 'TITLE_YEAR_UNIQUE' end;
      elsif candidate_count > 1 then
        resolved_status := 'AMBIGUOUS';
        resolved_method := 'TITLE_COLLISION';
        candidate_ids := candidate_ids[1:8];
      else
        resolved_status := 'UNMATCHED';
        resolved_method := null;
        candidate_ids := '{}'::uuid[];
      end if;
    end if;

    insert into private.profile_import_rows (
      job_id,
      source_row_key,
      item_type,
      title,
      release_year,
      creators,
      external_ids,
      evidence_kind,
      rating,
      source_occurred_at,
      source_metadata,
      match_status,
      match_resolution,
      matched_item_id,
      candidate_item_ids
    ) values (
      target_job_id,
      row_key,
      row_item_type,
      row_title,
      row_year,
      row_creators,
      row_external_ids,
      row_evidence_kind,
      row_rating,
      row_occurred_at,
      row_metadata,
      resolved_status,
      resolved_method,
      resolved_item_id,
      coalesce(candidate_ids, '{}'::uuid[])
    );
  end loop;

  update private.profile_import_jobs as job
  set
    status = 'STAGED',
    total_rows = summary.total_rows,
    matched_rows = summary.matched_rows,
    ambiguous_rows = summary.ambiguous_rows,
    unmatched_rows = summary.unmatched_rows,
    skipped_rows = summary.skipped_rows,
    committed_at = null,
    updated_at = now()
  from (
    select
      count(*)::integer as total_rows,
      count(*) filter (where row.match_status = 'MATCHED')::integer as matched_rows,
      count(*) filter (where row.match_status = 'AMBIGUOUS')::integer as ambiguous_rows,
      count(*) filter (where row.match_status = 'UNMATCHED')::integer as unmatched_rows,
      count(*) filter (where row.match_status = 'SKIPPED')::integer as skipped_rows
    from private.profile_import_rows as row
    where row.job_id = target_job_id
  ) as summary
  where job.id = target_job_id;

  return private.get_profile_import_job_v1(target_job_id);
end;
$$;

create or replace function private.resolve_profile_import_row_v1(
  target_row_id uuid,
  chosen_item_id uuid default null,
  skip_row boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  row_record private.profile_import_rows%rowtype;
  job_record private.profile_import_jobs%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select row.* into row_record
  from private.profile_import_rows as row
  where row.id = target_row_id;
  if row_record.id is null then
    raise exception 'Import row not found' using errcode = '22023';
  end if;

  select job.* into job_record
  from private.profile_import_jobs as job
  join public.profiles as profile on profile.id = job.profile_id
  where job.id = row_record.job_id
    and job.actor_user_id = actor_id
    and profile.profile_type = 'PERSONAL'
    and profile.owner_user_id = actor_id;
  if job_record.id is null then
    raise exception 'Import row access denied' using errcode = '42501';
  end if;

  if skip_row then
    update private.profile_import_rows
    set
      match_status = 'SKIPPED',
      match_resolution = 'USER_SKIPPED',
      matched_item_id = null,
      updated_at = now()
    where id = target_row_id;
  else
    if chosen_item_id is null or not exists (
      select 1 from public.items as item
      where item.id = chosen_item_id
        and item.item_type = row_record.item_type
        and not exists (
          select 1 from private.item_sources as source
          where source.item_id = item.id and source.provider_key = 'kajo_mock'
        )
    ) then
      raise exception 'Chosen canonical Item is invalid for import row' using errcode = '22023';
    end if;

    update private.profile_import_rows
    set
      match_status = 'MATCHED',
      match_resolution = 'USER_SELECTED',
      matched_item_id = chosen_item_id,
      updated_at = now()
    where id = target_row_id;
  end if;

  update private.profile_import_jobs as job
  set
    status = 'STAGED',
    matched_rows = summary.matched_rows,
    ambiguous_rows = summary.ambiguous_rows,
    unmatched_rows = summary.unmatched_rows,
    skipped_rows = summary.skipped_rows,
    updated_at = now()
  from (
    select
      count(*) filter (where row.match_status = 'MATCHED')::integer as matched_rows,
      count(*) filter (where row.match_status = 'AMBIGUOUS')::integer as ambiguous_rows,
      count(*) filter (where row.match_status = 'UNMATCHED')::integer as unmatched_rows,
      count(*) filter (where row.match_status = 'SKIPPED')::integer as skipped_rows
    from private.profile_import_rows as row
    where row.job_id = job_record.id
  ) as summary
  where job.id = job_record.id;

  return private.get_profile_import_job_v1(job_record.id);
end;
$$;

create or replace function private.commit_profile_import_job_v1(target_job_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  job_record private.profile_import_jobs%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select job.* into job_record
  from private.profile_import_jobs as job
  join public.profiles as profile on profile.id = job.profile_id
  where job.id = target_job_id
    and job.actor_user_id = actor_id
    and profile.profile_type = 'PERSONAL'
    and profile.owner_user_id = actor_id;

  if job_record.id is null then
    raise exception 'Import job access denied' using errcode = '42501';
  end if;
  if job_record.status not in ('STAGED', 'COMMITTED') then
    raise exception 'Import job must be staged before commit' using errcode = '55000';
  end if;

  -- A provider/dataset import is a replaceable snapshot. Re-importing that
  -- dataset deactivates its prior snapshot before activating the new matches.
  update private.profile_bootstrap_evidence
  set active = false
  where profile_id = job_record.profile_id
    and source_provider = job_record.source_provider
    and dataset_kind = job_record.dataset_kind
    and active;

  with ranked as (
    select
      row.*,
      row_number() over (
        partition by row.matched_item_id
        order by
          case row.evidence_kind when 'RATED' then 3 when 'CONSUMED' then 2 else 1 end desc,
          row.source_occurred_at desc nulls last,
          row.source_row_key
      ) as item_order
    from private.profile_import_rows as row
    where row.job_id = target_job_id
      and row.match_status = 'MATCHED'
      and row.matched_item_id is not null
  )
  insert into private.profile_bootstrap_evidence (
    actor_user_id,
    profile_id,
    item_id,
    item_type,
    source_provider,
    dataset_kind,
    source_job_id,
    source_row_key,
    evidence_kind,
    rating,
    source_occurred_at,
    imported_at,
    active,
    source_metadata
  )
  select
    actor_id,
    job_record.profile_id,
    ranked.matched_item_id,
    ranked.item_type,
    job_record.source_provider,
    job_record.dataset_kind,
    target_job_id,
    ranked.source_row_key,
    ranked.evidence_kind,
    ranked.rating,
    ranked.source_occurred_at,
    now(),
    true,
    ranked.source_metadata
  from ranked
  where ranked.item_order = 1
  on conflict (profile_id, source_provider, dataset_kind, item_id)
  do update set
    actor_user_id = excluded.actor_user_id,
    item_type = excluded.item_type,
    source_job_id = excluded.source_job_id,
    source_row_key = excluded.source_row_key,
    evidence_kind = excluded.evidence_kind,
    rating = excluded.rating,
    source_occurred_at = excluded.source_occurred_at,
    imported_at = excluded.imported_at,
    active = true,
    source_metadata = excluded.source_metadata;

  update private.profile_import_jobs
  set status = 'COMMITTED', committed_at = now(), updated_at = now()
  where id = target_job_id;

  return private.get_profile_import_job_v1(target_job_id);
end;
$$;

create or replace function private.remove_profile_import_job_v1(target_job_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  job_record private.profile_import_jobs%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select job.* into job_record
  from private.profile_import_jobs as job
  join public.profiles as profile on profile.id = job.profile_id
  where job.id = target_job_id
    and job.actor_user_id = actor_id
    and profile.profile_type = 'PERSONAL'
    and profile.owner_user_id = actor_id;

  if job_record.id is null then
    raise exception 'Import job access denied' using errcode = '42501';
  end if;

  update private.profile_bootstrap_evidence
  set active = false
  where source_job_id = target_job_id and active;

  update private.profile_import_jobs
  set status = 'REMOVED', updated_at = now()
  where id = target_job_id;

  return private.get_profile_import_job_v1(target_job_id);
end;
$$;

create or replace function public.create_profile_import_job_v1(
  target_profile_id uuid,
  source_provider text,
  dataset_kind text,
  file_name text,
  file_fingerprint text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_profile_import_job_v1(
    target_profile_id, source_provider, dataset_kind, file_name, file_fingerprint
  );
$$;

create or replace function public.stage_profile_import_rows_v1(
  target_job_id uuid,
  import_rows jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.stage_profile_import_rows_v1(target_job_id, import_rows);
$$;

create or replace function public.resolve_profile_import_row_v1(
  target_row_id uuid,
  chosen_item_id uuid default null,
  skip_row boolean default false
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.resolve_profile_import_row_v1(target_row_id, chosen_item_id, skip_row);
$$;

create or replace function public.commit_profile_import_job_v1(target_job_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.commit_profile_import_job_v1(target_job_id);
$$;

create or replace function public.remove_profile_import_job_v1(target_job_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.remove_profile_import_job_v1(target_job_id);
$$;

create or replace function public.get_profile_import_job_v1(target_job_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_import_job_v1(target_job_id);
$$;

revoke all on function private.normalize_import_title_v1(text) from public, anon, authenticated;
revoke all on function private.assert_personal_profile_owner_v1(uuid) from public, anon, authenticated;
revoke all on function private.get_profile_import_job_v1(uuid) from public, anon, authenticated;
revoke all on function private.create_profile_import_job_v1(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function private.stage_profile_import_rows_v1(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.resolve_profile_import_row_v1(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function private.commit_profile_import_job_v1(uuid) from public, anon, authenticated;
revoke all on function private.remove_profile_import_job_v1(uuid) from public, anon, authenticated;

grant execute on function private.get_profile_import_job_v1(uuid) to authenticated;
grant execute on function private.create_profile_import_job_v1(uuid, text, text, text, text) to authenticated;
grant execute on function private.stage_profile_import_rows_v1(uuid, jsonb) to authenticated;
grant execute on function private.resolve_profile_import_row_v1(uuid, uuid, boolean) to authenticated;
grant execute on function private.commit_profile_import_job_v1(uuid) to authenticated;
grant execute on function private.remove_profile_import_job_v1(uuid) to authenticated;

revoke all on function public.create_profile_import_job_v1(uuid, text, text, text, text) from public, anon;
revoke all on function public.stage_profile_import_rows_v1(uuid, jsonb) from public, anon;
revoke all on function public.resolve_profile_import_row_v1(uuid, uuid, boolean) from public, anon;
revoke all on function public.commit_profile_import_job_v1(uuid) from public, anon;
revoke all on function public.remove_profile_import_job_v1(uuid) from public, anon;
revoke all on function public.get_profile_import_job_v1(uuid) from public, anon;

grant execute on function public.create_profile_import_job_v1(uuid, text, text, text, text) to authenticated;
grant execute on function public.stage_profile_import_rows_v1(uuid, jsonb) to authenticated;
grant execute on function public.resolve_profile_import_row_v1(uuid, uuid, boolean) to authenticated;
grant execute on function public.commit_profile_import_job_v1(uuid) to authenticated;
grant execute on function public.remove_profile_import_job_v1(uuid) to authenticated;
grant execute on function public.get_profile_import_job_v1(uuid) to authenticated;

create or replace function private.bootstrap_evidence_weight_v1(
  evidence_kind text,
  evidence_rating integer
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case evidence_kind
    when 'RATED' then case
      when evidence_rating between 0 and 10 then (evidence_rating::double precision - 5.0) * 0.75
      else 0.0 end
    when 'CONSUMED' then 0.4
    when 'SAVED' then 0.9
    else 0.0
  end;
$$;

-- Extend the existing MemoryState in place. Bootstrap evidence contributes only
-- to LongTerm taste. It never enters the ShortTerm branch.
create or replace function private.build_profile_memory_state_v1(
  target_profile_id uuid,
  state_as_of timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reversed_events as (
    select (event.properties ->> 'reversedEventId')::uuid as event_id
    from public.events as event
    where event.profile_id = target_profile_id
      and event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.occurred_at <= state_as_of
      and event.properties ? 'reversedEventId'
      and (event.properties ->> 'reversedEventId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  native_weighted_events as (
    select
      event.item_id,
      event.occurred_at,
      private.event_evidence_weight_v1(event.event_type, event.properties) as event_weight,
      false as is_bootstrap,
      null::timestamptz as bootstrap_imported_at
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id is not null
      and event.occurred_at <= state_as_of
      and private.event_evidence_weight_v1(event.event_type, event.properties) <> 0.0
      and not exists (
        select 1 from reversed_events where reversed_events.event_id = event.id
      )
  ),
  bootstrap_ranked as (
    select
      evidence.*,
      row_number() over (
        partition by evidence.item_id
        order by
          case evidence.evidence_kind when 'RATED' then 3 when 'CONSUMED' then 2 else 1 end desc,
          evidence.source_occurred_at desc nulls last,
          evidence.imported_at desc,
          evidence.id
      ) as item_order
    from private.profile_bootstrap_evidence as evidence
    where evidence.profile_id = target_profile_id
      and evidence.active
      and evidence.imported_at <= state_as_of
  ),
  bootstrap_weighted_events as (
    select
      evidence.item_id,
      coalesce(evidence.source_occurred_at, evidence.imported_at) as occurred_at,
      private.bootstrap_evidence_weight_v1(evidence.evidence_kind, evidence.rating) as event_weight,
      true as is_bootstrap,
      evidence.imported_at as bootstrap_imported_at
    from bootstrap_ranked as evidence
    where evidence.item_order = 1
      and private.bootstrap_evidence_weight_v1(evidence.evidence_kind, evidence.rating) <> 0.0
  ),
  weighted_events as (
    select * from native_weighted_events
    union all
    select * from bootstrap_weighted_events
  ),
  tag_scores as (
    select
      tag,
      sum(
        weighted_events.event_weight
        * case
            when weighted_events.is_bootstrap then greatest(
              0.20,
              exp(
                -greatest(
                  0.0,
                  extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0
                ) / 1460.0
              )
            )
            else exp(
              -greatest(
                0.0,
                extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0
              ) / 180.0
            )
          end
      ) as long_term_score,
      sum(
        case
          when not weighted_events.is_bootstrap
           and weighted_events.occurred_at >= state_as_of - interval '14 days'
            then weighted_events.event_weight
              * exp(
                  -greatest(
                    0.0,
                    extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0
                  ) / 7.0
                )
          else 0.0
        end
      ) as short_term_score
    from weighted_events
    join public.items as evidence_item on evidence_item.id = weighted_events.item_id
    cross join lateral unnest(evidence_item.tags) as tag
    group by tag
  ),
  evidence_summary as (
    select
      count(*)::integer as evidence_count,
      count(*) filter (where not is_bootstrap)::integer as native_evidence_count,
      count(*) filter (where is_bootstrap)::integer as bootstrap_evidence_count,
      max(occurred_at) as last_evidence_at,
      max(bootstrap_imported_at) as last_bootstrap_imported_at
    from weighted_events
  )
  select jsonb_build_object(
    'version', 'memory-state-v1',
    'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
    'asOf', state_as_of,
    'evidenceCount', evidence_summary.evidence_count,
    'nativeEvidenceCount', evidence_summary.native_evidence_count,
    'bootstrapEvidenceCount', evidence_summary.bootstrap_evidence_count,
    'lastEvidenceAt', evidence_summary.last_evidence_at,
    'lastBootstrapImportedAt', evidence_summary.last_bootstrap_imported_at,
    'longTermPositiveTags', coalesce((
      select jsonb_agg(tag order by long_term_score desc, tag)
      from (
        select tag, long_term_score from tag_scores
        where long_term_score > 0.0
        order by long_term_score desc, tag limit 12
      ) as selected
    ), '[]'::jsonb),
    'longTermNegativeTags', coalesce((
      select jsonb_agg(tag order by long_term_score, tag)
      from (
        select tag, long_term_score from tag_scores
        where long_term_score < 0.0
        order by long_term_score, tag limit 12
      ) as selected
    ), '[]'::jsonb),
    'shortTermPositiveTags', coalesce((
      select jsonb_agg(tag order by short_term_score desc, tag)
      from (
        select tag, short_term_score from tag_scores
        where short_term_score > 0.0
        order by short_term_score desc, tag limit 12
      ) as selected
    ), '[]'::jsonb),
    'shortTermNegativeTags', coalesce((
      select jsonb_agg(tag order by short_term_score, tag)
      from (
        select tag, short_term_score from tag_scores
        where short_term_score < 0.0
        order by short_term_score, tag limit 12
      ) as selected
    ), '[]'::jsonb)
  ) from evidence_summary;
$$;

revoke all on function private.bootstrap_evidence_weight_v1(text, integer)
  from public, anon, authenticated;
revoke all on function private.build_profile_memory_state_v1(uuid, timestamptz)
  from public, anon, authenticated;

-- Extend the existing reacted-item policy in place so imported watched/read/rated
-- history cannot be recommended as if it were unseen. Imported SAVED remains a
-- saved-only intent and follows the same bounded reminder policy.
create or replace function private.resurfacing_policy_decision_v1(
  target_profile_id uuid,
  target_item_id uuid,
  candidate_explanation jsonb,
  decision_time timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  config jsonb := private.resurfacing_policy_config_v1();
  native_consumed boolean := coalesce(
    case when candidate_explanation ->> 'consumedSuppressed' in ('true', 'false')
      then (candidate_explanation ->> 'consumedSuppressed')::boolean end,
    false
  );
  native_rated boolean := candidate_explanation -> 'rating' is not null
    and candidate_explanation -> 'rating' <> 'null'::jsonb;
  native_not_interested boolean := coalesce(
    case when candidate_explanation ->> 'notInterested' in ('true', 'false')
      then (candidate_explanation ->> 'notInterested')::boolean end,
    false
  );
  native_saved boolean := coalesce(
    case when candidate_explanation ->> 'saved' in ('true', 'false')
      then (candidate_explanation ->> 'saved')::boolean end,
    false
  );
  bootstrap_kind text;
  bootstrap_at timestamptz;
  is_consumed boolean;
  has_rating boolean;
  is_not_interested boolean;
  is_saved boolean;
  last_saved_at timestamptz;
  last_reminder_at timestamptz;
  reminder_count_90d integer := 0;
  saved_age_days double precision;
begin
  if target_profile_id is null or target_item_id is null then
    raise exception 'Profile and Item are required for resurfacing policy'
      using errcode = '22023';
  end if;
  if decision_time is null then
    raise exception 'Decision time is required for resurfacing policy'
      using errcode = '22023';
  end if;

  select evidence.evidence_kind, coalesce(evidence.source_occurred_at, evidence.imported_at)
    into bootstrap_kind, bootstrap_at
  from private.profile_bootstrap_evidence as evidence
  where evidence.profile_id = target_profile_id
    and evidence.item_id = target_item_id
    and evidence.active
    and evidence.imported_at <= decision_time
  order by
    case evidence.evidence_kind when 'RATED' then 3 when 'CONSUMED' then 2 else 1 end desc,
    evidence.source_occurred_at desc nulls last,
    evidence.imported_at desc,
    evidence.id
  limit 1;

  is_consumed := native_consumed or bootstrap_kind in ('RATED', 'CONSUMED');
  has_rating := native_rated or bootstrap_kind = 'RATED';
  is_not_interested := native_not_interested;
  is_saved := native_saved or bootstrap_kind = 'SAVED';

  if is_consumed or has_rating or is_not_interested then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'TERMINAL_SUPPRESSED',
      'eligible', false,
      'reason', case
        when native_consumed then 'CONSUMED'
        when native_rated then 'RATED'
        when native_not_interested then 'NOT_INTERESTED'
        when bootstrap_kind = 'RATED' then 'IMPORTED_RATED'
        else 'IMPORTED_CONSUMED'
      end,
      'consumed', is_consumed,
      'rated', has_rating,
      'notInterested', is_not_interested,
      'saved', is_saved,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if not is_saved then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'ORDINARY',
      'eligible', true,
      'reason', 'NO_TERMINAL_OR_SAVED_REACTION',
      'consumed', false,
      'rated', false,
      'notInterested', false,
      'saved', false,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  select max(saved_at) into last_saved_at
  from (
    select event.occurred_at as saved_at
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id = target_item_id
      and event.event_type = 'ITEM_SAVED'
      and event.occurred_at <= decision_time
    union all
    select coalesce(evidence.source_occurred_at, evidence.imported_at)
    from private.profile_bootstrap_evidence as evidence
    where evidence.profile_id = target_profile_id
      and evidence.item_id = target_item_id
      and evidence.active
      and evidence.evidence_kind = 'SAVED'
      and evidence.imported_at <= decision_time
  ) as saves;

  select
    max(impression.occurred_at),
    count(*) filter (where impression.occurred_at > decision_time - interval '90 days')::integer
    into last_reminder_at, reminder_count_90d
  from public.events as impression
  join private.prediction_candidates as candidate
    on candidate.prediction_id = impression.prediction_id
   and candidate.item_id = impression.item_id
  where impression.profile_id = target_profile_id
    and impression.item_id = target_item_id
    and impression.event_type = 'ITEM_IMPRESSION'
    and impression.occurred_at <= decision_time
    and candidate.explanation #>> '{resurfacingPolicy,classification}' = 'SAVED_REMINDER';

  saved_age_days := case
    when last_saved_at is null then null
    else greatest(0.0, extract(epoch from (decision_time - last_saved_at)) / 86400.0)
  end;

  if last_saved_at is null then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'UNKNOWN_SAVE_AGE',
      'saved', true,
      'savedAt', null,
      'savedAgeDays', null,
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if saved_age_days < (config ->> 'minimumSavedAgeDays')::double precision then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'MINIMUM_SAVED_AGE',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if last_reminder_at is not null
     and last_reminder_at > decision_time
       - make_interval(days => (config ->> 'reminderCooldownDays')::integer) then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'REMINDER_COOLDOWN',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if reminder_count_90d >= (config ->> 'maxReminderImpressionsPerWindow')::integer then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'REMINDER_FREQUENCY_CAP',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  return jsonb_build_object(
    'version', config ->> 'version',
    'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
    'classification', 'SAVED_REMINDER_ELIGIBLE',
    'eligible', true,
    'reason', 'AGED_SAVED_ONLY',
    'saved', true,
    'savedAt', last_saved_at,
    'savedAgeDays', round(saved_age_days::numeric, 3),
    'lastReminderAt', last_reminder_at,
    'reminderImpressions90d', reminder_count_90d,
    'bootstrapEvidenceKind', bootstrap_kind
  ) || config;
end;
$$;

revoke all on function private.resurfacing_policy_decision_v1(uuid, uuid, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
