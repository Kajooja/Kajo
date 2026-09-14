-- #182: opt-in description patches; no data backfill and no historical edits.
-- Reject full-writer refreshes of managed BOOKs, under the same Item row lock.
do $migration$
declare
  definition text := pg_get_functiondef('public.upsert_catalog_item_v1(text,text,text,text,text,text[],jsonb,text[],integer,text,text,jsonb,text,timestamptz,text,jsonb,boolean)'::regprocedure);
  anchor text := '  if target_item_id is null then
    insert into public.items (';
  guard text := $guard$
  if item_type = 'BOOK' and (metadata ? 'descriptionProvenance' or source_payload ? 'descriptionEnrichment') then
    raise exception 'Managed BOOK descriptions require the guarded refresh mode' using errcode = '22023';
  end if;
  if target_item_id is not null then
    perform item.id from public.items item where item.id = target_item_id for update;
    if exists (select 1 from public.items item where item.id = target_item_id
      and item.metadata ? 'descriptionProvenance')
      or exists (select 1 from private.item_sources source where source.item_id = target_item_id
        and source.source_payload ? 'descriptionEnrichment') then
      raise exception 'Full refresh of a managed BOOK description is blocked' using errcode = '40001';
    end if;
  end if;
$guard$;
begin
  if definition is null or (length(definition) - length(replace(definition, anchor, ''))) <> length(anchor)
    or position('Managed BOOK descriptions' in definition) > 0 then
    raise exception 'Unexpected canonical catalog writer definition';
  end if;
  execute replace(definition, anchor, guard || anchor);
end;
$migration$;

-- A narrow overload of the canonical Item writer avoids re-normalizing existing
-- arrays/title/metadata via its legacy full-replacement signature.
create function public.upsert_catalog_item_v1(entry jsonb, refresh_mode text)
returns table(item_id uuid, outcome text)
language plpgsql security invoker set search_path = ''
as $function$
declare
  catalog_item public.items%rowtype;
  catalog_source private.item_sources%rowtype;
  provenance jsonb := entry -> 'provenance';
  enrichment jsonb := entry -> 'enrichment';
  review jsonb := provenance -> 'review';
  description_text text := entry ->> 'description';
  expected_item uuid;
  expected_source uuid;
  expected_item_version timestamptz;
  expected_source_version timestamptz;
  work_key text := '/works/' || (entry ->> 'workId');
  edition_key text := '/books/' || (entry ->> 'editionId');
begin
  if refresh_mode is distinct from 'open-library-description-v1'
    or jsonb_typeof(entry) is distinct from 'object'
    or not entry ?& array['expectedItemId','expectedSourceId','expectedItemUpdatedAt','expectedSourceUpdatedAt',
      'workId','editionId','description','provenance','enrichment']
    or entry - array['expectedItemId','expectedSourceId','expectedItemUpdatedAt','expectedSourceUpdatedAt',
      'workId','editionId','description','provenance','enrichment'] <> '{}'::jsonb then
    raise exception 'Invalid description refresh contract' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(entry) field where field.key not in ('provenance','enrichment')
      and jsonb_typeof(field.value) <> 'string')
    or (entry ->> 'workId' ~ '^OL[0-9]+W$' and entry ->> 'editionId' ~ '^OL[0-9]+M$') is not true then
    raise exception 'Invalid description identity or version' using errcode = '22023';
  end if;
  expected_item := (entry ->> 'expectedItemId')::uuid;
  expected_source := (entry ->> 'expectedSourceId')::uuid;
  expected_item_version := (entry ->> 'expectedItemUpdatedAt')::timestamptz;
  expected_source_version := (entry ->> 'expectedSourceUpdatedAt')::timestamptz;
  if expected_item is null or expected_source is null or expected_item_version is null or expected_source_version is null
    or not isfinite(expected_item_version) or not isfinite(expected_source_version) then
    raise exception 'Missing description identity or version' using errcode = '22023';
  end if;
  if (char_length(description_text) between 80 and 2000 and octet_length(description_text) <= 32768
      and description_text = normalize(description_text, NFC)
      and description_text = btrim(description_text, E' \n')
      and description_text !~ E'\r|\t|  |\n{3}'
      and replace(description_text, E'\n', '') !~ '[[:cntrl:]]'
      and description_text !~* '<[^>]*>|&(#|[a-z])[^;]*;|https?://|www\.|\[[^]]*\]\(|[*_`]|(^|\n)(#{1,6} |[-+] |> )') is not true then
    raise exception 'Invalid normalized description' using errcode = '22023';
  end if;
  if (jsonb_typeof(provenance) = 'object'
      and provenance ?& array['contract','provider','workKey','recordKey','field','sourceUrl','sourceRevision',
        'sourceModifiedAt','fetchedAt','recordSha256','textSha256','textLanguage','review']
      and provenance - array['contract','provider','workKey','recordKey','field','sourceUrl','sourceRevision',
        'sourceModifiedAt','fetchedAt','recordSha256','textSha256','textLanguage','review'] = '{}'::jsonb
      and provenance ->> 'contract' = refresh_mode and provenance ->> 'provider' = 'open_library'
      and provenance ->> 'workKey' = work_key and provenance ->> 'recordKey' in (work_key, edition_key)
      and provenance ->> 'field' = 'description'
      and provenance ->> 'sourceUrl' = 'https://openlibrary.org' || (provenance ->> 'recordKey')
      and provenance ->> 'recordSha256' ~ '^[0-9a-f]{64}$'
      and provenance ->> 'textSha256' = encode(sha256(convert_to(description_text, 'UTF8')), 'hex')
      and provenance ->> 'textLanguage' in ('fi','en')
      and jsonb_typeof(provenance -> 'fetchedAt') = 'string'
      and jsonb_typeof(provenance -> 'sourceRevision') in ('null','number')
      and (provenance -> 'sourceRevision' = 'null'::jsonb or provenance ->> 'sourceRevision' ~ '^[1-9][0-9]{0,14}$')
      and jsonb_typeof(provenance -> 'sourceModifiedAt') in ('null','string')) is not true then
    raise exception 'Invalid description provenance' using errcode = '22023';
  end if;
  if not isfinite((provenance ->> 'fetchedAt')::timestamptz)
    or (provenance ->> 'sourceModifiedAt' is not null and not isfinite((provenance ->> 'sourceModifiedAt')::timestamptz)) then
    raise exception 'Invalid provider timestamp' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(provenance) field
    where field.key not in ('sourceRevision','sourceModifiedAt','review') and jsonb_typeof(field.value) <> 'string') then
    raise exception 'Invalid provenance field type' using errcode = '22023';
  end if;
  if (jsonb_typeof(review) = 'object' and review ?& array['policy','rights','reason','basisSha256']
      and review - array['policy','rights','reason','basisSha256'] = '{}'::jsonb
      and review ->> 'policy' = 'open-library-description-pilot-v1'
      and review ->> 'rights' = 'approved-for-pilot'
      and ((provenance ->> 'recordKey' = edition_key and review ->> 'reason' = 'edition-description')
        or (provenance ->> 'recordKey' = work_key and review ->> 'reason' in
          ('edition-missing','edition-language','edition-rights','edition-unsuitable')))
      and jsonb_typeof(enrichment) = 'object' and enrichment ?& array['contract','records','review']
      and enrichment - array['contract','records','review'] = '{}'::jsonb
      and enrichment ->> 'contract' = refresh_mode
      and (enrichment -> 'review') - 'basis' = review
      and jsonb_typeof(enrichment #> '{review,basis}') = 'string'
      and char_length(enrichment #>> '{review,basis}') between 20 and 1000
      and review ->> 'basisSha256' = encode(sha256(convert_to(enrichment #>> '{review,basis}', 'UTF8')), 'hex')
      and jsonb_typeof(enrichment -> 'records') = 'array') is not true then
    raise exception 'Unreviewed description or invalid enrichment envelope' using errcode = '22023';
  end if;
  if jsonb_array_length(enrichment -> 'records') <> (case when provenance ->> 'recordKey' = edition_key then 1 else 2 end)
    or enrichment #>> '{records,0,key}' is distinct from edition_key
    or (provenance ->> 'recordKey' = work_key and enrichment #>> '{records,1,key}' is distinct from work_key)
    or exists (select 1 from jsonb_array_elements(enrichment -> 'records') ref where
      (jsonb_typeof(ref) = 'object' and ref ?& array['key','fetchedAt','status','recordSha256','sourceRevision','sourceModifiedAt']
        and ref - array['key','fetchedAt','status','recordSha256','sourceRevision','sourceModifiedAt'] = '{}'::jsonb
        and ref ->> 'status' in ('found','missing') and jsonb_typeof(ref -> 'fetchedAt') = 'string'
        and ((ref ->> 'status' = 'missing' and ref -> 'recordSha256' = 'null'::jsonb
            and ref -> 'sourceRevision' = 'null'::jsonb and ref -> 'sourceModifiedAt' = 'null'::jsonb)
          or (ref ->> 'status' = 'found' and ref ->> 'recordSha256' ~ '^[0-9a-f]{64}$'))
        and jsonb_typeof(ref -> 'sourceRevision') in ('number','null')
        and jsonb_typeof(ref -> 'sourceModifiedAt') in ('string','null')) is not true)
    or not exists (select 1 from jsonb_array_elements(enrichment -> 'records') ref
      where ref ->> 'key' = provenance ->> 'recordKey' and ref ->> 'status' = 'found'
        and ref -> 'recordSha256' = provenance -> 'recordSha256'
        and ref -> 'sourceRevision' = provenance -> 'sourceRevision'
        and ref -> 'sourceModifiedAt' = provenance -> 'sourceModifiedAt'
        and ref -> 'fetchedAt' = provenance -> 'fetchedAt') then
    raise exception 'Enrichment record references do not match' using errcode = '22023';
  end if;

  select * into catalog_item from public.items where id = expected_item for update;
  select * into catalog_source from private.item_sources where id = expected_source for update;
  perform alias.external_id from private.item_external_ids alias where alias.item_id = expected_item
    order by alias.namespace, alias.external_id for share;
  if (catalog_item.id = expected_item and catalog_item.item_type = 'BOOK' and catalog_item.discoverable
      and catalog_source.item_id = expected_item and catalog_source.provider_key = 'open_library'
      and catalog_source.provider_item_id = entry ->> 'workId'
      and catalog_source.source_payload ->> 'key' = work_key
      and catalog_item.metadata ->> 'openLibraryWorkId' = entry ->> 'workId'
      and catalog_item.metadata ->> 'displayEditionKey' = entry ->> 'editionId'
      and (select count(*) from private.item_external_ids alias
        where alias.item_id = expected_item and alias.namespace = 'open_library_work') = 1
      and exists (select 1 from private.item_external_ids alias where alias.item_id = expected_item
        and alias.namespace = 'open_library_work' and alias.external_id = entry ->> 'workId')
      and not exists (select 1 from private.item_external_ids alias where alias.namespace = 'open_library_edition'
        and alias.external_id = entry ->> 'editionId' and alias.item_id <> expected_item)) is not true then
    raise exception 'Description catalog identity or lifecycle changed' using errcode = '40001';
  end if;
  if (catalog_item.metadata ? 'descriptionProvenance'
      and catalog_item.metadata #>> '{descriptionProvenance,contract}' is distinct from refresh_mode)
    or (catalog_source.source_payload ? 'descriptionEnrichment'
      and catalog_source.source_payload #>> '{descriptionEnrichment,contract}' is distinct from refresh_mode) then
    raise exception 'Existing description uses a different contract' using errcode = '40001';
  end if;
  -- Same source/review identity is already applied. Preserve its original fetch
  -- evidence and all timestamps even when the caller holds older row versions.
  if catalog_item.description = description_text
    and (catalog_item.metadata -> 'descriptionProvenance') - array['fetchedAt','recordSha256']
      = provenance - array['fetchedAt','recordSha256']
    and catalog_source.source_payload #>> '{descriptionEnrichment,contract}' = refresh_mode
    and catalog_source.source_payload #> '{descriptionEnrichment,review}' = enrichment -> 'review' then
    return query select expected_item, 'unchanged'::text;
    return;
  end if;
  if catalog_item.updated_at is distinct from expected_item_version
    or catalog_source.updated_at is distinct from expected_source_version then
    raise exception 'Description catalog version changed' using errcode = '40001';
  end if;
  update public.items set description = description_text,
    metadata = catalog_item.metadata || jsonb_build_object('descriptionProvenance', provenance)
    where id = expected_item;
  update private.item_sources set source_payload = catalog_source.source_payload
    || jsonb_build_object('descriptionEnrichment', enrichment) where id = expected_source;
  return query select expected_item, 'updated'::text;
end;
$function$;

create function public.upsert_catalog_batch_v1(entries jsonb, refresh_mode text)
returns table(input_index integer, item_id uuid, outcome text)
language plpgsql security invoker set search_path = ''
as $function$
declare
  input record;
begin
  if refresh_mode is distinct from 'open-library-description-v1' or jsonb_typeof(entries) is distinct from 'array' then
    raise exception 'Invalid description batch contract' using errcode = '22023';
  end if;
  if jsonb_array_length(entries) not between 1 and 10
    or exists (select 1 from jsonb_array_elements(entries) e where jsonb_typeof(e) <> 'object')
    or (select count(distinct (e ->> 'expectedItemId')::uuid) from jsonb_array_elements(entries) e) <> jsonb_array_length(entries)
    or (select count(distinct (e ->> 'expectedSourceId')::uuid) from jsonb_array_elements(entries) e) <> jsonb_array_length(entries) then
    raise exception 'Invalid or duplicate description batch entries' using errcode = '22023';
  end if;
  -- All callers use the same lock order, even with reverse input order. No
  -- provider I/O is performed while these transaction-scoped locks are held.
  perform item.id from public.items item join jsonb_array_elements(entries) e
    on item.id = (e ->> 'expectedItemId')::uuid order by item.id for update of item;
  perform source.id from private.item_sources source join jsonb_array_elements(entries) e
    on source.id = (e ->> 'expectedSourceId')::uuid order by source.id for update of source;
  perform alias.external_id from private.item_external_ids alias join jsonb_array_elements(entries) e
    on alias.item_id = (e ->> 'expectedItemId')::uuid order by alias.namespace, alias.external_id for share of alias;
  for input in select e.value, e.ordinality from jsonb_array_elements(entries) with ordinality e loop
    return query select input.ordinality::integer, result.item_id, result.outcome
      from public.upsert_catalog_item_v1(input.value, refresh_mode) result;
  end loop;
end;
$function$;

revoke all on function public.upsert_catalog_item_v1(jsonb,text) from public, anon, authenticated;
revoke all on function public.upsert_catalog_batch_v1(jsonb,text) from public, anon, authenticated;
grant execute on function public.upsert_catalog_item_v1(jsonb,text) to service_role;
grant execute on function public.upsert_catalog_batch_v1(jsonb,text) to service_role;
notify pgrst, 'reload schema';
