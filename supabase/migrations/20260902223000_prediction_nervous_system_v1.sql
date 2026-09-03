create table private.prediction_runs (
  id uuid primary key,
  actor_user_id uuid not null
    references public.users (id) on delete cascade,
  profile_id uuid not null
    references public.profiles (id) on delete cascade,
  session_id uuid,
  requested_at timestamptz not null,
  requested_item_type text,
  discovery_mode text not null,
  model_version text not null,
  base_model_version text not null,
  policy_version text not null,
  experiment_key text,
  context jsonb not null default '{}'::jsonb,
  state_snapshot jsonb not null default '{}'::jsonb,
  candidate_count integer not null default 0,
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint prediction_runs_item_type_valid
    check (requested_item_type is null or requested_item_type in ('BOOK', 'MOVIE')),
  constraint prediction_runs_discovery_mode_valid
    check (discovery_mode in ('FOR_YOU', 'SURPRISE', 'RISK')),
  constraint prediction_runs_model_version_not_blank
    check (btrim(model_version) <> ''),
  constraint prediction_runs_base_model_version_not_blank
    check (btrim(base_model_version) <> ''),
  constraint prediction_runs_policy_version_not_blank
    check (btrim(policy_version) <> ''),
  constraint prediction_runs_context_is_object
    check (jsonb_typeof(context) = 'object'),
  constraint prediction_runs_state_snapshot_is_object
    check (jsonb_typeof(state_snapshot) = 'object'),
  constraint prediction_runs_counts_non_negative
    check (candidate_count >= 0 and result_count >= 0 and result_count <= candidate_count)
);

create index prediction_runs_profile_requested_at_idx
  on private.prediction_runs (profile_id, requested_at desc, id);

create index prediction_runs_actor_requested_at_idx
  on private.prediction_runs (actor_user_id, requested_at desc, id);

create index prediction_runs_session_requested_at_idx
  on private.prediction_runs (session_id, requested_at, id)
  where session_id is not null;

create table private.prediction_candidates (
  prediction_id uuid not null
    references private.prediction_runs (id) on delete cascade,
  item_id uuid not null
    references public.items (id) on delete restrict,
  source_rank integer not null,
  final_rank integer not null,
  source_score double precision not null,
  final_score double precision not null,
  confidence double precision not null,
  scenario_score double precision not null default 0.0,
  scenario_support integer not null default 0,
  scenario_max_similarity double precision not null default 0.0,
  selected_for_delivery boolean not null,
  selection_probability double precision,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (prediction_id, item_id),
  constraint prediction_candidates_source_rank_positive check (source_rank > 0),
  constraint prediction_candidates_final_rank_positive check (final_rank > 0),
  constraint prediction_candidates_confidence_valid
    check (confidence between 0.0 and 1.0),
  constraint prediction_candidates_scenario_support_non_negative
    check (scenario_support >= 0),
  constraint prediction_candidates_scenario_similarity_valid
    check (scenario_max_similarity between 0.0 and 1.0),
  constraint prediction_candidates_selection_probability_valid
    check (selection_probability is null or selection_probability between 0.0 and 1.0),
  constraint prediction_candidates_explanation_is_object
    check (jsonb_typeof(explanation) = 'object'),
  unique (prediction_id, source_rank),
  unique (prediction_id, final_rank)
);

alter table private.prediction_runs enable row level security;
alter table private.prediction_candidates enable row level security;

create index prediction_candidates_item_prediction_idx
  on private.prediction_candidates (item_id, prediction_id);

create index prediction_candidates_selected_prediction_idx
  on private.prediction_candidates (prediction_id, final_rank)
  where selected_for_delivery;

create index events_profile_prediction_outcome_idx
  on public.events (profile_id, prediction_id, item_id, occurred_at desc)
  where prediction_id is not null
    and item_id is not null
    and event_type in (
      'ITEM_RATED',
      'ITEM_CONSUMPTION_REVERSED',
      'ITEM_NOT_INTERESTED',
      'ITEM_CONSUMED',
      'ITEM_ADDED_TO_LIST',
      'ITEM_ENDORSED',
      'ITEM_LIKED',
      'ITEM_SAVED',
      'ITEM_UNSAVED'
    );

revoke all on table private.prediction_runs from public, anon, authenticated;
revoke all on table private.prediction_candidates from public, anon, authenticated;

create or replace function private.event_evidence_weight_v1(
  source_event_type text,
  source_properties jsonb
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case source_event_type
    when 'ITEM_RATED' then
      case
        when source_properties ->> 'rating' ~ '^(10|[0-9])$'
          then (((source_properties ->> 'rating')::double precision - 5.0) * 1.2)
        else 0.0
      end
    when 'ITEM_NOT_INTERESTED' then -5.5
    when 'ITEM_LIKED' then 3.0
    when 'ITEM_DISLIKED' then -4.0
    when 'ITEM_INTEREST_CLEARED' then -1.0
    when 'ITEM_SAVED' then 2.0
    when 'ITEM_UNSAVED' then -1.5
    when 'ITEM_OPENED' then 0.35
    when 'ITEM_CONSUMED' then 0.75
    when 'ITEM_CONSUMPTION_REVERSED' then -0.5
    else 0.0
  end;
$$;

create or replace function private.outcome_priority_v1(source_event_type text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case source_event_type
    when 'ITEM_RATED' then 100
    when 'ITEM_CONSUMPTION_REVERSED' then 95
    when 'ITEM_NOT_INTERESTED' then 90
    when 'ITEM_CONSUMED' then 80
    when 'ITEM_ADDED_TO_LIST' then 70
    when 'ITEM_ENDORSED' then 65
    when 'ITEM_LIKED' then 60
    when 'ITEM_SAVED' then 55
    when 'ITEM_UNSAVED' then 50
    else 0
  end;
$$;

create or replace function private.outcome_reward_v1(
  source_event_type text,
  source_properties jsonb
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case source_event_type
    when 'ITEM_RATED' then
      case
        when source_properties ->> 'rating' ~ '^(10|[0-9])$'
          then greatest(
            -1.0,
            least(1.0, ((source_properties ->> 'rating')::double precision - 5.0) / 5.0)
          )
        else 0.0
      end
    when 'ITEM_CONSUMPTION_REVERSED' then -0.6
    when 'ITEM_NOT_INTERESTED' then -1.0
    when 'ITEM_CONSUMED' then 0.4
    when 'ITEM_ADDED_TO_LIST' then 0.65
    when 'ITEM_ENDORSED' then 0.6
    when 'ITEM_LIKED' then 0.6
    when 'ITEM_SAVED' then 0.5
    when 'ITEM_UNSAVED' then -0.35
    else 0.0
  end;
$$;

create or replace function private.jsonb_string_array(
  source jsonb,
  source_key text
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(value order by value), '{}'::text[])
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(source -> source_key) = 'array' then source -> source_key
      else '[]'::jsonb
    end
  ) as element(value);
$$;

create or replace function private.text_array_jaccard(
  left_values text[],
  right_values text[]
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  with left_set as (
    select distinct value
    from unnest(coalesce(left_values, '{}'::text[])) as entry(value)
  ),
  right_set as (
    select distinct value
    from unnest(coalesce(right_values, '{}'::text[])) as entry(value)
  ),
  intersection_size as (
    select count(*)::double precision as value
    from left_set
    join right_set using (value)
  ),
  union_size as (
    select count(*)::double precision as value
    from (
      select value from left_set
      union
      select value from right_set
    ) as combined
  )
  select case
    when union_size.value = 0.0 then 0.0
    else intersection_size.value / union_size.value
  end
  from intersection_size
  cross join union_size;
$$;

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
  weighted_events as (
    select
      event.item_id,
      event.occurred_at,
      private.event_evidence_weight_v1(event.event_type, event.properties) as event_weight
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id is not null
      and event.occurred_at <= state_as_of
      and private.event_evidence_weight_v1(event.event_type, event.properties) <> 0.0
      and not exists (
        select 1
        from reversed_events
        where reversed_events.event_id = event.id
      )
  ),
  tag_scores as (
    select
      tag,
      sum(
        weighted_events.event_weight
        * exp(
            -greatest(
              0.0,
              extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0
            ) / 180.0
          )
      ) as long_term_score,
      sum(
        case
          when weighted_events.occurred_at >= state_as_of - interval '14 days'
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
    join public.items as evidence_item
      on evidence_item.id = weighted_events.item_id
    cross join lateral unnest(evidence_item.tags) as tag
    group by tag
  ),
  evidence_summary as (
    select
      count(*)::integer as evidence_count,
      max(occurred_at) as last_evidence_at
    from weighted_events
  )
  select jsonb_build_object(
    'version', 'memory-state-v1',
    'asOf', state_as_of,
    'evidenceCount', evidence_summary.evidence_count,
    'lastEvidenceAt', evidence_summary.last_evidence_at,
    'longTermPositiveTags', coalesce((
      select jsonb_agg(tag order by long_term_score desc, tag)
      from (
        select tag, long_term_score
        from tag_scores
        where long_term_score > 0.0
        order by long_term_score desc, tag
        limit 12
      ) as selected
    ), '[]'::jsonb),
    'longTermNegativeTags', coalesce((
      select jsonb_agg(tag order by long_term_score, tag)
      from (
        select tag, long_term_score
        from tag_scores
        where long_term_score < 0.0
        order by long_term_score, tag
        limit 12
      ) as selected
    ), '[]'::jsonb),
    'shortTermPositiveTags', coalesce((
      select jsonb_agg(tag order by short_term_score desc, tag)
      from (
        select tag, short_term_score
        from tag_scores
        where short_term_score > 0.0
        order by short_term_score desc, tag
        limit 12
      ) as selected
    ), '[]'::jsonb),
    'shortTermNegativeTags', coalesce((
      select jsonb_agg(tag order by short_term_score, tag)
      from (
        select tag, short_term_score
        from tag_scores
        where short_term_score < 0.0
        order by short_term_score, tag
        limit 12
      ) as selected
    ), '[]'::jsonb)
  )
  from evidence_summary;
$$;

create or replace function private.sanitize_prediction_context_v1(
  source_context jsonb,
  request_time timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  source_attributes jsonb := case
    when jsonb_typeof(source_context -> 'attributes') = 'object'
      then source_context -> 'attributes'
    else '{}'::jsonb
  end;
  local_hour integer;
  day_of_week integer;
  surface text;
begin
  if source_attributes ->> 'localHour' ~ '^([0-9]|1[0-9]|2[0-3])$' then
    local_hour := (source_attributes ->> 'localHour')::integer;
  end if;

  if source_attributes ->> 'dayOfWeek' ~ '^[0-6]$' then
    day_of_week := (source_attributes ->> 'dayOfWeek')::integer;
  end if;

  surface := case source_attributes ->> 'surface'
    when 'DISCOVERY_GRID' then 'DISCOVERY_GRID'
    when 'ITEM_SEQUENCE' then 'ITEM_SEQUENCE'
    else 'DISCOVERY'
  end;

  return jsonb_strip_nulls(jsonb_build_object(
    'version', 'prediction-context-v1',
    'requestedAt', request_time,
    'locale', left(nullif(source_context ->> 'locale', ''), 32),
    'timezone', left(nullif(source_context ->> 'timezone', ''), 64),
    'attributes', jsonb_strip_nulls(jsonb_build_object(
      'localHour', local_hour,
      'dayOfWeek', day_of_week,
      'surface', surface
    ))
  ));
end;
$$;

create or replace function private.scenario_similarity_v1(
  current_state jsonb,
  historical_state jsonb,
  current_context jsonb,
  historical_context jsonb,
  current_mode text,
  historical_mode text,
  current_item_type text,
  historical_item_type text,
  current_tags text[],
  historical_tags text[]
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  current_evidence_count integer := case
    when current_state ->> 'evidenceCount' ~ '^\d+$'
      then (current_state ->> 'evidenceCount')::integer
    else 0
  end;
  historical_evidence_count integer := case
    when historical_state ->> 'evidenceCount' ~ '^\d+$'
      then (historical_state ->> 'evidenceCount')::integer
    else 0
  end;
  state_similarity double precision;
  item_similarity double precision;
  mode_similarity double precision;
  context_similarity double precision := 0.5;
  type_multiplier double precision := 1.0;
  current_hour integer;
  historical_hour integer;
  current_day integer;
  historical_day integer;
  hour_distance integer;
begin
  if current_evidence_count = 0 and historical_evidence_count = 0 then
    state_similarity := 0.5;
  else
    state_similarity := (
      private.text_array_jaccard(
        private.jsonb_string_array(current_state, 'longTermPositiveTags'),
        private.jsonb_string_array(historical_state, 'longTermPositiveTags')
      )
      + private.text_array_jaccard(
        private.jsonb_string_array(current_state, 'longTermNegativeTags'),
        private.jsonb_string_array(historical_state, 'longTermNegativeTags')
      )
      + private.text_array_jaccard(
        private.jsonb_string_array(current_state, 'shortTermPositiveTags'),
        private.jsonb_string_array(historical_state, 'shortTermPositiveTags')
      )
      + private.text_array_jaccard(
        private.jsonb_string_array(current_state, 'shortTermNegativeTags'),
        private.jsonb_string_array(historical_state, 'shortTermNegativeTags')
      )
    ) / 4.0;
  end if;

  item_similarity := private.text_array_jaccard(current_tags, historical_tags);

  mode_similarity := case
    when current_mode = historical_mode then 1.0
    when (current_mode = 'FOR_YOU' and historical_mode = 'RISK')
      or (current_mode = 'RISK' and historical_mode = 'FOR_YOU') then 0.5
    else 0.75
  end;

  if current_context #>> '{attributes,localHour}' ~ '^([0-9]|1[0-9]|2[0-3])$'
     and historical_context #>> '{attributes,localHour}' ~ '^([0-9]|1[0-9]|2[0-3])$' then
    current_hour := (current_context #>> '{attributes,localHour}')::integer;
    historical_hour := (historical_context #>> '{attributes,localHour}')::integer;
    hour_distance := least(
      abs(current_hour - historical_hour),
      24 - abs(current_hour - historical_hour)
    );
    context_similarity := case
      when hour_distance <= 2 then 1.0
      when hour_distance <= 5 then 0.8
      else 0.5
    end;
  end if;

  if current_context #>> '{attributes,dayOfWeek}' ~ '^[0-6]$'
     and historical_context #>> '{attributes,dayOfWeek}' ~ '^[0-6]$' then
    current_day := (current_context #>> '{attributes,dayOfWeek}')::integer;
    historical_day := (historical_context #>> '{attributes,dayOfWeek}')::integer;
    context_similarity := (context_similarity + case
      when (current_day in (0, 6)) = (historical_day in (0, 6)) then 1.0
      else 0.7
    end) / 2.0;
  end if;

  if current_item_type <> historical_item_type then
    type_multiplier := 0.85;
  end if;

  return greatest(
    0.0,
    least(
      1.0,
      type_multiplier * (
        state_similarity * 0.4
        + item_similarity * 0.35
        + mode_similarity * 0.15
        + context_similarity * 0.1
      )
    )
  );
end;
$$;

revoke all on function private.event_evidence_weight_v1(text, jsonb)
  from public, anon, authenticated;
revoke all on function private.outcome_priority_v1(text)
  from public, anon, authenticated;
revoke all on function private.outcome_reward_v1(text, jsonb)
  from public, anon, authenticated;
revoke all on function private.jsonb_string_array(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.text_array_jaccard(text[], text[])
  from public, anon, authenticated;
revoke all on function private.build_profile_memory_state_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.sanitize_prediction_context_v1(jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function private.scenario_similarity_v1(
  jsonb, jsonb, jsonb, jsonb, text, text, text, text, text[], text[]
) from public, anon, authenticated;

create or replace function private.rank_items_v1_internal(
  target_profile_id uuid,
  requested_mode text,
  requested_item_type text default null,
  result_limit integer default 20,
  request_context jsonb default '{}'::jsonb
)
returns table (
  prediction_id uuid,
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  score double precision,
  confidence double precision,
  rank integer,
  explanation jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_actor_user_id uuid := (select auth.uid());
  current_prediction_id uuid := gen_random_uuid();
  request_time timestamptz := clock_timestamp();
  current_context jsonb;
  current_state jsonb;
  requested_session_id uuid;
  candidate_pool_limit integer;
begin
  if current_actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  if requested_mode is null
     or requested_mode not in ('FOR_YOU', 'SURPRISE', 'RISK') then
    raise exception 'Unsupported discovery mode' using errcode = '22023';
  end if;

  if requested_item_type is not null
     and requested_item_type not in ('BOOK', 'MOVIE') then
    raise exception 'Unsupported item type' using errcode = '22023';
  end if;

  if result_limit < 1 or result_limit > 50 then
    raise exception 'Result limit must be between 1 and 50'
      using errcode = '22023';
  end if;

  if request_context is null or jsonb_typeof(request_context) <> 'object' then
    raise exception 'Request context must be a JSON object'
      using errcode = '22023';
  end if;

  if request_context ->> 'sessionId' ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    requested_session_id := (request_context ->> 'sessionId')::uuid;
  end if;

  candidate_pool_limit := least(50, greatest(result_limit, result_limit * 3));
  current_context := private.sanitize_prediction_context_v1(request_context, request_time);
  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);

  insert into private.prediction_runs (
    id,
    actor_user_id,
    profile_id,
    session_id,
    requested_at,
    requested_item_type,
    discovery_mode,
    model_version,
    base_model_version,
    policy_version,
    context,
    state_snapshot
  ) values (
    current_prediction_id,
    current_actor_user_id,
    target_profile_id,
    requested_session_id,
    request_time,
    requested_item_type,
    requested_mode,
    'prediction-v1.0',
    'prediction-v0.3',
    'scenario-memory-v1',
    current_context,
    current_state
  );

  return query
  with base_ranking as materialized (
    select base.*
    from public.rank_items_v0(
      target_profile_id,
      requested_mode,
      requested_item_type,
      candidate_pool_limit,
      current_context
    ) as base
  ),
  reversed_events as (
    select (event.properties ->> 'reversedEventId')::uuid as event_id
    from public.events as event
    where event.profile_id = target_profile_id
      and event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.occurred_at <= request_time
      and event.properties ? 'reversedEventId'
      and (event.properties ->> 'reversedEventId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  prioritized_outcomes as (
    select
      event.prediction_id,
      event.item_id,
      event.event_type,
      event.properties,
      event.occurred_at,
      row_number() over (
        partition by event.prediction_id, event.item_id
        order by
          private.outcome_priority_v1(event.event_type) desc,
          event.occurred_at desc,
          event.id desc
      ) as outcome_rank
    from public.events as event
    join private.prediction_runs as historical_run
      on historical_run.id = event.prediction_id
     and historical_run.profile_id = target_profile_id
    join private.prediction_candidates as historical_candidate
      on historical_candidate.prediction_id = event.prediction_id
     and historical_candidate.item_id = event.item_id
     and historical_candidate.selected_for_delivery
    where event.profile_id = target_profile_id
      and event.item_id is not null
      and event.occurred_at >= historical_run.requested_at
      and event.occurred_at <= request_time
      and private.outcome_priority_v1(event.event_type) > 0
      and not exists (
        select 1
        from reversed_events
        where reversed_events.event_id = event.id
      )
  ),
  historical_outcomes as (
    select
      prioritized_outcomes.prediction_id,
      prioritized_outcomes.item_id,
      prioritized_outcomes.occurred_at,
      private.outcome_reward_v1(
        prioritized_outcomes.event_type,
        prioritized_outcomes.properties
      ) as reward,
      historical_run.discovery_mode,
      historical_run.requested_item_type,
      historical_run.context,
      historical_run.state_snapshot,
      historical_item.item_type,
      historical_item.tags
    from prioritized_outcomes
    join private.prediction_runs as historical_run
      on historical_run.id = prioritized_outcomes.prediction_id
    join public.items as historical_item
      on historical_item.id = prioritized_outcomes.item_id
    where prioritized_outcomes.outcome_rank = 1
  ),
  scenario_enriched as (
    select
      base_ranking.*,
      coalesce(scenario.raw_score, 0.0) as scenario_raw_score,
      coalesce(
        scenario.raw_score
          * least(1.0, 0.25 + scenario.support::double precision * 0.15),
        0.0
      ) as scenario_score,
      coalesce(scenario.support, 0)::integer as scenario_support,
      coalesce(scenario.max_similarity, 0.0) as scenario_max_similarity,
      coalesce(
        least(1.0, 0.25 + scenario.support::double precision * 0.15),
        0.0
      ) as scenario_confidence
    from base_ranking
    left join lateral (
      select
        sum(retrieved.reward * retrieved.retrieval_weight)
          / nullif(sum(retrieved.retrieval_weight), 0.0) as raw_score,
        count(*)::integer as support,
        max(retrieved.similarity) as max_similarity
      from (
        select
          historical_outcomes.reward,
          case
            when historical_outcomes.item_id = base_ranking.item_id
              then greatest(0.95, similarity.value)
            else similarity.value
          end as similarity,
          (
            case
              when historical_outcomes.item_id = base_ranking.item_id
                then greatest(0.95, similarity.value)
              else similarity.value
            end
          ) * exp(
            -greatest(
              0.0,
              extract(epoch from (request_time - historical_outcomes.occurred_at)) / 86400.0
            ) / 180.0
          ) as retrieval_weight
        from historical_outcomes
        cross join lateral (
          select private.scenario_similarity_v1(
            current_state,
            historical_outcomes.state_snapshot,
            current_context,
            historical_outcomes.context,
            requested_mode,
            historical_outcomes.discovery_mode,
            base_ranking.item_type,
            historical_outcomes.item_type,
            base_ranking.tags,
            historical_outcomes.tags
          ) as value
        ) as similarity
        where similarity.value >= 0.25
        order by similarity.value desc, historical_outcomes.occurred_at desc
        limit 30
      ) as retrieved
    ) as scenario on true
  ),
  rescored as (
    select
      scenario_enriched.*,
      scenario_enriched.score
        + scenario_enriched.scenario_score * case requested_mode
          when 'FOR_YOU' then 2.2
          when 'SURPRISE' then 1.6
          when 'RISK' then 1.0
        end as final_score,
      least(
        1.0,
        greatest(
          scenario_enriched.confidence,
          scenario_enriched.confidence
            + scenario_enriched.scenario_confidence * 0.2
        )
      ) as final_confidence
    from scenario_enriched
  ),
  reranked as (
    select
      rescored.*,
      row_number() over (
        order by rescored.final_score desc, rescored.item_id
      )::integer as final_rank,
      (
        rescored.explanation
        || jsonb_build_object(
          'version', 'prediction-v1.0',
          'baseVersion', 'prediction-v0.3',
          'policyVersion', 'scenario-memory-v1',
          'scenarioMemory', jsonb_build_object(
            'rawScore', round(rescored.scenario_raw_score::numeric, 4),
            'score', round(rescored.scenario_score::numeric, 4),
            'support', rescored.scenario_support,
            'maxSimilarity', round(rescored.scenario_max_similarity::numeric, 4),
            'retrievalScope', 'PROFILE',
            'maxEpisodes', 30
          )
        )
      ) as final_explanation
    from rescored
  ),
  candidate_write as (
    insert into private.prediction_candidates (
      prediction_id,
      item_id,
      source_rank,
      final_rank,
      source_score,
      final_score,
      confidence,
      scenario_score,
      scenario_support,
      scenario_max_similarity,
      selected_for_delivery,
      selection_probability,
      explanation
    )
    select
      current_prediction_id,
      reranked.item_id,
      reranked.rank,
      reranked.final_rank,
      reranked.score,
      reranked.final_score,
      reranked.final_confidence,
      reranked.scenario_score,
      reranked.scenario_support,
      reranked.scenario_max_similarity,
      reranked.final_rank <= result_limit,
      null,
      reranked.final_explanation
    from reranked
    returning prediction_id
  ),
  candidate_write_count as (
    select count(*) as value
    from candidate_write
  )
  select
    current_prediction_id,
    reranked.item_id,
    reranked.item_type,
    reranked.title,
    reranked.description,
    reranked.tags,
    reranked.final_score,
    reranked.final_confidence,
    reranked.final_rank,
    reranked.final_explanation
  from reranked
  cross join candidate_write_count
  where reranked.final_rank <= result_limit
  order by reranked.final_rank;

  update private.prediction_runs
  set
    candidate_count = (
      select count(*)
      from private.prediction_candidates as stored_candidate
      where stored_candidate.prediction_id = current_prediction_id
    ),
    result_count = (
      select count(*)
      from private.prediction_candidates as stored_candidate
      where stored_candidate.prediction_id = current_prediction_id
        and stored_candidate.selected_for_delivery
    )
  where private.prediction_runs.id = current_prediction_id;
end;
$$;

revoke all on function private.rank_items_v1_internal(uuid, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function private.rank_items_v1_internal(uuid, text, text, integer, jsonb)
  to authenticated;

create or replace function public.rank_items_v1(
  target_profile_id uuid,
  requested_mode text,
  requested_item_type text default null,
  result_limit integer default 20,
  request_context jsonb default '{}'::jsonb
)
returns table (
  prediction_id uuid,
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  score double precision,
  confidence double precision,
  rank integer,
  explanation jsonb
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.rank_items_v1_internal(
    target_profile_id,
    requested_mode,
    requested_item_type,
    result_limit,
    request_context
  );
$$;

revoke all on function public.rank_items_v0(uuid, text, text, integer, jsonb)
  from authenticated;
revoke all on function public.rank_items_v1(uuid, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.rank_items_v1(uuid, text, text, integer, jsonb)
  to authenticated;
