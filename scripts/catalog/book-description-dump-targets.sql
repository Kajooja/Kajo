-- Read-only, existing BOOK identities only. This snapshot does not grant text rights.
begin read only;
select jsonb_build_object(
  'contract', 'open-library-description-dump-targets-v1',
  'checkedAt', now(),
  'targets', coalesce(jsonb_agg(jsonb_build_object(
    'itemId', i.id,
    'sourceId', s.id,
    'workId', s.provider_item_id,
    'editionId', i.metadata ->> 'displayEditionKey',
    'displayLanguage', i.metadata ->> 'displayLanguage',
    'itemUpdatedAt', i.updated_at,
    'sourceUpdatedAt', s.updated_at,
    'descriptionSha256', case when nullif(btrim(i.description), '') is not null
      then encode(sha256(convert_to(i.description, 'UTF8')), 'hex') else null end,
    'managedDescription', i.metadata ? 'descriptionProvenance'
      or s.source_payload ? 'descriptionEnrichment',
    'identityMatches', coalesce(
      s.provider_item_id ~ '^OL[0-9]+W$'
      and i.metadata ->> 'openLibraryWorkId' = s.provider_item_id
      and i.metadata ->> 'displayEditionKey' ~ '^OL[0-9]+M$'
      and s.source_payload ->> 'key' = '/works/' || s.provider_item_id
      and (select count(*) from private.item_sources other
        where other.item_id = i.id and other.provider_key = 'open_library') = 1
      and (select count(*) from private.item_external_ids a
        where a.item_id = i.id and a.namespace = 'open_library_work') = 1
      and exists (select 1 from private.item_external_ids a
        where a.item_id = i.id and a.namespace = 'open_library_work'
          and a.external_id = s.provider_item_id), false)
  ) order by i.id), '[]'::jsonb)
) as book_description_dump_targets
from public.items i join private.item_sources s on s.item_id = i.id
where i.item_type = 'BOOK' and i.discoverable and s.provider_key = 'open_library';
commit;
