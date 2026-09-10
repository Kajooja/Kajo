-- Replay exactly the frozen candidate pool with the same score and delivery
-- policy as serving. No Events, historical traces, genomes or assignments change.
-- Rounded display explanations are retained; only new predictions carry v2 inputs.

create or replace function private.prediction_candidate_score_v2(
  requested_mode text, explanation jsonb, stored_scenario_score double precision,
  genome_config jsonb
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  features jsonb := explanation -> 'scoringFeatures';
  feature_key text;
  common_fit double precision := coalesce((explanation #>> '{sharedCommonFit,contribution}')::double precision, 0.0);
begin
  if features ->> 'version' is distinct from 'prediction-features-v2' then
    raise exception 'Replay requires frozen prediction-features-v2' using errcode = '22023';
  end if;
  foreach feature_key in array array['direct','longTerm','shortTerm','novelty',
    'exploration','reactionQueuePenalty','impressionCooldownPenalty'] loop
    if jsonb_typeof(features -> feature_key) is distinct from 'number'
      or (features ->> feature_key)::double precision in ('Infinity'::double precision, '-Infinity'::double precision, 'NaN'::double precision) then
      raise exception 'Invalid frozen scoring feature %', feature_key using errcode = '22023';
    end if;
  end loop;
  if stored_scenario_score is null or stored_scenario_score in ('Infinity'::double precision, '-Infinity'::double precision, 'NaN'::double precision)
    or common_fit in ('Infinity'::double precision, '-Infinity'::double precision, 'NaN'::double precision) then
    raise exception 'Invalid frozen Scenario/common-fit score' using errcode = '22023';
  end if;
  return
      (features ->> 'direct')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'direct')
    + (features ->> 'longTerm')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'longTerm')
    + (features ->> 'shortTerm')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'shortTerm')
    + (features ->> 'novelty')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'novelty')
    + (features ->> 'exploration')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'exploration')
    - (features ->> 'reactionQueuePenalty')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'reactionPenalty')
    - (features ->> 'impressionCooldownPenalty')::double precision * private.genome_weight_v1(genome_config, requested_mode, 'impressionCooldown')
    + stored_scenario_score * private.genome_weight_v1(genome_config, requested_mode, 'scenario')
    + common_fit;
end;
$$;

create or replace function private.finalize_resurfacing_policy_v1(policy jsonb, reminder_order integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when policy ->> 'classification' = 'SAVED_REMINDER_ELIGIBLE' and reminder_order = 1 then
      policy || jsonb_build_object('classification','SAVED_REMINDER','eligible',true,'reason','AGED_SAVED_ONLY_REMINDER')
    when policy ->> 'classification' = 'SAVED_REMINDER_ELIGIBLE' then
      policy || jsonb_build_object('classification','SAVED_SUPPRESSED','eligible',false,'reason','CANDIDATE_POOL_REMINDER_CAP')
    else policy
  end;
$$;

create or replace function private.prediction_delivery_tier_v1(policy jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when not coalesce((policy ->> 'eligible')::boolean, false) then 2
    when policy ->> 'classification' = 'SAVED_REMINDER' then 1
    else 0
  end;
$$;

revoke all on function private.prediction_candidate_score_v2(text,jsonb,double precision,jsonb),
  private.finalize_resurfacing_policy_v1(jsonb,integer),
  private.prediction_delivery_tier_v1(jsonb) from public,anon,authenticated,service_role;

-- Guard installed bodies and retain every replaced function's OID, owner and
-- grants. A divergent definition aborts the entire unchanged forward migration.
do $forward$
declare target regprocedure; definition text; patch record; matches integer;
begin
  foreach target in array array[
    'private.process_shadow_prediction_jobs_v1(integer)'::regprocedure,
    'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure,
    'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)'::regprocedure,
    'private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure,
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    for patch in select * from (values
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$AS $function$
begin$old$, $new$AS $function$
declare
  baseline_genome_config jsonb;
begin$new$, 1),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$  return query
$old$, $new$  select config into strict baseline_genome_config from private.predictor_genomes
  where genome_key = 'prediction-v1-baseline';

  return query
$new$, 1),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$  scored as (
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
$old$, $new$  feature_vectors as (
    select candidate_signals.*,
      jsonb_build_object(
        'version', 'prediction-features-v2',
        'direct', direct_score, 'longTerm', long_term_score,
        'shortTerm', short_term_score, 'novelty', novelty_score,
        'exploration', exploration_score, 'reactionQueuePenalty', reaction_queue_penalty,
        'impressionCooldownPenalty', impression_cooldown_penalty
      ) as scoring_features
    from candidate_signals
  ),
  scored as (
    select feature_vectors.*,
      private.prediction_candidate_score_v2(requested_mode,
        jsonb_build_object('scoringFeatures', feature_vectors.scoring_features),
        0.0, baseline_genome_config) as final_score
    from feature_vectors
  ),
$new$, 1),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$      'bootstrapServingVersion', 'bootstrap-serving-v1',$old$, $new$      'bootstrapServingVersion', 'bootstrap-serving-v1',
      'scoringFeatures', ranked.scoring_features,$new$, 1),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)', $old$      case
        when resolved_genome_key = 'prediction-v1-baseline'
          then baseline_pool.score
        else private.shadow_candidate_score_v1(
          requested_mode,
          baseline_pool.explanation,
          0.0,
          resolved_genome_config
        )
      end$old$, $new$      private.prediction_candidate_score_v2(
        requested_mode, baseline_pool.explanation, 0.0, resolved_genome_config
      )$new$, 1),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)', $old$      case
        when policy_evaluated.resurfacing_policy ->> 'classification'
               = 'SAVED_REMINDER_ELIGIBLE'
             and eligible_reminders.reminder_order = 1 then
          policy_evaluated.resurfacing_policy
          || jsonb_build_object(
            'classification', 'SAVED_REMINDER',
            'eligible', true,
            'reason', 'AGED_SAVED_ONLY_REMINDER'
          )
        when policy_evaluated.resurfacing_policy ->> 'classification'
               = 'SAVED_REMINDER_ELIGIBLE' then
          policy_evaluated.resurfacing_policy
          || jsonb_build_object(
            'classification', 'SAVED_SUPPRESSED',
            'eligible', false,
            'reason', 'CANDIDATE_POOL_REMINDER_CAP'
          )
        else policy_evaluated.resurfacing_policy
      end$old$, $new$      private.finalize_resurfacing_policy_v1(
        policy_evaluated.resurfacing_policy, eligible_reminders.reminder_order
      )$new$, 1),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)', $old$          case
            when coalesce(
              (finalized_policy.final_resurfacing_policy ->> 'eligible')::boolean,
              false
            ) = false then 2
            when finalized_policy.final_resurfacing_policy ->> 'classification'
              = 'SAVED_REMINDER' then 1
            else 0
          end,
$old$, $new$          private.prediction_delivery_tier_v1(finalized_policy.final_resurfacing_policy),
$new$, 1),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)', $old$        'resurfacingPolicy', reranked.final_resurfacing_policy$old$, $new$        'resurfacingInput', reranked.resurfacing_policy,
        'resurfacingPolicy', reranked.final_resurfacing_policy$new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$  current_policy_version text;$old$, $new$  current_policy_version text;
  serving_genome_id uuid;
  serving_genome_config jsonb;$new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$  end;

  insert into private.prediction_runs ($old$, $new$  end || '+frozen-replay-v2';

  insert into private.prediction_runs ($new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$    current_state
  );$old$, $new$    current_state
  ) returning private.prediction_runs.genome_id into serving_genome_id;
  select config into strict serving_genome_config from private.predictor_genomes
    where id = serving_genome_id;$new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$      current_context
    ) as base$old$, $new$      current_context,
      serving_genome_id
    ) as base$new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$      scenario_enriched.score
        + scenario_enriched.scenario_score
          * private.serving_scenario_weight_v1(
              target_profile_id,
              requested_mode,
              request_time
            )
        + coalesce(
            (scenario_enriched.shared_common_fit ->> 'contribution')::double precision,
            0.0
          )$old$, $new$      private.prediction_candidate_score_v2(
        requested_mode,
        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit),
        scenario_enriched.scenario_score,
        serving_genome_config
      )$new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$          case
            when coalesce(
              (rescored.explanation #>> '{resurfacingPolicy,eligible}')::boolean,
              false
            ) = false then 2
            when rescored.explanation #>> '{resurfacingPolicy,classification}'
              = 'SAVED_REMINDER' then 1
            else 0
          end,
$old$, $new$          private.prediction_delivery_tier_v1(rescored.explanation -> 'resurfacingPolicy'),
$new$, 1),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$      coalesce(
        (reranked.final_explanation #>> '{resurfacingPolicy,eligible}')::boolean,
        false
      )
$old$, $new$      private.prediction_delivery_tier_v1(reranked.final_explanation -> 'resurfacingPolicy') < 2
$new$, 1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$      shadow_run_id := gen_random_uuid();$old$, $new$      -- Old traces only contain rounded display features. Never manufacture
      -- precise inputs or eligibility from today's catalog/state for those jobs.
      if exists (
        select 1 from private.prediction_candidates c where c.prediction_id = source_run.id
          and (c.explanation #>> '{scoringFeatures,version}' is distinct from 'prediction-features-v2'
            or jsonb_typeof(c.explanation -> 'resurfacingInput') is distinct from 'object')
      ) then
        raise exception 'Unsupported replay inputs: source requires frozen prediction-features-v2 and resurfacingInput';
      end if;

      shadow_run_id := gen_random_uuid();$new$, 1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$        genome.code_version,
        genome.feature_version,$old$, $new$        'shadow-replay-v2',
        'prediction-features-v2',$new$, 1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$      with rescored as (
        select
          production_candidate.*,
          private.shadow_candidate_score_v1(
            source_run.discovery_mode,
            production_candidate.explanation,
            production_candidate.scenario_score,
            genome.config
          ) as challenger_score
        from private.prediction_candidates as production_candidate
        where production_candidate.prediction_id = source_run.id
      ),
      reranked as (
        select
          rescored.*,
          row_number() over (
            order by rescored.challenger_score desc, rescored.item_id
          )::integer as challenger_rank
        from rescored
      )
$old$, $new$      with rescored as materialized (
        select
          production_candidate.*,
          private.prediction_candidate_score_v2(
            source_run.discovery_mode, production_candidate.explanation,
            production_candidate.scenario_score, genome.config
          ) as challenger_score,
          private.prediction_candidate_score_v2(
            source_run.discovery_mode, production_candidate.explanation - 'sharedCommonFit',
            0.0, genome.config
          ) as challenger_scalar_score
        from private.prediction_candidates as production_candidate
        where production_candidate.prediction_id = source_run.id
      ),
      eligible_reminders as (
        select rescored.item_id,
          row_number() over (order by rescored.challenger_scalar_score desc, rescored.item_id)::integer as reminder_order
        from rescored
        where rescored.explanation #>> '{resurfacingInput,classification}' = 'SAVED_REMINDER_ELIGIBLE'
      ),
      policy_replayed as (
        select rescored.*,
          private.finalize_resurfacing_policy_v1(
            rescored.explanation -> 'resurfacingInput', eligible_reminders.reminder_order
          ) as replayed_policy
        from rescored left join eligible_reminders on eligible_reminders.item_id = rescored.item_id
      ),
      reranked as (
        select policy_replayed.*,
          row_number() over (
            order by private.prediction_delivery_tier_v1(policy_replayed.replayed_policy),
              policy_replayed.challenger_score desc, policy_replayed.item_id
          )::integer as challenger_rank
        from policy_replayed
      )
$new$, 1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$        reranked.challenger_rank <= source_run.result_count,$old$, $new$        private.prediction_delivery_tier_v1(reranked.replayed_policy) < 2
          and reranked.challenger_rank <= source_run.result_count,$new$, 1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$          'version', 'shadow-prediction-v1',$old$, $new$          'version', 'shadow-replay-v2',
          'comparisonScope', 'FROZEN_SOURCE_POOL',
          'resurfacingPolicy', reranked.replayed_policy,$new$, 1),
      ('private.evaluate_shadow_genome_v1(uuid,uuid)', $old$      and shadow.candidate_count = production.candidate_count$old$, $new$      and shadow.candidate_count = production.candidate_count
      and shadow.code_version = 'shadow-replay-v2'
      and shadow.feature_version = 'prediction-features-v2'
      and production.policy_version like '%+frozen-replay-v2'$new$, 1),
      ('private.evaluate_shadow_genome_v1(uuid,uuid)', $old$'outcomeAttributionVersion', 'outcome-attribution-v1',$old$, $new$'outcomeAttributionVersion', 'outcome-attribution-v1',
        'replayVersion', 'shadow-replay-v2',
        'comparisonScope', 'FROZEN_SOURCE_POOL',$new$, 2)
    ) as changes(identity,old_source,new_source,expected_matches) where identity::regprocedure = target loop
      matches := (length(definition)-length(replace(definition,patch.old_source,'')))/length(patch.old_source);
      if matches <> patch.expected_matches then
        raise exception 'Frozen replay forward: unexpected source anchor in % (found %)', target, matches;
      end if;
      definition := replace(definition,patch.old_source,patch.new_source);
    end loop;
    execute definition;
  end loop;
end;
$forward$;
