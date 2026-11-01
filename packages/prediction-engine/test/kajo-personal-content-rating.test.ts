import { describe, expect, it } from 'vitest';
import { normalizeKajoPersonalContentRatingPrefix as normalize, personalContentFeatureContract, personalContentFeatureMapping } from '../src/adapters/kajo-personal-content-rating.js';
import type { KajoPersonalContentRatingPrefix } from '../src/adapters/kajo-personal-content-rating.js';
import { forecastPersonalContentRating } from '../src/personal-content-rating.js';

const id = (n: number) => `a4050000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
function fixture(): Mutable<KajoPersonalContentRatingPrefix> {
  const snapshotId = `native-content-prospective:${'a'.repeat(32)}`, cutoff = '1793534400000000';
  const object = (n: number, concept: 'fantasy' | 'horror') => ({
    objectId: id(n), domainId: 'BOOK' as const, sourceId: id(n + 100), availableAtMicros: cutoff,
    status: 'AVAILABLE' as const, assertions: personalContentFeatureContract.concepts.map(c => c === concept ? 1 as const : null),
    values: personalContentFeatureContract.concepts.map(c => c === concept ? 1 as const : 0 as const),
    provenance: { providerKey: 'open_library' as const, providerItemId: `OL${n}W`, sourceUrl: null, sourceHash: null,
      sourceUpdatedAtMicros: null, rowUpdatedAtMicros: cutoff, syncedAtMicros: cutoff,
      alias: { namespace: 'open_library_work', externalId: `OL${n}W` }, evidenceKind: 'provider-subject' as const,
      projectionHash: 'd'.repeat(32), featurePayload: { subject: [concept] } },
  });
  return {
    version: 'kajo-personal-content-rating-prefix-v1', captureScope: 'PRIVATE_NATIVE_EVALUATION', evidenceOrigin: 'synthetic',
    forecastId: id(6), sourcePredictionId: id(7), targetItemId: id(5), snapshotId, complete: true,
    profile: { id: id(2), type: 'PERSONAL', ownerUserId: id(1) }, actorUserId: id(1), itemType: 'BOOK', cutoffMicros: cutoff,
    source: { signature: 'private.personal_source_evidence_v1(uuid,timestamp with time zone)', bodyMd5: 'b'.repeat(32) },
    labels: [[3, 8], [4, 2]].map(([n, rating]) => ({ itemId: id(n!), sourceEventId: id(n! + 200), sourceStatus: 'NATIVE_RATING',
      orderingBasis: 'CANONICAL_RECEIPT_LINEAGE', event: { id: id(n! + 200), actorUserId: id(1), profileId: id(2),
        itemId: id(n!), itemType: 'BOOK', eventType: 'ITEM_RATED', rating: rating!, occurredAtMicros: cutoff, availableAtMicros: cutoff } })),
    candidatePool: { snapshotId, cutoffMicros: cutoff, kind: 'FROZEN_DELIVERED_PERSONAL_POOL', sourcePredictionId: id(7),
      items: [5, 9].map(n => ({ id: id(n), itemType: 'BOOK', availableAtMicros: cutoff, discoverable: true })) },
    contentFeatures: { version: 'kajo-personal-content-features-v1', snapshotId, cutoffMicros: cutoff,
      mappingVersion: personalContentFeatureContract.mappingVersion, mappingHash: personalContentFeatureContract.mappingHash,
      transformVersion: personalContentFeatureContract.transformVersion, semantics: 'ASSERTION_PRESENCE',
      featureUse: { version: 'personal-content-feature-use-v1', purpose: 'PRIVATE_NATIVE_EVALUATION', origin: 'synthetic',
        reviewRef: 'fixture:structured-feature-use', validFromMicros: cutoff, validUntilMicros: '1793538000000000',
        retention: 'SOURCE_BOUND_UNTIL_WITHDRAWAL', sources: [{ providerKey: 'open_library', evidenceKind: 'provider-subject', disposition: 'PERMITTED' }] },
      featureIds: personalContentFeatureContract.concepts.map(c => `provider-subject:${c}`),
      objects: [object(3, 'fantasy'), object(4, 'horror'), object(5, 'fantasy'), object(9, 'horror')] },
  };
}
describe('Native content rating adapter', () => {
  it('keeps the actual projection maps and registry hash equal to the reviewed catalogue source', async () => {
    // Variable import keeps the private catalogue tooling out of the portable
    // package's compiled source graph; this is only an integration parity test.
    const registryPath = new URL('../../../scripts/catalog/item-features.mjs', import.meta.url).href;
    const { MAPPING_REGISTRY: registry, MAPPING_SHA256: hash } = await import(registryPath) as {
      MAPPING_SHA256: string; MAPPING_REGISTRY: { version: string; concepts: string[];
        tmdbGenreIds: Record<string, string>; openLibrarySubjects: Record<string, string> };
    };
    expect(personalContentFeatureContract.mappingHash).toBe(hash);
    expect(personalContentFeatureContract.mappingVersion).toBe(registry.version);
    expect(personalContentFeatureContract.concepts).toEqual(registry.concepts);
    expect(personalContentFeatureMapping.tmdbGenreIds).toEqual(registry.tmdbGenreIds);
    expect(personalContentFeatureMapping.openLibrarySubjects).toEqual(registry.openLibrarySubjects);
    for (const [label, concept] of Object.entries(registry.openLibrarySubjects)) {
      const raw = fixture(), row = raw.contentFeatures.objects[0]!;
      row.provenance!.featurePayload = { subject: [label] };
      row.assertions = registry.concepts.map(c => c === concept ? 1 : null);
      row.values = registry.concepts.map(c => c === concept ? 1 : 0);
      expect(normalize(raw).content.objects[0]!.values).toEqual(row.values);
    }
  });
  it('passes full grades and explicit source assertions to a separate fixed native challenger', () => {
    const raw = fixture(), input = normalize(raw), forecast = forecastPersonalContentRating(input);
    expect(input.contentConfig).toEqual({ version: 'personal-native-content-ridge-v1', ridge: 2 });
    expect(input.config).toEqual({ version: 'personal-native-location-v1', shrinkage: 2 });
    expect(input.prefix.sourceVersion).toBe(`personal-content-source-v1:${'b'.repeat(32)}:catalog-concepts-v1:${personalContentFeatureContract.mappingHash}:catalog-assertion-presence-v1`);
    expect(forecast.forecasts.map(row => row.control.value)).toEqual([5, 5]);
    expect(forecast.forecasts[0]!.candidate.value).toBeGreaterThan(5);
    expect(forecast.forecasts[1]!.candidate.value).toBeLessThan(5);
    expect(forecast.forecasts[0]!.candidate.prefixSupport).toBe(2);
    expect(raw.contentFeatures.objects[0]!.assertions).toEqual([1, null, null, null, null, null]);
    expect(input.content.objects[0]!.values).toEqual([1, 0, 0, 0, 0, 0]);
    for (let rating = 0; rating <= 10; rating++) {
      raw.labels[0]!.event.rating = rating;
      expect(normalize(raw).prefix.ratings[0]!.value).toBe(rating);
    }
  });
  it('keeps missing permission or source unavailable and preserves positive-only audit semantics', () => {
    const raw = fixture(); raw.contentFeatures.featureUse = null;
    for (const row of raw.contentFeatures.objects) Object.assign(row, {
      sourceId: `unavailable:${row.objectId}`, status: 'UNAVAILABLE', assertions: null, values: null, provenance: null,
    });
    const forecast = forecastPersonalContentRating(normalize(raw));
    expect(forecast.forecasts.map(row => row.candidate.value)).toEqual([5, 5]);
    expect(forecast.contentFit.featureSupport).toBe(0);
    const empty = fixture(), row = empty.contentFeatures.objects[0]!;
    row.provenance!.featurePayload = { subject: ['not in the reviewed mapping', '__proto__', 'constructor'] };
    row.assertions = [null, null, null, null, null, null]; row.values = null; row.status = 'UNAVAILABLE';
    expect(normalize(empty).content.objects[0]!.values).toBe(null);
  });
  it('uses only exact reviewed subject labels and separates movie genre evidence', () => {
    const raw = fixture();
    raw.contentFeatures.objects[0]!.provenance!.featurePayload = { subject: ['  FANTASY   FICTION  ', 'fantasy-world'] };
    expect(normalize(raw).content.objects[0]!.values).toEqual([1, 0, 0, 0, 0, 0]);
    raw.itemType = 'MOVIE'; raw.labels.forEach(row => { row.event.itemType = 'MOVIE'; });
    raw.candidatePool.items.forEach(row => { row.itemType = 'MOVIE'; });
    raw.contentFeatures.featureIds = personalContentFeatureContract.concepts.map(c => `provider-genre:${c}`);
    raw.contentFeatures.featureUse!.sources = [{ providerKey: 'tmdb', evidenceKind: 'provider-genre', disposition: 'PERMITTED' }];
    raw.contentFeatures.objects.forEach((row, i) => {
      row.domainId = 'MOVIE'; const provenance = row.provenance!;
      Object.assign(provenance, { providerKey: 'tmdb', providerItemId: String(i + 1), evidenceKind: 'provider-genre',
        alias: { namespace: 'tmdb_movie', externalId: String(i + 1) }, featurePayload: { genres: [{ id: i % 2 === 0 ? 14 : 27 }] } });
    });
    expect(normalize(raw).content.featureIds[0]).toBe('provider-genre:fantasy');
  });
  it('rejects incomplete unions, unapproved provenance, copied nonfeatures and changed feature identities', () => {
    const mutations: ((raw: ReturnType<typeof fixture>) => void)[] = [
      raw => { raw.contentFeatures.objects.pop(); },
      raw => { raw.contentFeatures.objects[1] = structuredClone(raw.contentFeatures.objects[0]!); },
      raw => { raw.contentFeatures.objects[0]!.domainId = 'MOVIE'; },
      raw => { raw.contentFeatures.objects[0]!.objectId = id(99); },
      raw => { raw.contentFeatures.objects[0]!.availableAtMicros = '1793534400000001'; },
      raw => { raw.contentFeatures.cutoffMicros = '1793534400000001'; },
      raw => { raw.contentFeatures.snapshotId = `native-content-prospective:${'f'.repeat(32)}`; },
      raw => { raw.contentFeatures.featureIds.reverse(); },
      raw => { delete raw.contentFeatures.featureIds[0]; },
      raw => { delete raw.contentFeatures.objects[0]; },
      raw => { Object.assign(raw.contentFeatures, { mappingHash: 'f'.repeat(64) }); },
      raw => { Object.assign(raw.contentFeatures, { transformVersion: 'implicit-absence-v1' }); },
      raw => { raw.contentFeatures.featureUse = null; },
      raw => { raw.contentFeatures.featureUse!.sources = []; },
      raw => { raw.contentFeatures.featureUse!.origin = 'observed'; },
      raw => { raw.contentFeatures.featureUse!.validFromMicros = '1793534400000001'; },
      raw => { raw.contentFeatures.featureUse!.validUntilMicros = '1793534399999999'; },
      raw => { raw.contentFeatures.featureUse!.sources.push(structuredClone(raw.contentFeatures.featureUse!.sources[0]!)); },
      raw => { raw.contentFeatures.objects[0]!.provenance!.alias.externalId = 'OL999W'; },
      raw => { raw.contentFeatures.objects[0]!.provenance!.featurePayload = { subject: ['fantasy'], description: 'unused text' }; },
      raw => { raw.contentFeatures.objects[0]!.provenance!.featurePayload = { subject: Array.from({ length: 129 }, () => 'fantasy') }; },
      raw => { raw.contentFeatures.objects[0]!.provenance!.featurePayload = { subject: ['x'.repeat(257)] }; },
      raw => { raw.contentFeatures.objects[0]!.provenance!.sourceUrl = 'file:///private'; },
      raw => { raw.contentFeatures.objects[0]!.provenance!.syncedAtMicros = '1793534400000001'; },
      raw => { raw.contentFeatures.objects[0]!.assertions = [1, 1, null, null, null, null]; },
      raw => { raw.contentFeatures.objects[0]!.values = [0, 0, 0, 0, 0, 0]; },
      raw => { delete raw.contentFeatures.objects[0]!.assertions![0]; },
      raw => { delete raw.contentFeatures.objects[0]!.values![0]; },
      raw => { raw.contentFeatures.objects[0]!.provenance = null; },
      raw => { raw.targetItemId = raw.labels[0]!.itemId; },
      raw => { raw.labels[0]!.event.rating = 5.5; },
    ];
    for (const mutate of mutations) { const raw = fixture(); mutate(raw); expect(() => normalize(raw)).toThrow(); }
  });
});
