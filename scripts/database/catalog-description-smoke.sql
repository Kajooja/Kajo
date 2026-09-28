-- Included inside a rollback-only fixture on PGlite and the required native CLI job.
do $check$
declare
  first_entry jsonb := (select entry from description_entries where position=1);
  second_entry jsonb := (select entry from description_entries where position=2);
  changed jsonb;
  before_rows jsonb;
  before_core jsonb := pg_temp.description_core();
  rows jsonb;
  invalid jsonb;
  role_name text;
  signature regprocedure;
begin
  foreach signature in array array['public.upsert_catalog_item_v1(jsonb,text)'::regprocedure,
    'public.upsert_catalog_batch_v1(jsonb,text)'::regprocedure,'public.upsert_catalog_batch_v1(jsonb)'::regprocedure] loop
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,signature,'execute') then raise exception 'Client can call catalog writer'; end if;
    end loop;
    if not has_function_privilege('service_role',signature,'execute')
      or (select prosecdef from pg_proc where oid=signature) then raise exception 'Wrong catalog writer role/security'; end if;
  end loop;
  if (select pronargdefaults from pg_proc where oid='public.upsert_catalog_batch_v1(jsonb,text)'::regprocedure) <> 0 then
    raise exception 'Refresh mode must not have a default';
  end if;
  select jsonb_agg(to_jsonb(r)) into rows from public.upsert_catalog_batch_v1(jsonb_build_array(first_entry),'open-library-description-v1') r;
  if rows <> jsonb_build_array(jsonb_build_object('input_index',1,'item_id',first_entry->>'expectedItemId','outcome','updated')) then
    raise exception 'Wrong description write acknowledgement';
  end if;
  if pg_temp.description_core() <> before_core then raise exception 'Description write changed catalog core or aliases'; end if;
  before_rows := pg_temp.description_snapshot();
  -- Stale versions are accepted only for an already-applied identical review.
  changed := jsonb_set(jsonb_set(first_entry,'{provenance,fetchedAt}','"2026-09-14T00:00:00Z"'),
    '{enrichment,records,0,fetchedAt}','"2026-09-14T00:00:00Z"');
  if (select outcome from public.upsert_catalog_item_v1(changed,'open-library-description-v1')) <> 'unchanged'
    or pg_temp.description_snapshot() <> before_rows then raise exception 'Replay changed stored data/timestamps'; end if;

  -- A changed text with an old Item version cannot overwrite the accepted text.
  begin
    perform public.upsert_catalog_item_v1(pg_temp.changed_description(first_entry),'open-library-description-v1');
    raise exception 'Stale Item update accepted';
  exception when serialization_failure then null; end;
  -- Independently check the private source version guard.
  changed := jsonb_set(pg_temp.changed_description(pg_temp.current_description_versions(first_entry)),
    '{expectedSourceUpdatedAt}','"2000-01-01T00:00:00Z"');
  begin
    perform public.upsert_catalog_item_v1(changed,'open-library-description-v1');
    raise exception 'Stale source update accepted';
  exception when serialization_failure then null; end;

  foreach invalid in array array[
    jsonb_set(first_entry,'{description}','null'),
    jsonb_set(first_entry,'{description}','"short"'),
    jsonb_set(first_entry,'{provenance,textSha256}',to_jsonb(repeat('0',64))),
    jsonb_set(first_entry,'{provenance,textLanguage}','"unknown"'),
    jsonb_set(first_entry,'{provenance,review,rights}','"unknown"'),
    first_entry || '{"title":"Must not overwrite"}'::jsonb,
    jsonb_set(first_entry,'{enrichment,records,0,key}','"/books/OL1M"')
  ] loop
    begin
      perform public.upsert_catalog_item_v1(invalid,'open-library-description-v1');
      raise exception 'Invalid refresh accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.upsert_catalog_batch_v1(jsonb_build_array(first_entry,first_entry),'open-library-description-v1');
    raise exception 'Duplicate batch accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.upsert_catalog_batch_v1('[]'::jsonb,'open-library-description-v1');
    raise exception 'Empty batch accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.upsert_catalog_batch_v1((select jsonb_agg(first_entry || jsonb_build_object(
      'expectedItemId','00000000-0000-0000-0000-'||lpad(n::text,12,'0'),
      'expectedSourceId','00000000-0000-0000-0000-'||lpad((n+20)::text,12,'0')))
      from generate_series(1,11) n),'open-library-description-v1');
    raise exception 'Oversized batch accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.upsert_catalog_batch_v1(jsonb_build_array(first_entry),'unknown-mode');
    raise exception 'Unknown mode accepted';
  exception when invalid_parameter_value then null; end;

  -- Identity/lifecycle/alias checks still precede an identical no-op.
  begin
    update public.items set discoverable=false where id=(first_entry->>'expectedItemId')::uuid;
    perform public.upsert_catalog_item_v1(first_entry,'open-library-description-v1');
    raise exception 'Inactive Item accepted';
  exception when serialization_failure then null; end;
  begin
    insert into private.item_external_ids(namespace,external_id,item_id,first_seen_provider)
      values('open_library_work','OL999999W',(first_entry->>'expectedItemId')::uuid,'open_library');
    perform public.upsert_catalog_item_v1(first_entry,'open-library-description-v1');
    raise exception 'Ambiguous Work aliases accepted';
  exception when serialization_failure then null; end;
  begin
    insert into private.item_external_ids(namespace,external_id,item_id,first_seen_provider)
      values('open_library_edition',first_entry->>'editionId',(second_entry->>'expectedItemId')::uuid,'open_library');
    perform public.upsert_catalog_item_v1(first_entry,'open-library-description-v1');
    raise exception 'Conflicting Edition alias accepted';
  exception when serialization_failure then null; end;

  -- A later invalid row rolls the earlier update back in the same transaction.
  changed := pg_temp.changed_description(pg_temp.current_description_versions(first_entry));
  invalid := jsonb_set(second_entry,'{expectedSourceId}',first_entry->'expectedSourceId');
  begin
    perform public.upsert_catalog_batch_v1(jsonb_build_array(changed,invalid),'open-library-description-v1');
    raise exception 'Duplicate source batch accepted';
  exception when invalid_parameter_value then null; end;
  invalid := jsonb_set(second_entry,'{expectedItemUpdatedAt}','"1999-01-01T00:00:00Z"');
  begin
    perform public.upsert_catalog_batch_v1(jsonb_build_array(changed,invalid),'open-library-description-v1');
    raise exception 'Partial atomic batch accepted';
  exception when serialization_failure then null; end;
  if pg_temp.description_snapshot() <> before_rows then raise exception 'Rejected batch changed records'; end if;

  -- Both old Search (Work source) and dump (Edition source + Work alias) paths
  -- must fail before clearing any managed field, replacing payload or aliases.
  foreach invalid in array array[
    jsonb_build_object('providerKey','open_library','providerItemId',first_entry->>'workId','itemType','BOOK','title','Search replay',
      'description',null,'metadata','{}'::jsonb,'sourcePayload',jsonb_build_object('key','/works/'||(first_entry->>'workId'))),
    jsonb_build_object('providerKey','open_library','providerItemId',first_entry->>'editionId','itemType','BOOK','title','Dump replay',
      'description','Legacy notes must not replace the reviewed description.','externalIds',jsonb_build_object('open_library_work',first_entry->>'workId'))
  ] loop
    begin
      perform public.upsert_catalog_batch_v1(jsonb_build_array(invalid));
      raise exception 'Legacy writer erased managed description';
    exception when serialization_failure then null; end;
  end loop;
  if pg_temp.description_snapshot() <> before_rows then raise exception 'Legacy replay changed managed catalog'; end if;
  -- A guarded changed refresh remains possible using the current row versions.
  if (select outcome from public.upsert_catalog_item_v1(changed,'open-library-description-v1')) <> 'updated' then
    raise exception 'Guarded changed refresh failed';
  end if;
  if pg_temp.description_core() <> before_core then raise exception 'Changed refresh changed catalog core'; end if;
  -- The one-argument contract still updates a separate unmanaged BOOK.
  perform public.upsert_catalog_batch_v1(jsonb_build_array(jsonb_build_object('providerKey','open_library',
    'providerItemId',second_entry->>'workId','itemType','BOOK','title','Unmanaged legacy refresh')));
end;
$check$;
select jsonb_build_object('catalogDescriptions','PASS: guarded patches, identity/version checks, atomicity, replay, legacy protection and ACLs') as snapshot;
