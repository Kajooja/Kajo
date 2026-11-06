import type { PersonalContentRatingInput } from '../personal-content-rating.js';
import type { PersonalRatingBaselineInput } from '../personal-rating.js';
import { normalizeKajoPersonalRatingProspectivePrefix } from './kajo-personal-rating-prospective.js';
import type { KajoPersonalRatingProspectivePrefix } from './kajo-personal-rating-prospective.js';

/** A new, explicit assertion-presence representation. The original catalogue
 * audit still means positive assertion or unknown, never factual absence. */
export const personalContentFeatureContract = Object.freeze({
  mappingVersion: 'catalog-concepts-v1' as const,
  mappingHash: 'b4319f2554c8627b35f4d77428ff91a576e66ef7ab58fbb1d35f6f64d66f1642' as const,
  transformVersion: 'catalog-assertion-presence-v1' as const,
  concepts: Object.freeze(['fantasy', 'horror', 'mystery', 'romance', 'science-fiction', 'thriller']),
});
export const personalContentRatingProspectiveConfig = Object.freeze({
  version: 'personal-native-content-ridge-v1', ridge: 2,
});
export interface KajoPersonalContentFeatureUse {
  readonly version: 'personal-content-feature-use-v1';
  readonly purpose: 'PRIVATE_NATIVE_EVALUATION';
  readonly origin: 'observed' | 'synthetic';
  readonly reviewRef: string;
  readonly validFromMicros: string;
  readonly validUntilMicros: string;
  readonly retention: 'SOURCE_BOUND_UNTIL_WITHDRAWAL';
  readonly sources: readonly Readonly<{
    providerKey: 'tmdb' | 'open_library';
    evidenceKind: 'provider-genre' | 'provider-subject';
    disposition: 'PERMITTED';
  }>[];
}
export interface KajoPersonalContentProvenance {
  readonly providerKey: 'tmdb' | 'open_library';
  readonly providerItemId: string;
  readonly sourceUrl: string | null;
  readonly sourceHash: string | null;
  readonly sourceUpdatedAtMicros: string | null;
  readonly rowUpdatedAtMicros: string;
  readonly syncedAtMicros: string;
  readonly alias: Readonly<{ namespace: string; externalId: string }>;
  readonly evidenceKind: 'provider-genre' | 'provider-subject';
  readonly projectionHash: string;
  readonly featurePayload: Readonly<Record<string, unknown>>;
}
export interface KajoPersonalContentRatingPrefix extends Omit<KajoPersonalRatingProspectivePrefix, 'version'> {
  readonly version: 'kajo-personal-content-rating-prefix-v1';
  readonly contentFeatures: {
    readonly version: 'kajo-personal-content-features-v1';
    readonly snapshotId: string;
    readonly cutoffMicros: string;
    readonly mappingVersion: typeof personalContentFeatureContract.mappingVersion;
    readonly mappingHash: typeof personalContentFeatureContract.mappingHash;
    readonly transformVersion: typeof personalContentFeatureContract.transformVersion;
    readonly semantics: 'ASSERTION_PRESENCE';
    readonly featureUse: KajoPersonalContentFeatureUse | null;
    readonly featureIds: readonly string[];
    readonly objects: readonly Readonly<{
      objectId: string; domainId: 'BOOK' | 'MOVIE'; sourceId: string; availableAtMicros: string;
      status: 'AVAILABLE' | 'UNAVAILABLE'; assertions: readonly (1 | null)[] | null;
      values: readonly (0 | 1)[] | null; provenance: KajoPersonalContentProvenance | null;
    }>[];
  };
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid Kajo content rating prefix: ${message}`);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function shape(value: unknown, keys: readonly string[], message: string): void {
  check(object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), message);
}
function short(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && [...value].length <= max;
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}
function micros(value: unknown): bigint {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'feature clock');
  return BigInt(value);
}
const genreConcepts: Readonly<Record<string, string>> = Object.freeze({
  14: 'fantasy', 27: 'horror', 9648: 'mystery', 10749: 'romance', 878: 'science-fiction', 53: 'thriller',
});
const subjectConcepts: Readonly<Record<string, string>> = Object.freeze({
  fantasy: 'fantasy', 'fantasy fiction': 'fantasy', 'fiction, fantasy, general': 'fantasy',
  horror: 'horror', 'horror fiction': 'horror', 'horror tales': 'horror', 'horror stories': 'horror',
  'fiction, horror': 'horror', 'fiction / horror': 'horror',
  mystery: 'mystery', 'mystery fiction': 'mystery', 'detective and mystery stories': 'mystery',
  'detective and mystery fiction': 'mystery', 'mystery and detective stories': 'mystery',
  'fiction, mystery & detective, general': 'mystery', romance: 'romance', 'romance fiction': 'romance',
  'love stories': 'romance', 'fiction, romance, general': 'romance',
  'science fiction': 'science-fiction', 'fiction, science fiction, general': 'science-fiction',
  'fiction / science fiction / general': 'science-fiction', thriller: 'thriller', thrillers: 'thriller',
  'fiction, thrillers': 'thriller', 'fiction, thrillers, general': 'thriller',
  'fiction / thrillers': 'thriller', 'fiction / thrillers / general': 'thriller',
});
/** Data-only parity surface for the reviewed catalogue registry. */
export const personalContentFeatureMapping = Object.freeze({
  tmdbGenreIds: genreConcepts, openLibrarySubjects: subjectConcepts,
});

/** Shape/binding checks cannot certify source rights or a database transaction.
 * The closed manifest is an operator assertion supplied at the native boundary. */
export function normalizeKajoPersonalContentRatingPrefix(input: KajoPersonalContentRatingPrefix): PersonalContentRatingInput {
  check(input?.version === 'kajo-personal-content-rating-prefix-v1', 'version');
  check(new TextEncoder().encode(JSON.stringify(input)).byteLength <= 4 * 1024 * 1024, 'serialized input budget');
  check(typeof input.snapshotId === 'string' && /^native-content-prospective:[0-9a-f]{32}$/u.test(input.snapshotId)
    && input.candidatePool?.snapshotId === input.snapshotId, 'content snapshot identity');
  // Bridge only the versioned snapshot namespace/discriminant into the unchanged
  // v1 raw-label/pool validator, then restore the actual content snapshot ID.
  const legacySnapshot = input.snapshotId.replace('native-content-prospective:', 'native-prospective:');
  const projected = normalizeKajoPersonalRatingProspectivePrefix({ ...input, version: 'kajo-personal-rating-prospective-prefix-v1',
    snapshotId: legacySnapshot, candidatePool: { ...input.candidatePool, snapshotId: legacySnapshot } });
  const baseline = { ...projected, prefix: { ...projected.prefix, snapshotId: input.snapshotId },
    candidatePool: { ...projected.candidatePool, snapshotId: input.snapshotId } };
  return normalizeKajoPersonalContentFeatures(input, baseline);
}

/** Shared feature validation after the version-specific source/label boundary. */
export function normalizeKajoPersonalContentFeatures(
  input: Pick<KajoPersonalContentRatingPrefix, 'contentFeatures' | 'cutoffMicros' | 'snapshotId' | 'itemType' | 'evidenceOrigin' | 'source'>,
  baseline: PersonalRatingBaselineInput,
): PersonalContentRatingInput {
  const content = input.contentFeatures, cutoff = micros(input.cutoffMicros);
  shape(content, ['version', 'snapshotId', 'cutoffMicros', 'mappingVersion', 'mappingHash', 'transformVersion',
    'semantics', 'featureUse', 'featureIds', 'objects'], 'feature snapshot shape');
  check(content.version === 'kajo-personal-content-features-v1' && content.snapshotId === input.snapshotId
    && content.cutoffMicros === input.cutoffMicros && content.mappingVersion === personalContentFeatureContract.mappingVersion
    && content.mappingHash === personalContentFeatureContract.mappingHash
    && content.transformVersion === personalContentFeatureContract.transformVersion
    && content.semantics === 'ASSERTION_PRESENCE', 'feature snapshot identity');
  const kind = input.itemType === 'MOVIE' ? 'provider-genre' : 'provider-subject';
  const provider = input.itemType === 'MOVIE' ? 'tmdb' : 'open_library';
  const featureIds = personalContentFeatureContract.concepts.map(concept => `${kind}:${concept}`);
  check(Array.isArray(content.featureIds) && content.featureIds.length === featureIds.length
    && Array.from(content.featureIds).every((id, index) => id === featureIds[index]), 'fixed feature vocabulary/order');
  const manifest = content.featureUse;
  if (manifest !== null) {
    shape(manifest, ['version', 'purpose', 'origin', 'reviewRef', 'validFromMicros', 'validUntilMicros', 'retention', 'sources'], 'feature-use manifest shape');
    check(manifest.version === 'personal-content-feature-use-v1' && manifest.purpose === 'PRIVATE_NATIVE_EVALUATION'
      && manifest.origin === input.evidenceOrigin && short(manifest.reviewRef, 256)
      && micros(manifest.validFromMicros) <= cutoff && micros(manifest.validUntilMicros) >= cutoff
      && manifest.retention === 'SOURCE_BOUND_UNTIL_WITHDRAWAL' && Array.isArray(manifest.sources)
      && manifest.sources.length <= 2, 'feature-use manifest');
    const providers = new Set<string>();
    for (const source of manifest.sources) {
      shape(source, ['providerKey', 'evidenceKind', 'disposition'], 'feature-use source shape');
      check((source.providerKey === 'tmdb' && source.evidenceKind === 'provider-genre'
        || source.providerKey === 'open_library' && source.evidenceKind === 'provider-subject')
        && source.disposition === 'PERMITTED' && !providers.has(source.providerKey), 'feature-use source');
      providers.add(source.providerKey);
    }
  }
  const permitted = manifest?.sources.some(source => source.providerKey === provider && source.evidenceKind === kind) ?? false;
  const expected = new Set([...baseline.prefix.ratings.map(row => row.objectId), ...baseline.candidatePool.candidateIds]);
  check(Array.isArray(content.objects) && content.objects.length === expected.size, 'complete feature object union');
  const seen = new Set<string>(), sources = new Set<string>(), providerIdentities = new Set<string>();
  const objects = Array.from(content.objects, (row: KajoPersonalContentRatingPrefix['contentFeatures']['objects'][number]) => {
    shape(row, ['objectId', 'domainId', 'sourceId', 'availableAtMicros', 'status', 'assertions', 'values', 'provenance'], 'feature object shape');
    check(uuid(row.objectId) && expected.has(row.objectId) && !seen.has(row.objectId)
      && row.domainId === input.itemType && row.availableAtMicros === input.cutoffMicros, 'feature object scope/cutoff');
    seen.add(row.objectId);
    if (row.provenance === null) {
      check(row.sourceId === `unavailable:${row.objectId}` && row.status === 'UNAVAILABLE'
        && row.assertions === null && row.values === null, 'unavailable feature source');
    } else {
      const provenance = row.provenance;
      shape(provenance, ['providerKey', 'providerItemId', 'sourceUrl', 'sourceHash', 'sourceUpdatedAtMicros',
        'rowUpdatedAtMicros', 'syncedAtMicros', 'alias', 'evidenceKind', 'projectionHash', 'featurePayload'], 'feature provenance shape');
      check(permitted && uuid(row.sourceId) && !sources.has(row.sourceId) && provenance.providerKey === provider
        && provenance.evidenceKind === kind && short(provenance.providerItemId, 512)
        && (provenance.sourceUrl === null || short(provenance.sourceUrl, 2048) && /^https?:\/\//u.test(provenance.sourceUrl))
        && (provenance.sourceHash === null || short(provenance.sourceHash, 512))
        && micros(provenance.rowUpdatedAtMicros) <= cutoff && micros(provenance.syncedAtMicros) <= cutoff
        && /^[0-9a-f]{32}$/u.test(provenance.projectionHash), 'authorized feature provenance');
      if (provenance.sourceUpdatedAtMicros !== null) micros(provenance.sourceUpdatedAtMicros);
      shape(provenance.alias, ['namespace', 'externalId'], 'source alias shape');
      const namespace = provider === 'tmdb' ? 'tmdb_movie' : /^OL[0-9]+W$/u.test(provenance.providerItemId)
        ? 'open_library_work' : 'open_library_edition';
      check((provider === 'tmdb' ? /^[0-9]+$/u.test(provenance.providerItemId) : /^OL[0-9]+[WM]$/u.test(provenance.providerItemId))
        && provenance.alias.namespace === namespace && provenance.alias.externalId === provenance.providerItemId, 'source alias identity');
      const identity = `${provider}:${provenance.providerItemId}`;
      check(!providerIdentities.has(identity), 'duplicate provider identity');
      sources.add(row.sourceId); providerIdentities.add(identity);
      const field = provider === 'tmdb' ? 'genres' : namespace === 'open_library_work' ? 'subject' : 'subjects';
      shape(provenance.featurePayload, [field], 'allowlisted feature payload');
      const labels = provenance.featurePayload[field];
      check(Array.isArray(labels) && labels.length <= 128, 'feature labels');
      const asserted = new Set<string>();
      for (const label of labels) {
        let concept: string | undefined;
        if (provider === 'tmdb') {
          shape(label, ['id'], 'genre shape');
          const genre = label as Record<string, unknown>;
          check(typeof genre.id === 'number' && Number.isSafeInteger(genre.id) && genre.id > 0, 'genre identity');
          concept = genreConcepts[genre.id];
        } else {
          check(typeof label === 'string' && label.length > 0 && [...label].length <= 256, 'subject label');
          const normalized = label.trim().replace(/\s+/gu, ' ').toLowerCase();
          concept = Object.hasOwn(subjectConcepts, normalized) ? subjectConcepts[normalized] : undefined;
        }
        if (concept !== undefined) asserted.add(concept);
      }
      const assertions = personalContentFeatureContract.concepts.map(concept => asserted.has(concept) ? 1 : null);
      check(Array.isArray(row.assertions) && row.assertions.length === assertions.length
        && Array.from(row.assertions).every((value, index) => value === assertions[index]), 'source assertion projection');
      const available = asserted.size > 0;
      check(row.status === (available ? 'AVAILABLE' : 'UNAVAILABLE') && (available
        ? Array.isArray(row.values) && row.values.length === assertions.length
          && Array.from(row.values).every((value, index) => value === (assertions[index] === 1 ? 1 : 0))
        : row.values === null), 'explicit assertion-presence transform');
    }
    return { objectId: row.objectId, domainId: row.domainId, sourceId: row.sourceId,
      availableAtMicros: row.availableAtMicros, status: row.status, values: row.values === null ? null : [...row.values] };
  });
  const featureVersion = `${content.mappingVersion}:${content.mappingHash}:${content.transformVersion}`;
  return { ...baseline, prior: null,
    prefix: { ...baseline.prefix, sourceVersion: `personal-content-source-v1:${input.source.bodyMd5}:${featureVersion}` },
    contentConfig: personalContentRatingProspectiveConfig,
    content: { version: 'personal-content-feature-snapshot-v1', snapshotId: content.snapshotId,
      cutoffMicros: content.cutoffMicros, sourceVersion: featureVersion, featureIds, objects },
  };
}
