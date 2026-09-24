import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { LIMITS, SOURCE_CONTRACT, TARGET_CONTRACT, planDumpDescriptions, stageDumpDescriptions,
  validateDumpSources, validateDumpTargets } from './open-library-dump-descriptions.mjs';

const retrievedAt = '2026-09-24T09:00:00.000Z';
const modifiedAt = '2026-08-15T10:00:00.000';
const description = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const target = { itemId: '00000000-0000-0000-0000-000000000001', sourceId: '00000000-0000-0000-0000-000000000002',
  workId: 'OL123W', editionId: 'OL456M', displayLanguage: 'fin', itemUpdatedAt: retrievedAt,
  sourceUpdatedAt: retrievedAt, descriptionSha256: null, managedDescription: false, identityMatches: true };
const snapshot = () => ({ contract: TARGET_CONTRACT, checkedAt: retrievedAt, targets: [structuredClone(target)] });
function record(kind, extra = {}) {
  return { key: kind === 'work' ? '/works/OL123W' : '/books/OL456M', type: { key: `/type/${kind}` },
    revision: 3, last_modified: { type: '/type/datetime', value: modifiedAt },
    ...(kind === 'edition' ? { works: [{ key: '/works/OL123W' }], languages: [{ key: '/languages/fin' }] } : {}),
    description, ...extra };
}
function row(kind, data = record(kind), envelope = {}) {
  return [envelope.type ?? `/type/${kind}`, envelope.key ?? (kind === 'work' ? '/works/OL123W' : '/books/OL456M'),
    envelope.revision ?? '3', envelope.modifiedAt ?? modifiedAt,
    typeof data === 'string' ? data : JSON.stringify(data)].join('\t') + '\n';
}
async function fixture(t, { gzip = true, works = row('work'), editions = row('edition'), targets = snapshot() } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-dump-intake-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const paths = {};
  const manifest = { contract: SOURCE_CONTRACT, release: '2026-08-31', retrievedAt, sources: {} };
  for (const [kind, text] of Object.entries({ works, editions })) {
    const bytes = gzip ? gzipSync(text) : Buffer.from(text);
    paths[kind] = join(directory, kind + (gzip ? '.gz' : '.txt'));
    await writeFile(paths[kind], bytes);
    manifest.sources[kind] = { url: `https://archive.org/download/ol_dump_2026-08-31/ol_dump_${kind}_2026-08-31.txt${gzip ? '.gz' : ''}`,
      sha256: sha256(bytes), bytes: bytes.length, compression: gzip ? 'gzip' : 'none',
      maxDecodedBytes: 2 * 1024 * 1024, maxRows: 10 };
  }
  const stagingRoot = join(directory, 'staging');
  return { directory, manifest, snapshot: targets, worksPath: paths.works, editionsPath: paths.editions,
    stagingRoot, outputDirectory: join(stagingRoot, 'run') };
}
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('plan freezes exact missing-description identities, excluding every existing or managed description', () => {
  const input = snapshot();
  for (const [index, extra] of [
    { descriptionSha256: 'a'.repeat(64) }, { managedDescription: true },
  ].entries()) input.targets.push({ ...target, itemId: `00000000-0000-0000-0000-00000000000${index + 3}`,
    sourceId: `00000000-0000-0000-0000-00000000000${index + 5}`, workId: `OL${index + 1}W`, editionId: `OL${index + 1}M`, ...extra });
  assert.deepEqual(validateDumpTargets(input), [target]);
  const plan = planDumpDescriptions(input);
  assert.equal(plan.catalogTargets, 3);
  assert.equal(plan.selectedTargets, 1);
  assert.equal(plan.excludedExistingOrManaged, 2);
  assert.equal(plan.expectedRecords, 2);
  assert.equal(plan.targetSnapshotSha256, digest(input));
  assert.equal(plan.sourceManifestSha256, null);
  assert.equal(plan.approved, 0);
  assert.equal(plan.databaseWrites, 0);
});

test('target snapshots fail closed for mismatches, duplicate identity, future versions and excess targets', () => {
  for (const change of [
    value => { value.targets[0].identityMatches = false; },
    value => { value.targets[0].sourceUpdatedAt = '2027-01-01T00:00:00Z'; },
    value => { value.targets[0].editionId = '/books/OL456M'; },
    value => { value.targets[0].descriptionSha256 = 'unknown'; },
    value => { value.targets.push({ ...value.targets[0] }); },
    value => { value.targets = Array(LIMITS.targets + 1).fill(value.targets[0]); },
    value => { value.unexpectedPrivateField = 'unused'; },
  ]) {
    const input = snapshot(); change(input);
    assert.throws(() => validateDumpTargets(input), /(?:invalid|duplicate)-dump-target/);
  }
});

test('source manifest requires a shared dated release, publisher URL, exact digest and explicit bounded scan', async t => {
  const data = await fixture(t);
  assert.equal(validateDumpSources(data.manifest), data.manifest);
  for (const change of [
    value => { value.sources.works.url = value.sources.works.url.replace('works_2026-08-31', 'works_latest'); },
    value => { value.sources.editions.url = value.sources.editions.url.replaceAll('2026-08-31', '2026-07-31'); },
    value => { value.sources.works.url = value.sources.works.url.replace('archive.org', 'unrelated.example'); },
    value => { value.sources.works.url = value.sources.works.url.replace('/ol_dump_2026-08-31/', '/other-user-upload/'); },
    value => { value.sources.works.sha256 = 'not-a-hash'; },
    value => { value.sources.works.maxRows = 0; },
    value => { value.sources.works.bytes = LIMITS.fileBytes + 1; },
    value => { value.sources.works.url += '?token=private'; },
    value => { value.retrievedAt = '2026-07-01T00:00:00Z'; },
    value => { value.sources.ratings = value.sources.works; },
  ]) {
    const manifest = structuredClone(data.manifest); change(manifest);
    assert.throws(() => validateDumpSources(manifest), /invalid-dump-source/);
  }
});

test('plain and gzip intake preserve identical raw records and unapproved text; selected Edition language does not approve it', async t => {
  const results = [];
  for (const gzip of [false, true]) {
    const data = await fixture(t, { gzip });
    const result = await stageDumpDescriptions(data);
    const state = await readJson(join(data.outputDirectory, 'state.json'));
    const records = await readJson(join(data.outputDirectory, 'records.json'));
    const review = await readJson(join(data.outputDirectory, 'review.json'));
    assert.equal(state.status, 'staged');
    assert.equal(result.coverage.eligibleTexts, 2);
    assert.equal(result.coverage.targetWithEligibleText, 1);
    assert.equal(result.coverage.recordsMissing, 0);
    assert.equal(result.providerRequests, 0);
    assert.equal(result.databaseWrites, 0);
    assert.equal(result.approved, 0);
    assert.equal(sha256(await readFile(join(data.outputDirectory, 'records.json'))), state.recordsFileSha256);
    assert.equal(review.candidates[0].decision.textLanguage, null);
    assert.equal(review.candidates[0].decision.rights, 'unreviewed');
    assert.equal(review.candidates[0].decision.choice, null);
    assert.equal(review.candidates[0].options.edition.originalLanguage, undefined);
    assert.equal(review.candidates[0].options.edition.description.text, description);
    assert.equal((await stat(data.outputDirectory)).mode & 0o077, 0);
    assert.equal((await stat(join(data.outputDirectory, 'records.json'))).mode & 0o077, 0);
    results.push(records);
  }
  assert.deepEqual(results[0], results[1]);
});

test('notes-only Edition stays missing; usable Work is an unselected fallback option and missing exact IDs are accounted', async t => {
  const data = await fixture(t, { editions: row('edition', record('edition', { description: null, notes: description })) });
  const result = await stageDumpDescriptions(data);
  const review = await readJson(join(data.outputDirectory, 'review.json'));
  assert.equal(result.coverage.descriptionStatuses.missing, 1);
  assert.equal(result.coverage.eligibleTexts, 1);
  assert.equal(review.candidates[0].decision.choice, null);
  assert.equal(review.candidates[0].options.edition.description.text, undefined);
  const missing = await fixture(t, { editions: row('edition', record('edition', { key: '/books/OL999M' }), { key: '/books/OL999M' }) });
  const absent = await stageDumpDescriptions(missing);
  assert.equal(absent.coverage.recordsMissing, 1);
  assert.equal(absent.coverage.descriptionStatuses['record-missing'], 1);
  assert.equal(absent.sources.editions.unrelatedRows, 1);
});

test('strict description policy rejects markup and malformed types without converting notes or altering original raw bytes', async t => {
  const data = await fixture(t, { works: row('work', record('work', { description: { value: description } })),
    editions: row('edition', record('edition', { description: '<p>' + description + '</p>' })) });
  const result = await stageDumpDescriptions(data);
  assert.equal(result.coverage.descriptionStatuses['invalid-type'], 1);
  assert.equal(result.coverage.descriptionStatuses['markup-or-url'], 1);
  assert.equal(result.coverage.targetWithEligibleText, 0);
});

test('identity, envelope and selected Edition Work linkage conflicts stop intake with no review packet', async t => {
  const cases = [
    { works: row('work', record('work', { key: '/works/OL999W' })) },
    { works: row('work', record('work', { location: '/works/OL999W' })) },
    { works: row('work', record('work', { type: { key: '/type/redirect' } })) },
    { works: row('work', record('work'), { revision: '4' }) },
    { works: row('work', record('work'), { modifiedAt: '2026-08-16T10:00:00.000' }) },
    { works: row('work', record('work'), { type: '/type/edition' }) },
    { works: row('work', '{malformed-json') },
    { works: '/type/work\t/works/OL123W\n' },
    { editions: row('edition', record('edition', { works: [{ key: '/works/OL999W' }] })) },
    { editions: row('edition', record('edition', { works: [{ key: '/works/OL123W' }, { key: '/works/OL999W' }] })) },
  ];
  for (const input of cases) {
    const data = await fixture(t, input);
    await assert.rejects(stageDumpDescriptions(data), /(?:invalid-dump-target-envelope|provider-identity-mismatch|malformed-provider-json|provider-work-link-mismatch|malformed-dump-target-row)/);
    assert.equal((await readJson(join(data.outputDirectory, 'state.json'))).status, 'failed');
    assert.ok(!(await readdir(data.outputDirectory)).includes('review.json'));
  }
});

test('collector scans after finding all targets and rejects late duplicates and checksum mismatch', async t => {
  const duplicate = await fixture(t, { works: row('work') + 'unrelated\n' + row('work') });
  await assert.rejects(stageDumpDescriptions(duplicate), /duplicate-dump-target-record/);
  const mismatch = await fixture(t);
  mismatch.manifest.sources.editions.sha256 = '0'.repeat(64);
  await assert.rejects(stageDumpDescriptions(mismatch), /dump-checksum-mismatch/);
  const state = await readJson(join(mismatch.outputDirectory, 'state.json'));
  assert.equal(state.sources.works.complete, true);
  assert.equal(state.sources.editions, undefined);
  assert.equal(state.status, 'failed');
  assert.ok(!(await readdir(mismatch.outputDirectory)).includes('review.json'));
});

test('truncated gzip with a matching pinned digest still fails EOF integrity instead of becoming sparse success', async t => {
  const data = await fixture(t);
  const bytes = (await readFile(data.worksPath)).subarray(0, -8);
  await writeFile(data.worksPath, bytes);
  data.manifest.sources.works.sha256 = sha256(bytes);
  data.manifest.sources.works.bytes = bytes.length;
  await assert.rejects(stageDumpDescriptions(data), /dump-operation-failed/);
  assert.equal((await readJson(join(data.outputDirectory, 'state.json'))).status, 'failed');
});

test('byte, row and line bounds terminate the stream; unrelated rows cannot bypass memory limits', async t => {
  for (const limit of ['size', 'decoded', 'rows', 'line']) {
    const data = await fixture(t, { works: limit === 'line' ? 'x'.repeat(LIMITS.lineBytes + 1) + '\n' : row('work') + 'other\n' });
    if (limit === 'size') data.manifest.sources.works.bytes += 1;
    if (limit === 'decoded') data.manifest.sources.works.maxDecodedBytes = 10;
    if (limit === 'rows') data.manifest.sources.works.maxRows = 1;
    await assert.rejects(stageDumpDescriptions(data), /dump-(?:file-size-mismatch|decoded-byte-limit|row-limit|line-limit)/);
    assert.equal((await readJson(join(data.outputDirectory, 'state.json'))).status, 'failed');
  }
});

test('output refuses overwrite, escaping and symlinked parents; an existing completed run remains byte-identical', async t => {
  const data = await fixture(t);
  await stageDumpDescriptions(data);
  const before = await readFile(join(data.outputDirectory, 'state.json'));
  await assert.rejects(stageDumpDescriptions(data), { code: 'EEXIST' });
  assert.deepEqual(await readFile(join(data.outputDirectory, 'state.json')), before);
  await assert.rejects(stageDumpDescriptions({ ...data, outputDirectory: join(data.directory, 'escape') }), /unsafe-dump-output/);
  await symlink(data.stagingRoot, join(data.directory, 'symlink'));
  await assert.rejects(stageDumpDescriptions({ ...data, stagingRoot: join(data.directory, 'symlink'),
    outputDirectory: join(data.directory, 'symlink', 'run-two') }), /unsafe-dump-output-parent/);
});

test('offline staging works with network disabled', async t => {
  const data = await fixture(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network forbidden'); };
  try { await stageDumpDescriptions(data); } finally { globalThis.fetch = originalFetch; }
});

test('stream chunk boundaries preserve UTF-8 raw hashes and final rows without a newline', async t => {
  const raw = record('work', { description: description + ' Kävelijä.', padding: 'ä'.repeat(80000) });
  const data = await fixture(t, { gzip: false, works: row('work', raw).trimEnd() });
  const result = await stageDumpDescriptions(data);
  const records = await readJson(join(data.outputDirectory, 'records.json'));
  assert.equal(result.sources.works.rows, 1);
  assert.equal(records.records[0].work.raw, JSON.stringify(raw));
  assert.equal(records.records[0].work.inspection.recordSha256, sha256(JSON.stringify(raw)));
});

test('CLI plan reads actual-format snapshot with no source bytes or credentials; errors never echo input text', async t => {
  const data = await fixture(t);
  const targetsPath = join(data.directory, 'snapshot.json');
  await writeFile(targetsPath, JSON.stringify(data.snapshot));
  const cli = fileURLToPath(new URL('./prepare-open-library-dump-descriptions.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'plan', '--targets', targetsPath], { encoding: 'utf8', env: {} });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).selectedTargets, 1);
  await writeFile(targetsPath, 'private-secret-that-must-not-be-echoed');
  const failure = spawnSync(process.execPath, [cli, 'plan', '--targets', targetsPath], { encoding: 'utf8', env: {} });
  assert.equal(failure.status, 1);
  assert.equal(JSON.parse(failure.stderr).status, 'error');
  assert.ok(!failure.stderr.includes('private-secret'));
  assert.equal(failure.stdout, '');
});
