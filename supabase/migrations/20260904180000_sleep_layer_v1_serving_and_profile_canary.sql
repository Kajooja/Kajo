-- Sprint 013C serving gate.
--
-- Keep one canonical Prediction V1 boundary while making its transparent scalar
-- score weights resolve from the versioned PolicyAssignment/PredictorGenome.
-- Production stays on the exact seeded baseline until a service-only manual
-- Profile canary passes the documented evidence gates. Global automatic or
-- manual Challenger promotion remains disabled in MVP 0.1.

-- -----------------------------------------------------------------------------
-- Canonical scalar base scorer. This is the parameterized form of the proven
-- Prediction V0.3 scoring logic. ScenarioMemory remains layered by V1 after the
-- base score. A forced genome is used only by the legacy V0 compatibility
-- wrapper; normal V1 serving resolves the current Profile/global assignment.
-- -----------------------------------------------------------------------------

create or replace function private.rank_items_scalar_v1(
  target_profile_id uuid,
  requested_mode text,
  requested_item_type text default null,
  result_limit integer default 20,
  request_context jsonb default '{}'::jsonb,
  forced_genome_id uuid default null
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
  resolved_genome_id uuid;
  resolved_genome_key text;
  resolved_genome_config jsonb;
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

  if forced_genome_id is null then
    select resolved.genome_id
      into resolved_genome_id
    from private.resolve_policy_assignment_v1(
      target_profile_id,
      clock_timestamp()
    ) as resolved;
  else
    resolved_genome_id := forced_genome_id;
  end if;

  select genome.genome_key, genome.config
    into resolved_genome_key, resolved_genome_config
  from private.predictor_genomes as genome
  where genome.id = resolved_genome_id;

  if resolved_genome_id is null
     or resolved_genome_config is null
     or not private.genome_config_is_valid_v1(resolved_genome_config) then
    raise exception 'No valid scalar PredictorGenome for Profile %', target_profile_id
      using errcode = '55000';
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
  tag_evidence as (
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
    where requested_item_type is null
       or candidate.item_type = requested_item_type
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
      direct_score
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'direct')
      + long_term_score
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'longTerm')
      + short_term_score
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'shortTerm')
      + novelty_score
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'novelty')
      + exploration_score
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'exploration')
      - reaction_queue_penalty
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'reactionPenalty')
      - impression_cooldown_penalty
        * private.genome_weight_v1(resolved_genome_config, requested_mode, 'impressionCooldown')
        as final_score
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
      'version', 'prediction-scalar-v1',
      'baseVersion', 'prediction-v0.3',
      'genomeId', resolved_genome_id,
      'genomeKey', resolved_genome_key,
      'mode', requested_mode,
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

revoke all on function private.rank_items_scalar_v1(uuid, text, text, integer, jsonb, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.serving_scenario_weight_v1(
  target_profile_id uuid,
  requested_mode text,
  decision_time timestamptz
)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select private.genome_weight_v1(genome.config, requested_mode, 'scenario')
  from private.resolve_policy_assignment_v1(target_profile_id, decision_time) as resolved
  join private.predictor_genomes as genome
    on genome.id = resolved.genome_id;
$$;

revoke all on function private.serving_scenario_weight_v1(uuid, text, timestamptz)
  from public, anon, authenticated, service_role;

-- Patch the already-deployed canonical V1 function rather than cloning a second
-- V1 implementation. The first replacement swaps only the base scorer call;
-- the second replaces the fixed Scenario multiplier with the assigned genome.
do $$
declare
  definition text;
  patched text;
  old_scenario text := E'scenario_enriched.score\n        + scenario_enriched.scenario_score * case requested_mode\n          when ''FOR_YOU'' then 2.2\n          when ''SURPRISE'' then 1.6\n          when ''RISK'' then 1.0\n        end as final_score';
  new_scenario text := E'scenario_enriched.score\n        + scenario_enriched.scenario_score\n          * private.serving_scenario_weight_v1(\n              target_profile_id,\n              requested_mode,\n              request_time\n            ) as final_score';
begin
  definition := pg_get_functiondef(
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  );

  if position('from public.rank_items_v0(' in definition) = 0 then
    raise exception 'Expected Prediction V1 base scorer call was not found';
  end if;

  if position(old_scenario in definition) = 0 then
    raise exception 'Expected Prediction V1 Scenario multiplier block was not found';
  end if;

  patched := replace(
    definition,
    'from public.rank_items_v0(',
    'from private.rank_items_scalar_v1('
  );
  patched := replace(patched, old_scenario, new_scenario);

  if patched = definition then
    raise exception 'Prediction V1 serving patch made no changes';
  end if;

  execute patched;
end;
$$;

-- The queue's Challenger pool is the latest GLOBAL state for each genome.
-- A Profile-specific canary must not accidentally remove a genome from the
-- global shadow pool used for all other Profiles.
create or replace function private.enqueue_prediction_shadows_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.candidate_count <= 0 then
    return new;
  end if;

  insert into private.shadow_prediction_jobs (
    source_prediction_id,
    genome_id
  )
  select
    new.id,
    latest_state.genome_id
  from (
    select distinct on (decision.genome_id)
      decision.genome_id,
      decision.to_state
    from private.promotion_decisions as decision
    where decision.scope_type = 'GLOBAL'
      and decision.scope_key = 'GLOBAL'
    order by decision.genome_id, decision.created_at desc, decision.id desc
  ) as latest_state
  where latest_state.to_state = 'SHADOW'
    and latest_state.genome_id <> new.genome_id
  on conflict (source_prediction_id, genome_id) do nothing;

  return new;
end;
$$;

revoke all on function private.enqueue_prediction_shadows_v1()
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Manual Profile canary. This is the only Challenger-to-serving operation in
-- MVP 0.1. It is evidence-gated, service-only, Profile-scoped and reversible.
-- Global Challenger promotion remains intentionally unavailable.
-- -----------------------------------------------------------------------------

create or replace function private.manual_profile_canary_v1(
  target_profile_id uuid,
  target_genome_id uuid,
  target_evaluation_window_id uuid,
  approved_by text,
  reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  evaluation record;
  evaluation_window record;
  genome record;
  current_assignment record;
  latest_state text;
  new_assignment_id uuid := gen_random_uuid();
begin
  if target_profile_id is null or target_genome_id is null
     or target_evaluation_window_id is null then
    raise exception 'Profile, genome and EvaluationWindow are required'
      using errcode = '22023';
  end if;

  if nullif(btrim(approved_by), '') is null
     or nullif(btrim(reason), '') is null then
    raise exception 'Manual approval identity and reason are required'
      using errcode = '22023';
  end if;

  select * into genome
  from private.predictor_genomes as stored_genome
  where stored_genome.id = target_genome_id;

  if genome.id is null or genome.genome_key = 'prediction-v1-baseline' then
    raise exception 'A non-baseline Challenger genome is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles as profile where profile.id = target_profile_id
  ) then
    raise exception 'Target Profile does not exist' using errcode = '22023';
  end if;

  select * into evaluation_window
  from private.evaluation_windows as stored_window
  where stored_window.id = target_evaluation_window_id;

  select * into evaluation
  from private.genome_evaluations as stored_evaluation
  where stored_evaluation.evaluation_window_id = target_evaluation_window_id
    and stored_evaluation.genome_id = target_genome_id
    and stored_evaluation.scope_type = 'PROFILE'
    and stored_evaluation.scope_key = target_profile_id::text;

  if evaluation.id is null or evaluation_window.id is null then
    raise exception 'Matching mature Profile GenomeEvaluation is required'
      using errcode = '55000';
  end if;

  if evaluation.eligibility_reason <> 'MATURE_COMPARABLE_EXPOSED_OUTCOME'
     or evaluation.outcome_count < 30
     or evaluation.coverage < 0.5
     or coalesce(evaluation.shrunk_advantage, -1.0) < 0.05
     or evaluation_window.prediction_until - evaluation_window.prediction_from < interval '14 days'
     or clock_timestamp() < evaluation_window.outcome_cutoff then
    raise exception 'Profile canary evidence gate is not satisfied'
      using errcode = '55000';
  end if;

  select decision.to_state into latest_state
  from private.promotion_decisions as decision
  where decision.genome_id = target_genome_id
    and (
      (decision.scope_type = 'PROFILE' and decision.scope_key = target_profile_id::text)
      or (decision.scope_type = 'GLOBAL' and decision.scope_key = 'GLOBAL')
    )
  order by
    case when decision.scope_type = 'PROFILE' then 0 else 1 end,
    decision.created_at desc,
    decision.id desc
  limit 1;

  if latest_state not in ('SHADOW', 'CANDIDATE', 'ROLLED_BACK') then
    raise exception 'Genome is not eligible for a Profile canary from state %', latest_state
      using errcode = '55000';
  end if;

  select * into current_assignment
  from private.resolve_policy_assignment_v1(target_profile_id, clock_timestamp());

  if current_assignment.assignment_id is null then
    raise exception 'No current rollback assignment exists for Profile %', target_profile_id
      using errcode = '55000';
  end if;

  if current_assignment.genome_id = target_genome_id then
    raise exception 'Target genome is already assigned to this Profile'
      using errcode = '55000';
  end if;

  insert into private.promotion_decisions (
    genome_id,
    scope_type,
    scope_key,
    from_state,
    to_state,
    evaluation_window_id,
    metrics,
    guardrails,
    decided_by,
    reason
  ) values (
    target_genome_id,
    'PROFILE',
    target_profile_id::text,
    latest_state,
    'CANARY',
    target_evaluation_window_id,
    jsonb_build_object(
      'outcomeCount', evaluation.outcome_count,
      'coverage', evaluation.coverage,
      'rawAdvantage', evaluation.raw_advantage,
      'shrunkAdvantage', evaluation.shrunk_advantage,
      'standardError', evaluation.standard_error
    ),
    jsonb_build_object(
      'automaticPromotion', false,
      'manualApproval', true,
      'scope', 'PROFILE',
      'minimumOutcomeCount', 30,
      'minimumCoverage', 0.5,
      'minimumShrunkAdvantage', 0.05,
      'minimumWindowDays', 14,
      'globalPromotionEnabled', false
    ),
    left(btrim(approved_by), 200),
    left(btrim(reason), 1000)
  );

  insert into private.policy_assignments (
    id,
    scope_type,
    scope_key,
    genome_id,
    previous_assignment_id,
    rollback_target_assignment_id,
    effective_from,
    decided_by,
    reason
  ) values (
    new_assignment_id,
    'PROFILE',
    target_profile_id::text,
    target_genome_id,
    current_assignment.assignment_id,
    current_assignment.assignment_id,
    clock_timestamp(),
    left(btrim(approved_by), 200),
    left(btrim(reason), 1000)
  );

  return new_assignment_id;
end;
$$;

create or replace function private.rollback_profile_canary_v1(
  target_profile_id uuid,
  approved_by text,
  reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_profile_assignment record;
  rollback_assignment record;
  current_state text;
  new_assignment_id uuid := gen_random_uuid();
begin
  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if nullif(btrim(approved_by), '') is null
     or nullif(btrim(reason), '') is null then
    raise exception 'Manual rollback identity and reason are required'
      using errcode = '22023';
  end if;

  select assignment.* into current_profile_assignment
  from private.policy_assignments as assignment
  where assignment.scope_type = 'PROFILE'
    and assignment.scope_key = target_profile_id::text
    and assignment.effective_from <= clock_timestamp()
  order by assignment.effective_from desc, assignment.created_at desc, assignment.id desc
  limit 1;

  if current_profile_assignment.id is null
     or current_profile_assignment.rollback_target_assignment_id is null then
    raise exception 'No reversible Profile canary assignment exists'
      using errcode = '55000';
  end if;

  select assignment.* into rollback_assignment
  from private.policy_assignments as assignment
  where assignment.id = current_profile_assignment.rollback_target_assignment_id;

  if rollback_assignment.id is null then
    raise exception 'Rollback target assignment is missing'
      using errcode = '55000';
  end if;

  select decision.to_state into current_state
  from private.promotion_decisions as decision
  where decision.genome_id = current_profile_assignment.genome_id
    and decision.scope_type = 'PROFILE'
    and decision.scope_key = target_profile_id::text
  order by decision.created_at desc, decision.id desc
  limit 1;

  if current_state <> 'CANARY' then
    raise exception 'Current Profile assignment is not an active canary'
      using errcode = '55000';
  end if;

  insert into private.promotion_decisions (
    genome_id,
    scope_type,
    scope_key,
    from_state,
    to_state,
    guardrails,
    decided_by,
    reason
  ) values (
    current_profile_assignment.genome_id,
    'PROFILE',
    target_profile_id::text,
    current_state,
    'ROLLED_BACK',
    jsonb_build_object(
      'automaticRollback', false,
      'manualApproval', true,
      'restoredAssignmentId', rollback_assignment.id,
      'restoredGenomeId', rollback_assignment.genome_id
    ),
    left(btrim(approved_by), 200),
    left(btrim(reason), 1000)
  );

  insert into private.policy_assignments (
    id,
    scope_type,
    scope_key,
    genome_id,
    previous_assignment_id,
    rollback_target_assignment_id,
    effective_from,
    decided_by,
    reason
  ) values (
    new_assignment_id,
    'PROFILE',
    target_profile_id::text,
    rollback_assignment.genome_id,
    current_profile_assignment.id,
    current_profile_assignment.id,
    clock_timestamp(),
    left(btrim(approved_by), 200),
    left(btrim(reason), 1000)
  );

  return new_assignment_id;
end;
$$;

revoke all on function private.manual_profile_canary_v1(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.rollback_profile_canary_v1(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function private.manual_profile_canary_v1(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function private.rollback_profile_canary_v1(uuid, text, text)
  to service_role;
