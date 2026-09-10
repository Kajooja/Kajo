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
