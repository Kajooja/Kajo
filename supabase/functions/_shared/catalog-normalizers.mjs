const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const OPEN_LIBRARY_COVER_BASE_URL = 'https://covers.openlibrary.org/b/id';

const TMDB_GENRE_TAGS = new Map([
  [28, 'action'],
  [12, 'adventure'],
  [16, 'animation'],
  [35, 'comedy'],
  [80, 'crime'],
  [99, 'documentary'],
  [18, 'drama'],
  [10751, 'family'],
  [14, 'fantasy'],
  [36, 'history'],
  [27, 'horror'],
  [10402, 'music'],
  [9648, 'mystery'],
  [10749, 'romance'],
  [878, 'science-fiction'],
  [10770, 'tv-movie'],
  [53, 'thriller'],
  [10752, 'war'],
  [37, 'western'],
]);

const OPEN_LIBRARY_LANGUAGE_MAP = new Map([
  ['eng', 'en'],
  ['fin', 'fi'],
  ['swe', 'sv'],
  ['ger', 'de'],
  ['fre', 'fr'],
  ['spa', 'es'],
  ['ita', 'it'],
  ['nor', 'no'],
  ['dan', 'da'],
  ['dut', 'nl'],
]);

export function normalizeTmdbMovie(movie) {
  if (!movie || typeof movie !== 'object') return null;

  const id = toNonEmptyString(movie.id);
  const title = normalizeWhitespace(movie.title);
  if (!id || !title) return null;

  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((genre) => {
        const genreId = Number(genre?.id);
        return TMDB_GENRE_TAGS.get(genreId) ?? genre?.name;
      })
    : [];
  const directors = Array.isArray(movie.credits?.crew)
    ? movie.credits.crew
        .filter((member) => member?.job === 'Director')
        .map((member) => member?.name)
    : [];
  const cast = Array.isArray(movie.credits?.cast)
    ? movie.credits.cast.slice(0, 8).map((member) => member?.name)
    : [];
  const imdbId = normalizeWhitespace(movie.external_ids?.imdb_id);
  const releaseYear = parseYear(movie.release_date);
  const posterPath = normalizeWhitespace(movie.poster_path);
  const originalLanguage = normalizeWhitespace(movie.original_language)?.toLowerCase() ?? null;

  return {
    providerKey: 'tmdb',
    providerItemId: id,
    itemType: 'MOVIE',
    title,
    description: normalizeDescription(movie.overview),
    tags: normalizeCatalogTags(genres, 10),
    metadata: compactObject({
      originalTitle: normalizeWhitespace(movie.original_title),
      runtimeMinutes: toFiniteNumber(movie.runtime),
      popularity: toFiniteNumber(movie.popularity),
      voteAverage: toFiniteNumber(movie.vote_average),
      voteCount: toFiniteNumber(movie.vote_count),
      cast: uniqueStrings(cast, 8),
      productionCountries: Array.isArray(movie.production_countries)
        ? uniqueStrings(movie.production_countries.map((country) => country?.iso_3166_1), 12)
        : [],
    }),
    creators: uniqueStrings(directors, 4),
    releaseYear,
    imageUrl: posterPath ? `${TMDB_POSTER_BASE_URL}${posterPath}` : null,
    originalLanguage,
    externalIds: compactObject({
      tmdb_movie: id,
      imdb_title: imdbId,
    }),
    sourceUrl: `https://www.themoviedb.org/movie/${encodeURIComponent(id)}`,
    sourceUpdatedAt: null,
    sourceHash: null,
    sourcePayload: compactObject({
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      overview: movie.overview,
      genres: movie.genres,
      release_date: movie.release_date,
      poster_path: movie.poster_path,
      original_language: movie.original_language,
      runtime: movie.runtime,
      popularity: movie.popularity,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      production_countries: movie.production_countries,
      external_ids: movie.external_ids,
      credits: movie.credits,
    }),
    discoverable: true,
  };
}

export function normalizeOpenLibraryEdition(record, options = {}) {
  if (!record || typeof record !== 'object') return null;

  const key = normalizeWhitespace(record.key);
  const title = normalizeWhitespace(record.title);
  if (!key || !key.startsWith('/books/') || !title) return null;

  const editionId = key.slice('/books/'.length);
  const workKey = firstRefKey(record.works, '/works/');
  const isbn13 = firstIdentifier(record.isbn_13);
  const isbn10 = firstIdentifier(record.isbn_10);
  const coverId = firstFiniteInteger(record.covers);
  const languageKey = firstRefKey(record.languages, '/languages/');
  const languageCode = languageKey?.slice('/languages/'.length) ?? null;
  const originalLanguage = languageCode
    ? OPEN_LIBRARY_LANGUAGE_MAP.get(languageCode) ?? languageCode
    : null;
  const sourceUpdatedAt = normalizeOpenLibraryTimestamp(
    options.lastModified ?? record.last_modified,
  );
  const subjectValues = [
    ...(Array.isArray(record.subjects) ? record.subjects : []),
    ...(Array.isArray(record.subject_people) ? record.subject_people : []),
    ...(Array.isArray(record.subject_places) ? record.subject_places : []),
  ];

  return {
    providerKey: 'open_library',
    providerItemId: editionId,
    itemType: 'BOOK',
    title,
    description: normalizeDescription(record.description ?? record.notes),
    tags: normalizeCatalogTags(subjectValues, 12),
    metadata: compactObject({
      editionKey: key,
      workKey,
      publishDate: normalizeWhitespace(record.publish_date),
      publishers: uniqueStrings(record.publishers, 8),
      numberOfPages: firstFiniteNumber([
        record.number_of_pages,
        record.pagination,
      ]),
      isbn13: uniqueStrings(record.isbn_13, 8),
      isbn10: uniqueStrings(record.isbn_10, 8),
      languages: Array.isArray(record.languages)
        ? uniqueStrings(record.languages.map((language) => language?.key), 8)
        : [],
      byStatement: normalizeWhitespace(record.by_statement),
    }),
    creators: normalizeOpenLibraryCreators(record),
    releaseYear: parseYear(record.publish_date),
    imageUrl: coverId
      ? `${OPEN_LIBRARY_COVER_BASE_URL}/${coverId}-L.jpg?default=false`
      : null,
    originalLanguage,
    externalIds: compactObject({
      open_library_edition: editionId,
      open_library_work: workKey?.slice('/works/'.length) ?? null,
      isbn13,
      isbn10,
    }),
    sourceUrl: `https://openlibrary.org${key}`,
    sourceUpdatedAt,
    sourceHash: null,
    sourcePayload: record,
    discoverable: true,
  };
}

export function parseOpenLibraryDumpLine(line) {
  if (typeof line !== 'string' || line.length === 0) return null;

  const columns = splitFirstColumns(line, 4);
  if (!columns) return null;

  const [type, key, revision, lastModified, json] = columns;
  if (type !== '/type/edition' || !key?.startsWith('/books/')) return null;

  let record;
  try {
    record = JSON.parse(json);
  } catch {
    return null;
  }

  return {
    key,
    revision: Number.parseInt(revision, 10) || null,
    lastModified: normalizeWhitespace(lastModified),
    record,
  };
}

export function isUsefulOpenLibraryEdition(entry, options = {}) {
  if (!entry?.record) return false;
  const record = entry.record;
  const allowedLanguages = new Set(
    Array.isArray(options.languages) && options.languages.length > 0
      ? options.languages
      : ['eng', 'fin', 'swe'],
  );
  const minimumYear = Number.isInteger(options.minimumYear)
    ? options.minimumYear
    : 1950;
  const maximumYear = Number.isInteger(options.maximumYear)
    ? options.maximumYear
    : new Date().getUTCFullYear() + 1;
  const languageKey = firstRefKey(record.languages, '/languages/');
  const languageCode = languageKey?.slice('/languages/'.length) ?? null;
  const releaseYear = parseYear(record.publish_date);

  if (!normalizeWhitespace(record.title)) return false;
  if (!firstRefKey(record.works, '/works/')) return false;
  if (!firstIdentifier(record.isbn_13) && !firstIdentifier(record.isbn_10)) return false;
  if (!firstFiniteInteger(record.covers)) return false;
  if (languageCode && !allowedLanguages.has(languageCode)) return false;
  if (releaseYear !== null && (releaseYear < minimumYear || releaseYear > maximumYear)) {
    return false;
  }

  return true;
}

export function normalizeCatalogTags(values, limit = 12) {
  const normalized = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const tag = normalizeCatalogTag(value);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
    if (normalized.length >= limit) break;
  }

  return normalized;
}

export function normalizeCatalogTag(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  const slug = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');

  return slug.length >= 2 ? slug : null;
}

function normalizeOpenLibraryCreators(record) {
  const byStatement = normalizeWhitespace(record.by_statement);
  if (byStatement) return [byStatement];

  return [];
}

function normalizeOpenLibraryTimestamp(value) {
  if (typeof value === 'string') {
    const normalized = normalizeWhitespace(value);
    return normalized && !Number.isNaN(Date.parse(normalized)) ? normalized : null;
  }

  if (value && typeof value === 'object') {
    return normalizeOpenLibraryTimestamp(value.value);
  }

  return null;
}

function normalizeDescription(value) {
  if (typeof value === 'string') return normalizeWhitespace(value);
  if (value && typeof value === 'object') {
    return normalizeWhitespace(value.value);
  }
  return null;
}

function normalizeWhitespace(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function toNonEmptyString(value) {
  return normalizeWhitespace(value);
}

function toFiniteNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFiniteNumber(values) {
  for (const value of Array.isArray(values) ? values : []) {
    const number = toFiniteNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function firstFiniteInteger(values) {
  for (const value of Array.isArray(values) ? values : []) {
    const number = Number(value);
    if (Number.isInteger(number) && number > 0) return number;
  }
  return null;
}

function parseYear(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  const match = normalized.match(/\b(1[4-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function firstRefKey(values, prefix) {
  if (!Array.isArray(values)) return null;
  for (const value of values) {
    const key = normalizeWhitespace(value?.key ?? value);
    if (key?.startsWith(prefix)) return key;
  }
  return null;
}

function firstIdentifier(values) {
  if (!Array.isArray(values)) return null;
  for (const value of values) {
    const normalized = normalizeWhitespace(value)?.replace(/[^0-9Xx]/g, '');
    if (normalized) return normalized.toUpperCase();
  }
  return null;
}

function uniqueStrings(values, limit = 12) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeWhitespace(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function compactObject(value) {
  const entries = Object.entries(value).filter(([, entryValue]) => {
    if (entryValue === null || entryValue === undefined) return false;
    if (Array.isArray(entryValue) && entryValue.length === 0) return false;
    if (typeof entryValue === 'string' && entryValue.length === 0) return false;
    return true;
  });
  return Object.fromEntries(entries);
}

function splitFirstColumns(line, delimiterCount) {
  const columns = [];
  let start = 0;

  for (let index = 0; index < delimiterCount; index += 1) {
    const delimiterIndex = line.indexOf('\t', start);
    if (delimiterIndex < 0) return null;
    columns.push(line.slice(start, delimiterIndex));
    start = delimiterIndex + 1;
  }

  columns.push(line.slice(start));
  return columns;
}
