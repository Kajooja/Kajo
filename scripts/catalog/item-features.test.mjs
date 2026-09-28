import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson, inspectItemFeatures, MAPPING_REGISTRY, MAPPING_SHA256,
  sha256, validateFeatureSnapshot } from './item-features.mjs';

const checkedAt = '2026-09-24T11:18:16.242881+00:00';
const previous = '2026-09-13T08:00:00Z';
function source(providerKey, providerItemId, featurePayload) {
  return { sourceId: `${providerKey}-${providerItemId}`, providerKey, providerItemId,
    sourceUrl: `https://example.invalid/private-${providerItemId}`, sourceHash: null,
    sourceUpdatedAt: null, rowUpdatedAt: previous, syncedAt: previous,
    identityMatches: true, featurePayload };
}
function book(subject = ['Science fiction'], id = 'book') {
  return { itemId: id, itemType: 'BOOK', itemUpdatedAt: previous, tags: [],
    sources: [source('open_library', 'OL1W', { subject })] };
}
function movie(genres = [{ id: 878, name: 'Science fiction' }]) {
  return { itemId: 'movie', itemType: 'MOVIE', itemUpdatedAt: previous, tags: [],
    sources: [source('tmdb', '123', { genres })] };
}
function snapshot(...items) { return { contract: 'catalog-feature-snapshot-v1', checkedAt, items }; }
function allNull(item) { return Object.values(item.values).every(value => value === null); }

test('BOOK subjects and localized MOVIE genre IDs share concepts while preserving distinct evidence', () => {
  const { artifact, report } = inspectItemFeatures(snapshot(book(['  SCIENCE   FICTION  ']), movie()));
  const [b, m] = artifact.features;
  assert.equal(b.values['concept:science-fiction'], 1);
  assert.equal(m.values['concept:science-fiction'], 1);
  assert.equal(b.values['concept:romance'], null);
  assert.equal(b.assertions[0].evidenceKind, 'provider-subject');
  assert.equal(m.assertions[0].evidenceKind, 'provider-genre');
  assert.equal(b.assertions[0].transferReliability, null);
  assert.equal(b.assertions[0].sourceField, 'subject[0]');
  assert.equal(b.assertions[0].sourceValue, '  SCIENCE   FICTION  ');
  assert.equal(b.assertions[0].ruleId, 'ol-subject:science fiction');
  assert.equal(b.sources[0].sourceHash, null);
  assert.equal(report.coverage.BOOK.itemsWithAssertions, 1);
  assert.equal(report.coverage.MOVIE.itemsWithAssertions, 1);
});

test('all six reviewed TMDB IDs map independently of localized names or order', () => {
  const genres = Object.entries(MAPPING_REGISTRY.tmdbGenreIds).map(([id]) => ({ id: Number(id), name: 'local name' }));
  const { artifact } = inspectItemFeatures(snapshot(movie(genres)));
  assert.deepEqual(Object.values(artifact.features[0].values), [1, 1, 1, 1, 1, 1]);
  assert.ok(allNull(inspectItemFeatures(snapshot(movie([{ id: 999, name: 'Fantasy' }]))).artifact.features[0]));
});

test('repeated and synonymous subject labels produce one positive value, with all evidence retained', () => {
  const { artifact, report } = inspectItemFeatures(snapshot(book(['Horror', 'horror', 'Horror fiction', 'Horror'])));
  assert.equal(artifact.features[0].values['concept:horror'], 1);
  assert.equal(artifact.features[0].assertions.length, 4);
  assert.equal(report.coverage.BOOK.conceptItems.horror, 1);
  assert.equal(report.coverage.BOOK.matchedLabelOccurrences, 4);
  assert.equal(report.coverage.BOOK.assertionsAbsentFromItemTags, 1);
});

test('missing, empty, unrecognized and curated-only evidence stay neutral even with canonical tags', () => {
  for (const subjects of [null, [], ['Unreviewed subject']]) {
    const item = book(subjects);
    item.tags = ['science-fiction', 'fantasy'];
    assert.ok(allNull(inspectItemFeatures(snapshot(item)).artifact.features[0]));
  }
  const curated = book();
  curated.tags = ['fantasy'];
  curated.sources = [{ ...source('kajo_curated', 'curated-book', {}), identityMatches: null }];
  const result = inspectItemFeatures(snapshot(curated));
  assert.ok(allNull(result.artifact.features[0]));
  assert.equal(result.report.coverage.BOOK.itemsWithoutSupportedSource, 1);
});

test('lookalike, ambiguous, qualified and mixed concepts do not trigger fuzzy matches', () => {
  const labels = ['Drama', 'History', 'Nonfiction', 'Comics', 'Romance languages',
    'Romance-language fiction', 'Mystery religions', 'Science fiction, history and criticism',
    'Horror films', 'Fantasy fiction, history and criticism', 'Science Fiction & Fantasy',
    'Fantasy .', 'fiction,fantasy,general', 'collectionID:YDarkromance', '__proto__', 'constructor'];
  const { artifact, report } = inspectItemFeatures(snapshot(book(labels)));
  assert.ok(allNull(artifact.features[0]));
  assert.equal(report.coverage.BOOK.unmatchedLabelOccurrences, labels.length);
});

test('Edition subjects use the same registry but keep their exact source field', () => {
  const item = book();
  item.sources = [source('open_library', 'OL2M', { subjects: ['Fantasy fiction'] })];
  const result = inspectItemFeatures(snapshot(item));
  assert.equal(result.artifact.features[0].values['concept:fantasy'], 1);
  assert.equal(result.artifact.features[0].assertions[0].sourceField, 'subjects[0]');
});

test('identity mismatch fails closed for assertions without treating it as negative evidence', () => {
  const item = book();
  item.sources[0].identityMatches = false;
  const { artifact, report } = inspectItemFeatures(snapshot(item));
  assert.ok(allNull(artifact.features[0]));
  assert.equal(artifact.features[0].sources[0].status, 'identity-mismatch');
  assert.equal(report.coverage.BOOK.observedLabelOccurrences, 0);
  assert.equal(report.coverage.BOOK.itemsWithIdentityMismatch, 1);
});

test('ambiguous or malformed identities, types, times and source payloads are rejected', () => {
  const mutations = [
    s => s.items.push(structuredClone(s.items[0])),
    s => s.items[0].sources.push({ ...s.items[0].sources[0], sourceId: 'second', providerItemId: 'OL2W' }),
    s => s.items[0].itemType = 'MOVIE',
    s => s.items[0].sources[0].providerItemId = 'OL1X',
    s => s.items[0].sources[0].identityMatches = null,
    s => s.items[0].sources[0].rowUpdatedAt = '2030-01-01T00:00:00Z',
    s => s.items[0].sources[0].syncedAt = '2026-01-01T00:00:00',
    s => s.items[0].sources[0].featurePayload.subject_people = ['Science fiction'],
    s => s.items[0].sources[0].featurePayload.subject = [{ name: 'Science fiction' }],
    s => s.items[0].sources[0].featurePayload.subject = ['x'.repeat(8193)],
    s => s.items[0].description = 'Not part of this projection',
  ];
  for (const change of mutations) {
    const input = snapshot(book());
    change(input);
    assert.throws(() => validateFeatureSnapshot(input));
  }
  const sameSource = snapshot(book(), { ...book(), itemId: 'different-item' });
  assert.throws(() => validateFeatureSnapshot(sameSource), /duplicate-source/);
  sameSource.items[1].sources[0].sourceId = 'different-source';
  assert.throws(() => validateFeatureSnapshot(sameSource), /duplicate-provider-identity/);
});

test('malformed TMDB IDs are rejected instead of coerced; absent fields are not fabricated', () => {
  assert.throws(() => inspectItemFeatures(snapshot(movie([{ id: '878', name: 'Science fiction' }]))), /invalid-genre/);
  assert.throws(() => inspectItemFeatures(snapshot(movie([{ id: 878 }]))), /invalid-genre/);
  const input = snapshot(movie());
  delete input.items[0].sources[0].featurePayload.genres;
  assert.throws(() => inspectItemFeatures(input), /invalid-feature-payload/);
});

test('provenance binds projection, mapping and observed availability without backdating', () => {
  const input = snapshot(book());
  input.items[0].sources[0].sourceUpdatedAt = '1950-01-01T00:00:00Z';
  const first = inspectItemFeatures(input);
  const row = first.artifact.features[0];
  assert.equal(row.availableAt, checkedAt);
  assert.equal(row.mappingSha256, MAPPING_SHA256);
  assert.equal(row.sources[0].projectionSha256, sha256(canonicalJson({ subject: ['Science fiction'] })));
  assert.equal(first.report.artifactSha256, sha256(canonicalJson(first.artifact)));
  input.items[0].sources[0].featurePayload.subject.push('Unknown label');
  const second = inspectItemFeatures(input);
  assert.notEqual(second.artifact.snapshotSha256, first.artifact.snapshotSha256);
  assert.notEqual(second.artifact.features[0].sources[0].projectionSha256, row.sources[0].projectionSha256);
  assert.deepEqual(second.artifact.features[0].values, row.values);
});

test('labels beyond the legacy tag cap are inspected, without claiming why tags omit them', () => {
  const labels = Array.from({ length: 12 }, (_, i) => `Unmapped subject ${i}`);
  labels.push('Science fiction', 'Fantasy fiction', 'Fantasy');
  const item = book(labels);
  item.tags = ['fantasy'];
  const { report, artifact } = inspectItemFeatures(snapshot(item));
  assert.equal(artifact.features[0].values['concept:science-fiction'], 1);
  assert.equal(artifact.features[0].values['concept:fantasy'], 1);
  assert.equal(report.coverage.BOOK.matchedLabelsAbsentFromItemTags, 2);
  assert.equal(report.coverage.BOOK.assertionsAbsentFromItemTags, 1);
  assert.equal(report.coverage.BOOK.itemsWithAssertionsAbsentFromItemTags, 1);
});

test('aggregate output never includes row identities, source URLs, hashes or raw labels', () => {
  const item = book(['PRIVATE_UNKNOWN_SUBJECT']);
  item.itemId = 'PRIVATE_ITEM_ID';
  item.sources[0].sourceId = 'PRIVATE_SOURCE_ID';
  item.sources[0].sourceHash = 'PRIVATE_SOURCE_HASH';
  item.sources[0].sourceUrl = 'https://example.invalid/PRIVATE_URL';
  const { report } = inspectItemFeatures(snapshot(item));
  const json = JSON.stringify(report);
  assert.doesNotMatch(json, /PRIVATE_|example\.invalid|OL1W/);
  assert.equal(report.coverage.BOOK.itemsWithoutAssertions, 1);
});

test('inspection is deterministic, independent of object-key order and does not mutate input', () => {
  const input = snapshot(book(), movie());
  const before = JSON.stringify(input);
  const first = inspectItemFeatures(input);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  assert.deepEqual(first, inspectItemFeatures(reordered));
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(MAPPING_REGISTRY.openLibrarySubjects));
});

test('CLI produces reproducible private artifacts and aggregate checksums, refuses overwrite', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-features-'));
  try {
    const input = join(directory, 'snapshot.json');
    await writeFile(input, JSON.stringify(snapshot(book(), movie())));
    const cli = new URL('./inspect-item-features.mjs', import.meta.url);
    const run = out => spawnSync(process.execPath, [cli.pathname, '--snapshot', input, '--out', out], { encoding: 'utf8' });
    const a = join(directory, 'a');
    const b = join(directory, 'b');
    const first = run(a);
    assert.equal(first.status, 0, first.stderr);
    const second = run(b);
    assert.equal(second.status, 0, second.stderr);
    const reportBytes = await readFile(join(a, 'coverage.json'));
    assert.deepEqual(reportBytes, await readFile(join(b, 'coverage.json')));
    assert.deepEqual(await readFile(join(a, 'features.json')), await readFile(join(b, 'features.json')));
    const report = JSON.parse(reportBytes);
    assert.equal(report.inputFileSha256, sha256(await readFile(input)));
    assert.equal(report.artifactFileSha256, sha256(await readFile(join(a, 'features.json'))));
    assert.equal(JSON.parse(first.stdout).reportFileSha256, sha256(reportBytes));
    assert.equal(Object.keys(report.implementation).length, 4);
    assert.equal((await stat(join(a, 'features.json'))).mode & 0o777, 0o600);
    assert.equal((await stat(a)).mode & 0o777, 0o700);
    assert.equal(run(a).status, 1);
    await writeFile(input, '{"PRIVATE_PARSER_ERROR');
    const failed = run(join(directory, 'bad'));
    assert.equal(failed.status, 1);
    assert.doesNotMatch(failed.stderr, /PRIVATE_|snapshot\.json|SyntaxError/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
