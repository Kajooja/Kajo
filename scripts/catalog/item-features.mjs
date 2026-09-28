import { createHash } from 'node:crypto';
import { normalizeCatalogTag } from '../../supabase/functions/_shared/catalog-normalizers.mjs';

export const FEATURE_VERSION = 'catalog-concepts-v1';
export const REPORT_VERSION = 'catalog-feature-coverage-v1';
export const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;

// Positive source assertions, not an exhaustive taxonomy or a serving vector.
// Open Library topics and TMDB genres retain different evidence kinds. Equal
// concept IDs do not claim equal transfer reliability or preference strength.
export const MAPPING_REGISTRY = Object.freeze({
  version: FEATURE_VERSION,
  reviewedAt: '2026-09-24',
  documentation: Object.freeze([
    'https://developer.themoviedb.org/reference/genre-movie-list',
    'https://openlibrary.org/dev/docs/api/search',
    'https://openlibrary.org/dev/docs/api/subjects',
    'https://openlibrary.org/subjects/science_fiction',
    'https://openlibrary.org/subjects/fantasy_fiction',
    'https://openlibrary.org/subjects/mystery_fiction',
    'https://openlibrary.org/subjects/romance_fiction',
    'https://openlibrary.org/subjects/horror_fiction',
    'https://openlibrary.org/subjects/fiction%2C_thrillers',
  ]),
  concepts: Object.freeze(['fantasy', 'horror', 'mystery', 'romance', 'science-fiction', 'thriller']),
  tmdbGenreIds: Object.freeze({ 14: 'fantasy', 27: 'horror', 9648: 'mystery',
    10749: 'romance', 878: 'science-fiction', 53: 'thriller' }),
  labelNormalization: 'trim-collapse-whitespace-lowercase-v1',
  // Reviewed exact labels after case/whitespace normalization only. No tokenization, fuzzy matches,
  // acquisition buckets, subject_people/places, text classification or fallback.
  openLibrarySubjects: Object.freeze({
    'fantasy': 'fantasy',
    'fantasy fiction': 'fantasy',
    'fiction, fantasy, general': 'fantasy',
    'horror': 'horror',
    'horror fiction': 'horror',
    'horror tales': 'horror',
    'horror stories': 'horror',
    'fiction, horror': 'horror',
    'fiction / horror': 'horror',
    'mystery': 'mystery',
    'mystery fiction': 'mystery',
    'detective and mystery stories': 'mystery',
    'detective and mystery fiction': 'mystery',
    'mystery and detective stories': 'mystery',
    'fiction, mystery & detective, general': 'mystery',
    'romance': 'romance',
    'romance fiction': 'romance',
    'love stories': 'romance',
    'fiction, romance, general': 'romance',
    'science fiction': 'science-fiction',
    'fiction, science fiction, general': 'science-fiction',
    'fiction / science fiction / general': 'science-fiction',
    'thriller': 'thriller',
    'thrillers': 'thriller',
    'fiction, thrillers': 'thriller',
    'fiction, thrillers, general': 'thriller',
    'fiction / thrillers': 'thriller',
    'fiction / thrillers / general': 'thriller',
  }),
});

function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, code) {
  requireValue(object(value) && Object.keys(value).length === keys.length
    && Object.keys(value).every(key => keys.includes(key)), code);
}

function shortString(value, max = 512) {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= max;
}

function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function unique(values, code) {
  requireValue(new Set(values).size === values.length, code);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export const MAPPING_SHA256 = sha256(canonicalJson(MAPPING_REGISTRY));

export function validateFeatureSnapshot(snapshot) {
  exactKeys(snapshot, ['contract', 'checkedAt', 'items'], 'invalid-snapshot');
  requireValue(snapshot.contract === 'catalog-feature-snapshot-v1' && timestamp(snapshot.checkedAt)
    && Array.isArray(snapshot.items) && snapshot.items.length <= 20000, 'invalid-snapshot');
  const sourceIds = [];
  const providerIds = [];
  for (const item of snapshot.items) {
    exactKeys(item, ['itemId', 'itemType', 'itemUpdatedAt', 'tags', 'sources'], 'invalid-item');
    requireValue(shortString(item.itemId, 128) && ['BOOK', 'MOVIE'].includes(item.itemType)
      && timestamp(item.itemUpdatedAt) && Date.parse(item.itemUpdatedAt) <= Date.parse(snapshot.checkedAt)
      && Array.isArray(item.tags) && item.tags.length <= 1000
      && item.tags.every(tag => shortString(tag, 8192))
      && Array.isArray(item.sources) && item.sources.length <= 8, 'invalid-item');
    for (const source of item.sources) {
      exactKeys(source, ['sourceId', 'providerKey', 'providerItemId', 'sourceUrl', 'sourceHash',
        'sourceUpdatedAt', 'rowUpdatedAt', 'syncedAt', 'identityMatches', 'featurePayload'], 'invalid-source');
      requireValue(shortString(source.sourceId, 128) && shortString(source.providerKey, 64)
        && /^[a-z0-9][a-z0-9._-]+$/.test(source.providerKey) && shortString(source.providerItemId)
        && (source.sourceUrl === null || shortString(source.sourceUrl, 2048))
        && (source.sourceHash === null || shortString(source.sourceHash))
        && (source.sourceUpdatedAt === null || timestamp(source.sourceUpdatedAt))
        && timestamp(source.rowUpdatedAt) && timestamp(source.syncedAt)
        && Date.parse(source.rowUpdatedAt) <= Date.parse(snapshot.checkedAt)
        && Date.parse(source.syncedAt) <= Date.parse(snapshot.checkedAt)
        && [true, false, null].includes(source.identityMatches)
        && object(source.featurePayload), 'invalid-source');
      const field = sourceField(source);
      const supported = source.providerKey === 'tmdb' || source.providerKey === 'open_library';
      if (supported) {
        requireValue(field !== null && (source.providerKey === 'tmdb'
          ? item.itemType === 'MOVIE' && /^[0-9]+$/.test(source.providerItemId)
          : item.itemType === 'BOOK') && typeof source.identityMatches === 'boolean', 'invalid-source-identity');
      }
      exactKeys(source.featurePayload, field ? [field] : [], 'invalid-feature-payload');
      const labels = field ? source.featurePayload[field] : null;
      requireValue(labels === null || (Array.isArray(labels) && labels.length <= 10000), 'invalid-feature-labels');
      if (Array.isArray(labels)) {
        for (const label of labels) {
          if (source.providerKey === 'tmdb') {
            exactKeys(label, ['id', 'name'], 'invalid-genre');
            requireValue(Number.isSafeInteger(label.id) && label.id > 0
              && shortString(label.name), 'invalid-genre');
          } else requireValue(shortString(label, 8192), 'invalid-subject');
        }
      }
      sourceIds.push(source.sourceId);
      providerIds.push(`${source.providerKey}:${source.providerItemId}`);
    }
    const supported = item.sources.filter(source => ['tmdb', 'open_library'].includes(source.providerKey));
    unique(supported.map(source => source.providerKey), 'ambiguous-item-provider');
  }
  unique(snapshot.items.map(item => item.itemId), 'duplicate-item');
  unique(sourceIds, 'duplicate-source');
  unique(providerIds, 'duplicate-provider-identity');
  return snapshot;
}

function sourceField(source) {
  if (source.providerKey === 'tmdb') return 'genres';
  if (source.providerKey === 'open_library') {
    if (/^OL[0-9]+W$/.test(source.providerItemId)) return 'subject';
    if (/^OL[0-9]+M$/.test(source.providerItemId)) return 'subjects';
  }
  return null;
}

function conceptFor(source, label) {
  if (source.providerKey === 'tmdb') return MAPPING_REGISTRY.tmdbGenreIds[label.id] ?? null;
  const normalized = normalizeSubject(label);
  return Object.hasOwn(MAPPING_REGISTRY.openLibrarySubjects, normalized)
    ? MAPPING_REGISTRY.openLibrarySubjects[normalized] : null;
}

function normalizeSubject(label) { return label.trim().replace(/\s+/g, ' ').toLowerCase(); }

function conceptValues() {
  return Object.fromEntries(MAPPING_REGISTRY.concepts.map(concept => [`concept:${concept}`, null]));
}

function counts() {
  return { items: 0, itemsWithAssertions: 0, itemsWithoutAssertions: 0,
    itemsWithoutSupportedSource: 0, itemsWithIdentityMismatch: 0,
    sourceRows: 0, unsupportedSourceRows: 0, identityMismatchSourceRows: 0,
    missingLabelSourceRows: 0, emptyLabelSourceRows: 0,
    observedLabelOccurrences: 0, matchedLabelOccurrences: 0, unmatchedLabelOccurrences: 0,
    matchedLabelsAbsentFromItemTags: 0, itemsWithAssertionsAbsentFromItemTags: 0,
    assertionsAbsentFromItemTags: 0,
    conceptItems: Object.fromEntries(MAPPING_REGISTRY.concepts.map(concept => [concept, 0])) };
}

function lexical(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

export function inspectItemFeatures(input) {
  const snapshot = validateFeatureSnapshot(input);
  const coverage = { BOOK: counts(), MOVIE: counts() };
  const features = [];
  for (const item of [...snapshot.items].sort((a, b) => lexical(a.itemId, b.itemId))) {
    const tally = coverage[item.itemType];
    tally.items += 1;
    const values = conceptValues();
    const assertions = [];
    const sources = [];
    const absentFromTags = new Set();
    const presentInTags = new Set();
    let hasSupportedSource = false;
    let hasIdentityMismatch = false;
    for (const source of [...item.sources].sort((a, b) => lexical(a.sourceId, b.sourceId))) {
      tally.sourceRows += 1;
      const field = sourceField(source);
      const labels = field ? source.featurePayload[field] : null;
      let status = 'unsupported-source';
      if (!field) tally.unsupportedSourceRows += 1;
      else {
        hasSupportedSource = true;
        if (!source.identityMatches) {
          status = 'identity-mismatch';
          hasIdentityMismatch = true;
          tally.identityMismatchSourceRows += 1;
        } else if (labels === null) {
          status = 'labels-unavailable';
          tally.missingLabelSourceRows += 1;
        } else if (!labels.length) {
          status = 'labels-empty';
          tally.emptyLabelSourceRows += 1;
        } else status = 'inspected';
      }
      const projectionSha256 = sha256(canonicalJson(source.featurePayload));
      const unmatched = [];
      if (status === 'inspected') {
        // Keep exact source positions for inspection; one concept is emitted once
        // per Item regardless of repeated or synonymous source labels.
        for (const [index, label] of labels.entries()) {
          tally.observedLabelOccurrences += 1;
          const concept = conceptFor(source, label);
          if (!concept) {
            tally.unmatchedLabelOccurrences += 1;
            unmatched.push({ index, value: label });
            continue;
          }
          tally.matchedLabelOccurrences += 1;
          values[`concept:${concept}`] = 1;
          const legacyTag = source.providerKey === 'tmdb' ? concept : normalizeCatalogTag(label);
          const inItemTags = item.tags.includes(legacyTag);
          if (inItemTags) presentInTags.add(concept);
          else {
            absentFromTags.add(concept);
            tally.matchedLabelsAbsentFromItemTags += 1;
          }
          assertions.push({ concept: `concept:${concept}`, sourceId: source.sourceId,
            sourceField: `${field}[${index}]`, sourceValue: label, projectionSha256,
            ruleId: source.providerKey === 'tmdb' ? `tmdb-genre:${label.id}` : `ol-subject:${normalizeSubject(label)}`,
            evidenceKind: source.providerKey === 'tmdb' ? 'provider-genre' : 'provider-subject',
            transferReliability: null, inItemTags });
        }
      }
      sources.push({ ...source, projectionSha256, status, unmatched });
    }
    const supportedConcepts = MAPPING_REGISTRY.concepts.filter(concept => values[`concept:${concept}`] === 1);
    if (supportedConcepts.length) tally.itemsWithAssertions += 1;
    else tally.itemsWithoutAssertions += 1;
    if (!hasSupportedSource) tally.itemsWithoutSupportedSource += 1;
    if (hasIdentityMismatch) tally.itemsWithIdentityMismatch += 1;
    for (const concept of supportedConcepts) tally.conceptItems[concept] += 1;
    const absent = [...absentFromTags].filter(concept => !presentInTags.has(concept)).length;
    if (absent) tally.itemsWithAssertionsAbsentFromItemTags += 1;
    tally.assertionsAbsentFromItemTags += absent;
    features.push({ itemId: item.itemId, itemType: item.itemType, itemUpdatedAt: item.itemUpdatedAt,
      availableAt: snapshot.checkedAt, featureVersion: FEATURE_VERSION, mappingSha256: MAPPING_SHA256,
      values, assertions, sources });
  }
  const snapshotSha256 = sha256(canonicalJson(snapshot));
  const artifact = { contract: 'catalog-feature-audit-v1', featureVersion: FEATURE_VERSION,
    mappingSha256: MAPPING_SHA256, snapshotSha256, checkedAt: snapshot.checkedAt, features };
  const report = { contract: REPORT_VERSION, featureVersion: FEATURE_VERSION,
    mappingSha256: MAPPING_SHA256, snapshotSha256, checkedAt: snapshot.checkedAt,
    artifactSha256: sha256(canonicalJson(artifact)), items: features.length, coverage,
    semantics: {
      positive: '1 means an exact supported provider label asserts the concept; duplicates do not increase it',
      missing: 'null means unavailable, unsupported or unasserted; never negative evidence',
      sourceKinds: 'provider-subject and provider-genre are retained separately; transfer reliability is unknown',
      availability: 'checkedAt is the observation boundary; source timestamps do not prove historical feature availability',
      tagComparison: 'compares matched source labels with current Item tags; absence is not proof of truncation',
      scope: 'offline catalog audit only; no serving, ranking, memory, training or rights admission',
    } };
  return { artifact, report };
}
