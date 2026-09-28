-- #182 / open-library-description-pilot-v1. Read-only; no actor/history data.
-- Fixed identities are deliberate: after checks must not select new candidates.
-- MD5 values detect snapshot drift; they are not authentication/security proofs.
begin read only;
with pilot(position, item_id, work_id, edition_id, display_language) as (
  values
    (1, 'a7f6d2cd-e290-4bc4-97b7-cf1180ea86b9'::uuid, 'OL17370186W', 'OL26433779M', 'fin'),
    (2, '43c6e886-0858-4f3e-b188-72cc62b6dfbc'::uuid, 'OL3923952W', 'OL44944392M', 'fin'),
    (3, '25fa7fee-2a4d-4b8e-9c63-f9f6f367aff9'::uuid, 'OL166894W', 'OL16835710M', 'fin'),
    (4, '6aa4020d-fdfa-4010-ad8d-2217c71f06f8'::uuid, 'OL362427W', 'OL26501345M', 'fin'),
    (5, '9d8a5234-5565-4f42-aa77-30422e780419'::uuid, 'OL1892617W', 'OL39218444M', 'fin'),
    (6, 'ccbdb717-0a27-4099-8b56-64b3c5f9aaed'::uuid, 'OL17930368W', 'OL27918581M', 'eng'),
    (7, 'b54ebb75-2e4c-48e1-8349-5f73bf0d789b'::uuid, 'OL18020194W', 'OL27213498M', 'eng'),
    (8, 'c3548ac2-ae85-4ee6-aeeb-8101fa909fb1'::uuid, 'OL17590212W', 'OL27351482M', 'eng'),
    (9, '4af3c2b6-7a8a-4107-b198-ac0ed0afa2c9'::uuid, 'OL25312237W', 'OL33899062M', 'eng'),
    (10, 'fad9046f-f67a-42f2-9fb8-57657035593e'::uuid, 'OL82563W', 'OL59004869M', 'eng')
),
books as (
  select * from public.items where item_type = 'BOOK' and discoverable
),
provider as (
  select b.*, s.provider_item_id, s.source_payload, s.synced_at,
    s.id as source_id, s.updated_at as source_updated_at,
    md5(((to_jsonb(s) - 'source_payload' - 'synced_at' - 'updated_at')
      || jsonb_build_object('source_payload', s.source_payload - 'descriptionEnrichment'))::text)
      as source_base_md5,
    (select count(*) from private.item_external_ids a
      where a.item_id = b.id and a.namespace = 'open_library_work') as work_alias_count,
    exists(select 1 from private.item_external_ids a
      where a.item_id = b.id and a.namespace = 'open_library_work'
        and a.external_id = s.provider_item_id) as matching_alias
  from books b join private.item_sources s
    on s.item_id = b.id and s.provider_key = 'open_library'
),
item_checks as (
  select i.id, i.item_type,
    -- Allow only description + its own provenance + automatic updated_at to change.
    md5(((to_jsonb(i) - 'description' - 'metadata' - 'updated_at')
      || jsonb_build_object('metadata', i.metadata - 'descriptionProvenance'))::text) as core_md5,
    md5(to_jsonb(i)::text) as full_md5
  from public.items i
)
select jsonb_build_object(
  'version', 'open-library-description-pilot-v1',
  'checked_at', now(),
  'inventory', (
    select jsonb_agg(x order by item_type) from (
      select item_type, count(*) as stored,
        count(*) filter (where discoverable) as discoverable,
        count(*) filter (where discoverable and nullif(btrim(description), '') is not null) as descriptions,
        count(*) filter (where discoverable and nullif(btrim(image_url), '') is not null) as images
      from public.items group by item_type
    ) x
  ),
  'open_library', (
    select jsonb_build_object(
      'source_rows', count(*), 'distinct_items', count(distinct id),
      'matching_aliases', count(*) filter (where matching_alias),
      'single_work_alias', count(*) filter (where work_alias_count = 1),
      'mirrored_ids', count(*) filter (where metadata ->> 'openLibraryWorkId' = provider_item_id),
      'display_edition_keys', count(*) filter (where metadata ->> 'displayEditionKey' ~ '^OL[0-9]+M$'),
      'source_matching_keys', count(*) filter (where source_payload ->> 'key' = '/works/' || provider_item_id),
      'source_description_fields', count(*) filter (where source_payload ? 'description'),
      'source_notes_fields', count(*) filter (where source_payload ? 'notes'),
      'descriptions', count(*) filter (where nullif(btrim(description), '') is not null),
      'description_provenance', count(*) filter (where metadata ? 'descriptionProvenance'),
      'known_original_languages', count(original_language),
      'latest_sync', max(synced_at)
    ) from provider
  ),
  'display_languages', (
    select jsonb_object_agg(coalesce(lang, 'unknown'), n) from (
      select metadata ->> 'displayLanguage' as lang, count(*) as n
      from provider group by 1
    ) x
  ),
  'curated_gaps', (
    select jsonb_agg(jsonb_build_object(
      'item_id', b.id, 'title', b.title, 'creators', b.creators,
      'created_at', b.created_at,
      'aliases', (select jsonb_object_agg(namespace, external_id)
        from private.item_external_ids a where a.item_id = b.id)
    ) order by b.id)
    from books b
    where exists(select 1 from private.item_sources s
      where s.item_id = b.id and s.provider_key = 'kajo_curated')
      and not exists(select 1 from private.item_external_ids a
        where a.item_id = b.id and a.namespace = 'open_library_work')
  ),
  'pilot', (
    select jsonb_agg(jsonb_build_object(
      'position', p.position, 'item_id', p.item_id, 'work_id', p.work_id,
      'edition_id', p.edition_id, 'display_language', p.display_language,
      'title', b.title, 'created_at', b.created_at, 'updated_at', b.updated_at,
      'source_id', b.source_id, 'source_updated_at', b.source_updated_at,
      'previous_description', b.description,
      'previous_enrichment', b.source_payload -> 'descriptionEnrichment',
      'identity_matches', coalesce(b.discoverable and b.provider_item_id = p.work_id
        and b.matching_alias and b.work_alias_count = 1
        and b.metadata ->> 'openLibraryWorkId' = p.work_id
        and b.metadata ->> 'displayEditionKey' = p.edition_id
        and b.metadata ->> 'displayLanguage' = p.display_language, false),
      'has_description', nullif(btrim(b.description), '') is not null,
      'description_md5', md5(b.description),
      'description_sha256', encode(sha256(convert_to(b.description, 'UTF8')), 'hex'),
      'description_provenance', b.metadata -> 'descriptionProvenance',
      'source_synced_at', b.synced_at, 'core_md5', c.core_md5,
      'source_base_md5', b.source_base_md5
    ) order by p.position)
    from pilot p left join provider b on b.id = p.item_id and b.provider_item_id = p.work_id
      left join item_checks c on c.id = p.item_id
  ),
  'preservation', jsonb_build_object(
    'book_core_md5', (select md5(string_agg(id::text || core_md5, ',' order by id))
      from item_checks where item_type = 'BOOK'),
    'nonpilot_book_full_md5', (select md5(string_agg(id::text || full_md5, ',' order by id))
      from item_checks c where item_type = 'BOOK'
        and not exists(select 1 from pilot p where p.item_id = c.id)),
    'movie_full_md5', (select md5(string_agg(id::text || full_md5, ',' order by id))
      from item_checks where item_type = 'MOVIE'),
    'alias_identity_md5', (select md5(string_agg(
      (to_jsonb(a) - 'last_seen_at')::text, ',' order by namespace, external_id))
      from private.item_external_ids a),
    'source_identity_md5', (select md5(string_agg(
      jsonb_build_array(id, item_id, provider_key, provider_item_id, created_at)::text,
      ',' order by id)) from private.item_sources),
    'nonpilot_source_full_md5', (select md5(string_agg(to_jsonb(s)::text, ',' order by s.id))
      from private.item_sources s where not exists(
        select 1 from pilot p where p.item_id = s.item_id and s.provider_key = 'open_library')),
    'discoverable_mocks', (select count(*) from private.item_sources s
      join public.items i on i.id = s.item_id where s.provider_key = 'kajo_mock' and i.discoverable)
  )
) as book_description_coverage;
commit;
