-- #232F: genuine, owner-only prospective consumption of prepared Shared input.
-- Existing captures/forecasts are immutable. No public delivery or Session API.
do $preflight$
declare expected record; actual record;
begin
  if current_user<>'postgres' or to_regclass('private.shared_round_prediction_consumptions') is not null
    or exists(select 1 from pg_proc where pronamespace='private'::regnamespace and proname in(
      'shared_prepared_feature_input_v1','prepare_shared_consumption_v1','validate_shared_consumption_v1',
      'consume_shared_round_prediction_input_v1','deny_detached_shared_consumption_v1',
      'deny_retained_shared_forecasts_v1','erase_shared_prepared_evidence_v1')) then
    raise exception 'Shared consumption owner or target collision';end if;
  for expected in select * from (values
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)','d509b15f884b6df168807e68e29a0204',true,'v','plpgsql',array['search_path=""']::text[]),
    ('private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid)','9cd05e64529ddc9ca9dbb6b89e0e6a14',false,'i','sql',array['search_path=""','extra_float_digits=3','TimeZone=UTC']::text[]),
    ('private.validate_native_final_source_v1(uuid)','f093672bca6f1a305db373c2b673701e',false,'s','plpgsql',array['search_path=""','extra_float_digits=3']::text[]),
    ('private.shared_common_fit_candidate_v1_1(jsonb,uuid,timestamp with time zone)','73c6709dbf19527c67a121fd2c83bfaf',true,'s','plpgsql',array['search_path=""']::text[]),
    ('private.erase_prediction_sources_v1(text,uuid)','26533f72b112439dd3183631f0ed095c',false,'v','plpgsql',array['search_path=""','TimeZone=UTC']::text[])
  ) v(signature,hash,definer,volatility,language_name,configuration) loop
    select * into strict actual from pg_proc where oid=expected.signature::regprocedure;
    if md5(actual.prosrc)<>expected.hash or actual.proowner<>'postgres'::regrole
      or actual.proconfig is distinct from expected.configuration or actual.prosecdef is distinct from expected.definer
      or actual.provolatile::text<>expected.volatility or actual.prolang<>(select oid from pg_language where lanname=expected.language_name)
      or actual.proleakproof or actual.proisstrict or actual.proparallel<>'u'
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a
        where a.grantee<>actual.proowner or a.is_grantable or a.grantor<>actual.proowner) then
      raise exception 'Shared consumption source/security drift: %',expected.signature;end if;
  end loop;
end;$preflight$;

create table private.shared_round_prediction_consumptions (
  prediction_id uuid primary key references private.prediction_runs(id) on delete cascade,
  input_id uuid not null unique references private.shared_round_prediction_inputs(id) on delete cascade,
  marker jsonb not null check(jsonb_typeof(marker)='object' and octet_length(marker::text)<=8192),
  feature_input jsonb not null check(jsonb_typeof(feature_input)='object' and octet_length(feature_input::text)<=262144)
);
alter table private.shared_round_prediction_consumptions enable row level security;
revoke all on private.shared_round_prediction_consumptions from public,anon,authenticated,service_role;
create trigger shared_round_prediction_consumptions_immutable before update on private.shared_round_prediction_consumptions
  for each row execute function private.deny_shared_round_evidence_update_v1();

-- Pure feature preparation. Actor identities/ratings stay in the private input;
-- neither raw vectors nor per-member tag states enter candidate explanations.
create function private.shared_prepared_feature_input_v1(input jsonb, source_items jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $features$
  with supported as (
    select s.value, s.value#>>'{outcome,round,itemId}' item_id,
      row_number() over(partition by s.value#>>'{outcome,round,itemId}'
        order by (s.value->>'observedAt')::timestamptz desc,s.value->>'captureId' desc) position
    from jsonb_array_elements(input->'sources') s
    where s.value#>>'{outcome,vectorStatus}'='READY_FOR_VECTOR_REVIEW'
      and (s.value#>>'{outcome,coverage,eligibleVectorResponseCount}')::integer
        =jsonb_array_length(input#>'{target,round,participants}')
      and not exists(select 1 from jsonb_array_elements(s.value#>'{outcome,responses}') a
        where a.value->>'status' is distinct from 'RATED'
          or jsonb_typeof(a.value->'rating') is distinct from 'number'
          or (a.value->>'rating')::numeric not between 0 and 10
          or a.value#>>'{attribution,status}' not in('VALIDATED_TRACE','LATE_EXPOSURE_V1'))
  ), selected as (
    select * from supported where position=1
  ), ratings as (
    select s.item_id,s.value->>'captureId' capture_id,a.value->>'actorUserId' actor,
      (a.value->>'rating')::numeric rating,coalesce(source_items->s.item_id,'[]'::jsonb) tags
    from selected s cross join lateral jsonb_array_elements(s.value#>'{outcome,responses}') a
  ), comparisons as (
    select a.actor,a.item_id preferred,b.item_id other,a.tags positive,b.tags negative
    from ratings a join ratings b on b.actor=a.actor and a.item_id<>b.item_id and a.rating>b.rating
    where jsonb_array_length(a.tags)>0 and jsonb_array_length(b.tags)>0
  ), votes as (
    select actor,tag,sum(direction) direction from (
      select actor,t.tag,1 direction from comparisons c cross join lateral jsonb_array_elements_text(c.positive) t(tag)
      union all
      select actor,t.tag,-1 direction from comparisons c cross join lateral jsonb_array_elements_text(c.negative) t(tag)
    ) v group by actor,tag
  ), members as (
    select p.value->>'actorUserId' actor,
      jsonb_build_object('evidenceCount',(select count(distinct item_id) from (
        select preferred item_id from comparisons where actor=p.value->>'actorUserId'
        union select other from comparisons where actor=p.value->>'actorUserId') observations),
        'longTermPositiveTags',(select coalesce(jsonb_agg(tag order by tag),'[]') from votes where actor=p.value->>'actorUserId' and direction>0),
        'longTermNegativeTags',(select coalesce(jsonb_agg(tag order by tag),'[]') from votes where actor=p.value->>'actorUserId' and direction<0),
        'shortTermPositiveTags','[]'::jsonb,'shortTermNegativeTags','[]'::jsonb) state
    from jsonb_array_elements(input#>'{target,round,participants}') p
  )
  select jsonb_build_object('version','shared-prepared-ordinal-tags-v1','sourceItems',source_items,
    'supportedCaptureIds',(select coalesce(jsonb_agg(value->'captureId' order by value->>'captureId'),'[]') from selected),
    'commonContext',jsonb_build_object('version','shared-common-fit-context-v1.1','applicable',true,
      'preparedFeaturePolicy','shared-prepared-ordinal-tags-v1',
      'sharedEvidenceCount',(select count(distinct item_id) from (
        select preferred item_id from comparisons union select other from comparisons) observations),
      'memberCount',(select count(*) from members),
      'members',(select jsonb_agg(state order by actor) from members)),
    'fallback',case when exists(select 1 from members where (state->>'evidenceCount')::integer>0)
      then 'SUPPORTED_ORDINAL_TAGS' else 'NEUTRAL_COLD_START' end);
$features$;

create function private.prepare_shared_consumption_v1(input_id uuid, target_profile uuid, candidate_ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' set extra_float_digits=3 as $prepare$
declare i private.shared_round_prediction_inputs%rowtype; members jsonb; target private.shared_rating_rounds%rowtype;
  s record; source_items jsonb; features jsonb; marker jsonb; actor uuid:=auth.uid();
begin
  -- This helper is also safe when invoked directly by its owner.
  perform pg_advisory_xact_lock_shared(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared consumption requires READ COMMITTED' using errcode='25001';end if;
  members:=private.lock_shared_round_members_v1(target_profile);
  select * into i from private.shared_round_prediction_inputs x where x.id=input_id for key share;
  if i.id is null or i.actor_user_id is distinct from actor or i.profile_id is distinct from target_profile
    or i.result#>'{target,round,participants}' is distinct from members then
    raise exception 'Shared consumption input access/enrollment denied' using errcode='42501';end if;
  if i.result->>'inputDigest' is distinct from md5((i.result-'inputDigest')::text)
    or i.result->>'captureId' is distinct from i.id::text
    or i.result#>>'{target,round,roundId}' is distinct from i.round_id::text
    or i.result#>>'{target,sourceRevision}' is distinct from i.target_revision::text
    or i.result#>>'{target,sourceCommandId}' is distinct from i.target_source_command_id::text
    or i.result#>>'{target,prefixDigest}' is distinct from md5((i.result#>'{target,visibleCommands}')::text)
    or not isfinite(i.observed_at) or i.observed_at>=now()
    or candidate_ids is distinct from array[(i.result#>>'{target,round,itemId}')::uuid] then
    raise exception 'Shared consumption requires exact previously prepared input/target' using errcode='40001';end if;
  -- All round locks use one order. Responses/reconfirmations use these same row
  -- locks; membership enrollment is already locked before acquiring any round.
  perform r.id from private.shared_rating_rounds r where r.id=i.round_id or r.id in(
    select (value#>>'{outcome,round,roundId}')::uuid from jsonb_array_elements(i.result->'sources'))
    order by r.id for update;
  select * into strict target from private.shared_rating_rounds where id=i.round_id;
  if target.revision<>i.target_revision or target.current_state<>'PENDING' or target.participants<>members
    or exists(select 1 from private.shared_rating_round_responses a where a.round_id=i.round_id)
    or exists(select 1 from private.shared_rating_round_receipts c where c.round_id=i.round_id
      and c.command->>'kind' in('SET_RESPONSE','CLEAR_RESPONSE'))
    or private.shared_rating_round_snapshot_v1(i.round_id,members) is distinct from i.result#>'{target,round}' then
    raise exception 'Shared consumption target is no longer the never-answered prepared head' using errcode='40001';end if;
  if (select count(*) from private.shared_round_prediction_input_sources e where e.input_id=i.id)
      <>jsonb_array_length(i.result->'sources') then
    raise exception 'Shared consumption source bindings incomplete' using errcode='55000';end if;
  for s in select value from jsonb_array_elements(i.result->'sources') loop
    if not exists(select 1 from private.shared_round_outcome_captures c
      join private.shared_round_prediction_input_sources e on e.source_capture_id=c.id and e.input_id=i.id
      join private.shared_rating_rounds r on r.id=c.round_id
      where c.id=(s.value->>'captureId')::uuid and c.result=s.value and c.profile_id=target_profile
        and r.revision=c.source_revision and r.participants=members
        and r.id<>target.id and r.experience_id<>target.experience_id) then
      raise exception 'Shared consumption source changed or was withdrawn' using errcode='40001';end if;
  end loop;
  -- Freeze current catalog tags as a separately declared feature read. These
  -- are not claimed to have existed at the earlier outcome or input capture.
  perform item.id from public.items item where item.id=any(candidate_ids) or item.id in(
    select (value#>>'{outcome,round,itemId}')::uuid from jsonb_array_elements(i.result->'sources'))
    order by item.id for share;
  select coalesce(jsonb_object_agg(item.id::text,(select coalesce(jsonb_agg(t order by t),'[]') from
    (select distinct t from unnest(coalesce(item.tags,'{}'::text[])) t) tags)),'{}') into source_items
    from public.items item where item.id in(
      select (value#>>'{outcome,round,itemId}')::uuid from jsonb_array_elements(i.result->'sources'));
  features:=private.shared_prepared_feature_input_v1(i.result,source_items);
  if octet_length(features::text)>262144 then
    raise exception 'Shared consumption feature input limit exceeded' using errcode='54000';end if;
  marker:=jsonb_build_object('version','shared-prepared-consumption-v1','inputCaptureId',i.id,
    'inputDigest',i.result->'inputDigest','targetRoundId',i.round_id,'targetExperienceId',target.experience_id,
    'targetItemId',target.item_id,'targetSourceCommandId',i.target_source_command_id,'targetRevision',i.target_revision,
    'targetPrefixDigest',i.result#>'{target,prefixDigest}','profileId',target_profile,'actorUserId',actor,
    'inputObservedAt',i.observed_at,'consumedAt',clock_timestamp(),'featureVersion',features->'version',
    'featureInputDigest',md5(features::text),'fallback',features->'fallback',
    'predictorConsumption','RECORDED','forecastKind','UNCALIBRATED_ORDINAL',
    'membershipValidity','CURRENT_FULL_ENROLLMENT_AT_CONSUMPTION',
    'commitVisibility','OWN_TRANSACTION_MVCC_VISIBLE_NOT_COMMIT_TIME');
  return jsonb_build_object('marker',marker,'featureInput',features);
end;$prepare$;

create function private.validate_shared_consumption_v1(source jsonb)
returns boolean language plpgsql stable security invoker set search_path='' as $validate$
declare marker jsonb:=source#>'{state_snapshot,sharedPreparedInput}'; binding record;
  marked boolean:='shared-prepared-input-v1'=any(string_to_array(source->>'policy_version','+'));
begin
  if marker is null then
    if marked then raise exception 'Shared consumption marker missing' using errcode='22023';end if;
    return false;
  end if;
  select c.*,i.result into binding from private.shared_round_prediction_consumptions c
    join private.shared_round_prediction_inputs i on i.id=c.input_id where c.prediction_id=(source->>'id')::uuid;
  if not found or marked is distinct from true or marker is distinct from binding.marker
    or marker->>'version' is distinct from 'shared-prepared-consumption-v1'
    or marker->'profileId' is distinct from source->'profile_id' or marker->'actorUserId' is distinct from source->'actor_user_id'
    or marker->>'inputDigest' is distinct from binding.result->>'inputDigest'
    or marker->>'featureInputDigest' is distinct from md5(binding.feature_input::text)
    or binding.feature_input is distinct from private.shared_prepared_feature_input_v1(binding.result,binding.feature_input->'sourceItems')
    or source->>'discovery_mode' is distinct from 'FOR_YOU' or source->'session_id' is distinct from 'null'::jsonb
    or source->'requested_item_type' is distinct from 'null'::jsonb
    or source->>'candidate_count' is distinct from '1' or source->>'result_count' is distinct from '0'
    or (marker->>'inputObservedAt')::timestamptz is distinct from (source#>>'{state_snapshot,candidateRequest,requiredAfter}')::timestamptz
    or (marker->>'inputObservedAt')::timestamptz>=(source->>'requested_at')::timestamptz
    or (marker->>'consumedAt')::timestamptz<(source->>'requested_at')::timestamptz
    or source#>>'{state_snapshot,candidateRequest,intent}' is distinct from 'EVALUATION'
    or source#>'{state_snapshot,candidateRequest,itemIds}' is distinct from jsonb_build_array(marker->'targetItemId')
    or exists(select 1 from private.prediction_candidates c where c.prediction_id=(source->>'id')::uuid
      and (c.item_id::text is distinct from marker->>'targetItemId' or c.selected_for_delivery
        or c.explanation#>>'{sharedCommonFit,sourceBasis}' is distinct from 'SHARED_PREPARED_ORDINAL_TAGS_V1'
        or c.explanation#>'{sharedCommonFit,preparedInputDigest}' is distinct from marker->'inputDigest'
        or c.explanation#>'{sharedCommonFit,featureInputDigest}' is distinct from marker->'featureInputDigest')) then
    raise exception 'Shared consumption source binding mismatch' using errcode='22023';end if;
  return true;
end;$validate$;

create function private.consume_shared_round_prediction_input_v1(prediction_id uuid, input_id uuid)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' set extra_float_digits=3 as $consume$
declare i private.shared_round_prediction_inputs%rowtype; members jsonb; binding record; request jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock_shared(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared consumption and retries require READ COMMITTED' using errcode='25001';end if;
  if prediction_id is null or input_id is null then raise exception 'Shared consumption identities required' using errcode='22023';end if;
  select * into i from private.shared_round_prediction_inputs x where x.id=input_id;
  if i.id is null or i.actor_user_id is distinct from auth.uid() then
    raise exception 'Shared consumption input access denied' using errcode='42501';end if;
  members:=private.lock_shared_round_members_v1(i.profile_id);
  if members is distinct from i.result#>'{target,round,participants}' then
    raise exception 'Shared consumption enrollment changed' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-prepared-prediction:'||prediction_id::text,0));
  select * into binding from private.shared_round_prediction_consumptions c where c.prediction_id=consume_shared_round_prediction_input_v1.prediction_id;
  if found then
    if binding.input_id<>input_id then raise exception 'Shared consumption retry identity conflict' using errcode='22023';end if;
  else
    request:=jsonb_build_object('version','native-candidate-request-v1','acquisition','EXPLICIT_CANONICAL','intent','EVALUATION',
      'itemIds',jsonb_build_array(i.result#>'{target,round,itemId}'),'seenItemIds','[]'::jsonb,
      'reminderSpent',false,'requiredAfter',i.observed_at);
    perform * from private.rank_items_request_with_identity_v1(request,prediction_id,i.profile_id,'FOR_YOU',null,1,
      jsonb_build_object('sharedPreparedInputId',input_id));
  end if;
  perform private.validate_native_final_source_v1(prediction_id);
  select jsonb_build_object('version','shared-prepared-forecast-v1','predictionId',r.id,
    'profileId',r.profile_id,'actorUserId',r.actor_user_id,'input',r.state_snapshot->'sharedPreparedInput',
    'forecastKind','UNCALIBRATED_ORDINAL','delivery',false,'items',coalesce((select jsonb_agg(jsonb_build_object(
      'itemId',c.item_id,'score',c.final_score,'rank',c.final_rank,
      'eligible',c.explanation#>'{resurfacingPolicy,eligible}','finalScoringInput',c.explanation->'finalScoringInput') order by c.final_rank)
      from private.prediction_candidates c where c.prediction_id=r.id),'[]'::jsonb)) into result
    from private.prediction_runs r where r.id=prediction_id;
  return result;
end;$consume$;

-- A detached binding could otherwise bypass source withdrawal. Parent deletes
-- remove the run first; its FK cascade is the only supported edge removal.
create function private.deny_detached_shared_consumption_v1()
returns trigger language plpgsql security invoker set search_path='' as $detach$
begin
  if exists(select 1 from private.prediction_runs r where r.id=old.prediction_id) then
    raise exception 'Erase the dependent forecast before its Shared consumption binding' using errcode='55000';end if;
  return old;
end;$detach$;
create trigger shared_round_prediction_consumptions_bound before delete on private.shared_round_prediction_consumptions
  for each row execute function private.deny_detached_shared_consumption_v1();

create function private.deny_retained_shared_forecasts_v1()
returns trigger language plpgsql security invoker set search_path='' as $withdraw$
begin
  if exists(select 1 from private.shared_round_prediction_consumptions c where c.input_id=old.id) then
    -- Erase the full dependent forecast closure BEFORE deleting evidence. Do
    -- not acquire a late lifecycle lock or recursively erase from a row trigger.
    raise exception 'Consumed Shared evidence requires the lifecycle eraser' using errcode='55000';
  end if;
  return old;
end;$withdraw$;
create trigger shared_round_prediction_inputs_consumed_forecasts before delete on private.shared_round_prediction_inputs
  for each row execute function private.deny_retained_shared_forecasts_v1();

create function private.erase_shared_prepared_evidence_v1(scope text, source_id uuid)
returns void language plpgsql security invoker set search_path='' as $erase$
declare prediction uuid;
begin
  perform pg_advisory_xact_lock(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared evidence erasure requires READ COMMITTED' using errcode='25001';end if;
  if source_id is null or scope is null or scope not in('INPUT','OUTCOME_CAPTURE') then
    raise exception 'Invalid Shared evidence erasure scope' using errcode='22023';end if;
  for prediction in select c.prediction_id from private.shared_round_prediction_consumptions c
    where (scope='INPUT' and c.input_id=source_id) or (scope='OUTCOME_CAPTURE' and exists(
      select 1 from private.shared_round_prediction_input_sources s where s.input_id=c.input_id and s.source_capture_id=source_id))
    order by c.prediction_id loop
    if exists(select 1 from private.prediction_runs r where r.id=prediction) then
      perform private.erase_prediction_sources_v1('PREDICTION_RUN',prediction);end if;
  end loop;
  if scope='INPUT' then delete from private.shared_round_prediction_inputs where id=source_id;
  else delete from private.shared_round_outcome_captures where id=source_id;end if;
end;$erase$;

-- Guarded changes to existing owners; no parallel ranking/scoring owner.
do $patch$
declare original text; body text; definition text; old text; replacement text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)'::regprocedure;
  body:=original;
  old:=$old$  native_receipt jsonb;$old$;
  replacement:=$new$  native_receipt jsonb;
  shared_prepared jsonb;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/0';end if;
  body:=replace(body,old,replacement);
  old:=$old$  if request_intent='EVALUATION' and not exists(select 1 from public.profiles p$old$;
  replacement:=$new$  if request_intent='EVALUATION' and request_context ? 'sharedPreparedInputId' then
    if requested_mode<>'FOR_YOU' or requested_item_type is not null or requested_session_id is not null
      or result_limit<>1 or request_context ? 'nativeV4Receipt'
      or (request_context->>'sharedPreparedInputId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Unsupported Shared prepared forecast request' using errcode='22023';end if;
    shared_prepared:=private.prepare_shared_consumption_v1(
      (request_context->>'sharedPreparedInputId')::uuid,target_profile_id,request_item_ids);
    if (shared_prepared#>>'{marker,inputObservedAt}')::timestamptz is distinct from request_required_after then
      raise exception 'Shared prepared input cutoff mismatch' using errcode='22023';end if;
  end if;
  if request_intent='EVALUATION' and shared_prepared is null and not exists(select 1 from public.profiles p$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/1';end if;
  body:=replace(body,old,replacement);
  old:=$old$  shared_common_context := private.build_shared_common_fit_context_v1_1(target_profile_id, request_time);$old$;
  replacement:=$new$  shared_common_context := case when shared_prepared is null
    then private.build_shared_common_fit_context_v1_1(target_profile_id, request_time)
    else shared_prepared#>'{featureInput,commonContext}' end;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/2';end if;
  body:=replace(body,old,replacement);
  old:=$old$      'version','personal-evaluation-v1','candidateIds',to_jsonb(request_item_ids),$old$;
  replacement:=$new$      'version',case when shared_prepared is null then 'personal-evaluation-v1' else 'shared-round-evaluation-v1' end,'candidateIds',to_jsonb(request_item_ids),$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/3';end if;
  body:=replace(body,old,replacement);
  old:=$old$  current_state := current_state || jsonb_build_object('candidateRequest',validated_request);$old$;
  replacement:=$new$  current_state := current_state || jsonb_build_object('candidateRequest',validated_request);
  if shared_prepared is not null then
    current_policy_version:=current_policy_version||'+shared-prepared-input-v1';
    current_state:=current_state||jsonb_build_object('sharedPreparedInput',shared_prepared->'marker');
  end if;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/4';end if;
  body:=replace(body,old,replacement);
  old:=$old$  ) returning private.prediction_runs.genome_id into serving_genome_id;$old$;
  replacement:=$new$  ) returning private.prediction_runs.genome_id into serving_genome_id;
  if shared_prepared is not null then
    insert into private.shared_round_prediction_consumptions(prediction_id,input_id,marker,feature_input)
      values(current_prediction_id,(shared_prepared#>>'{marker,inputCaptureId}')::uuid,
        shared_prepared->'marker',shared_prepared->'featureInput');
  end if;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/5';end if;
  body:=replace(body,old,replacement);
  old:=$old$      ) as shared_common_fit,$old$;
  replacement:=$new$      ) || case when shared_prepared is null then '{}'::jsonb else jsonb_build_object(
        'sourceBasis','SHARED_PREPARED_ORDINAL_TAGS_V1',
        'preparedInputDigest',shared_prepared#>'{marker,inputDigest}',
        'featureInputDigest',shared_prepared#>'{marker,featureInputDigest}',
        'fallback',shared_prepared#>'{marker,fallback}') end as shared_common_fit,$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: rank_items_request_with_identity_v1/6';end if;
  body:=replace(body,old,replacement);
  execute replace(definition,original,body);
end;$patch$;

do $patch$
declare original text; body text; definition text; old text; replacement text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid)'::regprocedure;
  body:=original;
  old:=$old$else '{}'::jsonb end;$old$;
  replacement:=$new$else '{}'::jsonb end
    ||case when source->'state_snapshot' ? 'sharedPreparedInput'
      then jsonb_build_object('sharedPreparedInput',source#>'{state_snapshot,sharedPreparedInput}') else '{}'::jsonb end;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: native_final_run_input_v1/0';end if;
  body:=replace(body,old,replacement);
  execute replace(definition,original,body);
end;$patch$;

do $patch$
declare original text; body text; definition text; old text; replacement text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.validate_native_final_source_v1(uuid)'::regprocedure;
  body:=original;
  old:=$old$  marker:=source.state_snapshot->'finalScoringInput';$old$;
  replacement:=$new$  if private.validate_shared_consumption_v1(to_jsonb(source)) and not(source.state_snapshot ? 'finalScoringInput') then
    raise exception 'Shared consumption requires complete FINAL input' using errcode='22023';end if;
  marker:=source.state_snapshot->'finalScoringInput';$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: validate_native_final_source_v1/0';end if;
  body:=replace(body,old,replacement);
  execute replace(definition,original,body);
end;$patch$;

do $patch$
declare original text; body text; definition text; old text; replacement text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.shared_common_fit_candidate_v1_1(jsonb,uuid,timestamp with time zone)'::regprocedure;
  body:=original;
  old:=$old$  prior := private.catalog_cold_start_prior_v1(target_item_id, decision_time);$old$;
  replacement:=$new$  -- Prepared relative preferences shrink toward no preference. The legacy
  -- catalog score measures recognition/trend; absent metadata is zero there,
  -- not evidence of a member's low satisfaction. Other callers stay unchanged.
  prior := case when common_context->>'preparedFeaturePolicy'='shared-prepared-ordinal-tags-v1'
    then jsonb_build_object('version','shared-prepared-neutral-prior-v1','score',0.5,'source','NO_DIRECTIONAL_EVIDENCE')
    else private.catalog_cold_start_prior_v1(target_item_id, decision_time) end;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: shared_common_fit_candidate_v1_1/0';end if;
  body:=replace(body,old,replacement);
  execute replace(definition,original,body);
end;$patch$;

do $patch$
declare original text; body text; definition text; old text; replacement text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
  body:=original;
  old:=$old$  copied_run jsonb;$old$;
  replacement:=$new$  copied_run jsonb;
  shared_input_ids uuid[];$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/0';end if;
  body:=replace(body,old,replacement);
  old:=$old$    delete from private.shared_round_prediction_inputs i where i.id=any(input_ids);$old$;
  replacement:=$new$    shared_input_ids:=input_ids; -- Delete only after the complete dependent run closure.$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/1';end if;
  body:=replace(body,old,replacement);
  old:=$old$  get diagnostics source_count=row_count;$old$;
  replacement:=$new$  get diagnostics source_count=row_count;
  delete from private.shared_round_prediction_inputs i where i.id=any(shared_input_ids);$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/2';end if;
  body:=replace(body,old,replacement);
  old:=$old$    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)$old$;
  replacement:=$new$    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)
    union all select 1 from private.shared_round_prediction_consumptions c where c.prediction_id=any(source_ids)$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/3';end if;
  body:=replace(body,old,replacement);
  old:=$old$  -- #232F input erasure end.$old$;
  replacement:=$new$  -- #232F input erasure end.
  for copied_run in select to_jsonb(r) from private.prediction_runs r where r.id=any(source_ids)
    and (r.state_snapshot ? 'sharedPreparedInput'
      or 'shared-prepared-input-v1'=any(string_to_array(r.policy_version,'+'))
      or exists(select 1 from private.shared_round_prediction_consumptions c where c.prediction_id=r.id)) loop
    if not private.validate_shared_consumption_v1(copied_run) then
      raise exception 'Shared consumption erasure binding missing' using errcode='55000';end if;
  end loop;$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/4';end if;
  body:=replace(body,old,replacement);
  old:=$old$      or (target_scope='ACTOR' and (r.actor_user_id=target_id or r.profile_id=any(owned_profile_ids)))
    union$old$;
  replacement:=$new$      or (target_scope='ACTOR' and (r.actor_user_id=target_id or r.profile_id=any(owned_profile_ids)))
      or exists(select 1 from private.shared_round_prediction_consumptions c
        join private.shared_round_prediction_inputs i on i.id=c.input_id where c.prediction_id=r.id
          and target_scope='ACTOR' and i.copied_actor_ids @> array[target_id])
    union$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/5';end if;
  body:=replace(body,old,replacement);
  old:=$old$    ) child join private.prediction_runs actual on actual.id=child.prediction_id$old$;
  replacement:=$new$      union
      select c.prediction_id from private.shared_round_prediction_consumptions c
        join private.shared_round_prediction_inputs i on i.id=c.input_id
        where i.origin_prediction_ids @> array[parent.id]
    ) child join private.prediction_runs actual on actual.id=child.prediction_id$new$;
  if (length(body)-length(replace(body,old,'')))/length(old)<>1 then
    raise exception 'Shared consumption anchor drift: erase_prediction_sources_v1/6';end if;
  body:=replace(body,old,replacement);
  execute replace(definition,original,body);
end;$patch$;

-- Explicit owner-only grants survive permissive platform defaults.
revoke all on function private.shared_prepared_feature_input_v1(jsonb,jsonb),
  private.prepare_shared_consumption_v1(uuid,uuid,uuid[]), private.validate_shared_consumption_v1(jsonb),
  private.consume_shared_round_prediction_input_v1(uuid,uuid), private.deny_detached_shared_consumption_v1(),
  private.deny_retained_shared_forecasts_v1(), private.erase_shared_prepared_evidence_v1(text,uuid)
  from public,anon,authenticated,service_role;
do $closed_access$
begin
  if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.pronamespace='private'::regnamespace and p.proname in(
      'shared_prepared_feature_input_v1','prepare_shared_consumption_v1','validate_shared_consumption_v1',
      'consume_shared_round_prediction_input_v1','deny_detached_shared_consumption_v1',
      'deny_retained_shared_forecasts_v1','erase_shared_prepared_evidence_v1')
      and (p.proowner<>'postgres'::regrole or p.prosecdef or p.proconfig[1]<>'search_path=""'
        or a.grantee<>p.proowner or a.grantor<>p.proowner or a.is_grantable))
    or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.oid='private.shared_round_prediction_consumptions'::regclass
        and (c.relowner<>'postgres'::regrole or not c.relrowsecurity or a.grantee<>c.relowner
          or a.grantor<>c.relowner or a.is_grantable)) then
    raise exception 'Shared consumption owner-only access unavailable';end if;
end;$closed_access$;
