-- Read-only feature audit input. No descriptions, people, Profiles or Events.
-- Keep the result outside Git; the offline inspector emits an aggregate report.
begin read only;
select jsonb_build_object(
  'contract', 'catalog-feature-snapshot-v1',
  'checkedAt', now(),
  'items', coalesce(jsonb_agg(jsonb_build_object(
    'itemId', i.id,
    'itemType', i.item_type,
    'itemUpdatedAt', i.updated_at,
    'tags', i.tags,
    'sources', coalesce((select jsonb_agg(jsonb_build_object(
      'sourceId', s.id,
      'providerKey', s.provider_key,
      'providerItemId', s.provider_item_id,
      'sourceUrl', s.source_url,
      'sourceHash', s.source_hash,
      'sourceUpdatedAt', s.source_updated_at,
      'rowUpdatedAt', s.updated_at,
      'syncedAt', s.synced_at,
      'identityMatches', case
        when s.provider_key = 'tmdb' then coalesce(
          i.item_type = 'MOVIE'
          and s.provider_item_id ~ '^[0-9]+$'
          and s.source_payload ->> 'id' = s.provider_item_id
          and (select count(*) from private.item_sources other
            where other.item_id = i.id and other.provider_key = s.provider_key) = 1
          and (select count(*) from private.item_external_ids a
            where a.item_id = i.id and a.namespace = 'tmdb_movie') = 1
          and exists (select 1 from private.item_external_ids a
            where a.item_id = i.id and a.namespace = 'tmdb_movie'
              and a.external_id = s.provider_item_id), false)
        when s.provider_key = 'open_library' then coalesce(
          i.item_type = 'BOOK'
          and (select count(*) from private.item_sources other
            where other.item_id = i.id and other.provider_key = s.provider_key) = 1
          and ((s.provider_item_id ~ '^OL[0-9]+W$'
            and s.source_payload ->> 'key' = '/works/' || s.provider_item_id
            and (select count(*) from private.item_external_ids a
              where a.item_id = i.id and a.namespace = 'open_library_work') = 1
            and exists (select 1 from private.item_external_ids a
              where a.item_id = i.id and a.namespace = 'open_library_work'
                and a.external_id = s.provider_item_id))
          or (s.provider_item_id ~ '^OL[0-9]+M$'
            and s.source_payload ->> 'key' = '/books/' || s.provider_item_id
            and (select count(*) from private.item_external_ids a
              where a.item_id = i.id and a.namespace = 'open_library_edition') = 1
            and exists (select 1 from private.item_external_ids a
              where a.item_id = i.id and a.namespace = 'open_library_edition'
                and a.external_id = s.provider_item_id))), false)
        else null
      end,
      'featurePayload', case
        when s.provider_key = 'tmdb' then jsonb_build_object('genres', s.source_payload -> 'genres')
        when s.provider_key = 'open_library' and s.provider_item_id ~ '^OL[0-9]+W$'
          then jsonb_build_object('subject', s.source_payload -> 'subject')
        when s.provider_key = 'open_library' and s.provider_item_id ~ '^OL[0-9]+M$'
          then jsonb_build_object('subjects', s.source_payload -> 'subjects')
        else '{}'::jsonb
      end
    ) order by s.provider_key, s.provider_item_id, s.id)
      from private.item_sources s where s.item_id = i.id), '[]'::jsonb)
  ) order by i.id), '[]'::jsonb)
) as catalog_feature_snapshot
from public.items i
where i.discoverable and i.item_type in ('BOOK', 'MOVIE');
commit;
