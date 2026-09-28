-- Read-only #182 expansion checkpoint. Count canonical Items, never upserts.
begin read only;
with movies as (
  select i.*,
    exists (select 1 from private.item_sources s where s.item_id = i.id and s.provider_key = 'tmdb') as tmdb,
    exists (select 1 from private.item_sources s where s.item_id = i.id and s.provider_key = 'kajo_curated') as curated,
    nullif(btrim(i.image_url), '') is not null and
      nullif(btrim(i.description), '') is not null and cardinality(i.creators) > 0 and
      i.release_year is not null and nullif(btrim(i.original_language), '') is not null and
      cardinality(i.tags) > 0 as core_metadata
  from public.items i where i.item_type = 'MOVIE' and i.discoverable
), language_counts as (
  select coalesce(original_language, 'unknown') as language, count(*) as items
  from movies where tmdb and core_metadata group by original_language
), eras as (
  select bounds.era, count(m.id) as items from (
    values ('before-1990', 0, 1989), ('1990s', 1990, 1999), ('2000s', 2000, 2009),
      ('2010s', 2010, 2019), ('2020s-and-later', 2020, 9999)
  ) bounds(era, first_year, last_year)
  left join movies m on m.tmdb and m.core_metadata and m.release_year between bounds.first_year and bounds.last_year
  group by bounds.era
), genres as (
  select genre, count(distinct m.id) as items
  from movies m cross join lateral unnest(m.tags) genre
  where m.tmdb and m.core_metadata group by genre
), curated_gaps as (
  select m.id, m.title, m.release_year,
    (select jsonb_agg(x.external_id order by x.external_id)
      from private.item_external_ids x where x.item_id = m.id and x.namespace = 'imdb_title') as imdb_ids
  from movies m where m.curated and (not m.tmdb or not m.core_metadata)
), counts as (
  select count(*) as discoverable_movies,
    count(*) filter (where tmdb and core_metadata) as complete_tmdb_movies,
    count(*) filter (where tmdb and core_metadata and original_language = 'fi') as finnish_language,
    count(*) filter (where tmdb and core_metadata and metadata->'productionCountries' ? 'FI') as finnish_production,
    count(*) filter (where tmdb and core_metadata and original_language <> 'en') as non_english,
    count(*) filter (where curated) as discoverable_curated_movies
  from movies
)
select jsonb_build_object(
  'checked_at', statement_timestamp(),
  'counts', (select to_jsonb(c) from counts c),
  'languages', (select coalesce(jsonb_object_agg(language, items), '{}'::jsonb) from language_counts),
  'eras', (select jsonb_object_agg(era, items) from eras),
  'genres', (select coalesce(jsonb_object_agg(genre, items), '{}'::jsonb) from genres),
  'curated_gaps', (select coalesce(jsonb_agg(g order by g.title), '[]'::jsonb) from curated_gaps g),
  'review_targets', jsonb_build_object(
    'at_least_300_complete_tmdb_movies', (select complete_tmdb_movies >= 300 from counts),
    'at_least_25_finnish_language_movies', (select finnish_language >= 25 from counts),
    'at_least_90_non_english_movies', (select non_english >= 90 from counts),
    'at_least_6_languages_with_10_movies', (select count(*) >= 6 from language_counts where language <> 'unknown' and items >= 10),
    'at_least_25_movies_in_each_era', (select bool_and(items >= 25) from eras),
    'at_least_8_genres_with_15_movies', (select count(*) >= 8 from genres where items >= 15),
    'at_least_10_documentaries', coalesce((select items >= 10 from genres where genre = 'documentary'), false),
    'all_30_curated_movies_enriched', (select discoverable_curated_movies = 30 from counts) and not exists (select 1 from curated_gaps)
  )
) as tmdb_expansion_coverage;
commit;
