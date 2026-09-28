-- Read-only before/after inventory for #182. No actor/Profile/history payloads.
begin read only;
select jsonb_build_object(
  'items', (
    select jsonb_agg(summary order by summary.item_type)
    from (
      select item_type,
        count(*) as stored,
        count(*) filter (where discoverable) as discoverable,
        count(*) filter (where discoverable and nullif(btrim(image_url), '') is not null) as with_image,
        count(*) filter (where discoverable and nullif(btrim(description), '') is not null) as with_description,
        count(*) filter (where discoverable and cardinality(creators) > 0) as with_creators,
        count(*) filter (where discoverable and release_year is not null) as with_year
      from public.items
      group by item_type
    ) summary
  ),
  'providers', (
    select jsonb_agg(summary order by summary.provider_key, summary.item_type)
    from (
      select source.provider_key, item.item_type,
        count(*) as source_rows,
        count(distinct item.id) as distinct_items,
        count(*) filter (where item.discoverable) as discoverable,
        max(source.synced_at) as latest_sync
      from private.item_sources source
      join public.items item on item.id = source.item_id
      group by source.provider_key, item.item_type
    ) summary
  ),
  'tmdb', (
    select jsonb_build_object(
      'source_rows', count(*),
      'distinct_items', count(distinct item.id),
      'discoverable', count(*) filter (where item.discoverable),
      'with_image', count(*) filter (where nullif(btrim(item.image_url), '') is not null),
      'with_description', count(*) filter (where nullif(btrim(item.description), '') is not null),
      'with_creators', count(*) filter (where cardinality(item.creators) > 0),
      'missing_matching_alias', count(*) filter (where not exists (
        select 1 from private.item_external_ids alias
        where alias.item_id = item.id and alias.namespace = 'tmdb_movie'
          and alias.external_id = source.provider_item_id
      ))
    )
    from private.item_sources source
    join public.items item on item.id = source.item_id
    where source.provider_key = 'tmdb'
  ),
  'discoverable_mocks', (
    select count(*) from private.item_sources source
    join public.items item on item.id = source.item_id
    where source.provider_key = 'kajo_mock' and item.discoverable
  ),
  'rpc_execute', (
    select jsonb_object_agg(role_name,
      has_function_privilege(role_name, 'public.upsert_catalog_batch_v1(jsonb)', 'EXECUTE'))
    from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
  )
) as catalog_coverage;
commit;
