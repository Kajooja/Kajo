-- Sprint 014B / #185
-- Real-catalog cold-start profiling for sparse PersonalProfiles.
--
-- The cold-start prior is a non-personal catalog prior. Provider trend/popularity
-- wins when available; provider recognition is next; the bounded curated beta
-- seed receives only an explicit recognition fallback. This is not
-- PopulationMemory and does not read another Profile's raw history.

alter table private.profile_import_jobs
  drop constraint if exists profile_import_jobs_provider_valid;
alter table private.profile_import_jobs
  add constraint profile_import_jobs_provider_valid check (
    source_provider in (
      'LETTERBOXD', 'IMDB', 'STORYGRAPH', 'GOODREADS', 'KAJO_CSV',
      'KAJO_CALIBRATION'
    )
  );

alter table private.profile_bootstrap_evidence
  drop constraint if exists profile_bootstrap_evidence_provider_valid;
alter table private.profile_bootstrap_evidence
  add constraint profile_bootstrap_evidence_provider_valid check (
    source_provider in (
      'LETTERBOXD', 'IMDB', 'STORYGRAPH', 'GOODREADS', 'KAJO_CSV',
      'KAJO_CALIBRATION'
    )
  );

-- The first real seed predates provider popularity ingestion. Give it a bounded
-- recognition-only prior so calibration begins from familiar titles without
-- pretending that these values represent live trend data.
update public.items as item
set metadata = item.metadata || jsonb_build_object(
  'coldStartRecognition', case source.provider_item_id
    when 'inception-2010' then 0.99
    when 'matrix-1999' then 0.98
    when 'dark-knight-2008' then 0.97
    when 'interstellar-2014' then 0.96
    when 'lotr-fellowship-2001' then 0.95
    when 'lotr-return-king-2003' then 0.95
    when 'pulp-fiction-1994' then 0.94
    when 'fight-club-1999' then 0.93
    when 'shawshank-1994' then 0.93
    when 'forrest-gump-1994' then 0.92
    when 'gladiator-2000' then 0.91
    when 'parasite-2019' then 0.90
    when 'dune-part-two-2024' then 0.90
    when 'dune-2021' then 0.89
    when 'oppenheimer-2023' then 0.89
    when 'arrival-2016' then 0.86
    when 'blade-runner-2049-2017' then 0.86
    when '1984-1949' then 0.99
    when 'animal-farm-1945' then 0.96
    when 'pride-prejudice-1813' then 0.95
    when 'hobbit-1937' then 0.95
    when 'lotr-fellowship-1954' then 0.94
    when 'great-gatsby-1925' then 0.93
    when 'mockingbird-1960' then 0.92
    when 'brave-new-world-1932' then 0.91
    when 'fahrenheit-451-1953' then 0.90
    when 'dune-book-1965' then 0.90
    when 'handmaids-tale-1985' then 0.88
    when 'neuromancer-1984' then 0.84
    else 0.62
  end,
  'coldStartPriorSource', 'KAJO_CURATED_RECOGNITION',
  'coldStartPriorVersion', 'cold-start-prior-v1'
)
from private.item_sources as source
where source.item_id = item.id
  and source.provider_key = 'kajo_curated';

create or replace function private.catalog_cold_start_prior_v1(
  target_item_id uuid,
  decision_time timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item_metadata jsonb;
  item_release_year integer;
  explicit_trend double precision;
  provider_popularity double precision;
  explicit_recognition double precision;
  provider_vote_count double precision;
  trend_score double precision := 0.0;
  recognition_score double precision := 0.0;
  freshness_score double precision := 0.0;
  final_score double precision := 0.0;
  prior_source text := 'CATALOG_NEUTRAL';
  current_year integer := extract(year from decision_time)::integer;
begin
  select item.metadata, item.release_year
  into item_metadata, item_release_year
  from public.items as item
  where item.id = target_item_id;

  if item_metadata is null then
    return jsonb_build_object(
      'version', 'cold-start-prior-v1',
      'score', 0.0,
      'trend', 0.0,
      'recognition', 0.0,
      'freshness', 0.0,
      'source', 'CATALOG_NEUTRAL'
    );
  end if;

  if coalesce(item_metadata ->> 'coldStartTrend', '') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
    explicit_trend := (item_metadata ->> 'coldStartTrend')::double precision;
    trend_score := least(1.0, greatest(0.0, explicit_trend));
    prior_source := 'PROVIDER_TREND';
  elsif coalesce(item_metadata ->> 'popularity', '') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
    provider_popularity := (item_metadata ->> 'popularity')::double precision;
    trend_score := least(1.0, greatest(0.0, provider_popularity / (provider_popularity + 100.0)));
    prior_source := 'PROVIDER_POPULARITY';
  end if;

  if coalesce(item_metadata ->> 'coldStartRecognition', '') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
    explicit_recognition := (item_metadata ->> 'coldStartRecognition')::double precision;
    recognition_score := least(1.0, greatest(0.0, explicit_recognition));
    if prior_source = 'CATALOG_NEUTRAL' then
      prior_source := coalesce(
        nullif(item_metadata ->> 'coldStartPriorSource', ''),
        'CATALOG_RECOGNITION'
      );
    end if;
  elsif coalesce(item_metadata ->> 'voteCount', '') ~ '^[0-9]+$' then
    provider_vote_count := (item_metadata ->> 'voteCount')::double precision;
    recognition_score := least(1.0, greatest(0.0, provider_vote_count / (provider_vote_count + 1000.0)));
    if prior_source = 'CATALOG_NEUTRAL' then
      prior_source := 'PROVIDER_RECOGNITION';
    end if;
  end if;

  if item_release_year is not null then
    freshness_score := least(
      1.0,
      greatest(0.0, 1.0 - greatest(0, current_year - item_release_year)::double precision / 12.0)
    );
  end if;

  if trend_score > 0.0 then
    final_score := trend_score * 0.55 + recognition_score * 0.40 + freshness_score * 0.05;
  else
    final_score := recognition_score * 0.85 + freshness_score * 0.15;
  end if;

  return jsonb_build_object(
    'version', 'cold-start-prior-v1',
    'score', round(final_score::numeric, 6),
    'trend', round(trend_score::numeric, 6),
    'recognition', round(recognition_score::numeric, 6),
    'freshness', round(freshness_score::numeric, 6),
    'source', prior_source
  );
end;
$$;

create or replace function private.get_profile_bootstrap_status_v1(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  strong_evidence_count integer;
  imported_strong_count integer;
  calibration_rating_count integer;
  native_strong_count integer;
  real_movie_count integer;
  real_book_count integer;
begin
  perform private.assert_personal_profile_owner_v1(target_profile_id);

  select count(distinct evidence.item_id)::integer
  into imported_strong_count
  from private.profile_bootstrap_evidence as evidence
  where evidence.profile_id = target_profile_id
    and evidence.active
    and evidence.source_provider <> 'KAJO_CALIBRATION'
    and evidence.evidence_kind in ('RATED', 'CONSUMED');

  select count(distinct evidence.item_id)::integer
  into calibration_rating_count
  from private.profile_bootstrap_evidence as evidence
  where evidence.profile_id = target_profile_id
    and evidence.active
    and evidence.source_provider = 'KAJO_CALIBRATION'
    and evidence.evidence_kind = 'RATED';

  select count(distinct event.item_id)::integer
  into native_strong_count
  from public.events as event
  where event.profile_id = target_profile_id
    and event.item_id is not null
    and event.event_type in (
      'ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED',
      'ITEM_ADDED_TO_LIST', 'ITEM_SAVED'
    );

  select count(*)::integer
  into strong_evidence_count
  from (
    select evidence.item_id
    from private.profile_bootstrap_evidence as evidence
    where evidence.profile_id = target_profile_id
      and evidence.active
      and evidence.evidence_kind in ('RATED', 'CONSUMED')
    union
    select event.item_id
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id is not null
      and event.event_type in (
        'ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED',
        'ITEM_ADDED_TO_LIST', 'ITEM_SAVED'
      )
  ) as strong_item;

  select
    count(distinct item.id) filter (where item.item_type = 'MOVIE')::integer,
    count(distinct item.id) filter (where item.item_type = 'BOOK')::integer
  into real_movie_count, real_book_count
  from public.items as item
  where item.discoverable
    and exists (
      select 1
      from private.item_sources as source
      where source.item_id = item.id
        and source.provider_key <> 'kajo_mock'
    );

  return jsonb_build_object(
    'profileId', target_profile_id,
    'minimumStrongEvidence', 6,
    'initialCandidateCount', 12,
    'maximumCandidateCount', 24,
    'strongEvidenceCount', coalesce(strong_evidence_count, 0),
    'importedStrongCount', coalesce(imported_strong_count, 0),
    'calibrationRatingCount', coalesce(calibration_rating_count, 0),
    'nativeStrongCount', coalesce(native_strong_count, 0),
    'needsCalibration', coalesce(strong_evidence_count, 0) < 6,
    'realMovieCount', coalesce(real_movie_count, 0),
    'realBookCount', coalesce(real_book_count, 0),
    'calibrationAvailable',
      coalesce(real_movie_count, 0) >= 4
      and coalesce(real_book_count, 0) >= 4
      and coalesce(real_movie_count, 0) + coalesce(real_book_count, 0) >= 12,
    'priorVersion', 'cold-start-prior-v1',
    'version', 'cold-start-v1'
  );
end;
$$;

create or replace function public.get_profile_bootstrap_status_v1(target_profile_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_bootstrap_status_v1(target_profile_id);
$$;

create or replace function private.get_profile_calibration_candidates_v1(
  target_profile_id uuid,
  input_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bounded_limit integer := greatest(6, least(coalesce(input_limit, 12), 24));
  per_domain_limit integer := ceil(greatest(6, least(coalesce(input_limit, 12), 24)) / 2.0)::integer;
begin
  perform private.assert_personal_profile_owner_v1(target_profile_id);

  return coalesce((
    with eligible as (
      select
        item.id,
        item.item_type,
        item.title,
        item.description,
        item.tags,
        item.creators,
        item.release_year,
        item.image_url,
        item.original_language,
        prior.value as cold_start_prior,
        coalesce((prior.value ->> 'score')::double precision, 0.0) as prior_score
      from public.items as item
      cross join lateral (
        select private.catalog_cold_start_prior_v1(item.id, now()) as value
      ) as prior
      where item.discoverable
        and item.item_type in ('BOOK', 'MOVIE')
        and exists (
          select 1
          from private.item_sources as source
          where source.item_id = item.id
            and source.provider_key <> 'kajo_mock'
        )
        and not exists (
          select 1
          from private.profile_bootstrap_evidence as evidence
          where evidence.profile_id = target_profile_id
            and evidence.item_id = item.id
            and evidence.active
            and evidence.evidence_kind in ('RATED', 'CONSUMED')
        )
        and not exists (
          select 1
          from public.events as event
          where event.profile_id = target_profile_id
            and event.item_id = item.id
            and event.event_type in ('ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED')
        )
    ), domain_ranked as (
      select
        eligible.*,
        row_number() over (
          partition by eligible.item_type
          order by eligible.prior_score desc, eligible.id
        )::integer as domain_rank
      from eligible
    ), balanced as (
      select *
      from domain_ranked
      where domain_rank <= per_domain_limit
    ), ordered as (
      select
        balanced.*,
        row_number() over (
          order by
            balanced.domain_rank,
            case balanced.item_type when 'MOVIE' then 0 else 1 end,
            balanced.prior_score desc,
            balanced.id
        )::integer as calibration_rank
      from balanced
    )
    select jsonb_agg(
      jsonb_build_object(
        'itemId', candidate.id,
        'itemType', candidate.item_type,
        'title', candidate.title,
        'description', candidate.description,
        'tags', candidate.tags,
        'creators', candidate.creators,
        'releaseYear', candidate.release_year,
        'imageUrl', candidate.image_url,
        'originalLanguage', candidate.original_language,
        'priorScore', round(candidate.prior_score::numeric, 6),
        'coldStartPrior', candidate.cold_start_prior,
        'calibrationRank', candidate.calibration_rank
      )
      order by candidate.calibration_rank
    )
    from ordered as candidate
    where candidate.calibration_rank <= bounded_limit
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_profile_calibration_candidates_v1(
  target_profile_id uuid,
  input_limit integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_calibration_candidates_v1(target_profile_id, input_limit);
$$;

create or replace function private.commit_profile_calibration_v1(
  target_profile_id uuid,
  input_responses jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  response_count integer;
  response jsonb;
  response_item_id uuid;
  response_rating integer;
  response_item_ids uuid[] := '{}'::uuid[];
  calibration_job_id uuid;
  calibration_fingerprint text := 'calibration:v1:' || replace(target_profile_id::text, '-', '');
begin
  actor_id := private.assert_personal_profile_owner_v1(target_profile_id);

  if input_responses is null or jsonb_typeof(input_responses) <> 'array' then
    raise exception 'Calibration responses must be a JSON array' using errcode = '22023';
  end if;

  response_count := jsonb_array_length(input_responses);
  if response_count < 6 or response_count > 24 then
    raise exception 'Calibration requires between 6 and 24 ratings' using errcode = '22023';
  end if;

  for response in select value from jsonb_array_elements(input_responses)
  loop
    if jsonb_typeof(response) <> 'object'
       or coalesce(response ->> 'itemId', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(response ->> 'rating', '') !~ '^([0-9]|10)$' then
      raise exception 'Invalid calibration response' using errcode = '22023';
    end if;

    response_item_id := (response ->> 'itemId')::uuid;
    response_rating := (response ->> 'rating')::integer;

    if response_item_id = any(response_item_ids) then
      raise exception 'Calibration contains duplicate Items' using errcode = '22023';
    end if;
    response_item_ids := array_append(response_item_ids, response_item_id);

    if not exists (
      select 1
      from public.items as item
      where item.id = response_item_id
        and item.discoverable
        and item.item_type in ('BOOK', 'MOVIE')
        and exists (
          select 1
          from private.item_sources as source
          where source.item_id = item.id
            and source.provider_key <> 'kajo_mock'
        )
    ) then
      raise exception 'Calibration Item is not an eligible real catalog Item'
        using errcode = '22023';
    end if;
  end loop;

  insert into private.profile_import_jobs (
    actor_user_id,
    profile_id,
    source_provider,
    dataset_kind,
    file_name,
    file_fingerprint,
    status,
    total_rows,
    matched_rows,
    ambiguous_rows,
    unmatched_rows,
    skipped_rows,
    committed_at
  ) values (
    actor_id,
    target_profile_id,
    'KAJO_CALIBRATION',
    'COLD_START_V1',
    null,
    calibration_fingerprint,
    'COMMITTED',
    response_count,
    response_count,
    0,
    0,
    0,
    now()
  )
  on conflict (profile_id, source_provider, dataset_kind, file_fingerprint)
  do update set
    actor_user_id = excluded.actor_user_id,
    status = 'COMMITTED',
    total_rows = excluded.total_rows,
    matched_rows = excluded.matched_rows,
    ambiguous_rows = 0,
    unmatched_rows = 0,
    skipped_rows = 0,
    committed_at = excluded.committed_at,
    updated_at = now()
  returning id into calibration_job_id;

  update private.profile_bootstrap_evidence as evidence
  set active = false, imported_at = now()
  where evidence.profile_id = target_profile_id
    and evidence.source_provider = 'KAJO_CALIBRATION'
    and evidence.dataset_kind = 'COLD_START_V1'
    and evidence.active;

  for response in select value from jsonb_array_elements(input_responses)
  loop
    response_item_id := (response ->> 'itemId')::uuid;
    response_rating := (response ->> 'rating')::integer;

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
      target_profile_id,
      item.id,
      item.item_type,
      'KAJO_CALIBRATION',
      'COLD_START_V1',
      calibration_job_id,
      item.id::text,
      'RATED',
      response_rating,
      now(),
      now(),
      true,
      jsonb_build_object(
        'source', 'IN_APP_CALIBRATION',
        'version', 'cold-start-v1',
        'priorVersion', 'cold-start-prior-v1'
      )
    from public.items as item
    where item.id = response_item_id
    on conflict (profile_id, source_provider, dataset_kind, item_id)
    do update set
      actor_user_id = excluded.actor_user_id,
      source_job_id = excluded.source_job_id,
      source_row_key = excluded.source_row_key,
      evidence_kind = 'RATED',
      rating = excluded.rating,
      source_occurred_at = excluded.source_occurred_at,
      imported_at = excluded.imported_at,
      active = true,
      source_metadata = excluded.source_metadata;
  end loop;

  return jsonb_build_object(
    'profileId', target_profile_id,
    'ratingCount', response_count,
    'status', 'COMMITTED',
    'priorVersion', 'cold-start-prior-v1',
    'version', 'cold-start-v1'
  );
end;
$$;

create or replace function public.commit_profile_calibration_v1(
  target_profile_id uuid,
  input_responses jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.commit_profile_calibration_v1(target_profile_id, input_responses);
$$;

-- Calibration is bootstrap state, not a user-imported file. Keep the existing
-- Settings import-history surface focused on user-selected files.
create or replace function private.list_profile_import_jobs_v1(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_personal_profile_owner_v1(target_profile_id);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
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
        'rows', '[]'::jsonb
      )
      order by coalesce(job.committed_at, job.updated_at) desc, job.id
    )
    from private.profile_import_jobs as job
    where job.profile_id = target_profile_id
      and job.status <> 'REMOVED'
      and job.source_provider <> 'KAJO_CALIBRATION'
  ), '[]'::jsonb);
end;
$$;

revoke all on function private.catalog_cold_start_prior_v1(uuid, timestamptz) from public, anon, authenticated;

revoke all on function private.get_profile_bootstrap_status_v1(uuid) from public, anon, authenticated;
grant execute on function private.get_profile_bootstrap_status_v1(uuid) to authenticated;
revoke all on function public.get_profile_bootstrap_status_v1(uuid) from public, anon;
grant execute on function public.get_profile_bootstrap_status_v1(uuid) to authenticated;

revoke all on function private.get_profile_calibration_candidates_v1(uuid, integer) from public, anon, authenticated;
grant execute on function private.get_profile_calibration_candidates_v1(uuid, integer) to authenticated;
revoke all on function public.get_profile_calibration_candidates_v1(uuid, integer) from public, anon;
grant execute on function public.get_profile_calibration_candidates_v1(uuid, integer) to authenticated;

revoke all on function private.commit_profile_calibration_v1(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.commit_profile_calibration_v1(uuid, jsonb) to authenticated;
revoke all on function public.commit_profile_calibration_v1(uuid, jsonb) from public, anon;
grant execute on function public.commit_profile_calibration_v1(uuid, jsonb) to authenticated;
