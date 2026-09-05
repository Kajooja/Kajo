import { normalizeCatalogTags } from '../../supabase/functions/_shared/catalog-normalizers.mjs';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_COVER_BASE_URL = 'https://covers.openlibrary.org/b/id';

export const OPEN_LIBRARY_BETA_BUCKETS = Object.freeze([
  { key: 'fantasy', query: 'subject_key:fantasy AND ratings_count:[20 TO *]', lang: 'en' },
  { key: 'science-fiction', query: 'subject_key:science_fiction AND ratings_count:[20 TO *]', lang: 'en' },
  { key: 'mystery', query: 'subject_key:mystery AND ratings_count:[20 TO *]', lang: 'en' },
  { key: 'romance', query: 'subject_key:romance AND ratings_count:[20 TO *]', lang: 'en' },
  { key: 'historical-fiction', query: 'subject_key:historical_fiction AND ratings_count:[10 TO *]', lang: 'en' },
  { key: 'horror', query: 'subject_key:horror AND ratings_count:[10 TO *]', lang: 'en' },
  { key: 'history', query: 'subject_key:history AND ratings_count:[10 TO *]', lang: 'en' },
  { key: 'philosophy', query: 'subject_key:philosophy AND ratings_count:[5 TO *]', lang: 'en' },
  { key: 'psychology', query: 'subject_key:psychology AND ratings_count:[5 TO *]', lang: 'en' },
  { key: 'recent-popular', query: 'first_publish_year:[2000 TO 2026] AND ratings_count:[30 TO *]', lang: 'en' },
  { key: 'finnish-editions', query: 'language:fin AND readinglog_count:[5 TO *]', lang: 'fi' },
  { key: 'swedish-editions', query: 'language:swe AND readinglog_count:[10 TO *]', lang: 'sv' },
  { key: 'young-adult', query: 'subject_key:young_adult_fiction AND ratings_count:[20 TO *]', lang: 'en' },
]);

const SEARCH_FIELDS = [
  'key',
  'title',
  'author_name',
  'cover_i',
  'first_publish_year',
  'edition_count',
  'ratings_count',
  'ratings_average',
  'readinglog_count',
  'language',
  'isbn',
  'subject',
  'editions',
  'editions.key',
  'editions.title',
  'editions.language',
  'editions.cover_i',
];

export function buildOpenLibrarySearchUrl(bucket, limit = 50) {
  if (!bucket?.query || !bucket?.lang) throw new Error('Open Library bucket requires query and lang.');
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set('q', bucket.query);
  url.searchParams.set('lang', bucket.lang);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('fields', SEARCH_FIELDS.join(','));
  return url.toString();
}

export function normalizeOpenLibrarySearchWork(doc, bucket) {
  if (!doc || typeof doc !== 'object' || !bucket?.key) return null;
  const workKey = cleanString(doc.key);
  if (!workKey || !/^\/works\/OL\d+W$/.test(workKey)) return null;

  const workId = workKey.slice('/works/'.length);
  const edition = Array.isArray(doc.editions?.docs) ? doc.editions.docs[0] : null;
  const editionTitle = cleanString(edition?.title);
  const workTitle = cleanString(doc.title);
  const title = editionTitle ?? workTitle;
  const coverId = positiveInteger(edition?.cover_i) ?? positiveInteger(doc.cover_i);
  const creators = uniqueStrings(doc.author_name, 5);

  if (!title || !coverId || creators.length === 0) return null;

  const releaseYear = fourDigitYear(doc.first_publish_year);
  const popularity = finiteNumber(doc.readinglog_count) ?? 0;
  const voteCount = finiteNumber(doc.ratings_count) ?? 0;
  const ratingsAverage = finiteNumber(doc.ratings_average);
  const editionCount = positiveInteger(doc.edition_count) ?? 0;
  const displayEditionKey = cleanString(edition?.key)?.replace(/^\/books\//, '') ?? null;
  const displayLanguage = cleanString(Array.isArray(edition?.language) ? edition.language[0] : null);
  const languages = uniqueStrings(doc.language, 24);
  const isbns = uniqueStrings(doc.isbn, 48);

  return {
    providerKey: 'open_library',
    providerItemId: workId,
    itemType: 'BOOK',
    title,
    description: null,
    tags: normalizeCatalogTags(doc.subject, 12),
    metadata: compactObject({
      openLibraryWorkId: workId,
      popularity,
      voteCount,
      ratingsAverage,
      editionCount,
      languages,
      isbns,
      providerSelection: 'OPEN_LIBRARY_SEARCH_BETA_V1',
      searchBucket: bucket.key,
      displayEditionKey,
      displayLanguage,
      displayTitleSource: editionTitle
        ? 'OPEN_LIBRARY_EDITION_LANG_V1'
        : 'OPEN_LIBRARY_WORK_TITLE',
    }),
    creators,
    releaseYear,
    imageUrl: `${OPEN_LIBRARY_COVER_BASE_URL}/${coverId}-L.jpg?default=false`,
    originalLanguage: null,
    externalIds: { open_library_work: workId },
    sourceUrl: `https://openlibrary.org/works/${encodeURIComponent(workId)}`,
    sourceUpdatedAt: null,
    sourceHash: null,
    sourcePayload: doc,
    discoverable: true,
  };
}

export function selectOpenLibraryBetaEntries(candidates, existingItems = []) {
  const existingWorkIds = new Set();
  const existingTitleOwners = new Map();

  for (const item of existingItems) {
    const titleKey = normalizedTitleKey(item?.title);
    const workId = cleanString(item?.metadata?.openLibraryWorkId);
    if (workId) existingWorkIds.add(workId);
    if (titleKey && !existingTitleOwners.has(titleKey)) {
      existingTitleOwners.set(titleKey, workId ?? null);
    }
  }

  const byWork = new Map();
  for (const candidate of candidates) {
    if (!candidate?.providerItemId || !candidate?.title) continue;
    const current = byWork.get(candidate.providerItemId);
    if (!current || compareCandidateQuality(candidate, current) < 0) {
      byWork.set(candidate.providerItemId, candidate);
    }
  }

  const selected = [];
  const selectedTitles = new Set();
  for (const candidate of [...byWork.values()].sort(compareCandidateQuality)) {
    const titleKey = normalizedTitleKey(candidate.title);
    if (!titleKey) continue;
    const existingOwner = existingTitleOwners.get(titleKey);
    const isRefresh = existingWorkIds.has(candidate.providerItemId);

    if (!isRefresh && existingOwner !== undefined) continue;
    if (selectedTitles.has(titleKey)) continue;

    selectedTitles.add(titleKey);
    selected.push(candidate);
  }

  return selected;
}

export function assertOpenLibraryBetaCoverage(input, options = {}) {
  const minimumItems = Number.isInteger(options.minimumItems) ? options.minimumItems : 180;
  const minimumBuckets = Number.isInteger(options.minimumBuckets) ? options.minimumBuckets : 8;
  const selectedCount = Number(input?.selectedCount ?? 0);
  const successfulBuckets = Number(input?.successfulBuckets ?? 0);

  if (selectedCount < minimumItems || successfulBuckets < minimumBuckets) {
    throw new Error(
      `Open Library beta coverage gate failed: ${selectedCount} Items / ${successfulBuckets} buckets; minimum ${minimumItems} / ${minimumBuckets}.`,
    );
  }
}

function compareCandidateQuality(left, right) {
  const popularityDelta = metadataNumber(right, 'popularity') - metadataNumber(left, 'popularity');
  if (popularityDelta !== 0) return popularityDelta;
  const voteDelta = metadataNumber(right, 'voteCount') - metadataNumber(left, 'voteCount');
  if (voteDelta !== 0) return voteDelta;
  return String(left.providerItemId).localeCompare(String(right.providerItemId));
}

function metadataNumber(entry, key) {
  const value = Number(entry?.metadata?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function normalizedTitleKey(value) {
  return cleanString(value)?.toLocaleLowerCase('en-US') ?? null;
}

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function finiteNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function fourDigitYear(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1400 && number <= 2200 ? number : null;
}

function uniqueStrings(values, limit = 12) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = cleanString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined) return false;
      if (Array.isArray(entryValue) && entryValue.length === 0) return false;
      if (typeof entryValue === 'string' && entryValue.length === 0) return false;
      return true;
    }),
  );
}
