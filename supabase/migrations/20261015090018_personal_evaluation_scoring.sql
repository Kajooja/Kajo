-- One scoring implementation for ordinary, catalogue-chain and explicit-candidate
-- evaluation. Existing public signatures, ACLs, frozen runs and v1 Taste stay intact.
-- Exact source guards make unknown upstream drift fail before any extraction.
do $shared_scoring$
declare target regprocedure; definition text; patch record; source record;
begin
  for source in select * from (values
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)','fc7db30df38d5604987936d21a11a4da'),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)','4d03435e5ed97ba2c86178e6c9cba0f9'),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)','c65a0a1e7c8d00725fb4ad5fe5076eac'),
      ('private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)','bb4c2ddb29cbbf9b14186410ac9e084a'),
      ('private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)','7a74e8ad7e09235be3a8588c9d5bb908'),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)','4f9912a24b3868d3b27ade970f9ae467'),
      ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)','8b116d51c38506a766594a3d55aa211c'),
      ('private.rank_items_first_page_v1(jsonb)','255928d830a4e7aee15b8a0bcc96190c'),
      ('private.rank_items_catalog_chain_v1(jsonb)','89ec67ba25ff9777713d2a4df81e24fd')
  ) expected(signature,hash) loop
    if md5(pg_get_functiondef(source.signature::regprocedure))<>source.hash then
      raise exception 'Evaluation scoring source drift: %',source.signature;
    end if;
  end loop;
  foreach target in array array[
    'private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)'::regprocedure,
    'private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)'::regprocedure,
    'private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(target);
    for patch in select * from (values
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$FUNCTION private.rank_items_catalog_base_v1($old$,$new$FUNCTION private.rank_items_candidate_base_v1(_candidate_ids uuid[], _catalog_chain boolean, $new$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$eligibility_time timestamptz := clock_timestamp();$old$,$new$eligibility_time timestamptz := case when _candidate_ids is null then clock_timestamp() else now() end;$new$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$      and not(candidate.id=any(_chain_seen))$old$,$new$      and (not _catalog_chain or not(candidate.id=any(_chain_seen)))
      and (_candidate_ids is null or (candidate.id=any(_candidate_ids)
        and exists(select 1 from private.item_sources source where source.item_id=candidate.id and source.provider_key<>'kajo_mock')))$new$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$    where not(_chain_reminder_spent and private.resurfacing_policy_decision_v1($old$,$new$    where not(_catalog_chain and _chain_reminder_spent and private.resurfacing_policy_decision_v1($new$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$        'catalogChainVersion','catalog-chain-v1','seenCount',cardinality(_chain_seen),
        'seenPrefixHash',md5(array_to_string(_chain_seen,',')),
        'reminderPreviouslyDelivered',_chain_reminder_spent,
$old$,$new$$new$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$        'baselineScoreRank',ranked.baseline_score_rank,'admissionRank',ranked.result_rank
      ),$old$,$new$        'baselineScoreRank',ranked.baseline_score_rank,'admissionRank',ranked.result_rank
      ) || case when _catalog_chain then jsonb_build_object(
        'catalogChainVersion','catalog-chain-v1','seenCount',cardinality(_chain_seen),
        'seenPrefixHash',md5(array_to_string(_chain_seen,',')),
        'reminderPreviouslyDelivered',_chain_reminder_spent
      ) else '{}'::jsonb end,$new$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$old$      'contextAccepted', request_context <> '{}'::jsonb
    )$old$,$new$      'contextAccepted', request_context <> '{}'::jsonb
    ) || case when _candidate_ids is not null then jsonb_build_object('evaluationFeatures',
      jsonb_build_object('version','canonical-item-tags-v1','itemType',ranked.item_type,'tags',to_jsonb(ranked.tags)))
      else '{}'::jsonb end$new$),
      ('private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',$old$FUNCTION private.rank_items_catalog_scalar_v1($old$,$new$FUNCTION private.rank_items_candidate_scalar_v1(_candidate_ids uuid[], _catalog_chain boolean, $new$),
      ('private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',$old$decision_time timestamptz := clock_timestamp();$old$,$new$decision_time timestamptz := case when _candidate_ids is null then clock_timestamp() else now() end;$new$),
      ('private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',$old$    from private.rank_items_catalog_base_v1(
$old$,$new$    from private.rank_items_candidate_base_v1(
      _candidate_ids, _catalog_chain,
$new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$FUNCTION private.rank_items_catalog_with_identity_v1($old$,$new$FUNCTION private.rank_items_candidate_with_identity_v1(_evaluation_after timestamp with time zone, _candidate_ids uuid[], _catalog_chain boolean, $new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$  request_time := pg_catalog.clock_timestamp();$old$,$new$  request_time := case when _candidate_ids is null then pg_catalog.clock_timestamp() else now() end;$new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$  candidate_pool_limit := least(50, greatest(result_limit, result_limit * 3));$old$,$new$  candidate_pool_limit := case when _candidate_ids is null then least(50, greatest(result_limit, result_limit * 3)) else cardinality(_candidate_ids) end;$new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$  end || '+frozen-replay-v2+eligibility-first-v1+catalog-chain-v1';$old$,$new$  end || '+frozen-replay-v2+eligibility-first-v1'
    || case when _catalog_chain then '+catalog-chain-v1' else '' end
    || case when _candidate_ids is not null then '+evaluation-candidates-v1' else '' end;$new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$  insert into private.prediction_runs ($old$,$new$  if _candidate_ids is not null then
    current_state := current_state || jsonb_build_object('evaluationInput',jsonb_build_object(
      'version','personal-evaluation-v1','candidateIds',to_jsonb(_candidate_ids),
      'evidenceCutoff',request_time,'requiredAfter',_evaluation_after,
      'scope','REQUESTED_CANDIDATES','calibration','UNCALIBRATED_ORDINAL'));
  end if;

  insert into private.prediction_runs ($new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$    from private.rank_items_catalog_scalar_v1(
$old$,$new$    from private.rank_items_candidate_scalar_v1(
      _candidate_ids, _catalog_chain,
$new$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$old$      private.prediction_delivery_tier_v1(reranked.final_explanation -> 'resurfacingPolicy') < 2
      and reranked.final_rank <= result_limit,$old$,$new$      _candidate_ids is null
      and private.prediction_delivery_tier_v1(reranked.final_explanation -> 'resurfacingPolicy') < 2
      and reranked.final_rank <= result_limit,$new$)
    ) changes(signature,old_text,new_text) where signature::regprocedure=target loop
      if (length(definition)-length(replace(definition,patch.old_text,'')))/length(patch.old_text)<>1 then
        raise exception 'Evaluation scoring anchor drift: %',target;
      end if;
      definition:=replace(definition,patch.old_text,patch.new_text);
    end loop;
    execute definition;
  end loop;
  -- Preserve each old function's identity/defaults/owner/security/configuration/ACL.
  -- Only its implementation delegates to the extracted common boundary.
  for patch in select * from (values
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)',$body$begin
  return query select * from private.rank_items_candidate_base_v1(null, false, '{}'::uuid[], false, target_profile_id, requested_mode, requested_item_type, result_limit, request_context);
end;
$body$),
      ('private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',$body$begin
  return query select * from private.rank_items_candidate_base_v1(null, true, _chain_seen, _chain_reminder_spent, target_profile_id, requested_mode, requested_item_type, result_limit, request_context);
end;
$body$),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)',$body$begin
  return query select * from private.rank_items_candidate_scalar_v1(null, false, '{}'::uuid[], false, target_profile_id, requested_mode, requested_item_type, result_limit, request_context, forced_genome_id);
end;
$body$),
      ('private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',$body$begin
  return query select * from private.rank_items_candidate_scalar_v1(null, true, _chain_seen, _chain_reminder_spent, target_profile_id, requested_mode, requested_item_type, result_limit, request_context, forced_genome_id);
end;
$body$),
      ('private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',$body$begin
  return query select * from private.rank_items_candidate_with_identity_v1(null, null, false, '{}'::uuid[], false, supplied_prediction_id, target_profile_id, requested_mode, requested_item_type, result_limit, request_context);
end;
$body$),
      ('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',$body$begin
  return query select * from private.rank_items_candidate_with_identity_v1(null, null, true, _chain_seen, _chain_reminder_spent, supplied_prediction_id, target_profile_id, requested_mode, requested_item_type, result_limit, request_context);
end;
$body$)
  ) wrappers(signature,body) loop
    definition:=pg_get_functiondef(patch.signature::regprocedure);
    execute left(definition,strpos(definition,'AS $function$')-1)
      ||'AS $function$'||chr(10)||patch.body||'$function$';
  end loop;
  -- Existing request owners enter the shared implementation directly, keeping
  -- the original serving call depth. Old identities remain compatibility APIs.
  for patch in select * from (values
    ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)',
      'private.rank_items_with_identity_v1(',
      'private.rank_items_candidate_with_identity_v1(null,null,false,''{}''::uuid[],false,'),
    ('private.rank_items_first_page_v1(jsonb)',
      'private.rank_items_with_identity_v1(',
      'private.rank_items_candidate_with_identity_v1(null,null,false,''{}''::uuid[],false,'),
    ('private.rank_items_catalog_chain_v1(jsonb)',
      'private.rank_items_catalog_with_identity_v1(',
      'private.rank_items_candidate_with_identity_v1(null,null,true,')
  ) callers(signature,old_text,new_text) loop
    definition:=pg_get_functiondef(patch.signature::regprocedure);
    if (length(definition)-length(replace(definition,patch.old_text,'')))/length(patch.old_text)<>1 then
      raise exception 'Evaluation request owner anchor drift: %',patch.signature;
    end if;
    execute replace(definition,patch.old_text,patch.new_text);
  end loop;
end;
$shared_scoring$;

revoke all on function private.rank_items_candidate_base_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb),
  private.rank_items_candidate_scalar_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb,uuid),
  private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)
  from public,anon,authenticated,service_role;

-- Internal owner only: the future durable Taste command supplies its retained
-- answer receipt time as required_after. A client cannot choose scoring inputs,
-- a later evidence clock or a genome. This is not a public/session v2 endpoint.
create function private.capture_personal_evaluation_v1(
  supplied_prediction_id uuid, target_profile_id uuid, requested_item_ids uuid[],
  required_after timestamptz, request_context jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path='' as $capture$
declare result jsonb; cutoff timestamptz:=now();
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p
    where p.id=target_profile_id and p.profile_type='PERSONAL' and p.owner_user_id=auth.uid()) then
    raise exception 'Evaluation requires PersonalProfile owner access' using errcode='42501';
  end if;
  if supplied_prediction_id is null or requested_item_ids is null
    or array_ndims(requested_item_ids) is distinct from 1
    or cardinality(requested_item_ids) not between 1 and 50
    or array_position(requested_item_ids,null) is not null
    or (select count(distinct id) from unnest(requested_item_ids) id)<>cardinality(requested_item_ids) then
    raise exception 'Evaluation requires 1 to 50 distinct Item ids and a new Prediction id' using errcode='22023';
  end if;
  if required_after is null or not pg_catalog.isfinite(required_after) or required_after>=cutoff then
    raise exception 'Commit the required answer before a new evaluation transaction' using errcode='40001';
  end if;
  -- Freeze all state and scoring at transaction start. The shared source readers
  -- use now(); an in-transaction answer must never be mislabelled as consumed.
  perform * from private.rank_items_candidate_with_identity_v1(required_after,requested_item_ids,
    false,'{}'::uuid[],false,supplied_prediction_id,target_profile_id,'FOR_YOU',null,
    cardinality(requested_item_ids),request_context);
  select jsonb_build_object(
    'version','personal-evaluation-v1','predictionId',r.id,'profileId',r.profile_id,
    'evidenceCutoff',r.requested_at,'requiredAfter',required_after,
    'genomeId',r.genome_id,'modelVersion',r.model_version,'policyVersion',r.policy_version,
    'metric','SAME_PREFIX_ORDINAL','calibration','UNCALIBRATED','delivery',false,
    'items',(select jsonb_agg(jsonb_build_object('itemId',requested.id,
      'itemType',coalesce(c.explanation#>>'{evaluationFeatures,itemType}',i.item_type),
      'features',c.explanation->'evaluationFeatures',
      'status',case when c.item_id is not null and coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false)
        then 'AVAILABLE' else 'UNAVAILABLE' end,
      'reason',case when c.item_id is null then 'MISSING_OR_INELIGIBLE_ITEM'
        when not coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) then 'SUPPRESSED' else null end,
      'score',case when coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) then c.final_score else null end,
      'rank',case when coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) then c.final_rank else null end
    ) order by requested.ordinality) from unnest(requested_item_ids) with ordinality requested(id,ordinality)
      left join public.items i on i.id=requested.id
      left join private.prediction_candidates c on c.prediction_id=r.id and c.item_id=requested.id)
  ) into result from private.prediction_runs r where r.id=supplied_prediction_id;
  return result;
end;
$capture$;
revoke all on function private.capture_personal_evaluation_v1(uuid,uuid,uuid[],timestamptz,jsonb)
  from public,anon,authenticated,service_role;
