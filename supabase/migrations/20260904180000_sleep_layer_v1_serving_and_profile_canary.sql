-- Sprint 013C serving gate.
--
-- Keep one canonical Prediction V1 boundary and one proven V0.3 feature/base
-- scorer. The existing V0 scorer is moved to the private schema and becomes
-- the fixed candidate generator. A scalar PredictorGenome may rerank only that
-- frozen candidate pool; ScenarioMemory is still applied by Prediction V1.
--
-- Production stays on the exact seeded baseline until a service-only manual
-- Profile canary passes the documented evidence gates. Global Challenger
-- promotion and automatic promotion remain disabled in MVP 0.1.

-- -----------------------------------------------------------------------------
-- Preserve the proven V0.3 implementation as one private baseline generator.
-- Direct mobile V0 execution was already revoked by Sprint 013A.
-- -----------------------------------------------------------------------------

alter function public.rank_items_v0(uuid, text, text, integer, jsonb)
  set schema private;

revoke all on function private.rank_items_v0(uuid, text, text, integer, jsonb)
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Genome-aware scalar policy layer.
--
-- The baseline genome returns the exact stored V0.3 score. Challenger genomes
-- recompute the transparent scalar score from the already-versioned V0.3
-- explanation components. This is intentionally the same formula used by the
-- prospective ShadowPrediction worker. No current/future state is read beyond
-- what the baseline request itself legitimately sees at serving time.
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
  with baseline_pool as materialized (
    select baseline.*
    from private.rank_items_v0(
      target_profile_id,
      requested_mode,
      requested_item_type,
      result_limit,
      request_context
    ) as baseline
  ),
  rescored as (
    select
      baseline_pool.*,
      case
        when resolved_genome_key = 'prediction-v1-baseline'
          then baseline_pool.score
        else private.shadow_candidate_score_v1(
          requested_mode,
          baseline_pool.explanation,
          0.0,
          resolved_genome_config
        )
      end as scalar_score
    from baseline_pool
  ),
  reranked as (
    select
      rescored.*,
      row_number() over (
        order by rescored.scalar_score desc, rescored.item_id
      )::integer as scalar_rank
    from rescored
  )
  select
    reranked.prediction_id,
    reranked.item_id,
    reranked.item_type,
    reranked.title,
    reranked.description,
    reranked.tags,
    reranked.scalar_score,
    reranked.confidence,
    reranked.scalar_rank,
    reranked.explanation || jsonb_build_object(
      'scalarGenome', jsonb_build_object(
        'genomeId', resolved_genome_id,
        'genomeKey', resolved_genome_key,
        'baselineEquivalent', resolved_genome_key = 'prediction-v1-baseline'
      )
    )
  from reranked
  order by reranked.scalar_rank;
end;
$$;

revoke all on function private.rank_items_scalar_v1(uuid, text, text, integer, jsonb, uuid)
  from public, anon, authenticated, service_role;

-- Keep the historical public V0 symbol only as a non-serving compatibility
-- wrapper. It is still not executable by mobile roles and always forces the
-- immutable baseline genome. The scoring formula itself now exists only in the
-- private V0.3 baseline generator above.
create or replace function public.rank_items_v0(
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
  from private.rank_items_scalar_v1(
    target_profile_id,
    requested_mode,
    requested_item_type,
    result_limit,
    request_context,
    md5('kajo:predictor-genome:prediction-v1-baseline')::uuid
  );
$$;

revoke all on function public.rank_items_v0(uuid, text, text, integer, jsonb)
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

-- Patch the already-deployed canonical V1 implementation in place rather than
-- introducing another V1 function. Only the base scorer call and fixed Scenario
-- multiplier change; trace/outcome/Scenario retrieval semantics stay intact.
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

-- A Profile CANARY decision must not remove that genome from the global shadow
-- pool for other Profiles. Queue candidates from each genome's latest GLOBAL
-- state only.
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
