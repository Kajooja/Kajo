-- #182: description attribution v2. No backfill or changes to installed files.
-- The existing v1 mode remains available; only a guarded v2 write can upgrade it.
create function private.is_description_attribution_v1(value jsonb, text_hash text, record_hash text)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $function$
declare
  field text;
  contents text;
  maximum integer;
  authority text;
begin
  if (jsonb_typeof(value) = 'object'
    and value ?& array['contract','sourceTitle','sourceUrl','sourceRevision','credit','licenseName','licenseUrl','changes','textSha256','recordSha256']
    and value - array['contract','sourceTitle','sourceUrl','sourceRevision','credit','licenseName','licenseUrl','changes','textSha256','recordSha256'] = '{}'::jsonb
    and value ->> 'contract' = 'description-attribution-v1'
    and jsonb_typeof(value -> 'textSha256') = 'string' and jsonb_typeof(value -> 'recordSha256') = 'string'
    and value ->> 'textSha256' = text_hash and text_hash ~ '^[0-9a-f]{64}$'
    and value ->> 'recordSha256' = record_hash and record_hash ~ '^[0-9a-f]{64}$') is not true then return false; end if;
  for field, maximum in select * from (values ('sourceTitle',200),('sourceRevision',200),('credit',500),
    ('licenseName',100),('changes',500)) limits(name,maximum) loop
    if field = 'sourceRevision' and value -> field = 'null'::jsonb then continue; end if;
    contents := value ->> field;
    if (jsonb_typeof(value -> field) = 'string' and char_length(contents) between 1 and maximum
      and contents = btrim(contents, U&' \0009\000a\000b\000c\000d\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff')
      and contents !~ '[[:cntrl:]<>]'
      and contents !~ U&'[\00ad\0600-\0605\061c\06dd\070f\0890-\0891\08e2\180e\200b-\200f\202a-\202e\2060-\2064\2066-\206f\feff\fff9-\fffb\+0110bd\+0110cd\+013430-\+01343f\+01bca0-\+01bca3\+01d173-\+01d17a\+0e0001\+0e0020-\+0e007f]') is not true then return false; end if;
  end loop;
  foreach field in array array['sourceUrl','licenseUrl'] loop
    contents := value ->> field;
    if (jsonb_typeof(value -> field) = 'string' and char_length(contents) <= 2048
      and contents ~ '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?([/?#][A-Za-z0-9._~!$&''()*+,;=:@/?#%\-]*)?$'
      and contents !~ '%([^0-9A-Fa-f]|[0-9A-Fa-f]([^0-9A-Fa-f]|$)|$)'
      and contents !~* '%(0[0-9a-f]|1[0-9a-f]|7f)') is not true then return false; end if;
    authority := split_part(regexp_replace(substr(contents,9),'[/?#].*$',''),':',1);
    if position('.' in authority) = 0 or exists (select 1 from unnest(string_to_array(authority,'.')) label
      where char_length(label) not between 1 and 63 or label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$') then return false; end if;
  end loop;
  return true;
end;
$function$;
revoke all on function private.is_description_attribution_v1(jsonb,text,text) from public, anon, authenticated;
grant execute on function private.is_description_attribution_v1(jsonb,text,text) to service_role;

-- A narrow overload of the canonical Item writer avoids re-normalizing existing
-- arrays/title/metadata via its legacy full-replacement signature.
create or replace function public.upsert_catalog_item_v1(entry jsonb, refresh_mode text)
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
  if (refresh_mode is null or refresh_mode not in ('open-library-description-v1','open-library-description-v2'))
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
      and provenance - (array['contract','provider','workKey','recordKey','field','sourceUrl','sourceRevision',
        'sourceModifiedAt','fetchedAt','recordSha256','textSha256','textLanguage','review'] || case when refresh_mode = 'open-library-description-v2' then array['attribution'] else array[]::text[] end) = '{}'::jsonb
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
    where field.key not in ('sourceRevision','sourceModifiedAt','review','attribution') and jsonb_typeof(field.value) <> 'string') then
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
      and enrichment - (array['contract','records','review'] || case when refresh_mode = 'open-library-description-v2' then array['permission'] else array[]::text[] end) = '{}'::jsonb
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

  if refresh_mode = 'open-library-description-v2' then
    if not private.is_description_attribution_v1(provenance -> 'attribution',
        provenance ->> 'textSha256', provenance ->> 'recordSha256')
      or (jsonb_typeof(enrichment -> 'permission') = 'object'
        and (enrichment -> 'permission') ?& array['evidenceSha256','intendedUse','recordSha256','textSha256','attribution']
        and (enrichment -> 'permission') - array['evidenceSha256','intendedUse','recordSha256','textSha256','attribution'] = '{}'::jsonb
        and jsonb_typeof(enrichment #> '{permission,evidenceSha256}') = 'string'
        and enrichment #>> '{permission,evidenceSha256}' ~ '^[0-9a-f]{64}$'
        and enrichment #>> '{permission,intendedUse}' = 'kajo-internal-pilot'
        and enrichment #> '{permission,recordSha256}' = provenance -> 'recordSha256'
        and enrichment #> '{permission,textSha256}' = provenance -> 'textSha256'
        and enrichment #> '{permission,attribution}' = provenance -> 'attribution') is not true then
      raise exception 'Invalid description attribution or permission binding' using errcode = '22023';
    end if;
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
      and catalog_item.metadata #>> '{descriptionProvenance,contract}' is distinct from refresh_mode
      and not (refresh_mode = 'open-library-description-v2'
        and catalog_item.metadata #>> '{descriptionProvenance,contract}' is not distinct from 'open-library-description-v1'))
    or (catalog_source.source_payload ? 'descriptionEnrichment'
      and catalog_source.source_payload #>> '{descriptionEnrichment,contract}' is distinct from refresh_mode
      and not (refresh_mode = 'open-library-description-v2'
        and catalog_source.source_payload #>> '{descriptionEnrichment,contract}' is not distinct from 'open-library-description-v1')) then
    raise exception 'Existing description uses a different contract' using errcode = '40001';
  end if;
  -- Same source/review identity is already applied. Preserve its original fetch
  -- evidence and all timestamps even when the caller holds older row versions.
  if catalog_item.description = description_text
    and (catalog_item.metadata -> 'descriptionProvenance') - array['fetchedAt','recordSha256']
      = provenance - array['fetchedAt','recordSha256']
    and catalog_source.source_payload #>> '{descriptionEnrichment,contract}' = refresh_mode
    and catalog_source.source_payload #> '{descriptionEnrichment,review}' = enrichment -> 'review'
    and (refresh_mode <> 'open-library-description-v2' or
      catalog_source.source_payload #> '{descriptionEnrichment,permission}' = enrichment -> 'permission') then
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

create or replace function public.upsert_catalog_batch_v1(entries jsonb, refresh_mode text)
returns table(input_index integer, item_id uuid, outcome text)
language plpgsql security invoker set search_path = ''
as $function$
declare
  input record;
begin
  if (refresh_mode is null or refresh_mode not in ('open-library-description-v1','open-library-description-v2')) or jsonb_typeof(entries) is distinct from 'array' then
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
