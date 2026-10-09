-- #232F: an owner-only, actually observed pre-first-response input snapshot.
-- No Prediction consumer is integrated here. Source selection is caller-declared;
-- neither stored request clocks nor this transaction's own writes prove commits.
create table private.shared_round_prediction_inputs (
  id uuid primary key,
  profile_id uuid not null,
  round_id uuid not null,
  actor_user_id uuid not null,
  target_source_command_id uuid not null references private.shared_rating_round_receipts(command_id) on delete cascade,
  target_revision integer not null check(target_revision between 1 and 4096),
  copied_actor_ids uuid[] not null check(cardinality(copied_actor_ids) between 2 and 135681
    and array_position(copied_actor_ids,null) is null),
  origin_prediction_ids uuid[] not null check(cardinality(origin_prediction_ids)<=2560
    and array_position(origin_prediction_ids,null) is null),
  request jsonb not null check(jsonb_typeof(request)='object' and octet_length(request::text)<=4096),
  result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=8388608),
  observed_at timestamptz not null check(isfinite(observed_at))
);
create index shared_round_prediction_inputs_round_idx on private.shared_round_prediction_inputs(round_id);
create index shared_round_prediction_inputs_profile_idx on private.shared_round_prediction_inputs(profile_id);
create index shared_round_prediction_inputs_target_source_idx on private.shared_round_prediction_inputs(target_source_command_id);
create index shared_round_prediction_inputs_copied_actor_idx on private.shared_round_prediction_inputs using gin(copied_actor_ids);
create index shared_round_prediction_inputs_origin_prediction_idx on private.shared_round_prediction_inputs using gin(origin_prediction_ids);

create table private.shared_round_prediction_input_sources (
  input_id uuid not null references private.shared_round_prediction_inputs(id) on delete cascade,
  source_capture_id uuid not null references private.shared_round_outcome_captures(id) on delete cascade,
  primary key(input_id,source_capture_id)
);
create index shared_round_prediction_input_sources_source_idx on private.shared_round_prediction_input_sources(source_capture_id);
alter table private.shared_round_prediction_inputs enable row level security;
alter table private.shared_round_prediction_input_sources enable row level security;
revoke all on table private.shared_round_prediction_inputs,private.shared_round_prediction_input_sources
  from public,anon,authenticated,service_role;
create trigger shared_round_prediction_input_immutable before update on private.shared_round_prediction_inputs
  for each row execute function private.deny_shared_round_evidence_update_v1();
create trigger shared_round_prediction_input_source_immutable before update on private.shared_round_prediction_input_sources
  for each row execute function private.deny_shared_round_evidence_update_v1();

-- Removing a binding independently would leave copied evidence without its
-- source erasure dependency. Parent deletion runs before its edge FK cascades.
create function private.deny_detached_shared_round_prediction_input_source_v1()
returns trigger language plpgsql volatile security invoker set search_path='' as $$
begin
  if exists(select 1 from private.shared_round_prediction_inputs i where i.id=old.input_id) then
    raise exception 'Shared prediction input source binding is immutable while its parent exists' using errcode='55000'; end if;
  return old;
end;
$$;
create trigger shared_round_prediction_input_source_delete_guard before delete on private.shared_round_prediction_input_sources
  for each row execute function private.deny_detached_shared_round_prediction_input_source_v1();

create function private.get_shared_round_prediction_input_v1(target_capture_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select result from private.shared_round_prediction_inputs where id=target_capture_id;
$$;

-- A source DELETE owns its row lock before this trigger runs. Allocators acquire
-- sorted KEY SHARE locks on those same rows before creating dependency edges.
-- Delete the whole copied artifact before FK edge cascades; never take a late
-- lifecycle lock from an already-started parent/root deletion.
create function private.delete_shared_round_prediction_inputs_for_source_v1()
returns trigger language plpgsql volatile security invoker set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared prediction input source deletion requires READ COMMITTED' using errcode='25001'; end if;
  delete from private.shared_round_prediction_inputs i where i.id in (
    select s.input_id from private.shared_round_prediction_input_sources s where s.source_capture_id=old.id);
  return old;
end;
$$;
create trigger delete_shared_round_prediction_inputs_for_source_v1
  before delete on private.shared_round_outcome_captures
  for each row execute function private.delete_shared_round_prediction_inputs_for_source_v1();

create function private.capture_shared_round_prediction_input_v1(
  capture_id uuid,target_profile_id uuid,target_round_id uuid,expected_revision integer,source_capture_ids uuid[]
)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' set extra_float_digits='3' as $$
declare
  actor uuid;
  members jsonb;
  canonical_source_ids uuid[];
  request jsonb;
  prior private.shared_round_prediction_inputs%rowtype;
  target private.shared_rating_rounds%rowtype;
  receipt private.shared_rating_round_receipts%rowtype;
  source private.shared_round_outcome_captures%rowtype;
  last_receipt private.shared_rating_round_receipts%rowtype;
  snapshot jsonb;
  commands jsonb := '[]';
  command_ids jsonb := '[]';
  sources jsonb := '[]';
  source_round_ids uuid[] := '{}';
  source_experience_ids uuid[] := '{}';
  copied_actor_ids uuid[] := '{}';
  origin_prediction_ids uuid[] := '{}';
  source_id uuid;
  source_experience_id uuid;
  origin_ref text;
  identity_key text;
  latest_source_available_at timestamptz;
  observed_at timestamptz;
  result jsonb;
  receipt_count integer;
  receipt_bytes bigint;
  revision integer := 0;
  previous_participant_version integer := 0;
  previous_accepted_at timestamptz;
  response jsonb;
  participant jsonb;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  -- FIRST body action, before identity, advisory-ID, membership or parent locks.
  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);
  if capture_id is null or target_profile_id is null or target_round_id is null
    or expected_revision is null or expected_revision not between 1 and 4096
    or source_capture_ids is null or coalesce(array_ndims(source_capture_ids),1)<>1
    or cardinality(source_capture_ids)>16 then
    raise exception 'Invalid Shared prediction input boundary' using errcode='22023'; end if;
  if array_position(source_capture_ids,null) is not null
    or (select count(distinct s.id) from unnest(source_capture_ids) s(id))<>cardinality(source_capture_ids) then
    raise exception 'Invalid Shared prediction input source set' using errcode='22023'; end if;
  select coalesce(array_agg(s.id order by s.id),'{}'::uuid[]) into canonical_source_ids from unnest(source_capture_ids) s(id);
  actor := (select auth.uid());
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  request := jsonb_build_object('captureId',capture_id,'actorUserId',actor,'profileId',target_profile_id,
    'roundId',target_round_id,'expectedRevision',expected_revision,'sourceCaptureIds',to_jsonb(canonical_source_ids));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-round-prediction-input-id:'||capture_id::text,0));
  -- Every exact retry reauthorizes today's actor before returning old evidence.
  -- It deliberately does not require today's roster/revision/answers to be old.
  members := private.lock_shared_round_members_v1(target_profile_id);
  select i.* into prior from private.shared_round_prediction_inputs i where i.id=capture_id;
  if found then
    if prior.request<>request or prior.actor_user_id<>actor then
      raise exception 'Shared prediction input ID payload mismatch' using errcode='22023'; end if;
    return prior.result;
  end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared prediction input allocation requires READ COMMITTED' using errcode='25001'; end if;
  if jsonb_array_length(members) not between 2 and 32 then
    raise exception 'Shared prediction input requires complete supported enrollment' using errcode='55000'; end if;
  select r.* into target from private.shared_rating_rounds r
    where r.id=target_round_id and r.profile_id=target_profile_id for update;
  if not found then raise exception 'Shared prediction input target unavailable' using errcode='55000'; end if;
  if target.current_state<>'PENDING' or target.revision<>expected_revision or target.participants is distinct from members then
    raise exception 'Shared prediction input target head or enrollment mismatch' using errcode='55000'; end if;
  -- No-answer means the whole experience, not a reset participant-set version.
  -- Receipts also prevent an owner-deleted response row from fabricating freshness.
  if exists(select 1 from private.shared_rating_round_responses r where r.round_id=target_round_id)
    or exists(select 1 from private.shared_rating_round_receipts r where r.round_id=target_round_id
      and r.command->>'kind' in ('SET_RESPONSE','CLEAR_RESPONSE')) then
    raise exception 'Shared prediction input target has prior response evidence' using errcode='55000'; end if;
  if (select count(*) from private.shared_round_prediction_inputs i where i.round_id=target_round_id)>=16 then
    raise exception 'Shared prediction input capture limit reached' using errcode='54000'; end if;
  select count(*),coalesce(sum(octet_length(bounded.command::text)+octet_length(bounded.result::text)+256),0)
    into receipt_count,receipt_bytes from (
    select c.command,c.result from private.shared_rating_round_receipts c where c.round_id=target_round_id limit 4097) bounded;
  if receipt_count<>expected_revision then
    raise exception 'Shared prediction input receipt prefix unavailable' using errcode='55000'; end if;
  if receipt_bytes>8388608 then
    raise exception 'Shared prediction input prefix snapshot limit exceeded' using errcode='54000'; end if;
  snapshot := private.shared_rating_round_snapshot_v1(target_round_id,members);
  copied_actor_ids := array[actor];
  for receipt in select c.* from private.shared_rating_round_receipts c where c.round_id=target_round_id
    order by (c.result#>>'{round,revision}')::integer,c.command_id loop
    revision := revision+1;
    if jsonb_typeof(receipt.command) is distinct from 'object'
      or receipt.command->'version' is distinct from '1'::jsonb
      or receipt.result->'version' is distinct from '1'::jsonb
      or receipt.result#>'{round,version}' is distinct from '1'::jsonb
      or jsonb_typeof(receipt.command->'expectedRevision') is distinct from 'number' then
      raise exception 'Shared prediction input receipt contract mismatch' using errcode='55000'; end if;
    foreach identity_key in array array['commandId','actorUserId','roundId','profileId'] loop
      if jsonb_typeof(receipt.command->identity_key) is distinct from 'string'
        or receipt.command->>identity_key !~* uuid_pattern then
        raise exception 'Shared prediction input command identity malformed' using errcode='55000'; end if;
    end loop;
    if receipt.profile_id<>target_profile_id or receipt.result#>>'{round,roundId}' is distinct from target_round_id::text
      or receipt.result#>>'{round,profileId}' is distinct from target_profile_id::text
      or receipt.result#>>'{round,itemId}' is distinct from target.item_id::text
      or receipt.result#>>'{round,experienceId}' is distinct from target.experience_id::text
      or receipt.result->>'commandId' is distinct from receipt.command_id::text
      or receipt.result#>>'{round,revision}' is distinct from revision::text
      or jsonb_typeof(receipt.command->'expectedRevision') is distinct from 'number'
      or (receipt.command->>'expectedRevision')::numeric is distinct from (revision-1)::numeric
      or (receipt.command->>'commandId')::uuid is distinct from receipt.command_id
      or (receipt.command->>'actorUserId')::uuid is distinct from receipt.actor_user_id
      or (receipt.command->>'roundId')::uuid is distinct from target_round_id
      or (receipt.command->>'profileId')::uuid is distinct from target_profile_id
      or receipt.command->>'kind' is distinct from (case when revision=1 then 'OPEN_ROUND' else 'RECONFIRM_ROUND' end)
      or receipt.result#>>'{round,state}' is distinct from 'PENDING'
      or jsonb_typeof(receipt.result#>'{round,participants}') is distinct from 'array'
      or (case when jsonb_typeof(receipt.result#>'{round,participants}')='array' then jsonb_array_length(receipt.result#>'{round,participants}') else -1 end) not between 2 and 32
      or jsonb_typeof(receipt.result#>'{round,responses}') is distinct from 'array'
      or receipt.result#>>'{round,participantSetVersion}' is distinct from (previous_participant_version+1)::text
      or not isfinite(receipt.created_at) or receipt.created_at>clock_timestamp()
      or (previous_accepted_at is not null and receipt.created_at<previous_accepted_at)
      or (receipt.result#>>'{round,updatedAt}')::timestamptz is distinct from receipt.created_at then
      raise exception 'Shared prediction input receipt prefix mismatch' using errcode='55000'; end if;
    if exists(select 1 from jsonb_array_elements(receipt.result#>'{round,responses}') a
      where a->>'status' is distinct from 'UNANSWERED' or a->'rating' is distinct from 'null'::jsonb
        or a->'responseRevision' is distinct from 'null'::jsonb) then
      raise exception 'Shared prediction input receipt has response evidence' using errcode='55000'; end if;
    for participant in select value from jsonb_array_elements(receipt.result#>'{round,participants}') loop
      if participant->>'actorUserId' !~* uuid_pattern or participant->>'membershipGeneration' !~* uuid_pattern
        or participant->>'actorUserId' is null or participant->>'membershipGeneration' is null then
        raise exception 'Shared prediction input receipt enrollment malformed' using errcode='55000'; end if;
      copied_actor_ids := array_append(copied_actor_ids,(participant->>'actorUserId')::uuid);
    end loop;
    copied_actor_ids := array_append(copied_actor_ids,receipt.actor_user_id);
    commands := commands||jsonb_build_array(jsonb_build_object('commandId',receipt.command_id,
      'actorUserId',receipt.actor_user_id,'acceptedAt',receipt.created_at,'command',receipt.command,'result',receipt.result));
    command_ids := command_ids||jsonb_build_array(receipt.command_id);
    previous_participant_version := previous_participant_version+1;
    previous_accepted_at := receipt.created_at;
    last_receipt := receipt;
  end loop;
  if revision<>expected_revision or last_receipt.result->'round' is distinct from snapshot
    or previous_participant_version<>target.participant_set_version then
    raise exception 'Shared prediction input current receipt mismatch' using errcode='55000'; end if;

  -- All selected existing immutable rows are actually read, in sorted lock order.
  -- No new historical outcome reader or prediction backfill is invoked here.
  for source_id in select unnest(canonical_source_ids) loop
    select c.* into source from private.shared_round_outcome_captures c where c.id=source_id for key share;
    if not found then raise exception 'Shared prediction input source unavailable' using errcode='55000'; end if;
    observed_at := clock_timestamp();
    if source.profile_id<>target_profile_id or source.round_id=target_round_id
      or source.round_id=any(source_round_ids) or not isfinite(source.observed_at) or source.observed_at>observed_at
      or source.result->>'contractVersion' is distinct from 'shared-round-capture-v1'
      or source.result->>'sourceBasis' is distinct from 'SERVER_VISIBLE_COMMAND_RECEIPT_PREFIX'
      or source.result->>'usage' is distinct from 'OUTCOME_EVIDENCE_ONLY'
      or source.result->>'captureId' is distinct from source.id::text
      or source.result->'historicalFeatureEligible' is distinct from 'false'::jsonb
      or source.result->'learnable' is distinct from 'false'::jsonb
      or source.result->'groupReward' is distinct from 'null'::jsonb
      or source.result->>'outcomeDigest' is distinct from md5((source.result->'outcome')::text)
      or source.result->>'sourceCommandId' is distinct from source.source_command_id::text
      or source.result->>'sourceRevision' is distinct from source.source_revision::text
      or source.result#>>'{outcome,contractVersion}' is distinct from 'shared-round-outcome-v1'
      or source.result#>>'{outcome,round,profileId}' is distinct from target_profile_id::text
      or source.result#>>'{outcome,round,roundId}' is distinct from source.round_id::text
      or source.result#>>'{outcome,round,itemId}' is distinct from source.item_id::text
      or source.result#>>'{outcome,source,commandId}' is distinct from source.source_command_id::text
      or source.result#>>'{outcome,source,revision}' is distinct from source.source_revision::text
      or source.result#>'{outcome,round,participants}' is distinct from members
      or jsonb_typeof(source.result#>'{outcome,responses}') is distinct from 'array'
      or (case when jsonb_typeof(source.result#>'{outcome,responses}')='array' then jsonb_array_length(source.result#>'{outcome,responses}') else -1 end)<>jsonb_array_length(members)
      or source.request->>'captureId' is distinct from source.id::text
      or source.request->>'profileId' is distinct from source.profile_id::text
      or source.request->>'roundId' is distinct from source.round_id::text
      or jsonb_typeof(source.result->'visibleCommandIds') is distinct from 'array'
      or (case when jsonb_typeof(source.result->'visibleCommandIds')='array' then jsonb_array_length(source.result->'visibleCommandIds') else -1 end)<>source.source_revision then
      raise exception 'Shared prediction input source binding or enrollment mismatch' using errcode='55000'; end if;
    if octet_length(commands::text)+octet_length(sources::text)+octet_length(source.result::text)>8388608 then
      raise exception 'Shared prediction input source snapshot limit exceeded' using errcode='54000'; end if;
    begin
      if (source.result->>'observedAt')::timestamptz is distinct from source.observed_at
        or source.result#>>'{outcome,outcomeCutoff}' is null or source.result#>>'{outcome,evidenceCutoff}' is null
        or not isfinite((source.result#>>'{outcome,outcomeCutoff}')::timestamptz)
        or not isfinite((source.result#>>'{outcome,evidenceCutoff}')::timestamptz)
        or (source.result#>>'{outcome,outcomeCutoff}')::timestamptz>source.observed_at
        or (source.result#>>'{outcome,evidenceCutoff}')::timestamptz>source.observed_at
        or source.result#>>'{outcome,round,experienceId}' !~* uuid_pattern
        or (source.result#>>'{outcome,outcomeCutoff}')::timestamptz is distinct from (source.request->>'outcomeCutoff')::timestamptz
        or (source.result#>>'{outcome,evidenceCutoff}')::timestamptz is distinct from (source.request->>'evidenceCutoff')::timestamptz then
        raise exception 'Shared prediction input source observation boundary mismatch' using errcode='55000'; end if;
      source_experience_id := (source.result#>>'{outcome,round,experienceId}')::uuid;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception 'Shared prediction input source observation boundary malformed' using errcode='55000';
    end;
    if source_experience_id is null or source_experience_id=target.experience_id or source_experience_id=any(source_experience_ids)
      or not exists(select 1 from private.shared_rating_round_receipts c where c.command_id=source.source_command_id
        and c.round_id=source.round_id and c.profile_id=source.profile_id
        and c.result#>>'{round,revision}'=source.source_revision::text
        and c.result->'round'=source.result#>'{outcome,round}') then
      raise exception 'Shared prediction input source experience or receipt mismatch' using errcode='55000'; end if;
    source_round_ids := array_append(source_round_ids,source.round_id);
    source_experience_ids := array_append(source_experience_ids,source_experience_id);
    -- Track every well-formed copied Prediction reference for conservative
    -- erasure only. An UNATTRIBUTED claim gains no quality or feature credit.
    for participant in select value from jsonb_array_elements(source.result#>'{outcome,round,participants}') loop
      copied_actor_ids := array_append(copied_actor_ids,(participant->>'actorUserId')::uuid);
    end loop;
    if (select count(distinct a.value->>'actorUserId') from jsonb_array_elements(source.result#>'{outcome,responses}') a)<>jsonb_array_length(members) then
      raise exception 'Shared prediction input source response enrollment mismatch' using errcode='55000'; end if;
    for response in select value from jsonb_array_elements(source.result#>'{outcome,responses}') loop
      if response->>'actorUserId' is null or not (members @> jsonb_build_array(jsonb_build_object('actorUserId',response->>'actorUserId'))) then
        raise exception 'Shared prediction input source response enrollment mismatch' using errcode='55000'; end if;
      if response#>>'{attribution,status}' in ('VALIDATED_TRACE','LATE_EXPOSURE_V1') then
        if response#>>'{attribution,predictionId}' is null or response#>>'{attribution,predictionId}' !~* uuid_pattern then
          raise exception 'Shared prediction input source origin malformed' using errcode='55000'; end if;
      end if;
    end loop;
    for origin_ref in
      select ref.value from jsonb_array_elements(source.result#>'{outcome,responses}') p
        cross join lateral (values (p.value#>>'{origin,predictionId}'),(p.value#>>'{origin,claimedPredictionId}'),
          (p.value#>>'{attribution,predictionId}')) ref(value) where ref.value ~* uuid_pattern
      union all select ref.value from jsonb_array_elements(source.result#>'{outcome,round,responses}') p
        cross join lateral (values (p.value#>>'{origin,predictionId}'),(p.value#>>'{origin,claimedPredictionId}')) ref(value)
        where ref.value ~* uuid_pattern loop
      origin_prediction_ids := array_append(origin_prediction_ids,origin_ref::uuid);
    end loop;
    latest_source_available_at := greatest(latest_source_available_at,source.observed_at,
      (source.result#>>'{outcome,outcomeCutoff}')::timestamptz,(source.result#>>'{outcome,evidenceCutoff}')::timestamptz);
    sources := sources||jsonb_build_array(source.result);
  end loop;
  select array_agg(distinct a.id order by a.id) into copied_actor_ids from unnest(copied_actor_ids) a(id);
  select coalesce(array_agg(distinct p.id order by p.id),'{}'::uuid[]) into origin_prediction_ids from unnest(origin_prediction_ids) p(id);
  observed_at := clock_timestamp();
  if not isfinite(observed_at) or previous_accepted_at>observed_at or latest_source_available_at>observed_at then
    raise exception 'Shared prediction input final observation boundary regressed' using errcode='55000'; end if;
  result := jsonb_build_object('contractVersion','shared-round-prediction-input-v1','captureId',capture_id,
    'capturedByActorUserId',actor,'observedAt',observed_at,'sourceBasis','SERVER_VISIBLE_PRE_RESPONSE_CONTEXT',
    'selectionBasis','CALLER_DECLARED_SOURCE_CAPTURE_IDS','usage','INPUT_CAPTURE_ONLY',
    'predictorConsumption','NOT_RECORDED','consumerPredictionId',null,
    'membershipValidity','CURRENT_FULL_ENROLLMENT_AT_CAPTURE','commitVisibility','OWN_TRANSACTION_MVCC_VISIBLE_NOT_COMMIT_TIME',
    'historicalFeatureEligible',false,'learnable',false,'groupReward',null,
    'target',jsonb_build_object('round',last_receipt.result->'round','sourceCommandId',last_receipt.command_id,
      'sourceRevision',expected_revision,'visibleCommandIds',command_ids,'visibleCommands',commands,'prefixDigest',md5(commands::text)),
    'sources',sources);
  result := result||jsonb_build_object('inputDigest',md5(result::text));
  if octet_length(request::text)>4096 or octet_length(result::text)>8388608 then
    raise exception 'Shared prediction input snapshot limit exceeded' using errcode='54000'; end if;
  insert into private.shared_round_prediction_inputs(id,profile_id,round_id,actor_user_id,target_source_command_id,
    target_revision,copied_actor_ids,origin_prediction_ids,request,result,observed_at)
    values(capture_id,target_profile_id,target_round_id,actor,last_receipt.command_id,expected_revision,
      copied_actor_ids,origin_prediction_ids,request,result,observed_at);
  insert into private.shared_round_prediction_input_sources(input_id,source_capture_id)
    select capture_id,s.id from unnest(canonical_source_ids) s(id);
  return result;
end;
$$;
revoke all on function private.get_shared_round_prediction_input_v1(uuid),
  private.delete_shared_round_prediction_inputs_for_source_v1(),
  private.deny_detached_shared_round_prediction_input_source_v1(),
  private.capture_shared_round_prediction_input_v1(uuid,uuid,uuid,integer,uuid[])
  from public,anon,authenticated,service_role;

-- Only the declared post-guard erasure block changes an existing function body.
-- Drift aborts the migration; CREATE OR REPLACE preserves its existing identity.
do $prediction_input_erasure$
declare
  previous record;
  replacement text;
  definition text;
  old_anchor constant text := $input_anchor$  -- All guards precede writes. No permission ever authorizes a genome, window,
  -- decision, assignment or UPDATE, and all permitted row keys are exact.
$input_anchor$;
  inserted_block constant text := $input_erasure_block$  -- #232F input erasure begin: all existing influence/resource guards passed.
  declare
    input_ids uuid[];
    input_edge_count integer;
  begin
    -- Typed closure metadata must remain the exact immutable copied identities,
    -- including old target-prefix members and every copied source trace/claim.
    begin
      if exists(select 1 from private.shared_round_prediction_inputs i where
        i.result->>'contractVersion' is distinct from 'shared-round-prediction-input-v1'
        or i.result->>'captureId' is distinct from i.id::text
        or i.result->>'capturedByActorUserId' is distinct from i.actor_user_id::text
        or i.result#>>'{target,round,profileId}' is distinct from i.profile_id::text
        or i.result#>>'{target,round,roundId}' is distinct from i.round_id::text
        or i.result#>>'{target,sourceCommandId}' is distinct from i.target_source_command_id::text
        or i.result#>>'{target,sourceRevision}' is distinct from i.target_revision::text
        or i.result->>'inputDigest' is distinct from md5((i.result-'inputDigest')::text)
        or i.result#>>'{target,prefixDigest}' is distinct from md5((i.result#>'{target,visibleCommands}')::text)
        or i.copied_actor_ids is distinct from (select array_agg(distinct a.id order by a.id) from (
          select (i.result->>'capturedByActorUserId')::uuid id
          union all select (c.value->>'actorUserId')::uuid from jsonb_array_elements(i.result#>'{target,visibleCommands}') c
          union all select (p.value->>'actorUserId')::uuid from jsonb_array_elements(i.result#>'{target,visibleCommands}') c
            cross join lateral jsonb_array_elements(c.value#>'{result,round,participants}') p
          union all select (p.value->>'actorUserId')::uuid from jsonb_array_elements(i.result->'sources') c
            cross join lateral jsonb_array_elements(c.value#>'{outcome,round,participants}') p) a)
        or i.origin_prediction_ids is distinct from (select coalesce(array_agg(distinct a.id order by a.id),'{}'::uuid[]) from (
          select ref.value::uuid id from jsonb_array_elements(i.result->'sources') c
            cross join lateral jsonb_array_elements(c.value#>'{outcome,responses}') p
            cross join lateral (values (p.value#>>'{origin,predictionId}'),(p.value#>>'{origin,claimedPredictionId}'),
              (p.value#>>'{attribution,predictionId}')) ref(value)
            where ref.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          union all select ref.value::uuid id from jsonb_array_elements(i.result->'sources') c
            cross join lateral jsonb_array_elements(c.value#>'{outcome,round,responses}') p
            cross join lateral (values (p.value#>>'{origin,predictionId}'),(p.value#>>'{origin,claimedPredictionId}')) ref(value)
            where ref.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') a)) then
        raise exception 'Shared prediction input erasure metadata unavailable' using errcode='55000'; end if;
    exception when invalid_text_representation or invalid_parameter_value then
      raise exception 'Shared prediction input erasure metadata malformed' using errcode='55000';
    end;
    select coalesce(array_agg(bounded.id order by bounded.id),'{}'::uuid[]) into input_ids from (
      select i.id from private.shared_round_prediction_inputs i where
        (target_scope='PROFILE' and i.profile_id=target_id)
        or (target_scope='ACTOR' and (i.copied_actor_ids @> array[target_id] or i.profile_id=any(owned_profile_ids)))
        or i.origin_prediction_ids && source_ids
      limit 250001) bounded;
    select count(*) into input_edge_count from (
      select 1 from private.shared_round_prediction_input_sources s where s.input_id=any(input_ids) limit 250001) bounded;
    if cardinality(input_ids)>250000 or input_edge_count>250000
      or dependent_count+cardinality(input_ids)+input_edge_count>250000 then
      raise exception 'Prediction source erasure dependent row limit exceeded' using errcode='54000'; end if;
    perform i.id from private.shared_round_prediction_inputs i where i.id=any(input_ids) order by i.id for update;
    delete from private.shared_round_prediction_inputs i where i.id=any(input_ids);
  end;
  -- #232F input erasure end.

$input_erasure_block$;
begin
  select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prolang,p.prosrc,
    pg_catalog.pg_get_functiondef(p.oid) as definition into strict previous
    from pg_catalog.pg_proc p where p.oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
  if pg_catalog.md5(previous.prosrc) is distinct from '9a3e12be950b2a465b967f71e1c70945' then
    raise exception 'Shared prediction input erasure source drift' using errcode='55000'; end if;
  if (pg_catalog.length(previous.prosrc)-pg_catalog.length(pg_catalog.replace(previous.prosrc,old_anchor,'')))
    /pg_catalog.length(old_anchor)<>1 then
    raise exception 'Shared prediction input erasure anchor drift' using errcode='55000'; end if;
  replacement := pg_catalog.replace(previous.prosrc,old_anchor,inserted_block||old_anchor);
  if (pg_catalog.length(previous.definition)-pg_catalog.length(pg_catalog.replace(previous.definition,previous.prosrc,'')))
    /pg_catalog.length(previous.prosrc)<>1 then
    raise exception 'Shared prediction input erasure definition drift' using errcode='55000'; end if;
  definition := pg_catalog.replace(previous.definition,previous.prosrc,replacement);
  execute definition;
  if not exists(select 1 from pg_catalog.pg_proc p where p.oid=previous.oid
    and p.proowner=previous.proowner and p.proacl is not distinct from previous.proacl
    and p.prosecdef=previous.prosecdef and p.proconfig is not distinct from previous.proconfig
    and p.prolang=previous.prolang and p.prosrc=replacement) then
    raise exception 'Shared prediction input erasure identity or settings drift' using errcode='55000'; end if;
end;
$prediction_input_erasure$;
