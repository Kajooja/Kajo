-- Read-time reconciliation only: stored Events, action receipts and evaluations
-- remain immutable. A missing impression is never synthesized or guessed.
create function private.prediction_outcome_events_v1(
  target_profile_id uuid,
  outcome_cutoff timestamptz,
  evidence_cutoff timestamptz
)
returns table (
  id uuid, profile_id uuid, item_id uuid, prediction_id uuid,
  event_type text, properties jsonb, occurred_at timestamptz,
  attribution_source text
)
language sql stable security invoker
set search_path = ''
as $$
  -- Keep existing recorded attribution compatible; downstream consumers retain
  -- their selected-candidate, outcome priority and exact reversal checks.
  select e.id,e.profile_id,e.item_id,e.prediction_id,e.event_type,e.properties,
    e.occurred_at,'RECORDED'::text
  from public.events e
  where e.profile_id=target_profile_id and e.prediction_id is not null
    and e.item_id is not null and private.outcome_priority_v1(e.event_type)>0
    and e.occurred_at<=outcome_cutoff and e.created_at<=evidence_cutoff
  union all
  select e.id,e.profile_id,e.item_id,run.id,e.event_type,e.properties,
    e.occurred_at,'LATE_EXPOSURE_V1'::text
  from public.events e
  join private.item_action_receipts receipt on receipt.id=case
    when e.properties->>'actionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (e.properties->>'actionId')::uuid end
  join private.prediction_runs run on run.id=case
    when receipt.command->>'predictionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (receipt.command->>'predictionId')::uuid end
  join private.prediction_candidates candidate
    on candidate.prediction_id=run.id and candidate.item_id=e.item_id
      and candidate.selected_for_delivery
  where e.profile_id=target_profile_id and e.prediction_id is null
    and e.item_id is not null and private.outcome_priority_v1(e.event_type)>0
    and e.occurred_at<=outcome_cutoff and e.created_at<=evidence_cutoff
    and receipt.created_at<=evidence_cutoff
    and receipt.actor_user_id=e.actor_user_id and receipt.profile_id=e.profile_id
    and receipt.item_id=e.item_id
    -- Client-writable properties are not proof of receipt ownership. Secondary
    -- collection Events must be explicitly recorded in the private receipt.
    and (e.id=receipt.id or receipt.result->'eventIds' @> jsonb_build_array(e.id))
    and receipt.command->>'actorUserId'=e.actor_user_id::text
    and receipt.command->>'profileId'=e.profile_id::text
    and receipt.command->>'itemId'=e.item_id::text
    and (receipt.command->>'occurredAt')::timestamptz=e.occurred_at
    and receipt.command->'session'->>'sessionId'=e.session_id::text
    and receipt.command->>'discoveryMode'=e.discovery_mode
    and (
      (receipt.command->>'kind'='SET_RATING' and e.event_type='ITEM_RATED')
      or (receipt.command->>'kind'='SET_NOT_INTERESTED' and e.event_type='ITEM_NOT_INTERESTED')
      or (receipt.command->>'kind'='SET_LIST_ENTRY' and e.event_type in
        ('ITEM_ADDED_TO_LIST','ITEM_REMOVED_FROM_LIST','ITEM_LIKED','ITEM_SAVED','ITEM_UNSAVED'))
      or (receipt.command->>'kind'='ENDORSE_SHARED_ITEM' and e.event_type in
        ('ITEM_ENDORSED','ITEM_SAVED','ITEM_ADDED_TO_LIST'))
    )
    and run.actor_user_id=e.actor_user_id and run.profile_id=e.profile_id
    and run.session_id=e.session_id and run.discovery_mode=e.discovery_mode
    and run.requested_at<=e.occurred_at
    and exists (
      select 1 from public.events impression
      where impression.prediction_id=run.id and impression.item_id=e.item_id
        and impression.profile_id=e.profile_id and impression.actor_user_id=e.actor_user_id
        and impression.session_id=e.session_id and impression.event_type='ITEM_IMPRESSION'
        and impression.occurred_at between run.requested_at and e.occurred_at
        and impression.created_at<=evidence_cutoff
    );
$$;

revoke all on function private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;

-- Change only the two readers. Guard every source anchor and preserve function
-- identity, ownership and ACLs via CREATE OR REPLACE on their installed bodies.
do $forward$
declare
  target regprocedure;
  definition text;
  patch record;
  matches integer;
begin
  foreach target in array array[
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure,
    'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    -- ADR-0006 reviewed this installed compact body as formatting-only.
    -- Accept precisely its captured SHA-256; never normalize arbitrary SQL.
    -- The unchanged feature patches below still validate every source anchor.
    if target='private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure
      and encode(sha256(convert_to(definition,'UTF8')),'hex')='50a6ba3ce029e6a1a4f2451f4f97c43455ed879136441e74e2d91b4a82426532' then
      definition := $reviewed_evaluation_source$create or replace function private.evaluate_shadow_genome_v1(
  target_window_id uuid,
  target_genome_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  evaluation_window record;
  inserted_count integer := 0;
begin
  select * into evaluation_window
  from private.evaluation_windows as stored_window
  where stored_window.id = target_window_id;

  if evaluation_window.id is null then
    raise exception 'EvaluationWindow not found' using errcode = '22023';
  end if;

  if clock_timestamp() < evaluation_window.outcome_cutoff then
    raise exception 'EvaluationWindow has not matured yet' using errcode = '55000';
  end if;

  if exists (
    select 1
    from private.genome_evaluations as existing
    where existing.evaluation_window_id = target_window_id
      and existing.genome_id = target_genome_id
  ) then
    raise exception 'GenomeEvaluation already exists for this immutable window/genome'
      using errcode = '23505';
  end if;

  with eligible_runs as materialized (
    select
      shadow.id as shadow_prediction_id,
      shadow.source_prediction_id,
      production.profile_id,
      production.requested_at,
      production.candidate_count
    from private.shadow_prediction_runs as shadow
    join private.prediction_runs as production
      on production.id = shadow.source_prediction_id
    where shadow.genome_id = target_genome_id
      and production.requested_at >= evaluation_window.prediction_from
      and production.requested_at < evaluation_window.prediction_until
      and shadow.as_of = production.requested_at
      and shadow.candidate_count = production.candidate_count
  ),
  reversed_events as (
    select (event.properties ->> 'reversedEventId')::uuid as event_id
    from public.events as event
    where event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.occurred_at <= evaluation_window.outcome_cutoff
      and event.properties ? 'reversedEventId'
      and (event.properties ->> 'reversedEventId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  exposed as materialized (
    select distinct
      eligible.source_prediction_id,
      eligible.shadow_prediction_id,
      eligible.profile_id,
      eligible.candidate_count,
      event.item_id
    from eligible_runs as eligible
    join public.events as event
      on event.prediction_id = eligible.source_prediction_id
     and event.profile_id = eligible.profile_id
     and event.event_type = 'ITEM_IMPRESSION'
     and event.item_id is not null
     and event.occurred_at >= eligible.requested_at
     and event.occurred_at <= evaluation_window.outcome_cutoff
    join private.prediction_candidates as production_candidate
      on production_candidate.prediction_id = eligible.source_prediction_id
     and production_candidate.item_id = event.item_id
     and production_candidate.selected_for_delivery
  ),
  ranked_outcomes as (
    select
      exposed.source_prediction_id,
      exposed.profile_id,
      exposed.item_id,
      outcome.event_type,
      outcome.properties,
      row_number() over (
        partition by exposed.source_prediction_id, exposed.item_id
        order by
          private.outcome_priority_v1(outcome.event_type) desc,
          outcome.occurred_at desc,
          outcome.id desc
      ) as outcome_rank
    from exposed
    join private.prediction_runs as production
      on production.id = exposed.source_prediction_id
    join public.events as outcome
      on outcome.prediction_id = exposed.source_prediction_id
     and outcome.profile_id = exposed.profile_id
     and outcome.item_id = exposed.item_id
     and outcome.occurred_at >= production.requested_at
     and outcome.occurred_at <= evaluation_window.outcome_cutoff
     and private.outcome_priority_v1(outcome.event_type) > 0
    where not exists (
      select 1
      from reversed_events
      where reversed_events.event_id = outcome.id
    )
  ),
  labelled as materialized (
    select
      exposed.source_prediction_id,
      exposed.profile_id,
      exposed.item_id,
      exposed.candidate_count,
      production_candidate.final_rank as production_rank,
      shadow_candidate.shadow_rank,
      private.outcome_reward_v1(
        ranked_outcomes.event_type,
        ranked_outcomes.properties
      ) as reward
    from exposed
    join ranked_outcomes
      on ranked_outcomes.source_prediction_id = exposed.source_prediction_id
     and ranked_outcomes.item_id = exposed.item_id
     and ranked_outcomes.outcome_rank = 1
    join private.prediction_candidates as production_candidate
      on production_candidate.prediction_id = exposed.source_prediction_id
     and production_candidate.item_id = exposed.item_id
    join private.shadow_prediction_candidates as shadow_candidate
      on shadow_candidate.shadow_prediction_id = exposed.shadow_prediction_id
     and shadow_candidate.item_id = exposed.item_id
  ),
  contributions as materialized (
    select
      labelled.*,
      labelled.reward * case
        when labelled.candidate_count <= 1 then 1.0
        else 1.0 - (
          (labelled.production_rank - 1)::double precision
          / (labelled.candidate_count - 1)::double precision
        )
      end as production_contribution,
      labelled.reward * case
        when labelled.candidate_count <= 1 then 1.0
        else 1.0 - (
          (labelled.shadow_rank - 1)::double precision
          / (labelled.candidate_count - 1)::double precision
        )
      end as challenger_contribution
    from labelled
  ),
  sample_scopes as (
    select
      'GLOBAL'::text as scope_type,
      'GLOBAL'::text as scope_key,
      contributions.*
    from contributions
    union all
    select
      'PROFILE'::text,
      contributions.profile_id::text,
      contributions.*
    from contributions
  ),
  exposure_scopes as (
    select
      'GLOBAL'::text as scope_type,
      'GLOBAL'::text as scope_key,
      count(*)::integer as exposed_count
    from exposed
    union all
    select
      'PROFILE'::text,
      exposed.profile_id::text,
      count(*)::integer
    from exposed
    group by exposed.profile_id
  ),
  aggregated as (
    select
      sample_scopes.scope_type,
      sample_scopes.scope_key,
      avg(sample_scopes.production_contribution) as production_metric,
      avg(sample_scopes.challenger_contribution) as challenger_metric,
      avg(sample_scopes.challenger_contribution - sample_scopes.production_contribution) as raw_advantage,
      count(*)::integer as outcome_count,
      count(distinct sample_scopes.source_prediction_id)::integer as prediction_count,
      count(distinct sample_scopes.profile_id)::integer as profile_count,
      case
        when count(*) > 1
          then stddev_samp(
            sample_scopes.challenger_contribution - sample_scopes.production_contribution
          ) / sqrt(count(*)::double precision)
        else null
      end as standard_error
    from sample_scopes
    group by sample_scopes.scope_type, sample_scopes.scope_key
  ),
  global_stats as (
    select aggregated.raw_advantage
    from aggregated
    where aggregated.scope_type = 'GLOBAL'
      and aggregated.scope_key = 'GLOBAL'
  )
  insert into private.genome_evaluations (
    evaluation_window_id,
    genome_id,
    scope_type,
    scope_key,
    production_metric,
    challenger_metric,
    raw_advantage,
    shrunk_advantage,
    outcome_count,
    exposed_count,
    prediction_count,
    profile_count,
    coverage,
    standard_error,
    eligibility_reason,
    metrics
  )
  select
    target_window_id,
    target_genome_id,
    aggregated.scope_type,
    aggregated.scope_key,
    aggregated.production_metric,
    aggregated.challenger_metric,
    aggregated.raw_advantage,
    case
      when aggregated.scope_type = 'PROFILE' then
        (
          aggregated.outcome_count::double precision
          / (aggregated.outcome_count::double precision + 30.0)
        ) * aggregated.raw_advantage
        + (
          1.0 - (
            aggregated.outcome_count::double precision
            / (aggregated.outcome_count::double precision + 30.0)
          )
        ) * coalesce((select raw_advantage from global_stats), 0.0)
      else aggregated.raw_advantage
    end,
    aggregated.outcome_count,
    exposure_scopes.exposed_count,
    aggregated.prediction_count,
    aggregated.profile_count,
    aggregated.outcome_count::double precision
      / greatest(1, exposure_scopes.exposed_count)::double precision,
    aggregated.standard_error,
    'MATURE_COMPARABLE_EXPOSED_OUTCOME',
    jsonb_build_object(
      'metricVersion', evaluation_window.metric_version,
      'rewardVersion', evaluation_window.reward_version,
      'counterfactualLimit', 'UNEXPOSED_SHADOW_ITEMS_UNLABELLED',
      'profileShrinkageK', 30,
      'productionMetric', aggregated.production_metric,
      'challengerMetric', aggregated.challenger_metric,
      'rawAdvantage', aggregated.raw_advantage,
      'standardError', aggregated.standard_error
    )
  from aggregated
  join exposure_scopes
    on exposure_scopes.scope_type = aggregated.scope_type
   and exposure_scopes.scope_key = aggregated.scope_key
  where exposure_scopes.exposed_count >= evaluation_window.minimum_exposure_count;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    insert into private.genome_evaluations (
      evaluation_window_id,
      genome_id,
      scope_type,
      scope_key,
      production_metric,
      challenger_metric,
      raw_advantage,
      shrunk_advantage,
      outcome_count,
      exposed_count,
      prediction_count,
      profile_count,
      coverage,
      standard_error,
      eligibility_reason,
      metrics
    ) values (
      target_window_id,
      target_genome_id,
      'GLOBAL',
      'GLOBAL',
      null,
      null,
      null,
      null,
      0,
      0,
      0,
      0,
      0.0,
      null,
      'NO_MATURE_COMPARABLE_OUTCOMES',
      jsonb_build_object(
        'metricVersion', evaluation_window.metric_version,
        'rewardVersion', evaluation_window.reward_version,
        'counterfactualLimit', 'UNEXPOSED_SHADOW_ITEMS_UNLABELLED'
      )
    );
    inserted_count := 1;
  end if;

  return jsonb_build_object('evaluationsInserted', inserted_count);
end;
$$;$reviewed_evaluation_source$;
    end if;
    for patch in select * from (values
      ('rank', $old$from public.events as event
    join private.prediction_runs as historical_run$old$,
        $new$from private.prediction_outcome_events_v1(target_profile_id, request_time, request_time) as event
    join private.prediction_runs as historical_run$new$, 1),
      ('rank', $old$'scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1'$old$,
        $new$'scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1+outcome-attribution-v1'$new$, 1),
      ('rank', $old$'scenario-memory-v1+resurfacing-v1'$old$,
        $new$'scenario-memory-v1+resurfacing-v1+outcome-attribution-v1'$new$, 1),
      ('rank', $old$and event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.occurred_at <= request_time$old$,
        $new$and event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.created_at <= request_time
      and event.occurred_at <= request_time$new$, 1),
      ('eval', $old$  inserted_count integer := 0;$old$,
        $new$  inserted_count integer := 0;
  evidence_cutoff timestamptz := clock_timestamp();$new$, 1),
      ('eval', $old$  reversed_events as ($old$,
        $new$  effective_outcomes as materialized (
    select outcome.*
    from (select distinct profile_id from eligible_runs) as eligible_profile
    cross join lateral private.prediction_outcome_events_v1(
      eligible_profile.profile_id, evaluation_window.outcome_cutoff, evidence_cutoff
    ) as outcome
  ),
  reversed_events as ($new$, 1),
      ('eval', $old$and event.occurred_at <= evaluation_window.outcome_cutoff$old$,
        $new$and event.occurred_at <= evaluation_window.outcome_cutoff
      and event.created_at <= evidence_cutoff$new$, 2),
      ('eval', $old$join public.events as outcome$old$,
        $new$join effective_outcomes as outcome$new$, 1),
      ('eval', $old$'rewardVersion', evaluation_window.reward_version,$old$,
        $new$'rewardVersion', evaluation_window.reward_version,
        'outcomeAttributionVersion', 'outcome-attribution-v1',
        'evidenceCutoff', evidence_cutoff,$new$, 2)
    ) as changes(reader,old_source,new_source,expected_matches)
    where reader=case when target='private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
      then 'rank' else 'eval' end
    loop
      matches := (length(definition)-length(replace(definition,patch.old_source,'')))/length(patch.old_source);
      if matches<>patch.expected_matches then
        raise exception 'Late outcome forward: unexpected source anchor in % (expected %, found %)',
          target,patch.expected_matches,matches;
      end if;
      definition := replace(definition,patch.old_source,patch.new_source);
    end loop;
    execute definition;
  end loop;
end;
$forward$;
