-- #232B: owner-only descriptive replay of acknowledged Shared round commands.
-- Accepted timestamps are not commit-visibility proofs. This projection is
-- never admitted to historical features, scalar rewards or existing readers.
create index shared_round_receipts_outcome_prefix_v1_idx
  on private.shared_rating_round_receipts
    (round_id, ((result#>>'{round,revision}')::integer), created_at);

create function private.shared_rating_round_outcome_v1(
  target_profile_id uuid,
  target_round_id uuid,
  outcome_cutoff timestamptz,
  evidence_cutoff timestamptz,
  maturity_interval interval
)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare
  root_item_id uuid;
  receipt_count integer;
  snapshot jsonb;
  source_command_id uuid;
  source_revision integer;
  source_accepted_at timestamptz;
  anchor_at timestamptz;
  mature_at timestamptz;
  interval_seconds numeric;
  response jsonb;
  recorded_origin jsonb;
  projected_responses jsonb := '[]';
  attribution_status text;
  attribution_prediction_id uuid;
  proof_event_id uuid;
  proof_occurred_at timestamptz;
  proof_available_at timestamptz;
  participant_count integer;
  rated_count integer := 0;
  unanswered_count integer := 0;
  unknown_count integer := 0;
  cleared_count integer := 0;
  attributed_rating_count integer := 0;
  rating_min integer;
  rating_max integer;
  rating_value integer;
  complete_vector boolean;
  is_mature boolean;
  vector_status text;
begin
  if target_profile_id is null or target_round_id is null
    or outcome_cutoff is null or evidence_cutoff is null
    or not isfinite(outcome_cutoff) or not isfinite(evidence_cutoff)
    or outcome_cutoff>clock_timestamp() or evidence_cutoff>clock_timestamp()
    or maturity_interval is null or not isfinite(maturity_interval)
    or extract(year from maturity_interval)<>0 or extract(month from maturity_interval)<>0
    or maturity_interval<interval '0 seconds' or maturity_interval>interval '90 days' then
    raise exception 'Invalid Shared round replay boundary' using errcode='22023';
  end if;
  interval_seconds := extract(epoch from maturity_interval);
  perform 1 from public.profiles where id=target_profile_id and profile_type='SHARED';
  if not found then raise exception 'Shared round replay requires Shared Profile' using errcode='22023'; end if;

  -- Only identity/scope is read from the current root. Its mutable revision,
  -- state, participants and today's membership never enter historical input.
  select item_id into root_item_id from private.shared_rating_rounds
    where id=target_round_id and profile_id=target_profile_id;
  if not found then
    if exists(select 1 from private.shared_rating_rounds where id=target_round_id) then
      raise exception 'Shared round replay scope mismatch' using errcode='22023';
    end if;
    return null;
  end if;
  select count(*) into receipt_count from (
    select 1 from private.shared_rating_round_receipts where round_id=target_round_id limit 4097
  ) bounded;
  if receipt_count>4096 then
    raise exception 'Shared round receipt limit exceeded' using errcode='55000';
  end if;

  -- Receipt revision is command order, including timestamp ties/regressions.
  -- A missing, duplicate or cutoff-excluded revision stops the entire prefix;
  -- a later matching timestamp must never jump over invisible prior evidence.
  with ordered as (
    select c.*, (c.result#>>'{round,revision}')::integer as receipt_revision,
      row_number() over(order by (c.result#>>'{round,revision}')::integer,c.command_id) as ordinal,
      count(*) over(partition by (c.result#>>'{round,revision}')::integer) as revision_count
    from private.shared_rating_round_receipts c where c.round_id=target_round_id
  ), prefixes as (
    select o.*,
      bool_and(coalesce(receipt_revision=ordinal and revision_count=1 and isfinite(created_at)
        and created_at<=outcome_cutoff and created_at<=evidence_cutoff,false))
        over(order by receipt_revision,command_id rows unbounded preceding) as included,
      max(created_at) over(order by receipt_revision,command_id rows unbounded preceding) as prefix_anchor
    from ordered o
  )
  select result->'round',command_id,receipt_revision,created_at,prefix_anchor
    into snapshot,source_command_id,source_revision,source_accepted_at,anchor_at
    from prefixes where included order by receipt_revision desc,command_id desc limit 1;
  if not found then return null; end if;
  if snapshot->>'roundId' is distinct from target_round_id::text
    or snapshot->>'profileId' is distinct from target_profile_id::text
    or snapshot->>'itemId' is distinct from root_item_id::text
    or coalesce(snapshot->>'state','') not in ('PENDING','COMPLETED','CANCELLED')
    or snapshot->'version' is distinct from '1'::jsonb
    or coalesce((snapshot->>'participantSetVersion')::integer,0) not between 1 and 4096
    or jsonb_typeof(snapshot->'participants') is distinct from 'array'
    or jsonb_typeof(snapshot->'responses') is distinct from 'array'
    or jsonb_array_length(snapshot->'participants') not between 2 and 32
    or jsonb_array_length(snapshot->'responses')<>jsonb_array_length(snapshot->'participants') then
    raise exception 'Shared round receipt snapshot unavailable' using errcode='55000';
  end if;
  participant_count := jsonb_array_length(snapshot->'participants');
  if (select count(distinct p->>'actorUserId') from jsonb_array_elements(snapshot->'participants') p)<>participant_count
    or (select count(distinct a->>'actorUserId') from jsonb_array_elements(snapshot->'responses') a)<>participant_count then
    raise exception 'Shared round participant snapshot unavailable' using errcode='55000';
  end if;

  for response in select value from jsonb_array_elements(snapshot->'responses') loop
    if coalesce(response->>'status','') not in ('RATED','UNANSWERED','UNKNOWN','CLEARED')
      or not exists(select 1 from jsonb_array_elements(snapshot->'participants') p
        where p->>'actorUserId'=response->>'actorUserId') then
      raise exception 'Shared round response snapshot unavailable' using errcode='55000';
    end if;
    if response->>'status'='UNANSWERED' and (
      response->'rating' is distinct from 'null'::jsonb
      or response->'responseRevision' is distinct from 'null'::jsonb
      or response->'receivedAt' is distinct from 'null'::jsonb
      or response->'origin' is distinct from 'null'::jsonb) then
      raise exception 'Shared round unanswered evidence unavailable' using errcode='55000';
    end if;
    if response->>'status'<>'UNANSWERED' then
      -- Tie every frozen answer to its own immutable responding command, actor
      -- and participant set. No participant may borrow another actor's trace.
      perform 1 from private.shared_rating_round_responses a
        join private.shared_rating_round_receipts c on c.round_id=a.round_id
          and (c.result#>>'{round,revision}')::integer=a.revision
        where a.round_id=target_round_id and a.revision=(response->>'responseRevision')::integer
          and a.revision<=source_revision
          and a.participant_set_version=(snapshot->>'participantSetVersion')::integer
          and a.actor_user_id=(response->>'actorUserId')::uuid
          and a.status=response->>'status'
          and a.rating is not distinct from (response->>'rating')::integer
          and a.origin is not distinct from nullif(response->'origin','null'::jsonb)
          and a.received_at=(response->>'receivedAt')::timestamptz
          and a.received_at=c.created_at
          and c.actor_user_id=a.actor_user_id and c.profile_id=target_profile_id
          and c.command->>'kind'=case when a.status='CLEARED' then 'CLEAR_RESPONSE' else 'SET_RESPONSE' end;
      if not found then raise exception 'Shared round response evidence unavailable' using errcode='55000'; end if;
    end if;
    recorded_origin := nullif(response->'origin','null'::jsonb);
    attribution_status := case when recorded_origin is null then 'UNRANKED' else 'UNATTRIBUTED' end;
    attribution_prediction_id := null;
    proof_event_id := null; proof_occurred_at := null; proof_available_at := null;
    if recorded_origin->>'status'='VALIDATED_TRACE' then
      -- Acceptance-time validation is frozen; the foundation did not retain a
      -- proof Event ID. Do not invent one or retroactively rewrite that receipt.
      attribution_status := 'VALIDATED_TRACE';
      attribution_prediction_id := (recorded_origin->>'predictionId')::uuid;
    elsif recorded_origin->>'status'='UNATTRIBUTED' then
      select e.id,e.occurred_at,e.created_at,r.id
        into proof_event_id,proof_occurred_at,proof_available_at,attribution_prediction_id
        from private.prediction_runs r
        join private.prediction_candidates c on c.prediction_id=r.id
          and c.item_id=root_item_id and c.selected_for_delivery
        join public.events e on e.prediction_id=r.id and e.profile_id=target_profile_id
          and e.actor_user_id=(response->>'actorUserId')::uuid and e.item_id=root_item_id
          and e.session_id=r.session_id and e.discovery_mode=r.discovery_mode
          and e.event_type='ITEM_IMPRESSION'
        where r.id=(recorded_origin->>'claimedPredictionId')::uuid
          and r.profile_id=target_profile_id and r.actor_user_id=(response->>'actorUserId')::uuid
          and r.session_id=(recorded_origin->>'sessionId')::uuid
          and r.discovery_mode=recorded_origin->>'discoveryMode'
          and r.requested_at<=(response->>'receivedAt')::timestamptz
          and e.occurred_at between r.requested_at and (response->>'receivedAt')::timestamptz
          and e.created_at<=evidence_cutoff
        order by e.created_at,e.id limit 1;
      if found then
        attribution_status := 'LATE_EXPOSURE_V1';
      end if;
    end if;
    projected_responses := projected_responses||jsonb_build_array(response||jsonb_build_object(
      'attribution',jsonb_build_object('status',attribution_status,'predictionId',attribution_prediction_id,
        'proofEventId',proof_event_id,'proofOccurredAt',proof_occurred_at,'proofAvailableAt',proof_available_at,
        'proofAvailabilityBasis',case when attribution_status='LATE_EXPOSURE_V1'
          then 'STORED_EVENT_CREATED_AT' else null end)));
    case response->>'status'
      when 'RATED' then
        rated_count := rated_count+1;
        rating_value := (response->>'rating')::integer;
        rating_min := least(rating_min,rating_value); rating_max := greatest(rating_max,rating_value);
        if attribution_status in ('VALIDATED_TRACE','LATE_EXPOSURE_V1') then
          attributed_rating_count := attributed_rating_count+1;
        end if;
      when 'UNANSWERED' then unanswered_count := unanswered_count+1;
      when 'UNKNOWN' then unknown_count := unknown_count+1;
      when 'CLEARED' then cleared_count := cleared_count+1;
    end case;
  end loop;
  complete_vector := snapshot->>'state'='COMPLETED' and rated_count=participant_count;
  -- Fixed elapsed seconds avoid session timezone/DST-dependent DAY arithmetic.
  -- The prefix maximum also prevents a clock-regressed correction from making
  -- a round mature earlier than an already accepted prior command.
  mature_at := anchor_at+interval_seconds*interval '1 second';
  is_mature := mature_at<=least(outcome_cutoff,evidence_cutoff);
  vector_status := case when snapshot->>'state'='CANCELLED' then 'CANCELLED'
    when not complete_vector then 'INCOMPLETE'
    when not is_mature then 'IMMATURE' else 'READY_FOR_VECTOR_REVIEW' end;
  return jsonb_build_object(
    'contractVersion','shared-round-outcome-v1','sourceBasis','COMMAND_RECEIPT_PREFIX',
    'availabilityBasis','SERVER_COMMAND_ACCEPTED_AT','historicalFeatureEligible',false,
    'membershipValidity','HISTORICAL_MEMBERSHIP_UNKNOWN','commitVisibility','UNKNOWN',
    'outcomeCutoff',outcome_cutoff,'evidenceCutoff',evidence_cutoff,
    'source',jsonb_build_object('commandId',source_command_id,'revision',source_revision,
      'participantSetVersion',(snapshot->>'participantSetVersion')::integer,'acceptedAt',source_accepted_at),
    'round',snapshot,'responses',projected_responses,
    'maturity',jsonb_build_object('intervalSeconds',interval_seconds,'anchorAt',anchor_at,
      'matureAt',mature_at,'isMature',is_mature),
    'vectorStatus',vector_status,
    'coverage',jsonb_build_object('participantCount',participant_count,'ratedCount',rated_count,
      'unansweredCount',unanswered_count,'unknownCount',unknown_count,'clearedCount',cleared_count,
      'attributedRatingCount',attributed_rating_count,'eligibleVectorResponseCount',
        case when vector_status='READY_FOR_VECTOR_REVIEW' then attributed_rating_count else 0 end),
    'descriptive',jsonb_build_object('minRating',case when complete_vector then rating_min else null end,
      'ratingSpread',case when complete_vector then rating_max-rating_min else null end),
    'groupReward',null,'learnable',false);
end;
$$;

revoke all on function private.shared_rating_round_outcome_v1(uuid,uuid,timestamptz,timestamptz,interval)
  from public,anon,authenticated,service_role;
