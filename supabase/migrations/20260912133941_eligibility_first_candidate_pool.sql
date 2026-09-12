-- Admission before the unchanged 50-candidate retained pool. No data, genome,
-- public RPC signature or weight changes. The existing full feature scan remains;
-- expensive Scenario/common-fit work and persisted candidates stay bounded.
-- A new source-policy version distinguishes admission from historical pools.

-- Zero selected candidates and a completely empty pool are valid frozen results,
-- not failed shadow work. Preserve every existing artifact while accepting zero.
do $counts_guard$
begin
  if not exists(select 1 from pg_constraint
    where conrelid='private.shadow_prediction_runs'::regclass
      and conname='shadow_prediction_runs_counts_check'
      and pg_get_constraintdef(oid) like '%candidate_count >= 1%'
      and pg_get_constraintdef(oid) like '%hypothetical_result_count >= 1%') then
    raise exception 'Candidate pool forward: unexpected shadow count constraint';
  end if;
end;
$counts_guard$;
alter table private.shadow_prediction_runs drop constraint shadow_prediction_runs_counts_check;
alter table private.shadow_prediction_runs add constraint shadow_prediction_runs_counts_check
  check(candidate_count >= 0 and hypothetical_result_count >= 0 and hypothetical_result_count <= candidate_count);

do $forward$
declare target regprocedure; definition text; patch record; matches integer;
begin
  foreach target in array array[
    'private.process_shadow_prediction_jobs_v1(integer)'::regprocedure,
    'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure,
    'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)'::regprocedure,
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure,
    'private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    for patch in select * from (values
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$  baseline_genome_config jsonb;$old$, $new$  baseline_genome_config jsonb;
  eligibility_time timestamptz := clock_timestamp();$new$),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$  ranked as (
    select
      scored.*,
      row_number() over (order by final_score desc, id)::integer as result_rank
    from scored
  )$old$, $new$  -- Evaluate admission once, before the retained-pool cutoff. Otherwise strong
  -- taste for an already-consumed genre can hide every available alternative.
  policy_candidates as materialized (
    select scored.*,
      row_number() over (order by final_score desc, id)::integer as baseline_score_rank,
      private.resurfacing_policy_decision_v1(
        target_profile_id, scored.id,
        jsonb_build_object('consumedSuppressed',scored.consumed,'rating',scored.rating,
          'notInterested',scored.not_interested,'saved',scored.saved),
        eligibility_time
      ) as resurfacing_input
    from scored
  ),
  pool_summary as (
    select count(*)::integer as considered_count,
      count(*) filter (where resurfacing_input ->> 'classification' = 'ORDINARY')::integer as ordinary_count,
      count(*) filter (where resurfacing_input ->> 'classification' = 'SAVED_REMINDER_ELIGIBLE')::integer as reminder_count,
      count(*) filter (where not coalesce((resurfacing_input ->> 'eligible')::boolean,false))::integer as suppressed_count
    from policy_candidates
  ),
  ranked as (
    select policy_candidates.*,
      row_number() over (
        order by
          -- Each aged reminder is provisionally eligible here. The assigned
          -- genome applies the one-reminder cap over the retained pool later.
          private.prediction_delivery_tier_v1(private.finalize_resurfacing_policy_v1(resurfacing_input,1)),
          final_score desc, id
      )::integer as result_rank
    from policy_candidates
  )$new$),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$      'scoringFeatures', ranked.scoring_features,$old$, $new$      'scoringFeatures', ranked.scoring_features,
      'resurfacingInput', ranked.resurfacing_input,
      'candidatePool', jsonb_build_object(
        'version','eligibility-first-v1','eligibilityAt',eligibility_time,
        'consideredCount',pool_summary.considered_count,
        'ordinaryCount',pool_summary.ordinary_count,'reminderEligibleCount',pool_summary.reminder_count,
        'suppressedCount',pool_summary.suppressed_count,
        'retainedLimit',result_limit,'retainedCount',least(result_limit,pool_summary.considered_count),
        'baselineScoreRank',ranked.baseline_score_rank,'admissionRank',ranked.result_rank
      ),$new$),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)', $old$  cross join prediction
$old$, $new$  cross join prediction
  cross join pool_summary
$new$),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)', $old$      private.resurfacing_policy_decision_v1(
        target_profile_id,
        rescored.item_id,
        rescored.explanation,
        decision_time
      ) as resurfacing_policy$old$, $new$      rescored.explanation -> 'resurfacingInput' as resurfacing_policy$new$),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)', $old$  end || '+frozen-replay-v2';$old$, $new$  end || '+frozen-replay-v2+eligibility-first-v1';$new$),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$         or source_run.candidate_count <= 0
         or source_run.result_count <= 0 then$old$, $new$         or source_run.candidate_count < 0
         or source_run.result_count < 0
         or source_run.result_count > source_run.candidate_count then$new$),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$      if exists (
        select 1 from private.prediction_candidates c where c.prediction_id = source_run.id$old$, $new$      if not ('frozen-replay-v2' = any(string_to_array(source_run.policy_version,'+')))
        or exists (
        select 1 from private.prediction_candidates c where c.prediction_id = source_run.id$new$),
      ('private.evaluate_shadow_genome_v1(uuid,uuid)', $old$      and production.policy_version like '%+frozen-replay-v2'$old$, $new$      and 'frozen-replay-v2' = any(string_to_array(production.policy_version,'+'))$new$)
    ) as changes(identity,old_source,new_source) where identity::regprocedure=target loop
      matches := (length(definition)-length(replace(definition,patch.old_source,'')))/length(patch.old_source);
      if matches<>1 then
        raise exception 'Candidate pool forward: unexpected source anchor in % (found %)',target,matches;
      end if;
      definition := replace(definition,patch.old_source,patch.new_source);
    end loop;
    execute definition;
  end loop;
end;
$forward$;
