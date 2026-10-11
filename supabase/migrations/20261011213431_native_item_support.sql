-- Native confidence support: distinct already-admitted matching Items.
-- Legacy evidenceCount remains the native tag-incidence diagnostic. Scores,
-- feature/genome/base versions and frozen history retain their exact semantics.
-- The /8 heuristic is uncalibrated and does not establish independent outcomes.
do $native_item_support_guard$
declare patch jsonb;replacement jsonb;source text;signature regprocedure;
begin
  if to_regprocedure('private.native_item_support_count_v1(uuid[])') is not null then
    raise exception 'Native Item support forward: helper already exists' using errcode='55000';end if;
  for patch in select value from jsonb_array_elements($native_item_support_manifest$[{"signature":"private.rank_items_v0(uuid,text,text,integer,jsonb)","sourceMd5":"478a0d8a1554dce3a274de3aaf5d0f98","replacements":[{"before":"      count(*)::integer as evidence_count\n    from weighted_events","after":"      count(*)::integer as evidence_count,\n      array_agg(distinct weighted_events.item_id) as native_support_item_ids\n    from weighted_events","count":1},{"before":"      coalesce(native.evidence_count, 0) as evidence_count,","after":"      coalesce(native.evidence_count, 0) as evidence_count,\n      coalesce(native.native_support_item_ids, '{}'::uuid[]) as native_support_item_ids,","count":1},{"before":"    from policy_candidates\n  )\n  select","after":"    from policy_candidates\n  ),\n  -- Count support only once per retained candidate (at most result_limit=50).\n  -- The complete scoring/admission pool above remains unchanged.\n  native_supported as materialized (\n    select ranked.*,\n      private.native_item_support_count_v1(array(\n        select unnest(matched.native_support_item_ids)\n        from tag_evidence as matched\n        where matched.tag = any(ranked.tags)\n      )) as native_item_support_count\n    from ranked\n    where ranked.result_rank <= result_limit\n  )\n  select","count":1},{"before":"  from ranked\n  cross join prediction","after":"  from native_supported as ranked\n  cross join prediction","count":1},{"before":"    least(1.0, ranked.evidence_count::double precision / 8.0),","after":"    least(1.0, ranked.native_item_support_count::double precision / 8.0),","count":1},{"before":"      'evidenceCount', ranked.evidence_count,","after":"      'evidenceCount', ranked.evidence_count,\n      'nativeItemSupportCount', ranked.native_item_support_count,\n      'nativeSupportVersion', 'native-item-support-v1',\n      'nativeSupportBasis', 'DISTINCT_MATCHING_NATIVE_ITEMS',\n      'nativeSupportCalibration', 'uncalibrated',","count":1}]},{"signature":"private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)","sourceMd5":"d30e2000ec99cdbf315152454aada8fe","replacements":[{"before":"      count(*)::integer as evidence_count\n    from weighted_events","after":"      count(*)::integer as evidence_count,\n      array_agg(distinct weighted_events.item_id) as native_support_item_ids\n    from weighted_events","count":1},{"before":"      coalesce(native.evidence_count, 0) as evidence_count,","after":"      coalesce(native.evidence_count, 0) as evidence_count,\n      coalesce(native.native_support_item_ids, '{}'::uuid[]) as native_support_item_ids,","count":1},{"before":"    from policy_candidates\n  )\n  select","after":"    from policy_candidates\n  ),\n  -- Count support only once per retained candidate (at most result_limit=50).\n  -- The complete scoring/admission pool above remains unchanged.\n  native_supported as materialized (\n    select ranked.*,\n      private.native_item_support_count_v1(array(\n        select unnest(matched.native_support_item_ids)\n        from tag_evidence as matched\n        where matched.tag = any(ranked.tags)\n      )) as native_item_support_count\n    from ranked\n    where ranked.result_rank <= result_limit\n  )\n  select","count":1},{"before":"  from ranked\n  cross join prediction","after":"  from native_supported as ranked\n  cross join prediction","count":1},{"before":"    least(1.0, ranked.evidence_count::double precision / 8.0),","after":"    least(1.0, ranked.native_item_support_count::double precision / 8.0),","count":1},{"before":"      'evidenceCount', ranked.evidence_count,","after":"      'evidenceCount', ranked.evidence_count,\n      'nativeItemSupportCount', ranked.native_item_support_count,\n      'nativeSupportVersion', 'native-item-support-v1',\n      'nativeSupportBasis', 'DISTINCT_MATCHING_NATIVE_ITEMS',\n      'nativeSupportCalibration', 'uncalibrated',","count":1}]}]$native_item_support_manifest$::jsonb) loop
    signature := to_regprocedure(patch->>'signature');
    select p.prosrc into source from pg_catalog.pg_proc p where p.oid=signature;
    if signature is null or source is null or pg_catalog.md5(source)<>patch->>'sourceMd5' then
      raise exception 'Native Item support forward: unexpected source %',patch->>'signature' using errcode='55000';end if;
    for replacement in select value from jsonb_array_elements(patch->'replacements') loop
      if (length(source)-length(replace(source,replacement->>'before','')))/length(replacement->>'before')
        <>(replacement->>'count')::integer then
        raise exception 'Native Item support forward: unexpected source anchor %',patch->>'signature' using errcode='55000';end if;
      source := replace(source,replacement->>'before',replacement->>'after');
    end loop;
  end loop;
end;$native_item_support_guard$;

-- A pure count over the caller's existing source-filtered tag matches. This
-- helper reads no Event/Item/account and cannot widen kernel authorization.
create function private.native_item_support_count_v1(evidence_item_ids uuid[])
returns integer language sql immutable parallel safe security invoker set search_path=''
as $native_item_support$
  select count(distinct admitted.item_id)::integer
  from unnest(coalesce(evidence_item_ids,'{}'::uuid[])) as admitted(item_id)
  where admitted.item_id is not null;
$native_item_support$;
revoke all on function private.native_item_support_count_v1(uuid[]) from public,anon,authenticated,service_role;
comment on function private.native_item_support_count_v1(uuid[]) is
  'native-item-support-v1: distinct matching admitted native Items; conservative support heuristic, not independent outcome N or calibrated probability';

do $native_item_support_patch$
declare patch jsonb;replacement jsonb;previous record;source text;definition text;
begin
  for patch in select value from jsonb_array_elements($native_item_support_manifest$[{"signature":"private.rank_items_v0(uuid,text,text,integer,jsonb)","sourceMd5":"478a0d8a1554dce3a274de3aaf5d0f98","replacements":[{"before":"      count(*)::integer as evidence_count\n    from weighted_events","after":"      count(*)::integer as evidence_count,\n      array_agg(distinct weighted_events.item_id) as native_support_item_ids\n    from weighted_events","count":1},{"before":"      coalesce(native.evidence_count, 0) as evidence_count,","after":"      coalesce(native.evidence_count, 0) as evidence_count,\n      coalesce(native.native_support_item_ids, '{}'::uuid[]) as native_support_item_ids,","count":1},{"before":"    from policy_candidates\n  )\n  select","after":"    from policy_candidates\n  ),\n  -- Count support only once per retained candidate (at most result_limit=50).\n  -- The complete scoring/admission pool above remains unchanged.\n  native_supported as materialized (\n    select ranked.*,\n      private.native_item_support_count_v1(array(\n        select unnest(matched.native_support_item_ids)\n        from tag_evidence as matched\n        where matched.tag = any(ranked.tags)\n      )) as native_item_support_count\n    from ranked\n    where ranked.result_rank <= result_limit\n  )\n  select","count":1},{"before":"  from ranked\n  cross join prediction","after":"  from native_supported as ranked\n  cross join prediction","count":1},{"before":"    least(1.0, ranked.evidence_count::double precision / 8.0),","after":"    least(1.0, ranked.native_item_support_count::double precision / 8.0),","count":1},{"before":"      'evidenceCount', ranked.evidence_count,","after":"      'evidenceCount', ranked.evidence_count,\n      'nativeItemSupportCount', ranked.native_item_support_count,\n      'nativeSupportVersion', 'native-item-support-v1',\n      'nativeSupportBasis', 'DISTINCT_MATCHING_NATIVE_ITEMS',\n      'nativeSupportCalibration', 'uncalibrated',","count":1}]},{"signature":"private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)","sourceMd5":"d30e2000ec99cdbf315152454aada8fe","replacements":[{"before":"      count(*)::integer as evidence_count\n    from weighted_events","after":"      count(*)::integer as evidence_count,\n      array_agg(distinct weighted_events.item_id) as native_support_item_ids\n    from weighted_events","count":1},{"before":"      coalesce(native.evidence_count, 0) as evidence_count,","after":"      coalesce(native.evidence_count, 0) as evidence_count,\n      coalesce(native.native_support_item_ids, '{}'::uuid[]) as native_support_item_ids,","count":1},{"before":"    from policy_candidates\n  )\n  select","after":"    from policy_candidates\n  ),\n  -- Count support only once per retained candidate (at most result_limit=50).\n  -- The complete scoring/admission pool above remains unchanged.\n  native_supported as materialized (\n    select ranked.*,\n      private.native_item_support_count_v1(array(\n        select unnest(matched.native_support_item_ids)\n        from tag_evidence as matched\n        where matched.tag = any(ranked.tags)\n      )) as native_item_support_count\n    from ranked\n    where ranked.result_rank <= result_limit\n  )\n  select","count":1},{"before":"  from ranked\n  cross join prediction","after":"  from native_supported as ranked\n  cross join prediction","count":1},{"before":"    least(1.0, ranked.evidence_count::double precision / 8.0),","after":"    least(1.0, ranked.native_item_support_count::double precision / 8.0),","count":1},{"before":"      'evidenceCount', ranked.evidence_count,","after":"      'evidenceCount', ranked.evidence_count,\n      'nativeItemSupportCount', ranked.native_item_support_count,\n      'nativeSupportVersion', 'native-item-support-v1',\n      'nativeSupportBasis', 'DISTINCT_MATCHING_NATIVE_ITEMS',\n      'nativeSupportCalibration', 'uncalibrated',","count":1}]}]$native_item_support_manifest$::jsonb) loop
    select p.oid,p.prosrc,pg_get_functiondef(p.oid) definition,to_jsonb(p)-'prosrc' metadata into strict previous
      from pg_catalog.pg_proc p where p.oid=to_regprocedure(patch->>'signature');
    if pg_catalog.md5(previous.prosrc)<>patch->>'sourceMd5' then
      raise exception 'Native Item support forward: source drift %',patch->>'signature' using errcode='55000';end if;
    source := previous.prosrc;
    for replacement in select value from jsonb_array_elements(patch->'replacements') loop
      if (length(source)-length(replace(source,replacement->>'before','')))/length(replacement->>'before')
        <>(replacement->>'count')::integer then
        raise exception 'Native Item support forward: source anchor drift %',patch->>'signature' using errcode='55000';end if;
      source := replace(source,replacement->>'before',replacement->>'after');
    end loop;
    if (length(previous.definition)-length(replace(previous.definition,previous.prosrc,'')))/length(previous.prosrc)<>1 then
      raise exception 'Native Item support forward: definition drift %',patch->>'signature' using errcode='55000';end if;
    definition := replace(previous.definition,previous.prosrc,source);
    execute definition;
    if not exists(select 1 from pg_catalog.pg_proc p where p.oid=previous.oid
      and to_jsonb(p)-'prosrc'=previous.metadata and p.prosrc=source) then
      raise exception 'Native Item support forward: function identity/metadata drift %',patch->>'signature' using errcode='55000';end if;
  end loop;
end;$native_item_support_patch$;
