-- Bind actual owned V4 receipt visibility to the consumed fresh forecast.
-- No retained rows, public API, scoring formula or selection policy is rewritten.
do $receipt_preflight$
declare expected record; actual record;
begin
  if current_user<>'postgres' or exists(select 1 from pg_proc where pronamespace='private'::regnamespace
    and proname in('capture_native_v4_receipt_v1','validate_native_v4_receipt_v1')) then
    raise exception 'V4 receipt owner or target collision';end if;
  for expected in select * from (values
    ('private.taste_session_v2(jsonb)','585bb6800fe02ab3f87b04cf6c39df6b',true,'v','plpgsql',array['search_path=""']::text[],true),
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)','0c02979e3ed5e00500085a273fbb7a8f',true,'v','plpgsql',array['search_path=""']::text[],false),
    ('private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid)','c0505ea9180dad68413e94660dd38027',false,'i','sql',array['search_path=""','extra_float_digits=3','TimeZone=UTC']::text[],false),
    ('private.validate_native_final_source_v1(uuid)','a339b45dd95c9531078c4a5a6ff90168',false,'s','plpgsql',array['search_path=""','extra_float_digits=3']::text[],false)
  ) checks(signature,body_hash,definer,volatility,language_name,configuration,authenticated_access) loop
    select * into strict actual from pg_proc where oid=expected.signature::regprocedure;
    if md5(actual.prosrc)<>expected.body_hash or actual.proowner<>'postgres'::regrole
      or actual.prosecdef is distinct from expected.definer or actual.provolatile::text<>expected.volatility
      or actual.prolang<>(select oid from pg_language where lanname=expected.language_name)
      or actual.proleakproof or actual.proisstrict or actual.proparallel<>'u'
      or actual.proconfig is distinct from expected.configuration
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a
        where a.grantor<>actual.proowner or a.is_grantable
          or (a.grantee<>actual.proowner and not(expected.authenticated_access and a.grantee='authenticated'::regrole)))
      or has_function_privilege('anon',actual.oid,'EXECUTE')
      or has_function_privilege('service_role',actual.oid,'EXECUTE')
      or has_function_privilege('authenticated',actual.oid,'EXECUTE') is distinct from expected.authenticated_access then
      raise exception 'V4 receipt source/security drift: %',expected.signature;end if;
  end loop;
end;$receipt_preflight$;

-- A current owned V4 receipt is a scoped visibility fact, not a historical or
-- global database snapshot. The command supplies its snapshot taken BEFORE its
-- lifecycle-lock wait. Top-level receipt XIDs come from pg_current_xact_id().
create function private.capture_native_v4_receipt_v1(target_session uuid, entry_snapshot pg_snapshot)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $receipt$
declare s private.sequential_taste_sessions%rowtype; actor uuid:=auth.uid();
  forecast_transaction text:=pg_current_xact_id_if_assigned()::text;
begin
  select * into s from private.sequential_taste_sessions where id=target_session;
  if actor is null or s.id is null or s.actor_user_id is distinct from actor
    or s.policy<>'CANONICAL_FORECAST_POOL_V4' or s.status<>'ACTIVE'
    or not exists(select 1 from public.profiles p where p.id=s.profile_id
      and p.profile_type='PERSONAL' and p.owner_user_id=actor)
    or not coalesce(private.is_profile_member(s.profile_id),false) then
    raise exception 'V4 receipt requires the active owned session' using errcode='42501';
  end if;
  if entry_snapshot is null or octet_length(entry_snapshot::text)>65536
    or forecast_transaction is null or s.receipt_transaction=forecast_transaction
    or s.receipt_at>=now() or not isfinite(s.receipt_at)
    or not pg_visible_in_snapshot(s.receipt_transaction::xid8,entry_snapshot) then
    raise exception 'V4 receipt must be committed before command entry' using errcode='40001';
  end if;
  return jsonb_build_object('version','native-v4-receipt-v1','policy',s.policy,
    'profileId',s.profile_id,'actorUserId',actor,'sessionId',s.id,
    'receiptRevision',s.revision,'receiptTransaction',s.receipt_transaction,'receiptAt',s.receipt_at,
    'forecastTransaction',forecast_transaction,'forecastAsOf',now(),'entrySnapshot',entry_snapshot::text);
end;$receipt$;

-- Frozen admission is independent of today's mutable session. Source erasure
-- still owns withdrawal. This validates a trusted producer's retained binding;
-- an arbitrary exported JSON object is not authenticated by this function.
create function private.validate_native_v4_receipt_v1(source jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $validate$
declare state jsonb:=source->'state_snapshot'; receipt jsonb:=state->'nativeV4Receipt';
  marked boolean:='v4-receipt-input-v1'=any(string_to_array(source->>'policy_version','+'));
  field text; accepted timestamptz; forecast timestamptz; snapshot pg_snapshot;
  receipt_xid xid8; forecast_xid xid8;
begin
  if not(state ? 'nativeV4Receipt') then
    if marked then raise exception 'V4 receipt marker is missing' using errcode='22023';end if;
    return false;
  end if;
  if marked is distinct from true or jsonb_typeof(receipt) is distinct from 'object'
    or octet_length(receipt::text)>131072
    or receipt->>'version' is distinct from 'native-v4-receipt-v1'
    or receipt->>'policy' is distinct from 'CANONICAL_FORECAST_POOL_V4'
    or not(receipt ?& array['version','policy','profileId','actorUserId','sessionId','receiptRevision',
      'receiptTransaction','receiptAt','forecastTransaction','forecastAsOf','entrySnapshot'])
    or exists(select 1 from jsonb_object_keys(receipt) k where k<>all(array[
      'version','policy','profileId','actorUserId','sessionId','receiptRevision',
      'receiptTransaction','receiptAt','forecastTransaction','forecastAsOf','entrySnapshot'])) then
    raise exception 'Invalid V4 receipt contract' using errcode='22023';
  end if;
  foreach field in array array['profileId','actorUserId','sessionId'] loop
    if jsonb_typeof(receipt->field) is distinct from 'string'
      or (receipt->>field)!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid V4 receipt identity' using errcode='22023';end if;
  end loop;
  if receipt->'profileId' is distinct from source->'profile_id'
    or receipt->'actorUserId' is distinct from source->'actor_user_id'
    or receipt->'sessionId' is distinct from source->'session_id'
    or jsonb_typeof(receipt->'receiptRevision') is distinct from 'number'
    or receipt->>'receiptRevision'!~'^(0|[1-9][0-9]{0,2})$'
    or (receipt->>'receiptRevision')::integer>255
    or state#>>'{candidateRequest,intent}' is distinct from 'EVALUATION'
    or state#>>'{candidateRequest,acquisition}' is distinct from 'EXPLICIT_CANONICAL'
    or source->>'discovery_mode' is distinct from 'FOR_YOU'
    or source->'requested_item_type' is distinct from 'null'::jsonb then
    raise exception 'V4 receipt forecast scope mismatch' using errcode='22023';
  end if;
  foreach field in array array['receiptTransaction','forecastTransaction'] loop
    if jsonb_typeof(receipt->field) is distinct from 'string'
      or (receipt->>field)!~'^[1-9][0-9]{0,19}$' then
      raise exception 'Invalid V4 receipt transaction' using errcode='22023';end if;
  end loop;
  foreach field in array array['receiptAt','forecastAsOf'] loop
    if jsonb_typeof(receipt->field) is distinct from 'string' or length(receipt->>field)>32
      or (receipt->>field)!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'Invalid V4 receipt clock' using errcode='22023';end if;
  end loop;
  if jsonb_typeof(receipt->'entrySnapshot') is distinct from 'string'
    or octet_length(receipt->>'entrySnapshot')>65536 then
    raise exception 'Invalid V4 receipt entry snapshot' using errcode='22023';end if;
  begin
    accepted:=(receipt->>'receiptAt')::timestamptz;forecast:=(receipt->>'forecastAsOf')::timestamptz;
    receipt_xid:=(receipt->>'receiptTransaction')::xid8;forecast_xid:=(receipt->>'forecastTransaction')::xid8;
    snapshot:=(receipt->>'entrySnapshot')::pg_snapshot;
  exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    raise exception 'Invalid V4 receipt visibility input' using errcode='22023';
  end;
  if not isfinite(accepted) or not isfinite(forecast) or accepted>=forecast
    or forecast is distinct from (source->>'requested_at')::timestamptz
    or forecast is distinct from (state#>>'{predictionInput,nativeEvidenceAsOf}')::timestamptz
    or accepted is distinct from (state#>>'{candidateRequest,requiredAfter}')::timestamptz
    or accepted is distinct from (state#>>'{predictionInput,requiredAfter}')::timestamptz
    or receipt_xid=forecast_xid or not pg_visible_in_snapshot(receipt_xid,snapshot) then
    raise exception 'V4 receipt was not visible to the bound forecast' using errcode='22023';
  end if;
  return true;
end;$validate$;
revoke all on function private.capture_native_v4_receipt_v1(uuid,pg_snapshot),
  private.validate_native_v4_receipt_v1(jsonb) from public,anon,authenticated,service_role;

do $receipt_consumers$
declare patch record; definition text; original text;
begin
  for patch in select * from (values
    ('private.taste_session_v2(jsonb)', $old0$  actor uuid;profile uuid;operation text;command_id uuid;question_id uuid;keys text[];$old0$, $new0$  command_snapshot pg_snapshot:=pg_current_snapshot();
  actor uuid;profile uuid;operation text;command_id uuid;question_id uuid;keys text[];$new0$),
    ('private.taste_session_v2(jsonb)', $old1$frozen:=private.capture_personal_evaluation_v1(prediction,profile,ids,s.receipt_at,jsonb_build_object('sessionId',s.id));$old1$, $new1$frozen:=private.capture_personal_evaluation_v1(prediction,profile,ids,s.receipt_at,
          jsonb_build_object('sessionId',s.id)||case when s.policy='CANONICAL_FORECAST_POOL_V4'
            then jsonb_build_object('nativeV4Receipt',private.capture_native_v4_receipt_v1(s.id,command_snapshot))
            else '{}'::jsonb end);$new1$),
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)', $old2$  current_context jsonb;$old2$, $new2$  native_receipt jsonb;
  current_context jsonb;$new2$),
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)', $old3$  candidate_pool_limit := case when request_acquisition$old3$, $new3$  -- This key is supplied only by the private V4 evaluation owner. Public
  -- delivery Context cannot claim a V4 receipt or select evaluation intent.
  if request_intent='EVALUATION' and request_context ? 'nativeV4Receipt' then
    if jsonb_typeof(request_context->'nativeV4Receipt') is distinct from 'object' then
      raise exception 'Invalid consumed V4 receipt' using errcode='22023';end if;
    begin
      native_receipt:=private.capture_native_v4_receipt_v1(requested_session_id,
        (request_context#>>'{nativeV4Receipt,entrySnapshot}')::pg_snapshot);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid consumed V4 entry snapshot' using errcode='22023';
    end;
    if native_receipt is distinct from request_context->'nativeV4Receipt'
      or native_receipt->'profileId' is distinct from to_jsonb(target_profile_id)
      or native_receipt->'actorUserId' is distinct from to_jsonb(current_actor_user_id)
      or (native_receipt->>'receiptAt')::timestamptz is distinct from request_required_after
      or requested_mode<>'FOR_YOU' or requested_item_type is not null then
      raise exception 'Consumed V4 receipt does not match the forecast request' using errcode='40001';
    end if;
  end if;

  candidate_pool_limit := case when request_acquisition$new3$),
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)', $old4$  current_state := current_state || jsonb_build_object('candidateRequest',validated_request);$old4$, $new4$  current_state := current_state || jsonb_build_object('candidateRequest',validated_request);
  if native_receipt is not null then
    current_policy_version:=current_policy_version||'+v4-receipt-input-v1';
    current_state:=current_state||jsonb_build_object('nativeV4Receipt',native_receipt);
    perform private.validate_native_v4_receipt_v1(jsonb_build_object(
      'state_snapshot',current_state,'policy_version',current_policy_version,
      'actor_user_id',current_actor_user_id,'profile_id',target_profile_id,'session_id',requested_session_id,
      'requested_at',request_time,'discovery_mode',requested_mode,'requested_item_type',requested_item_type));
  end if;$new4$),
    ('private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid)', $old5$'candidateCount',source->'candidate_count','candidateIds',candidate_ids);$old5$, $new5$'candidateCount',source->'candidate_count','candidateIds',candidate_ids)
    ||case when source->'state_snapshot' ? 'nativeV4Receipt'
      then jsonb_build_object('nativeV4Receipt',source#>'{state_snapshot,nativeV4Receipt}') else '{}'::jsonb end;$new5$),
    ('private.validate_native_final_source_v1(uuid)', $old6$  marker:=source.state_snapshot->'finalScoringInput';$old6$, $new6$  if private.validate_native_v4_receipt_v1(to_jsonb(source)) and not(source.state_snapshot ? 'finalScoringInput') then
    raise exception 'V4 receipt requires its complete FINAL input' using errcode='22023';end if;
  marker:=source.state_snapshot->'finalScoringInput';$new6$)
  ) changes(signature,old_text,new_text) loop
    select pg_get_functiondef(p.oid),p.prosrc into strict definition,original
      from pg_proc p where p.oid=patch.signature::regprocedure;
    if (length(original)-length(replace(original,patch.old_text,'')))/length(patch.old_text)<>1 then
      raise exception 'V4 receipt owner patch drift: %',patch.signature;end if;
    execute replace(definition,original,replace(original,patch.old_text,patch.new_text));
  end loop;
end;$receipt_consumers$;

do $receipt_access$
begin
  if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.pronamespace='private'::regnamespace
      and p.proname in('capture_native_v4_receipt_v1','validate_native_v4_receipt_v1')
      and (a.grantor<>p.proowner or a.grantee<>p.proowner)) then
    raise exception 'V4 receipt new-function access drift';end if;
end;$receipt_access$;
