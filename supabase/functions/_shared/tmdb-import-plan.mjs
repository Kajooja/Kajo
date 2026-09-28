// Versioned admin selection contract. This is catalog coverage, not ranking.
// New actions fail as unsupported on the older importer before any provider I/O.
export const TMDB_BUCKET_ACTION = 'tmdb-movie-bucket-v1';
export const TMDB_IMDB_ACTION = 'tmdb-movies-by-imdb-v1';
export const MAX_IMDB_IDS_PER_REQUEST = 10;

export const TMDB_BETA_BUCKETS = Object.freeze([
  { id: 'finnish', pages: 3, minimumVoteCount: 10, filters: { with_original_language: 'fi' } },
  { id: 'classics', pages: 2, filters: { 'primary_release_date.lte': '1989-12-31' } },
  { id: '1990s', pages: 2, filters: { 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31' } },
  { id: '2000s', pages: 2, filters: { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31' } },
  { id: '2010s', pages: 2, filters: { 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31' } },
  { id: '2020s', pages: 2, filters: { 'primary_release_date.gte': '2020-01-01' } },
  ...['sv', 'fr', 'de', 'ja', 'ko', 'es'].map((language) => ({
    id: `language-${language}`, pages: 1, filters: { with_original_language: language },
  })),
  { id: 'animation', pages: 2, filters: { with_genres: '16' } },
  { id: 'comedy', pages: 2, filters: { with_genres: '35' } },
  { id: 'thriller', pages: 2, filters: { with_genres: '53' } },
  { id: 'horror', pages: 2, filters: { with_genres: '27' } },
  { id: 'science-fiction', pages: 2, filters: { with_genres: '878' } },
  { id: 'documentary', pages: 1, filters: { with_genres: '99' } },
].map((bucket) => Object.freeze({
  minimumVoteCount: 40, ...bucket, filters: Object.freeze(bucket.filters),
})));

export function getTmdbBucket(id) {
  return TMDB_BETA_BUCKETS.find((bucket) => bucket.id === id) ?? null;
}

export function validTmdbAsOf(value, today = new Date().toISOString().slice(0, 10)) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    value >= '2020-01-01' && value <= today;
}

export function validImdbIds(value, maximum = MAX_IMDB_IDS_PER_REQUEST) {
  return Array.isArray(value) && value.length > 0 && value.length <= maximum &&
    value.every((id) => typeof id === 'string' && /^tt\d{7,10}$/.test(id)) &&
    new Set(value).size === value.length;
}

export function bucketDiscoverFilters(bucket, asOf) {
  return {
    ...bucket.filters,
    'primary_release_date.lte': bucket.filters['primary_release_date.lte']
      ? (bucket.filters['primary_release_date.lte'] < asOf ? bucket.filters['primary_release_date.lte'] : asOf)
      : asOf,
  };
}

// Provider Discover filtering is checked again against primary-date detail data.
// Missing/invalid fields fail this admission check instead of creating sparse Items.
/** @param {ReturnType<typeof getTmdbBucket>} [bucket] */
export function eligibleTmdbMovie(movie, entry, asOf, bucket = null) {
  const date = movie?.release_date;
  if (!entry || movie.adult === true || movie.video === true ||
    typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > asOf ||
    !/^\/[^\s?#]+\.(jpg|png)$/.test(movie.poster_path ?? '') ||
    !entry.description || !entry.imageUrl || !entry.creators.length ||
    !entry.tags.length || !/^[a-z]{2}$/.test(entry.originalLanguage ?? '') ||
    !/^tt\d{7,10}$/.test(entry.externalIds.imdb_title ?? '') ||
    !Number.isFinite(movie.runtime) || movie.runtime <= 0 ||
    !Number.isFinite(movie.popularity) || movie.popularity < 0 ||
    !Number.isInteger(movie.vote_count) || movie.vote_count < 0) return false;
  if (!bucket) return true;
  const filters = bucketDiscoverFilters(bucket, asOf);
  return movie.vote_count >= bucket.minimumVoteCount &&
    (!filters.with_original_language || entry.originalLanguage === filters.with_original_language) &&
    (!filters['primary_release_date.gte'] || date >= filters['primary_release_date.gte']) &&
    date <= filters['primary_release_date.lte'] &&
    (!filters.with_genres || movie.genres?.some((genre) => String(genre.id) === filters.with_genres));
}
