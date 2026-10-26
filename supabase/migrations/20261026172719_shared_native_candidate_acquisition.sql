-- One private acquisition owner, consumed by the existing native scorer and V4
-- recognition catalogue. Retained policies, clocks, score math and records stay
-- intact; different declared acquisition inputs are not equal-policy serving.
do $acquisition_preflight$
declare expected record; actual record;
begin
  if current_user<>'postgres' or exists(select 1 from pg_proc
    where pronamespace='private'::regnamespace and proname='acquire_native_candidates_v1') then
    raise exception 'Native acquisition owner or target collision';
  end if;
  for expected in select * from (values
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)',
      'a1838239e7c92017e9c9d1384a1281e9',false,'v','plpgsql',array['search_path=""','extra_float_digits=3']::text[]),
    ('private.taste_candidate_catalog_v4(uuid,timestamptz)',
      'bb3582ab6441469be5ed0f124a3b8018',false,'s','sql',array['search_path=""']::text[]),
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)',
      '88edb62fda37e7d518afeb24b4196947',true,'v','plpgsql',array['search_path=""']::text[])
  ) checks(signature,body_hash,definer,volatility,language_name,configuration) loop
    select * into strict actual from pg_proc where oid=expected.signature::regprocedure;
    if md5(actual.prosrc)<>expected.body_hash or actual.proowner<>'postgres'::regrole
      or actual.prosecdef is distinct from expected.definer or actual.provolatile::text<>expected.volatility
      or actual.prolang<>(select oid from pg_language where lanname=expected.language_name)
      or actual.proleakproof or actual.proisstrict or actual.proparallel<>'u'
      or actual.proconfig is distinct from expected.configuration
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) acl
        where acl.grantor<>actual.proowner or acl.grantee<>actual.proowner)
      or has_function_privilege('anon',actual.oid,'EXECUTE')
      or has_function_privilege('authenticated',actual.oid,'EXECUTE')
      or has_function_privilege('service_role',actual.oid,'EXECUTE') then
      raise exception 'Native acquisition source/security drift: %',expected.signature;
    end if;
  end loop;
end;$acquisition_preflight$;

create function private.acquire_native_candidates_v1(acquisition_request jsonb)
returns table(id uuid,item_type text,title text,description text,tags text[],
  recognition_prior jsonb,has_recognition boolean,source_rank integer,
  retained boolean,resurfacing_input jsonb)
language plpgsql stable security invoker set search_path='' as $acquire$
declare
  scope jsonb; pool jsonb; native_request jsonb; is_taste boolean;
  scope_profile_id uuid; scope_actor_id uuid; scope_session_id uuid; mode text; domain text;
  evidence_at timestamptz; eligibility_at timestamptz; receipt_at timestamptz;
  field text; value jsonb; parsed_time timestamptz; acquisition text;
  item_ids uuid[]; seen_ids uuid[]; reminder_spent boolean;
  taste_session private.sequential_taste_sessions%rowtype;
  uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  time_pattern constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
  if acquisition_request is null or jsonb_typeof(acquisition_request)<>'object'
    or octet_length(acquisition_request::text)>65536
    or acquisition_request->>'version' is distinct from 'native-candidate-acquisition-v1'
    or not(acquisition_request ?& array['version','scope','mode','itemType','nativeEvidenceAsOf',
      'eligibilityAt','eligibilityClock','sourcePolicy','candidateRequest','tastePool'])
    or exists(select 1 from jsonb_object_keys(acquisition_request) k where k<>all(array[
      'version','scope','mode','itemType','nativeEvidenceAsOf','eligibilityAt','eligibilityClock',
      'sourcePolicy','candidateRequest','tastePool'])) then
    raise exception 'Invalid native acquisition contract' using errcode='22023';
  end if;
  scope:=acquisition_request->'scope';
  if jsonb_typeof(scope)<>'object' or not(scope ?& array['profileId','actorUserId','sessionId'])
    or exists(select 1 from jsonb_object_keys(scope) k where k<>all(array['profileId','actorUserId','sessionId'])) then
    raise exception 'Invalid native acquisition scope' using errcode='22023';
  end if;
  foreach field in array array['profileId','actorUserId','sessionId'] loop
    value:=scope->field;
    if field='sessionId' and value='null'::jsonb then continue;end if;
    if jsonb_typeof(value)<>'string' or (value#>>'{}')!~uuid_pattern then
      raise exception 'Invalid native acquisition scope identity' using errcode='22023';
    end if;
  end loop;
  scope_profile_id:=(scope->>'profileId')::uuid;scope_actor_id:=(scope->>'actorUserId')::uuid;
  scope_session_id:=(scope->>'sessionId')::uuid;
  if scope_actor_id is distinct from auth.uid() or not coalesce(private.is_profile_member(scope_profile_id),false) then
    raise exception 'Native acquisition access denied' using errcode='42501';
  end if;
  mode:=acquisition_request->>'mode';domain:=acquisition_request->>'itemType';
  if jsonb_typeof(acquisition_request->'mode')<>'string' or mode not in('FOR_YOU','SURPRISE','RISK')
    or jsonb_typeof(acquisition_request->'itemType') not in('string','null')
    or (domain is not null and domain not in('BOOK','MOVIE')) then
    raise exception 'Invalid native acquisition mode or domain' using errcode='22023';
  end if;
  foreach field in array array['nativeEvidenceAsOf','eligibilityAt'] loop
    value:=acquisition_request->field;
    if jsonb_typeof(value)<>'string' or length(value#>>'{}')>32 or (value#>>'{}')!~time_pattern then
      raise exception 'Native acquisition requires explicit finite clocks' using errcode='22023';
    end if;
    begin parsed_time:=(value#>>'{}')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid native acquisition clock' using errcode='22023';
    end;
    if not isfinite(parsed_time) then
      raise exception 'Invalid native acquisition clock' using errcode='22023';
    end if;
    if field='nativeEvidenceAsOf' then evidence_at:=parsed_time;else eligibility_at:=parsed_time;end if;
  end loop;
  -- A declared arithmetic cutoff is not a historical/current-row snapshot proof.
  if evidence_at<>now() then
    raise exception 'Native acquisition evidence clock must be transaction start' using errcode='22023';
  end if;
  pool:=acquisition_request->'tastePool';
  is_taste:=acquisition_request->'candidateRequest'='null'::jsonb;
  if is_taste then
    if jsonb_typeof(pool)<>'object'
      or not(pool ?& array['policy','receiptRevision','receiptTransaction','receiptAt',
        'sourceLimitPerDomain','retainedLimitPerDomain','selectionTagLimit'])
      or exists(select 1 from jsonb_object_keys(pool) k where k<>all(array[
        'policy','receiptRevision','receiptTransaction','receiptAt',
        'sourceLimitPerDomain','retainedLimitPerDomain','selectionTagLimit']))
      or pool->>'policy' is distinct from 'CANONICAL_FORECAST_POOL_V4'
      or pool->'sourceLimitPerDomain' is distinct from '128'::jsonb
      or pool->'retainedLimitPerDomain' is distinct from '25'::jsonb
      or pool->'selectionTagLimit' is distinct from '64'::jsonb
      or mode<>'FOR_YOU' or domain is not null
      or acquisition_request->>'eligibilityClock' is distinct from 'SERVER_POOL_CUTOFF'
      or acquisition_request->>'sourcePolicy' is distinct from 'CANONICAL_AVAILABLE_AT_CUTOFF' then
      raise exception 'Invalid native recognition acquisition policy' using errcode='22023';
    end if;
    select s.* into taste_session from private.sequential_taste_sessions s
      where s.id=scope_session_id and s.profile_id=scope_profile_id and s.actor_user_id=scope_actor_id
        and s.status='ACTIVE' and s.policy='CANONICAL_FORECAST_POOL_V4';
    if not found then raise exception 'Native acquisition session access denied' using errcode='42501';end if;
    value:=pool->'receiptAt';
    if jsonb_typeof(value)<>'string' or length(value#>>'{}')>32 or (value#>>'{}')!~time_pattern then
      raise exception 'Invalid native acquisition receipt clock' using errcode='22023';
    end if;
    begin receipt_at:=(value#>>'{}')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid native acquisition receipt clock' using errcode='22023';
    end;
    if pool->'receiptRevision' is distinct from to_jsonb(taste_session.revision)
      or pool->'receiptTransaction' is distinct from to_jsonb(taste_session.receipt_transaction)
      or receipt_at is distinct from taste_session.receipt_at then
      raise exception 'Native acquisition requires the retained session receipt' using errcode='40001';
    end if;
    acquisition:='TASTE_RECOGNITION_V4';seen_ids:='{}';reminder_spent:=false;
  else
    if pool<>'null'::jsonb then
      raise exception 'Native catalogue acquisition cannot contain a Taste policy' using errcode='22023';
    end if;
    native_request:=private.validate_native_candidate_request_v1(acquisition_request->'candidateRequest',false);
    acquisition:=native_request->>'acquisition';
    item_ids:=case when acquisition='EXPLICIT_CANONICAL' then array(
      select x::uuid from jsonb_array_elements_text(native_request->'itemIds') x) else null end;
    seen_ids:=array(select x::uuid from jsonb_array_elements_text(native_request->'seenItemIds') x);
    reminder_spent:=(native_request->>'reminderSpent')::boolean;
    if acquisition_request->>'sourcePolicy' is distinct from (case when acquisition='EXPLICIT_CANONICAL'
        then 'CANONICAL_AVAILABLE_AT_CUTOFF' else 'LEGACY_DISCOVERABLE_ROWS' end)
      or acquisition_request->>'eligibilityClock' is distinct from (case when acquisition='EXPLICIT_CANONICAL'
        then 'TRANSACTION_START' else 'CURRENT_WALL_TIME' end)
      or (acquisition='EXPLICIT_CANONICAL' and eligibility_at<>evidence_at) then
      raise exception 'Contradictory native acquisition source or clock policy' using errcode='22023';
    end if;
  end if;

  return query
  with potential_skips as materialized (
    select distinct c.item_id from private.contextual_skip_commands c
    where is_taste and c.profile_id=scope_profile_id and c.kind='CONTEXTUAL_SKIP'
      and c.erased_at is null and c.accepted_at<=eligibility_at and c.item_id is not null
  ), available as materialized (
    select i.id,i.item_type,i.title,i.description,i.tags,
      case when is_taste then private.catalog_cold_start_prior_v1(i.id,eligibility_at) end prior,
      case when is_taste then
        coalesce(i.metadata->>'coldStartRecognition','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
        or coalesce(i.metadata->>'voteCount','') ~ '^[0-9]+$' else false end recognized,
      case when not is_taste then private.resurfacing_policy_decision_v1(scope_profile_id,i.id,
        jsonb_build_object('consumedSuppressed',coalesce(a.consumed,false),'rating',a.rating,
          'notInterested',coalesce(a.not_interested,false),'saved',coalesce(a.saved,false)),eligibility_at) end policy
    from public.items i left join public.item_interactions a on a.profile_id=scope_profile_id and a.item_id=i.id
    where i.discoverable and (domain is null or i.item_type=domain)
      and (acquisition<>'CATALOG_CHAIN' or not(i.id=any(seen_ids)))
      and (item_ids is null or i.id=any(item_ids))
      and (acquisition in('LEGACY_DISCOVERY','CATALOG_CHAIN')
        or private.canonical_item_source_available_v1(i.id,eligibility_at))
      and (not is_taste or (i.item_type in('BOOK','MOVIE')
        and not exists(select 1 from jsonb_array_elements(taste_session.presentations) q where q->>'objectId'=i.id::text)
        and not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=scope_profile_id and b.item_id=i.id)
        and not exists(select 1 from public.events e where e.profile_id=scope_profile_id and e.item_id=i.id
          and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_SAVED'))
        and a.item_id is null
        and case when exists(select 1 from potential_skips p where p.item_id=i.id)
          then (private.contextual_skip_decision_v1(scope_profile_id,i.id,eligibility_at,true)->>'eligible')::boolean else true end))
  ), admitted as (
    select a.* from available a where not(acquisition='CATALOG_CHAIN' and reminder_spent
      and a.policy->>'classification'='SAVED_REMINDER_ELIGIBLE')
  ), numbered as (
    select a.*,case when is_taste then row_number() over(partition by a.item_type
      order by (a.prior->>'recognition')::double precision desc,a.id)::integer end n from admitted a
  )
  select n.id,n.item_type,n.title,n.description,n.tags,n.prior,n.recognized,n.n,
    case when is_taste then n.n<=25 else true end,n.policy
  from numbered n where not is_taste or n.n<=128 order by n.id;
end;$acquire$;
revoke all on function private.acquire_native_candidates_v1(jsonb) from public,anon,authenticated,service_role;

-- Patch the consumed owners in place. No retained record or public signature is
-- rewritten. The identity owner threads only its actual session to the private
-- scorer call; persisted sanitized Context and every other score input stay exact.
do $acquisition_consumers$
declare patch record; definition text; original text; rewritten text;
begin
  for patch in select * from (values
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old0$  baseline_genome_config jsonb;$old0$, $new0$  native_acquisition jsonb;
  baseline_genome_config jsonb;$new0$),
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old1$  select config into strict baseline_genome_config from private.predictor_genomes$old1$, $new1$  native_acquisition:=jsonb_build_object('version','native-candidate-acquisition-v1',
    'scope',jsonb_build_object('profileId',target_profile_id,'actorUserId',auth.uid(),
      'sessionId',case when request_context->>'sessionId' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (request_context->>'sessionId')::uuid end),
    'mode',requested_mode,'itemType',requested_item_type,'nativeEvidenceAsOf',now(),
    'eligibilityAt',eligibility_time,'eligibilityClock',case when request_acquisition='EXPLICIT_CANONICAL'
      then 'TRANSACTION_START' else 'CURRENT_WALL_TIME' end,
    'sourcePolicy',case when request_acquisition='EXPLICIT_CANONICAL'
      then 'CANONICAL_AVAILABLE_AT_CUTOFF' else 'LEGACY_DISCOVERABLE_ROWS' end,
    'candidateRequest',validated_request,'tastePool',null);

  select config into strict baseline_genome_config from private.predictor_genomes$new1$),
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old2$      candidate.tags,
      coalesce(sum(tag_evidence.long_term_score)$old2$, $new2$      candidate.tags,
      candidate.resurfacing_input,
      coalesce(sum(tag_evidence.long_term_score)$new2$),
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old3$    from public.items as candidate$old3$, $new3$    from private.acquire_native_candidates_v1(native_acquisition) as candidate$new3$),
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old4$    where candidate.discoverable
      and (not (request_acquisition = 'CATALOG_CHAIN') or not(candidate.id=any(request_seen_ids)))
      and (request_acquisition <> 'EXPLICIT_CANONICAL' or (candidate.id=any(request_item_ids)
        and private.canonical_item_source_available_v1(candidate.id,eligibility_time)))
      and (requested_item_type is null or candidate.item_type = requested_item_type)
$old4$, $new4$$new4$),
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old5$      candidate.tags,
      interaction.interest,$old5$, $new5$      candidate.tags,
      candidate.resurfacing_input,
      interaction.interest,$new5$),
    ('private.rank_items_request_base_v1(jsonb,uuid,text,text,integer,jsonb)', $old6$      row_number() over (order by final_score desc, id)::integer as baseline_score_rank,
      private.resurfacing_policy_decision_v1(
        target_profile_id, scored.id,
        jsonb_build_object('consumedSuppressed',scored.consumed,'rating',scored.rating,
          'notInterested',scored.not_interested,'saved',scored.saved),
        eligibility_time
      ) as resurfacing_input
    from scored
    where not((request_acquisition = 'CATALOG_CHAIN') and request_reminder_spent and private.resurfacing_policy_decision_v1(
      target_profile_id,scored.id,jsonb_build_object('consumedSuppressed',scored.consumed,
        'rating',scored.rating,'notInterested',scored.not_interested,'saved',scored.saved),
      eligibility_time)->>'classification'='SAVED_REMINDER_ELIGIBLE')$old6$, $new6$      row_number() over (order by final_score desc, id)::integer as baseline_score_rank
    from scored$new6$),
    ('private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)', $old7$      candidate_pool_limit,
      current_context,
      serving_genome_id$old7$, $new7$      candidate_pool_limit,
      current_context||jsonb_build_object('sessionId',requested_session_id),
      serving_genome_id$new7$),
    ('private.taste_candidate_catalog_v4(uuid,timestamp with time zone)', $old8$
  with session as materialized (
    select * from private.sequential_taste_sessions where id=target_session and policy='CANONICAL_FORECAST_POOL_V4'
      and status='ACTIVE' and actor_user_id=auth.uid()
  ), potential_skips as materialized (
    -- Absence of a retained pre-cutoff skip makes the canonical decision true.
    -- Leave cooldown/reversal handling to that helper for every potential source.
    select distinct item_id from private.contextual_skip_commands
    where profile_id=(select profile_id from session) and kind='CONTEXTUAL_SKIP'
      and erased_at is null and accepted_at<=cutoff and item_id is not null
  ), eligible as materialized (
    select i.id,i.item_type,i.title,i.tags,
      private.catalog_cold_start_prior_v1(i.id,cutoff) prior,
      (coalesce(i.metadata->>'coldStartRecognition','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
        or coalesce(i.metadata->>'voteCount','') ~ '^[0-9]+$') has_recognition
    from session s cross join public.items i
    where i.item_type in('BOOK','MOVIE') and i.discoverable
      and private.canonical_item_source_available_v1(i.id,cutoff)
      and not exists(select 1 from jsonb_array_elements(s.presentations) q where q->>'objectId'=i.id::text)
      and not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=s.profile_id and b.item_id=i.id)
      and not exists(select 1 from public.events e where e.profile_id=s.profile_id and e.item_id=i.id
        and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_SAVED'))
      and not exists(select 1 from public.item_interactions a where a.profile_id=s.profile_id and a.item_id=i.id)
      and case when exists(select 1 from potential_skips potential where potential.item_id=i.id)
        then (private.contextual_skip_decision_v1(s.profile_id,i.id,cutoff,true)->>'eligible')::boolean else true end
  ), bounded as materialized (
    select * from (select e.*,row_number() over(partition by item_type
      order by (prior->>'recognition')::double precision desc,id) n from eligible e) ranked where n<=128
  ),$old8$, $new8$
  with session as materialized (
    select * from private.sequential_taste_sessions where id=target_session and policy='CANONICAL_FORECAST_POOL_V4'
      and status='ACTIVE' and actor_user_id=auth.uid() and isfinite(cutoff)
  ), bounded as materialized (
    select a.id,a.item_type,a.title,a.tags,a.recognition_prior prior,a.has_recognition,
      a.source_rank n,a.retained
    from session s cross join lateral private.acquire_native_candidates_v1(jsonb_build_object(
      'version','native-candidate-acquisition-v1',
      'scope',jsonb_build_object('profileId',s.profile_id,'actorUserId',s.actor_user_id,'sessionId',s.id),
      'mode','FOR_YOU','itemType',null,'nativeEvidenceAsOf',now(),'eligibilityAt',cutoff,
      'eligibilityClock','SERVER_POOL_CUTOFF','sourcePolicy','CANONICAL_AVAILABLE_AT_CUTOFF',
      'candidateRequest',null,'tastePool',jsonb_build_object('policy',s.policy,
        'receiptRevision',s.revision,'receiptTransaction',s.receipt_transaction,'receiptAt',s.receipt_at,
        'sourceLimitPerDomain',128,'retainedLimitPerDomain',25,'selectionTagLimit',64))) a
  ),$new8$),
    ('private.taste_candidate_catalog_v4(uuid,timestamp with time zone)', $old9$from bounded b where n<=25;$old9$, $new9$from bounded b where b.retained;$new9$)
  ) changes(signature,old_text,new_text) loop
    select pg_get_functiondef(p.oid),p.prosrc into strict definition,original
      from pg_proc p where p.oid=patch.signature::regprocedure;
    if (length(original)-length(replace(original,patch.old_text,'')))/length(patch.old_text)<>1 then
      raise exception 'Native acquisition owner patch drift: %',patch.signature;
    end if;
    rewritten:=replace(original,patch.old_text,patch.new_text);
    execute replace(definition,original,rewritten);
  end loop;
end;$acquisition_consumers$;

-- Revoke known API roles above, then reject any inherited unexpected grant.
-- Never repair an ambient default ACL as part of an application forward.
do $acquisition_access$
declare f pg_proc%rowtype;
begin
  select * into strict f from pg_proc where oid='private.acquire_native_candidates_v1(jsonb)'::regprocedure;
  if exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
    where a.grantee<>f.proowner or a.grantor<>f.proowner) then
    raise exception 'Native acquisition new-function access drift';
  end if;
end;$acquisition_access$;
