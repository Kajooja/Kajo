-- #207: direct bootstrap LongTerm evidence in the canonical base scorer.
-- Existing deployed migrations stay unchanged. Native V0.3 weights remain the
-- baseline. prediction-v0.4-bootstrap versions the extended scorer;
-- bootstrapServingVersion identifies its additive feature contract.
-- Full migration replay (#208), V1 integration and device acceptance remain gates.

create or replace function private.bootstrap_decay_v1(
  state_as_of timestamptz,
  evidence_at timestamptz
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  -- Preserve the current bootstrap memory decay in this scoped correction.
  -- Replacing its 20% floor belongs to the source-aware decay acceptance gate.
  select greatest(0.20, exp(-greatest(0.0,
    extract(epoch from (state_as_of - evidence_at)) / 86400.0) / 1460.0));
$$;

create or replace function private.bootstrap_weighted_evidence_v1(
  target_profile_id uuid,
  state_as_of timestamptz
)
returns table (
  item_id uuid,
  occurred_at timestamptz,
  event_weight double precision,
  imported_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select evidence.*, row_number() over (
      partition by evidence.item_id
      order by
        case evidence.evidence_kind when 'RATED' then 3 when 'CONSUMED' then 2 else 1 end desc,
        evidence.source_occurred_at desc nulls last,
        evidence.imported_at desc,
        evidence.id
    ) as item_order
    from private.profile_bootstrap_evidence as evidence
    join public.profiles as profile on profile.id = evidence.profile_id
    where evidence.profile_id = target_profile_id
      and profile.profile_type = 'PERSONAL'
      and evidence.active
      and evidence.imported_at <= state_as_of
  )
  select evidence.item_id,
    coalesce(evidence.source_occurred_at, evidence.imported_at),
    private.bootstrap_evidence_weight_v1(evidence.evidence_kind, evidence.rating),
    evidence.imported_at
  from ranked as evidence
  where evidence.item_order = 1
    and private.bootstrap_evidence_weight_v1(evidence.evidence_kind, evidence.rating) <> 0.0;
$$;

revoke all on function private.bootstrap_decay_v1(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.bootstrap_weighted_evidence_v1(uuid, timestamptz)
  from public, anon, authenticated, service_role;

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
  bootstrap_weighted_events as (
    select evidence.item_id, evidence.occurred_at, evidence.event_weight,
      true as is_bootstrap, evidence.imported_at as bootstrap_imported_at
    from private.bootstrap_weighted_evidence_v1(target_profile_id, state_as_of) as evidence
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
            when weighted_events.is_bootstrap then
              private.bootstrap_decay_v1(state_as_of, weighted_events.occurred_at)
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
    'bootstrapServingVersion', 'bootstrap-serving-v1',
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

revoke all on function private.build_profile_memory_state_v1(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function private.rank_items_v0(
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
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
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

  return query
  with prediction as (
    select gen_random_uuid() as id
  ),
  reversed_events as (
    select (event.properties ->> 'reversedEventId')::uuid as event_id
    from public.events as event
    where event.profile_id = target_profile_id
      and event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.properties ? 'reversedEventId'
      and (event.properties ->> 'reversedEventId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  weighted_events as (
    select
      event.item_id,
      event.occurred_at,
      case event.event_type
        when 'ITEM_RATED' then
          case
            when event.properties ->> 'rating' ~ '^(10|[0-9])$'
              then (((event.properties ->> 'rating')::double precision - 5.0) * 1.2)
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
      end as event_weight
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id is not null
      and event.event_type in (
        'ITEM_RATED',
        'ITEM_NOT_INTERESTED',
        'ITEM_LIKED',
        'ITEM_DISLIKED',
        'ITEM_INTEREST_CLEARED',
        'ITEM_SAVED',
        'ITEM_UNSAVED',
        'ITEM_OPENED',
        'ITEM_CONSUMED',
        'ITEM_CONSUMPTION_REVERSED'
      )
      and not exists (
        select 1
        from reversed_events
        where reversed_events.event_id = event.id
      )
  ),
  native_tag_evidence as (
    select
      tag,
      sum(
        weighted_events.event_weight
        * exp(
            -least(
              365.0,
              greatest(
                0.0,
                extract(epoch from (now() - weighted_events.occurred_at))
                  / 86400.0
              )
            )
            / 180.0
          )
      ) as long_term_score,
      sum(
        case
          when weighted_events.occurred_at >= now() - interval '14 days'
            then weighted_events.event_weight
              * exp(
                  -greatest(
                    0.0,
                    extract(epoch from (now() - weighted_events.occurred_at))
                      / 86400.0
                  )
                  / 7.0
                )
          else 0.0
        end
      ) as short_term_score,
      count(*)::integer as evidence_count
    from weighted_events
    join public.items as evidence_item
      on evidence_item.id = weighted_events.item_id
    cross join lateral unnest(evidence_item.tags) as tag
    where weighted_events.event_weight <> 0
    group by tag
  ),
  bootstrap_evidence as materialized (
    select * from private.bootstrap_weighted_evidence_v1(target_profile_id, now())
  ),
  bootstrap_tag_evidence as (
    select tag, sum(evidence.event_weight
      * private.bootstrap_decay_v1(now(), evidence.occurred_at)) as bootstrap_score
    from bootstrap_evidence as evidence
    join public.items as item on item.id = evidence.item_id
    cross join lateral (select distinct unnest(item.tags) as tag) as item_tag
    group by tag
  ),
  tag_evidence as (
    select coalesce(native.tag, bootstrap.tag) as tag,
      coalesce(native.long_term_score, 0.0) + coalesce(bootstrap.bootstrap_score, 0.0) as long_term_score,
      coalesce(native.short_term_score, 0.0) as short_term_score,
      coalesce(native.evidence_count, 0) as evidence_count,
      coalesce(bootstrap.bootstrap_score, 0.0) as bootstrap_score
    from native_tag_evidence as native
    full join bootstrap_tag_evidence as bootstrap on bootstrap.tag = native.tag
  ),
  recent_impressions as (
    select
      event.item_id,
      max(event.occurred_at) as last_impression_at
    from public.events as event
    where event.profile_id = target_profile_id
      and event.event_type = 'ITEM_IMPRESSION'
      and event.item_id is not null
      and event.occurred_at >= now() - interval '30 minutes'
    group by event.item_id
  ),
  candidate_signals as (
    select
      candidate.id,
      candidate.item_type,
      candidate.title,
      candidate.description,
      candidate.tags,
      coalesce(sum(tag_evidence.long_term_score), 0.0) as long_term_score,
      coalesce(sum(tag_evidence.short_term_score), 0.0) as short_term_score,
      coalesce(sum(tag_evidence.bootstrap_score), 0.0) as bootstrap_score,
      coalesce(sum(tag_evidence.evidence_count), 0)::integer as evidence_count,
      coalesce(
        case interaction.interest
          when 'LIKED' then 4.0
          when 'DISLIKED' then -6.0
          else 0.0
        end,
        0.0
      )
      + case when interaction.saved then 2.5 else 0.0 end
      + case
          when interaction.rating is not null
            then (interaction.rating::double precision - 5.0) * 1.2
          else 0.0
        end
      - case when interaction.not_interested then 7.0 else 0.0 end
        as direct_score,
      coalesce(interaction.rating, null) as rating,
      coalesce(interaction.not_interested, false) as not_interested,
      coalesce(interaction.saved, false) as saved,
      interaction.interest as interest,
      coalesce(interaction.consumed, false) as consumed,
      recent_impressions.last_impression_at,
      case
        when coalesce(interaction.consumed, false) then 100.0
        when interaction.rating is not null
          or coalesce(interaction.not_interested, false)
          or coalesce(interaction.saved, false)
          or interaction.interest is not null
          then 18.0
        else 0.0
      end as reaction_queue_penalty,
      case
        when recent_impressions.last_impression_at is null
          or coalesce(interaction.consumed, false)
          or interaction.rating is not null
          or coalesce(interaction.not_interested, false)
          or coalesce(interaction.saved, false)
          or interaction.interest is not null
          then 0.0
        else 12.0 * greatest(
          0.0,
          1.0 - least(
            1800.0,
            greatest(
              0.0,
              extract(epoch from (now() - recent_impressions.last_impression_at))
            )
          ) / 1800.0
        )
      end as impression_cooldown_penalty,
      case
        when coalesce(cardinality(candidate.tags), 0) = 0 then 0.0
        else 1.0 - least(
          1.0,
          coalesce(count(tag_evidence.tag), 0)::double precision
            / cardinality(candidate.tags)::double precision
        )
      end as novelty_score,
      (
        ('x' || substr(md5(target_profile_id::text || ':' || candidate.id::text), 1, 8))
          ::bit(32)::bigint::double precision
        / 4294967295.0
      ) as exploration_score
    from public.items as candidate
    left join public.item_interactions as interaction
      on interaction.profile_id = target_profile_id
     and interaction.item_id = candidate.id
    left join recent_impressions
      on recent_impressions.item_id = candidate.id
    left join lateral unnest(candidate.tags) as candidate_tag on true
    left join tag_evidence on tag_evidence.tag = candidate_tag
    where candidate.discoverable
      and (requested_item_type is null or candidate.item_type = requested_item_type)
    group by
      candidate.id,
      candidate.item_type,
      candidate.title,
      candidate.description,
      candidate.tags,
      interaction.interest,
      interaction.saved,
      interaction.rating,
      interaction.not_interested,
      interaction.consumed,
      recent_impressions.last_impression_at
  ),
  scored as (
    select
      candidate_signals.*,
      case requested_mode
        when 'FOR_YOU' then
          direct_score
          + long_term_score
          + short_term_score * 1.2
          + novelty_score * 0.1
        when 'SURPRISE' then
          direct_score
          + long_term_score * 0.75
          + short_term_score * 0.7
          + novelty_score * 1.5
          + exploration_score * 0.5
        when 'RISK' then
          direct_score
          + long_term_score * 0.4
          + short_term_score * 0.35
          + novelty_score * 2.5
          + exploration_score * 1.5
      end
      - reaction_queue_penalty
      - impression_cooldown_penalty as final_score
    from candidate_signals
  ),
  ranked as (
    select
      scored.*,
      row_number() over (order by final_score desc, id)::integer as result_rank
    from scored
  )
  select
    prediction.id,
    ranked.id,
    ranked.item_type,
    ranked.title,
    ranked.description,
    ranked.tags,
    ranked.final_score,
    least(1.0, ranked.evidence_count::double precision / 8.0),
    ranked.result_rank,
    jsonb_build_object(
      'version', 'prediction-v0.4-bootstrap',
      'mode', requested_mode,
      'bootstrapServingVersion', 'bootstrap-serving-v1',
      'bootstrapLongTerm', round(ranked.bootstrap_score::numeric, 4),
      'longTerm', round(ranked.long_term_score::numeric, 4),
      'shortTerm', round(ranked.short_term_score::numeric, 4),
      'direct', round(ranked.direct_score::numeric, 4),
      'novelty', round(ranked.novelty_score::numeric, 4),
      'exploration', round(ranked.exploration_score::numeric, 4),
      'rating', ranked.rating,
      'notInterested', ranked.not_interested,
      'saved', ranked.saved,
      'consumedSuppressed', ranked.consumed,
      'lastImpressionAt', ranked.last_impression_at,
      'reactionQueuePenalty', round(ranked.reaction_queue_penalty::numeric, 4),
      'impressionCooldownPenalty', round(ranked.impression_cooldown_penalty::numeric, 4),
      'evidenceCount', ranked.evidence_count,
      'contextAccepted', request_context <> '{}'::jsonb
    )
  from ranked
  cross join prediction
  where ranked.result_rank <= result_limit
  order by ranked.result_rank;
end;
$$;

revoke all on function private.rank_items_v0(uuid, text, text, integer, jsonb)
  from public, anon, authenticated, service_role;


-- Preserve the complete current V1 function; only its base version changes.
CREATE OR REPLACE FUNCTION private.rank_items_v1_internal(target_profile_id uuid, requested_mode text, requested_item_type text DEFAULT NULL::text, result_limit integer DEFAULT 20, request_context jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(prediction_id uuid, item_id uuid, item_type text, title text, description text, tags text[], score double precision, confidence double precision, rank integer, explanation jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_actor_user_id uuid := (select auth.uid());
  current_prediction_id uuid := gen_random_uuid();
  request_time timestamptz := clock_timestamp();
  current_context jsonb;
  current_state jsonb;
  requested_session_id uuid;
  candidate_pool_limit integer;
  shared_common_context jsonb;
  current_policy_version text;
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
  shared_common_context := private.build_shared_common_fit_context_v1_1(target_profile_id, request_time);
  current_policy_version := case
    when coalesce((shared_common_context ->> 'applicable')::boolean, false)
      then 'scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1'
    else 'scenario-memory-v1+resurfacing-v1'
  end;

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
    'prediction-v0.4-bootstrap',
    current_policy_version,
    current_context,
    current_state
  );

  return query
  with base_ranking as materialized (
    select base.*
    from private.rank_items_scalar_v1(
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
      private.shared_common_fit_candidate_v1_1(
        shared_common_context,
        base_ranking.item_id,
        request_time
      ) as shared_common_fit,
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
        + scenario_enriched.scenario_score
          * private.serving_scenario_weight_v1(
              target_profile_id,
              requested_mode,
              request_time
            )
        + coalesce(
            (scenario_enriched.shared_common_fit ->> 'contribution')::double precision,
            0.0
          ) as final_score,
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
        order by
          case
            when coalesce(
              (rescored.explanation #>> '{resurfacingPolicy,eligible}')::boolean,
              false
            ) = false then 2
            when rescored.explanation #>> '{resurfacingPolicy,classification}'
              = 'SAVED_REMINDER' then 1
            else 0
          end,
          rescored.final_score desc,
          rescored.item_id
      )::integer as final_rank,
      (
        rescored.explanation
        || jsonb_build_object(
          'version', 'prediction-v1.0',
          'baseVersion', 'prediction-v0.4-bootstrap',
          'policyVersion', current_policy_version,
          'scenarioMemory', jsonb_build_object(
            'rawScore', round(rescored.scenario_raw_score::numeric, 4),
            'score', round(rescored.scenario_score::numeric, 4),
            'support', rescored.scenario_support,
            'maxSimilarity', round(rescored.scenario_max_similarity::numeric, 4),
            'retrievalScope', 'PROFILE',
            'maxEpisodes', 30
          ),
          'sharedCommonFit', rescored.shared_common_fit
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
      coalesce(
        (reranked.final_explanation #>> '{resurfacingPolicy,eligible}')::boolean,
        false
      )
      and reranked.final_rank <= result_limit,
      null,
      reranked.final_explanation
    from reranked
    returning private.prediction_candidates.prediction_id
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
  where coalesce(
        (reranked.final_explanation #>> '{resurfacingPolicy,eligible}')::boolean,
        false
      )
      and reranked.final_rank <= result_limit
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
$function$
;

revoke all on function private.rank_items_v1_internal(uuid,text,text,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.rank_items_v1_internal(uuid,text,text,integer,jsonb) to authenticated;
