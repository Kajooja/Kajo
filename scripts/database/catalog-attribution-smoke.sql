-- Rollback-only synthetic fixture, also exercised by required native CLI CI.
do $check$
declare
  original jsonb := (select entry from description_entries where position=1);
  second_entry jsonb := (select entry from description_entries where position=2);
  old_entry jsonb;
  changed jsonb;
  invalid jsonb;
  patch jsonb;
  old_rows jsonb;
  core jsonb := pg_temp.description_core();
  field text;
  role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if has_function_privilege(role_name,'private.is_description_attribution_v1(jsonb,text,text)','execute') then
      raise exception 'Private validator exposed to client';
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid='private.is_description_attribution_v1(jsonb,text,text)'::regprocedure)
    or not has_function_privilege('service_role','private.is_description_attribution_v1(jsonb,text,text)','execute') then
    raise exception 'Invalid validator security';
  end if;
  old_rows := pg_temp.description_snapshot();
  -- The v1 request cannot silently drop an attribution envelope.
  begin
    perform public.upsert_catalog_item_v1(original,'open-library-description-v1');
    raise exception 'v1 accepted a v2 envelope';
  exception when invalid_parameter_value then null; end;
  -- Upgrade an already managed v1 description with the exact current versions.
  old_entry := jsonb_set(jsonb_set(original,'{provenance}',
    (original->'provenance')-'attribution' || '{"contract":"open-library-description-v1"}'),
    '{enrichment}',(original->'enrichment')-'permission' || '{"contract":"open-library-description-v1"}');
  perform public.upsert_catalog_item_v1(old_entry,'open-library-description-v1');
  original := pg_temp.current_description_versions(original);
  if (select outcome from public.upsert_catalog_item_v1(original,'open-library-description-v2')) <> 'updated' then
    raise exception 'v1 attribution upgrade failed';
  end if;
  old_rows := pg_temp.description_snapshot();
  if pg_temp.description_core() <> core then raise exception 'Attribution changed unrelated catalog data'; end if;
  if (select metadata -> 'descriptionProvenance' from public.items where id=(original->>'expectedItemId')::uuid) <> original->'provenance'
    or (select source_payload -> 'descriptionEnrichment' from private.item_sources where id=(original->>'expectedSourceId')::uuid) <> original->'enrichment' then
    raise exception 'Public credit or private evidence was dropped';
  end if;
  if (select outcome from public.upsert_catalog_item_v1(original,'open-library-description-v2')) <> 'unchanged'
    or pg_temp.description_snapshot() <> old_rows then raise exception 'Identical v2 replay rewrote data'; end if;
  -- Downgrade cannot erase mandatory credit even with current versions.
  begin
    perform public.upsert_catalog_item_v1(pg_temp.current_description_versions(old_entry),'open-library-description-v1');
    raise exception 'v1 erased v2 credit';
  exception when serialization_failure then null; end;
  begin
    perform public.upsert_catalog_batch_v1(jsonb_build_array(jsonb_build_object('providerKey','open_library',
      'providerItemId',original->>'workId','itemType','BOOK','title','Legacy overwrite')));
    raise exception 'Legacy writer erased v2 credit';
  exception when serialization_failure then null; end;
  -- Public fields, text/record binding and private permission are all mandatory.
  foreach invalid in array array[
    original #- '{provenance,attribution}', original #- '{enrichment,permission}',
    jsonb_set(original,'{enrichment,permission,intendedUse}','"public-store-release"'),
    jsonb_set(original,'{enrichment,permission,evidenceSha256}','"unknown"'),
    jsonb_set(original,'{enrichment,permission,recordSha256}',to_jsonb(repeat('0',64))),
    jsonb_set(original,'{enrichment,permission,attribution,credit}','"Unbound credit"'),
    pg_temp.changed_description(original),
    jsonb_set(original,'{provenance,attribution,sourceUrl}','"javascript:alert(1)"')
  ] loop
    begin
      perform public.upsert_catalog_item_v1(invalid,'open-library-description-v2');
      raise exception 'Invalid v2 binding accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  for field in select jsonb_object_keys(original #> '{provenance,attribution}') loop
    if private.is_description_attribution_v1((original #> '{provenance,attribution}')-field,
      original #>> '{provenance,textSha256}',original #>> '{provenance,recordSha256}') then
      raise exception 'Missing attribution field accepted: %',field;
    end if;
  end loop;
  foreach patch in array array[
    '{"credit":"<b>Author</b>"}'::jsonb, jsonb_build_object('credit',U&'Hidden\202e'),
    jsonb_build_object('licenseName',U&'trailing\00a0'),
    '{"sourceUrl":"https://user:password@example.invalid/"}'::jsonb,
    '{"sourceUrl":"https://example.invalid:443/"}'::jsonb,
    '{"sourceUrl":"https://example.invalid/%0A"}'::jsonb,
    '{"sourceUrl":"https://example.invalid/%zz"}'::jsonb,
    '{"sourceUrl":"https://example.invalid/%"}'::jsonb,
    '{"sourceUrl":"https://example..invalid/"}'::jsonb,
    '{"reviewer":"Private identity"}'::jsonb,
    '{"sourceRevision":""}'::jsonb
  ] loop
    if private.is_description_attribution_v1((original #> '{provenance,attribution}')||patch,
      original #>> '{provenance,textSha256}',original #>> '{provenance,recordSha256}') then
      raise exception 'Unsafe attribution accepted: %',patch;
    end if;
  end loop;
  -- Credit-only changes are real guarded updates; mismatched stale versions fail.
  changed := jsonb_set(jsonb_set(original,'{provenance,attribution,credit}','"Corrected synthetic credit"'),
    '{enrichment,permission,attribution,credit}','"Corrected synthetic credit"');
  begin
    -- now() is transaction-stable in this rollback-only fixture.
    perform public.upsert_catalog_item_v1(jsonb_set(changed,'{expectedItemUpdatedAt}',
      '"2000-01-01T00:00:00Z"'),'open-library-description-v2');
    raise exception 'Stale attribution update accepted';
  exception when serialization_failure then null; end;
  changed := pg_temp.current_description_versions(changed);
  begin
    perform public.upsert_catalog_batch_v1(jsonb_build_array(changed,second_entry #- '{enrichment,permission}'),'open-library-description-v2');
    raise exception 'Partial attribution batch accepted';
  exception when invalid_parameter_value then null; end;
  if pg_temp.description_snapshot() <> old_rows then raise exception 'Rejected operation changed data'; end if;
  if (select outcome from public.upsert_catalog_item_v1(changed,'open-library-description-v2')) <> 'updated' then
    raise exception 'Guarded credit update failed';
  end if;
  if pg_temp.description_core() <> core then raise exception 'Credit update changed unrelated catalog data'; end if;
end;
$check$;
select jsonb_build_object('catalogAttribution','PASS: v1 upgrade, binding, credit, downgrade prevention, atomicity and ACLs') as snapshot;
