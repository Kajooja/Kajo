-- One consumed candidate request contract, with the existing three combinations
-- only. Acquisition chooses the pool; intent chooses delivery/evaluation. The
-- old signatures retain their identities and delegate to the same three cores.
-- A finite past requiredAfter is a freshness guard, not receipt verification or
-- historical reconstruction. Existing clocks, policies and frozen rows remain.
do $candidate_request_preflight$
declare expected record; actual record;
begin
  if exists(select 1 from pg_proc where pronamespace='private'::regnamespace and proname=any(array[
    'validate_native_candidate_request_v1','rank_items_request_base_v1',
    'rank_items_request_scalar_v1','rank_items_request_with_identity_v1'])) then
    raise exception 'Native candidate request target collision';
  end if;
  for expected in select * from (values
    ('private.rank_items_candidate_base_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb)',
      '626a9c813441e0397cb990df65ed534e',false,array['search_path=""','extra_float_digits=3']::text[],'plpgsql',false),
    ('private.rank_items_candidate_scalar_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',
      'a2aba6bf5983e99ddec68228b850eebe',true,array['search_path=""']::text[],'plpgsql',false),
    ('private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',
      '07296ce999eaa11446cd534315f32d90',true,array['search_path=""']::text[],'plpgsql',false),
    ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)',
      'ac714253a8af7bef294b5075c0793576',true,array['search_path=""']::text[],'sql',true),
    ('private.rank_items_first_page_v1(jsonb)',
      'a6faa6ca0e0f6da475ae4e303a9e9958',true,array['search_path=""']::text[],'plpgsql',false),
    ('private.rank_items_catalog_chain_v1(jsonb)',
      '121c71beb290be58b8ba9d14d65a754d',true,array['search_path=""','extra_float_digits=3']::text[],'plpgsql',false),
    ('private.capture_personal_evaluation_v1(uuid,uuid,uuid[],timestamptz,jsonb)',
      '966c294f8602f6b02d0ff6c12993a872',false,array['search_path=""']::text[],'plpgsql',false)
  ) checks(signature,body_hash,definer,configuration,language_name,authenticated_access) loop
    select * into strict actual from pg_proc where oid=expected.signature::regprocedure;
    if md5(actual.prosrc)<>expected.body_hash or actual.proowner<>'postgres'::regrole
      or actual.prosecdef is distinct from expected.definer or actual.provolatile<>'v'
      or actual.prolang<>(select oid from pg_language where lanname=expected.language_name)
      or actual.proleakproof or actual.proisstrict or actual.proparallel<>'u'
      or actual.proconfig is distinct from expected.configuration
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) acl
        where acl.grantor<>actual.proowner or (acl.grantee<>actual.proowner and not(
          expected.authenticated_access and acl.grantee='authenticated'::regrole
          and acl.privilege_type='EXECUTE' and not acl.is_grantable)))
      or has_function_privilege('anon',actual.oid,'EXECUTE')
      or has_function_privilege('authenticated',actual.oid,'EXECUTE') is distinct from expected.authenticated_access
      or has_function_privilege('service_role',actual.oid,'EXECUTE') then
      raise exception 'Native candidate request source/security drift: %',expected.signature;
    end if;
  end loop;
end;$candidate_request_preflight$;

create function private.validate_native_candidate_request_v1(
  candidate_request jsonb, require_committed_prefix boolean default false
) returns jsonb language plpgsql stable set search_path='' as $validate$
declare
  acquisition text; intent text; item_ids uuid[]; seen_ids uuid[];
  reminder_spent boolean; required_after timestamptz; field text; entry jsonb;
  uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if candidate_request is null or jsonb_typeof(candidate_request)<>'object'
    or require_committed_prefix is null then
    raise exception 'Invalid native candidate request object' using errcode='22023';
  end if;
  if not(candidate_request ?& array['version','acquisition','intent','itemIds','seenItemIds','reminderSpent','requiredAfter'])
    or exists(select 1 from jsonb_object_keys(candidate_request) k where k<>all(array[
      'version','acquisition','intent','itemIds','seenItemIds','reminderSpent','requiredAfter']))
    or candidate_request->>'version' is distinct from 'native-candidate-request-v1'
    or jsonb_typeof(candidate_request->'acquisition')<>'string'
    or jsonb_typeof(candidate_request->'intent')<>'string'
    or jsonb_typeof(candidate_request->'reminderSpent')<>'boolean'
    or jsonb_typeof(candidate_request->'seenItemIds')<>'array' then
    raise exception 'Invalid native candidate request version or fields' using errcode='22023';
  end if;
  acquisition:=candidate_request->>'acquisition'; intent:=candidate_request->>'intent';
  reminder_spent:=(candidate_request->>'reminderSpent')::boolean;
  if not((acquisition in('LEGACY_DISCOVERY','CATALOG_CHAIN') and intent='DELIVERY')
    or (acquisition='EXPLICIT_CANONICAL' and intent='EVALUATION')) then
    raise exception 'Unsupported native candidate acquisition and intent' using errcode='22023';
  end if;
  if jsonb_array_length(candidate_request->'seenItemIds')>1000
    or (acquisition<>'CATALOG_CHAIN' and
      (jsonb_array_length(candidate_request->'seenItemIds')<>0 or reminder_spent)) then
    raise exception 'Invalid native candidate chain controls' using errcode='22023';
  end if;
  if acquisition='EXPLICIT_CANONICAL' then
    if jsonb_typeof(candidate_request->'itemIds')<>'array' then
      raise exception 'Explicit candidate request requires Item ids' using errcode='22023';
    end if;
    if jsonb_array_length(candidate_request->'itemIds') not between 1 and 50 then
      raise exception 'Explicit candidate request requires 1 to 50 Item ids' using errcode='22023';
    end if;
  elsif candidate_request->'itemIds'<>'null'::jsonb then
    raise exception 'Catalogue candidate request cannot contain explicit Item ids' using errcode='22023';
  end if;
  -- Reject malformed/nested/null entries before casts, and duplicates after
  -- conversion so UUID spelling cannot defeat distinctness. Retain input order.
  foreach field in array array['itemIds','seenItemIds'] loop
    if jsonb_typeof(candidate_request->field)='array' then
      for entry in select value from jsonb_array_elements(candidate_request->field) loop
        if jsonb_typeof(entry)<>'string' or (entry#>>'{}')!~uuid_pattern then
          raise exception 'Invalid native candidate UUID array: %',field using errcode='22023';
        end if;
      end loop;
    end if;
  end loop;
  item_ids:=case when acquisition='EXPLICIT_CANONICAL' then array(
    select value::uuid from jsonb_array_elements_text(candidate_request->'itemIds') with ordinality x(value,n) order by n) else null end;
  seen_ids:=array(select value::uuid from jsonb_array_elements_text(candidate_request->'seenItemIds') with ordinality x(value,n) order by n);
  if (item_ids is not null and cardinality(item_ids)<>(select count(distinct id) from unnest(item_ids) id))
    or cardinality(seen_ids)<>(select count(distinct id) from unnest(seen_ids) id) then
    raise exception 'Native candidate UUID arrays must contain distinct ids' using errcode='22023';
  end if;
  if candidate_request->'requiredAfter'<>'null'::jsonb then
    if intent<>'EVALUATION' or jsonb_typeof(candidate_request->'requiredAfter')<>'string' then
      raise exception 'Invalid native candidate requiredAfter' using errcode='22023';
    end if;
    -- Native timestamptz JSON uses this explicit-offset ISO form. Reject
    -- relative and DateStyle-dependent text at the new direct JSON boundary.
    -- Nonfinite sentinels continue to reach the same freshness rejection below.
    if candidate_request->>'requiredAfter' not in('infinity','-infinity') and
      (length(candidate_request->>'requiredAfter')>32 or candidate_request->>'requiredAfter'
        !~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$') then
      raise exception 'Native candidate requiredAfter requires explicit-offset ISO time' using errcode='22023';
    end if;
    begin
      required_after:=(candidate_request->>'requiredAfter')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid native candidate requiredAfter' using errcode='22023';
    end;
  end if;
  if intent='EVALUATION' and ((require_committed_prefix and required_after is null)
    or (required_after is not null and (not pg_catalog.isfinite(required_after) or required_after>=pg_catalog.now()))) then
    raise exception 'Commit the required answer before a new evaluation transaction' using errcode='40001';
  end if;
  return jsonb_build_object('version','native-candidate-request-v1','acquisition',acquisition,'intent',intent,
    'itemIds',to_jsonb(item_ids),'seenItemIds',to_jsonb(seen_ids),'reminderSpent',reminder_spent,'requiredAfter',required_after);
end;$validate$;
revoke all on function private.validate_native_candidate_request_v1(jsonb,boolean) from public,anon,authenticated,service_role;

do $candidate_request_cores$
declare source record; definition text; body text; patch record; wrapper_body text;
  request_declarations constant text := $declarations$  validated_request jsonb := private.validate_native_candidate_request_v1(candidate_request,false);
  request_acquisition text := validated_request->>'acquisition';
  request_intent text := validated_request->>'intent';
  request_item_ids uuid[] := case when request_acquisition='EXPLICIT_CANONICAL' then array(
    select value::uuid from jsonb_array_elements_text(validated_request->'itemIds') with ordinality x(value,n) order by n) else null end;
  request_seen_ids uuid[] := array(select value::uuid from jsonb_array_elements_text(validated_request->'seenItemIds') with ordinality x(value,n) order by n);
  request_reminder_spent boolean := (validated_request->>'reminderSpent')::boolean;
  request_required_after timestamptz := (validated_request->>'requiredAfter')::timestamptz;
$declarations$;
  compatibility_request constant text := $request$jsonb_build_object(
    'version','native-candidate-request-v1',
    'acquisition',case when _catalog_chain then 'CATALOG_CHAIN'
      when _catalog_chain=false and _candidate_ids is null then 'LEGACY_DISCOVERY'
      when _catalog_chain=false and _candidate_ids is not null then 'EXPLICIT_CANONICAL' else null end,
    'intent',case when _candidate_ids is null then 'DELIVERY' else 'EVALUATION' end,
    'itemIds',to_jsonb(_candidate_ids),'seenItemIds',to_jsonb(_chain_seen),
    'reminderSpent',_chain_reminder_spent,'requiredAfter',EVALUATION_AFTER)$request$;
begin
  for source in select * from (values
    ('private.rank_items_candidate_base_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb)',
      'rank_items_candidate_base_v1','rank_items_request_base_v1',false),
    ('private.rank_items_candidate_scalar_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',
      'rank_items_candidate_scalar_v1','rank_items_request_scalar_v1',false),
    ('private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',
      'rank_items_candidate_with_identity_v1','rank_items_request_with_identity_v1',true)
  ) cores(signature,old_name,new_name,identity_layer) loop
    select pg_get_functiondef(p.oid),p.prosrc into strict definition,body from pg_proc p where p.oid=source.signature::regprocedure;
    -- Rename only the signature. All scoring statements are transformed in
    -- place, then the old body is replaced with a compatibility delegate.
    for patch in select * from (values
      ('rank_items_candidate_base_v1',
        'FUNCTION private.rank_items_candidate_base_v1(_candidate_ids uuid[], _catalog_chain boolean, _chain_seen uuid[], _chain_reminder_spent boolean, ',
        'FUNCTION private.rank_items_request_base_v1(candidate_request jsonb, '),
      ('rank_items_candidate_scalar_v1',
        'FUNCTION private.rank_items_candidate_scalar_v1(_candidate_ids uuid[], _catalog_chain boolean, _chain_seen uuid[], _chain_reminder_spent boolean, ',
        'FUNCTION private.rank_items_request_scalar_v1(candidate_request jsonb, '),
      ('rank_items_candidate_with_identity_v1',
        'FUNCTION private.rank_items_candidate_with_identity_v1(_evaluation_after timestamp with time zone, _candidate_ids uuid[], _catalog_chain boolean, _chain_seen uuid[], _chain_reminder_spent boolean, ',
        'FUNCTION private.rank_items_request_with_identity_v1(candidate_request jsonb, ')
    ) changes(name,before_text,after_text) where name=source.old_name loop
      if (length(definition)-length(replace(definition,patch.before_text,'')))/length(patch.before_text)<>1 then
        raise exception 'Native candidate request signature drift: %',source.old_name;
      end if;
      definition:=replace(definition,patch.before_text,patch.after_text);
    end loop;
    for patch in select * from (values
      ('rank_items_candidate_base_v1',
        'eligibility_time timestamptz := case when _candidate_ids is null then clock_timestamp() else now() end;',
        'eligibility_time timestamptz := case when request_acquisition = ''EXPLICIT_CANONICAL'' then now() else clock_timestamp() end;',1),
      ('rank_items_candidate_scalar_v1',
        'decision_time timestamptz := case when _candidate_ids is null then clock_timestamp() else now() end;',
        'decision_time timestamptz := case when request_intent = ''EVALUATION'' then now() else clock_timestamp() end;',1),
      ('rank_items_candidate_scalar_v1',$old$private.rank_items_candidate_base_v1(
      _candidate_ids, _catalog_chain,
      _chain_seen,
      _chain_reminder_spent,$old$,$new$private.rank_items_request_base_v1(
      validated_request,$new$,1),
      ('rank_items_candidate_with_identity_v1',
        'request_time := case when _candidate_ids is null then pg_catalog.clock_timestamp() else now() end;',
        'request_time := case when request_intent = ''EVALUATION'' then now() else pg_catalog.clock_timestamp() end;',1),
      ('rank_items_candidate_with_identity_v1',$old$private.rank_items_candidate_scalar_v1(
      _candidate_ids, _catalog_chain,
      _chain_seen,
      _chain_reminder_spent,$old$,$new$private.rank_items_request_scalar_v1(
      validated_request,$new$,1),
      ('rank_items_candidate_with_identity_v1',$old$      _candidate_ids is null
      and private.prediction_delivery_tier_v1$old$,$new$      request_intent = 'DELIVERY'
      and private.prediction_delivery_tier_v1$new$,1),
      ('rank_items_candidate_with_identity_v1',
        'case when _candidate_ids is not null then ''+evaluation-candidates-v1''',
        'case when request_intent = ''EVALUATION'' then ''+evaluation-candidates-v1''',1),
      ('rank_items_candidate_with_identity_v1','  if _candidate_ids is not null then',
        '  if request_intent = ''EVALUATION'' then',1),
      ('rank_items_candidate_with_identity_v1',
        '''requiredAfter'',case when _candidate_ids is not null then _evaluation_after else null end',
        '''requiredAfter'',case when request_intent = ''EVALUATION'' then _evaluation_after else null end',1),
      ('rank_items_candidate_with_identity_v1','  insert into private.prediction_runs (',
        $new$  current_state := current_state || jsonb_build_object('candidateRequest',validated_request);

  insert into private.prediction_runs ($new$,1),
      ('rank_items_candidate_with_identity_v1','  candidate_pool_limit :=',
        $new$  if request_intent='EVALUATION' and not exists(select 1 from public.profiles p
    where p.id=target_profile_id and p.profile_type='PERSONAL' and p.owner_user_id=current_actor_user_id) then
    raise exception 'Evaluation requires PersonalProfile owner access' using errcode='42501';
  end if;
  if supplied_prediction_id is null then
    raise exception 'Prediction id is required' using errcode='22023';
  end if;

  candidate_pool_limit :=$new$,1)
    ) changes(name,before_text,after_text,expected_count) where name=source.old_name loop
      if (length(body)-length(replace(body,patch.before_text,'')))/length(patch.before_text)<>patch.expected_count then
        raise exception 'Native candidate request anchor drift: % / %',source.old_name,patch.before_text;
      end if;
      body:=replace(body,patch.before_text,patch.after_text);
    end loop;
    -- Acquisition controls source filtering/features, pool size and declared
    -- acquisition lineage. Intent controls the actual delivery write above.
    body:=replace(body,'_candidate_ids is not null','request_acquisition = ''EXPLICIT_CANONICAL''');
    body:=replace(body,'_candidate_ids is null','request_acquisition <> ''EXPLICIT_CANONICAL''');
    body:=replace(body,'_candidate_ids','request_item_ids');
    body:=replace(body,'_catalog_chain','(request_acquisition = ''CATALOG_CHAIN'')');
    body:=replace(body,'_chain_seen','request_seen_ids');
    body:=replace(body,'_chain_reminder_spent','request_reminder_spent');
    body:=replace(body,'_evaluation_after','request_required_after');
    if (length(body)-length(replace(body,E'declare\n','')))/length(E'declare\n')<>1 then
      raise exception 'Native candidate request declaration drift: %',source.old_name;
    end if;
    body:=replace(body,E'declare\n',E'declare\n'||case when source.identity_layer then
      replace(request_declarations,'candidate_request,false','candidate_request,true') else request_declarations end);
    execute replace(definition,(select prosrc from pg_proc where oid=source.signature::regprocedure),body);

    wrapper_body:=E'\nbegin\n  return query select * from private.'||source.new_name||'('
      ||replace(compatibility_request,'EVALUATION_AFTER',case when source.identity_layer then '_evaluation_after' else 'null::timestamptz' end)
      ||case when source.identity_layer then ', supplied_prediction_id' else '' end
      ||', target_profile_id, requested_mode, requested_item_type, result_limit, request_context'
      ||case when source.old_name='rank_items_candidate_scalar_v1' then ', forced_genome_id' else '' end||E');\nend;\n';
    select pg_get_functiondef(p.oid) into definition from pg_proc p where p.oid=source.signature::regprocedure;
    execute replace(definition,(select prosrc from pg_proc where oid=source.signature::regprocedure),wrapper_body);
  end loop;
end;$candidate_request_cores$;

revoke all on function private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb),
  private.rank_items_request_scalar_v1(jsonb,uuid,text,text,integer,jsonb,uuid),
  private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)
  from public,anon,authenticated,service_role;

-- Preserve the existing native serving call depth. The October 15 extraction
-- likewise connected request owners directly to the identity core; routing them
-- through another compatibility layer exceeds the exercised WASM stack limit.
-- Old callable identities remain intact for compatibility, with unchanged ACLs.
do $candidate_request_callers$
declare patch record; definition text; body text;
begin
  for patch in select * from (values
    ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)',
      'private.rank_items_candidate_with_identity_v1(null,null,false,''{}''::uuid[],false,',
      $new$private.rank_items_request_with_identity_v1('{"version":"native-candidate-request-v1","acquisition":"LEGACY_DISCOVERY","intent":"DELIVERY","itemIds":null,"seenItemIds":[],"reminderSpent":false,"requiredAfter":null}'::jsonb,$new$),
    ('private.rank_items_first_page_v1(jsonb)',
      'private.rank_items_candidate_with_identity_v1(null,null,false,''{}''::uuid[],false,',
      $new$private.rank_items_request_with_identity_v1('{"version":"native-candidate-request-v1","acquisition":"LEGACY_DISCOVERY","intent":"DELIVERY","itemIds":null,"seenItemIds":[],"reminderSpent":false,"requiredAfter":null}'::jsonb,$new$),
    ('private.rank_items_catalog_chain_v1(jsonb)',
      'private.rank_items_candidate_with_identity_v1(null,null,true,seen_before,reminder_spent,',
      $new$private.rank_items_request_with_identity_v1(jsonb_build_object(
      'version','native-candidate-request-v1','acquisition','CATALOG_CHAIN','intent','DELIVERY',
      'itemIds',null,'seenItemIds',to_jsonb(seen_before),'reminderSpent',reminder_spent,'requiredAfter',null),$new$),
    ('private.capture_personal_evaluation_v1(uuid,uuid,uuid[],timestamptz,jsonb)',
      $old$private.rank_items_candidate_with_identity_v1(required_after,requested_item_ids,
    false,'{}'::uuid[],false,$old$,
      $new$private.rank_items_request_with_identity_v1(jsonb_build_object(
    'version','native-candidate-request-v1','acquisition','EXPLICIT_CANONICAL','intent','EVALUATION',
    'itemIds',to_jsonb(requested_item_ids),'seenItemIds','[]'::jsonb,'reminderSpent',false,'requiredAfter',required_after),$new$)
  ) callers(signature,before_text,after_text) loop
    select pg_get_functiondef(p.oid),p.prosrc into strict definition,body from pg_proc p where p.oid=patch.signature::regprocedure;
    if (length(body)-length(replace(body,patch.before_text,'')))/length(patch.before_text)<>1 then
      raise exception 'Native candidate request caller anchor drift: %',patch.signature;
    end if;
    execute replace(definition,body,replace(body,patch.before_text,patch.after_text));
  end loop;
end;$candidate_request_callers$;

-- Unknown default grants must not turn a newly extracted private core into an
-- additional API. Abort the supported migration transaction on that drift.
do $candidate_request_access$
declare target regprocedure; actual record;
begin
  foreach target in array array[
    'private.validate_native_candidate_request_v1(jsonb,boolean)'::regprocedure,
    'private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)'::regprocedure,
    'private.rank_items_request_scalar_v1(jsonb,uuid,text,text,integer,jsonb,uuid)'::regprocedure,
    'private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)'::regprocedure
  ] loop
    select * into strict actual from pg_proc where oid=target;
    if actual.proowner<>'postgres'::regrole
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) acl
        where acl.grantor<>actual.proowner or acl.grantee<>actual.proowner)
      or has_function_privilege('anon',target,'EXECUTE')
      or has_function_privilege('authenticated',target,'EXECUTE')
      or has_function_privilege('service_role',target,'EXECUTE') then
      raise exception 'Native candidate request new-function access drift: %',target;
    end if;
  end loop;
end;$candidate_request_access$;
