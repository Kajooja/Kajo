-- Sprint 014A / #182
-- Bounded server-only batch wrapper around the canonical provider Item upsert.
-- Keeps provider adapters from issuing one Data API request per Item while
-- preserving one canonical public.items write path.

create or replace function public.upsert_catalog_batch_v1(entries jsonb)
returns table(input_index integer, item_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry_record record;
  normalized_tags text[];
  normalized_creators text[];
begin
  if entries is null or jsonb_typeof(entries) <> 'array' then
    raise exception 'Catalog entries must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(entries) < 1 or jsonb_array_length(entries) > 50 then
    raise exception 'Catalog batch size must be between 1 and 50'
      using errcode = '22023';
  end if;

  for entry_record in
    select value as entry, ordinality::integer as input_index
    from jsonb_array_elements(entries) with ordinality
  loop
    if jsonb_typeof(entry_record.entry) <> 'object' then
      raise exception 'Every catalog entry must be a JSON object'
        using errcode = '22023';
    end if;

    if entry_record.entry ? 'tags'
       and jsonb_typeof(entry_record.entry -> 'tags') <> 'array' then
      raise exception 'Catalog tags must be a JSON array' using errcode = '22023';
    end if;

    if entry_record.entry ? 'creators'
       and jsonb_typeof(entry_record.entry -> 'creators') <> 'array' then
      raise exception 'Catalog creators must be a JSON array' using errcode = '22023';
    end if;

    select coalesce(array_agg(tag_value), '{}'::text[])
    into normalized_tags
    from jsonb_array_elements_text(
      coalesce(entry_record.entry -> 'tags', '[]'::jsonb)
    ) as tag(tag_value);

    select coalesce(array_agg(creator_value), '{}'::text[])
    into normalized_creators
    from jsonb_array_elements_text(
      coalesce(entry_record.entry -> 'creators', '[]'::jsonb)
    ) as creator(creator_value);

    input_index := entry_record.input_index;
    item_id := public.upsert_catalog_item_v1(
      provider_key => entry_record.entry ->> 'providerKey',
      provider_item_id => entry_record.entry ->> 'providerItemId',
      item_type => entry_record.entry ->> 'itemType',
      title => entry_record.entry ->> 'title',
      description => entry_record.entry ->> 'description',
      tags => normalized_tags,
      metadata => coalesce(entry_record.entry -> 'metadata', '{}'::jsonb),
      creators => normalized_creators,
      release_year => case
        when entry_record.entry ? 'releaseYear'
          then (entry_record.entry ->> 'releaseYear')::integer
        else null
      end,
      image_url => entry_record.entry ->> 'imageUrl',
      original_language => entry_record.entry ->> 'originalLanguage',
      external_ids => coalesce(entry_record.entry -> 'externalIds', '{}'::jsonb),
      source_url => entry_record.entry ->> 'sourceUrl',
      source_updated_at => case
        when entry_record.entry ? 'sourceUpdatedAt'
          then (entry_record.entry ->> 'sourceUpdatedAt')::timestamptz
        else null
      end,
      source_hash => entry_record.entry ->> 'sourceHash',
      source_payload => coalesce(entry_record.entry -> 'sourcePayload', '{}'::jsonb),
      discoverable => case
        when entry_record.entry ? 'discoverable'
          then (entry_record.entry ->> 'discoverable')::boolean
        else true
      end
    );

    return next;
  end loop;
end;
$$;

revoke all on function public.upsert_catalog_batch_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_catalog_batch_v1(jsonb)
  to service_role;
