import { extractWikidataFilmEvidence } from '@kajo/catalog-contracts/wikidata-film';
import type { PersonalContentRatingInput } from '../personal-content-rating.js';
import { normalizeKajoOwnedTasteRatingLabels } from './kajo-owned-taste-rating.js';
import type { KajoOwnedTasteRatingPrefix } from './kajo-owned-taste-rating.js';
import { normalizeKajoPersonalContentFeatures, personalContentFeatureContract, personalContentRatingProspectiveConfig }
  from './kajo-personal-content-rating.js';
import type { KajoPersonalContentFeatureUse, KajoPersonalContentProvenance, KajoPersonalContentRatingPrefix }
  from './kajo-personal-content-rating.js';

// SHA-256 of the four newline-separated version/digest lines checked by fixtures.
// This pins both provider mappings without changing either predecessor contract.
export const wikidataContentFeatureContract = Object.freeze({
  mappingVersion: 'wikidata-open-library-concepts-v1' as const,
  mappingHash: '34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb' as const,
  transformVersion: 'catalog-assertion-presence-v1' as const,
  concepts: personalContentFeatureContract.concepts,
});
export interface KajoWikidataFeatureUse extends Omit<KajoPersonalContentFeatureUse, 'version' | 'sources'> {
  readonly version: 'personal-content-feature-use-v2';
  readonly sources: readonly Readonly<{
    providerKey: 'wikidata' | 'open_library';
    evidenceKind: 'wikidata-direct-film-genre' | 'provider-subject'; disposition: 'PERMITTED';
  }>[];
}
interface WikidataProvenance extends Omit<KajoPersonalContentProvenance, 'providerKey' | 'evidenceKind' | 'featurePayload'> {
  readonly providerKey: 'wikidata'; readonly evidenceKind: 'wikidata-direct-film-genre';
  readonly aliases: readonly Readonly<{ namespace: string; externalId: string }>[];
  readonly featurePayload: Readonly<{
    projectionText: string; retrievedAtMicros: string; identity: Readonly<{ imdbId: string; tmdbMovieId: string }>;
  }>;
}
type OldFeatures = KajoPersonalContentRatingPrefix['contentFeatures'];
export interface KajoWikidataContentRatingPrefix extends Omit<KajoOwnedTasteRatingPrefix, 'version' | 'contentFeatures'> {
  readonly version: 'kajo-personal-content-rating-prefix-v3';
  readonly contentFeatures: Omit<OldFeatures, 'version' | 'mappingVersion' | 'mappingHash' | 'featureUse' | 'objects'> & {
    readonly version: 'kajo-personal-content-features-v2';
    readonly mappingVersion: typeof wikidataContentFeatureContract.mappingVersion;
    readonly mappingHash: typeof wikidataContentFeatureContract.mappingHash;
    readonly featureUse: KajoWikidataFeatureUse | null;
    readonly objects: readonly (Omit<OldFeatures['objects'][number], 'provenance'> & {
      readonly provenance: KajoPersonalContentProvenance | WikidataProvenance | null;
    })[];
  };
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid Kajo Wikidata content prefix: ${message}`);
}
function shape(value: unknown, keys: readonly string[]): void {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'closed shape');
}
function micros(value: unknown): bigint {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'source clock');
  return BigInt(value);
}
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** SQL proves committed source identity/availability under relation fences.
 * Re-extract only the frozen claims projection here, independently checking the
 * numerical vector. Its SHA binds projection bytes; sourceHash separately binds
 * original EntityData bytes checked by SQL, never a reconstructed original. */
export function normalizeKajoWikidataContentRatingPrefix(input: KajoWikidataContentRatingPrefix): PersonalContentRatingInput {
  check(input?.version === 'kajo-personal-content-rating-prefix-v3'
    && new TextEncoder().encode(JSON.stringify(input)).byteLength <= 4 * 1024 * 1024, 'version/input budget');
  check(/^native-wikidata-content:[0-9a-f]{32}$/u.test(input.snapshotId)
    && input.candidatePool?.snapshotId === input.snapshotId, 'snapshot identity');
  const labelSnapshot = input.snapshotId.replace('native-wikidata-content:', 'native-owned-content:');
  // Only labels pass the predecessor validator; new provider features are never
  // reinterpreted as TMDB. Restore the actual snapshot before content validation.
  const projected = normalizeKajoOwnedTasteRatingLabels({ ...input, version: 'kajo-personal-content-rating-prefix-v2',
    snapshotId: labelSnapshot, candidatePool: { ...input.candidatePool, snapshotId: labelSnapshot },
    contentFeatures: {} as OldFeatures });
  const baseline = { ...projected, prefix: { ...projected.prefix, snapshotId: input.snapshotId },
    candidatePool: { ...projected.candidatePool, snapshotId: input.snapshotId } };
  const content = input.contentFeatures, cutoff = micros(input.cutoffMicros), manifest = content.featureUse;
  shape(content, ['version', 'snapshotId', 'cutoffMicros', 'mappingVersion', 'mappingHash', 'transformVersion',
    'semantics', 'featureUse', 'featureIds', 'objects']);
  check(content.version === 'kajo-personal-content-features-v2' && content.snapshotId === input.snapshotId
    && content.cutoffMicros === input.cutoffMicros && content.mappingVersion === wikidataContentFeatureContract.mappingVersion
    && content.mappingHash === wikidataContentFeatureContract.mappingHash
    && content.transformVersion === wikidataContentFeatureContract.transformVersion && content.semantics === 'ASSERTION_PRESENCE', 'feature identity');
  if (manifest !== null) {
    shape(manifest, ['version', 'purpose', 'origin', 'reviewRef', 'validFromMicros', 'validUntilMicros', 'retention', 'sources']);
    check(manifest.version === 'personal-content-feature-use-v2' && manifest.purpose === 'PRIVATE_NATIVE_EVALUATION'
      && manifest.origin === input.evidenceOrigin && typeof manifest.reviewRef === 'string'
      && [...manifest.reviewRef].length >= 1 && [...manifest.reviewRef].length <= 256
      && micros(manifest.validFromMicros) <= cutoff && micros(manifest.validUntilMicros) >= cutoff
      && manifest.retention === 'SOURCE_BOUND_UNTIL_WITHDRAWAL' && Array.isArray(manifest.sources) && manifest.sources.length <= 2, 'review');
    const providers = new Set<string>();
    for (const source of manifest.sources) {
      shape(source, ['providerKey', 'evidenceKind', 'disposition']);
      check((source.providerKey === 'wikidata' && source.evidenceKind === 'wikidata-direct-film-genre'
        || source.providerKey === 'open_library' && source.evidenceKind === 'provider-subject')
        && source.disposition === 'PERMITTED' && !providers.has(source.providerKey), 'reviewed source');
      providers.add(source.providerKey);
    }
  }
  const sourceVersion = `${content.mappingVersion}:${content.mappingHash}:${content.transformVersion}`;
  let normalized: PersonalContentRatingInput;
  if (input.itemType === 'BOOK') {
    normalized = normalizeKajoPersonalContentFeatures({ ...input, contentFeatures: { ...content,
      version: 'kajo-personal-content-features-v1', mappingVersion: personalContentFeatureContract.mappingVersion,
      mappingHash: personalContentFeatureContract.mappingHash,
      featureUse: manifest === null ? null : { ...manifest, version: 'personal-content-feature-use-v1',
        sources: manifest.sources.filter(s => s.providerKey === 'open_library') as KajoPersonalContentFeatureUse['sources'] },
      objects: content.objects as OldFeatures['objects'] } }, baseline);
  } else {
    check(input.itemType === 'MOVIE', 'domain');
    const featureIds = wikidataContentFeatureContract.concepts.map(c => `wikidata-direct-film-genre:${c}`);
    check(equal(content.featureIds, featureIds), 'feature vocabulary/order');
    const expected = new Set([...baseline.prefix.ratings.map(r => r.objectId), ...baseline.candidatePool.candidateIds]);
    check(Array.isArray(content.objects) && content.objects.length === expected.size, 'complete object union');
    const seen = new Set<string>(), sources = new Set<string>(), identities = new Set<string>();
    const objects = content.objects.map(row => {
      shape(row, ['objectId', 'domainId', 'sourceId', 'availableAtMicros', 'status', 'assertions', 'values', 'provenance']);
      check(uuid(row.objectId) && expected.has(row.objectId) && !seen.has(row.objectId)
        && row.domainId === 'MOVIE' && row.availableAtMicros === input.cutoffMicros, 'object scope');seen.add(row.objectId);
      if (row.provenance === null) {
        check(row.sourceId === `unavailable:${row.objectId}` && row.status === 'UNAVAILABLE'
          && row.assertions === null && row.values === null, 'unavailable source');
      } else {
        const p = row.provenance;
        shape(p, ['providerKey', 'providerItemId', 'sourceUrl', 'sourceHash', 'sourceUpdatedAtMicros',
          'rowUpdatedAtMicros', 'syncedAtMicros', 'alias', 'aliases', 'evidenceKind', 'projectionHash', 'featurePayload']);
        check(p.providerKey === 'wikidata' && p.evidenceKind === 'wikidata-direct-film-genre'
          && manifest?.sources.some(s => s.providerKey === 'wikidata') && uuid(row.sourceId) && !sources.has(row.sourceId)
          && !identities.has(p.providerItemId) && typeof p.sourceHash === 'string' && /^[0-9a-f]{64}$/u.test(p.sourceHash)
          && micros(p.rowUpdatedAtMicros) <= cutoff && micros(p.syncedAtMicros) <= cutoff, 'native provenance');
        sources.add(row.sourceId);identities.add(p.providerItemId);
        shape(p.featurePayload, ['projectionText', 'retrievedAtMicros', 'identity']);
        const payload = p.featurePayload;
        shape(payload.identity, ['imdbId', 'tmdbMovieId']);
        check(typeof payload.projectionText === 'string' && new TextEncoder().encode(payload.projectionText).length <= 65536
          && micros(payload.retrievedAtMicros) <= micros(p.syncedAtMicros), 'available bounded projection');
        const aliases = [ { namespace: 'imdb_title', externalId: payload.identity.imdbId },
          { namespace: 'tmdb_movie', externalId: payload.identity.tmdbMovieId }, { namespace: 'wikidata_item', externalId: p.providerItemId } ];
        check(Array.isArray(p.aliases) && p.aliases.length === 3, 'identity census');
        p.aliases.forEach((alias: { namespace: string; externalId: string }, index: number) => { shape(alias, ['namespace', 'externalId']);
          check(alias.namespace === aliases[index]?.namespace && alias.externalId === aliases[index]?.externalId, 'exact external identity'); });
        shape(p.alias, ['namespace', 'externalId']);
        check(p.alias.namespace === 'wikidata_item' && p.alias.externalId === p.providerItemId, 'entity alias');
        const extraction = extractWikidataFilmEvidence(new TextEncoder().encode(payload.projectionText), {
          entityId: p.providerItemId, identity: payload.identity, retrievedAtMicros: payload.retrievedAtMicros, cutoffMicros: input.cutoffMicros });
        const evidence = extraction.evidence;
        check(evidence !== null && p.projectionHash === evidence.sourceSha256 && p.sourceUrl === evidence.sourceUrl
          && micros(p.sourceUpdatedAtMicros) === BigInt(Date.parse(evidence.sourceModifiedAt)) * 1000n
          && equal(row.assertions, evidence.assertions) && equal(row.values, evidence.values)
          && row.status === (extraction.status === 'CANDIDATE' ? 'AVAILABLE' : 'UNAVAILABLE'), 'independent feature projection');
      }
      return { objectId: row.objectId, domainId: row.domainId, sourceId: row.sourceId,
        availableAtMicros: row.availableAtMicros, status: row.status, values: row.values === null ? null : [...row.values] };
    });
    normalized = { ...baseline, prior: null, contentConfig: personalContentRatingProspectiveConfig,
      content: { version: 'personal-content-feature-snapshot-v1', snapshotId: input.snapshotId,
        cutoffMicros: input.cutoffMicros, sourceVersion, featureIds, objects } };
  }
  return { ...normalized, content: { ...normalized.content, sourceVersion }, prefix: { ...normalized.prefix,
    sourceId: 'kajo-owned-native-and-taste-ratings',
    sourceVersion: `owned-rating-source-v3:${input.trainingSource.bodyMd5}:${input.source.bodyMd5}:${sourceVersion}` } };
}
