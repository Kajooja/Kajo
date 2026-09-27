import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CONFLICT_POLICY_CONTRACT, createDumpConflictLedger } from './dump-conflict-policy.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { CONFLICT_INTAKE_CONTRACT, DEFAULT_STAGING_ROOT, INTAKE_CONTRACT, LIMITS, SOURCE_CONTRACT, TARGET_CONTRACT,
  scanDumpConflictStream, scanDumpStream, stageDumpDescriptions, stageDumpDescriptionsWithConflicts } from './open-library-dump-descriptions.mjs';

const at = '2026-09-28T09:00:00.000Z', modifiedAt = '2026-08-15T10:00:00.000';
const text = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const canary = 'PRIVATE-CONFLICT-RAW-CANARY';
const targets = Array.from({ length: 3 }, (_, index) => ({ itemId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  sourceId: `00000000-0000-0000-0000-${String(index + 101).padStart(12, '0')}`, workId: `OL${index + 100}W`,
  editionId: `OL${index + 200}M`, displayLanguage: 'fin', itemUpdatedAt: at, sourceUpdatedAt: at,
  descriptionSha256: null, managedDescription: false, identityMatches: true }));
const snapshot = selected => ({ contract: TARGET_CONTRACT, checkedAt: at, targets: structuredClone(selected ?? targets) });
const policy = (overrides = {}) => ({ contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 2,
  maxDiagnosticBytes: 2 * 1024 * 1024, ...overrides });
function rawRecord(kind, target = targets[0], extra = {}) {
  return { key: kind === 'work' ? `/works/${target.workId}` : `/books/${target.editionId}`, type: { key: `/type/${kind}` },
    revision: 3, last_modified: { value: modifiedAt }, ...(kind === 'edition' ? { works: [{ key: `/works/${target.workId}` }] } : {}),
    description: text, ...extra };
}
function row(kind, target = targets[0], extra = {}, envelope = {}) {
  const record = typeof extra === 'string' ? extra : JSON.stringify(rawRecord(kind, target, extra));
  return [envelope.type ?? `/type/${kind}`, envelope.key ?? (kind === 'work' ? `/works/${target.workId}` : `/books/${target.editionId}`),
    envelope.revision ?? '3', envelope.modifiedAt ?? modifiedAt, record].join('\t') + '\n';
}
const conflict = (kind, target = targets[0], extra = {}, envelope) => row(kind, target,
  { location: kind === 'work' ? '/works/OL900000W' : '/books/OL900000M', privateMarker: canary, ...extra }, envelope);
const all = (kind, replaced, extra) => targets.map((target, index) => index === replaced
  ? conflict(kind, target, extra) : row(kind, target)).join('');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
async function fixture(t, { works = all('work'), editions = all('edition'), selected = targets,
  selectedPolicy = policy(), gzip = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-conflict-intake-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = { contract: SOURCE_CONTRACT, release: '2026-08-31', retrievedAt: at, sources: {} }, paths = {};
  for (const [kind, contents] of Object.entries({ works, editions })) {
    const bytes = gzip ? gzipSync(contents) : Buffer.from(contents);
    paths[kind] = join(directory, kind + (gzip ? '.gz' : '.txt'));
    await writeFile(paths[kind], bytes);
    manifest.sources[kind] = { url: `https://archive.org/download/ol_dump_2026-08-31/ol_dump_${kind}_2026-08-31.txt${gzip ? '.gz' : ''}`,
      sha256: sha256(bytes), bytes: bytes.length, compression: gzip ? 'gzip' : 'none', maxDecodedBytes: 4 * 1024 * 1024, maxRows: 100 };
  }
  const stagingRoot = join(directory, 'staging');
  return { directory, manifest, snapshot: snapshot(selected), policy: selectedPolicy, worksPath: paths.works,
    editionsPath: paths.editions, stagingRoot, outputDirectory: join(stagingRoot, 'run') };
}
async function noCandidates(data) {
  const names = await readdir(data.outputDirectory);
  assert.ok(!names.includes('records.json')); assert.ok(!names.includes('review.json')); assert.ok(!names.includes('report.json'));
  const state = await readJson(join(data.outputDirectory, 'state.json'));
  assert.equal(state.contract, CONFLICT_INTAKE_CONTRACT); assert.equal(state.status, 'failed-with-conflict-policy');
  return state;
}

test('verified Work conflict excludes its entire pair while complete sources retain truthful match and byte accounting', async t => {
  const data = await fixture(t, { works: all('work', 1) + 'unrelated\n' });
  const result = await stageDumpDescriptionsWithConflicts(data);
  const records = await readJson(join(data.outputDirectory, 'records.json'));
  const review = await readJson(join(data.outputDirectory, 'review.json'));
  const quarantine = await readJson(join(data.outputDirectory, 'quarantine.json'));
  const report = await readJson(join(data.outputDirectory, 'report.json'));
  assert.equal(result.status, 'staged-with-conflict-policy'); assert.equal(result.quarantinedPairs, 1);
  assert.equal(result.quarantinedRows, 1); assert.equal(result.pairedRecordsSuppressed, 1);
  assert.equal(result.survivingTargets, 2); assert.equal(result.recordsFound, 4); assert.equal(result.recordsMissing, 0);
  assert.equal(result.eligibleTexts, 4); assert.equal(result.fullSourcesVerified, 2);
  assert.deepEqual(records.records.map(item => item.itemId), [targets[0].itemId, targets[2].itemId]);
  assert.equal(review.candidates.length, 2); assert.ok(review.candidates.every(item => item.decision.rights === 'unreviewed'));
  assert.equal(quarantine.ledger.conflicts.length, 1);
  assert.deepEqual(quarantine.ledger.quarantinedWorkIds, [targets[1].workId]);
  assert.equal(report.coverage.validMatchedRecords, 5); assert.equal(report.sources.works.matchedRecords, 2);
  assert.equal(report.sources.works.quarantinedRecords, 1); assert.equal(report.sources.works.unrelatedRows, 1);
  assert.equal(report.sources.editions.matchedRecords, 3); assert.equal(report.sources.editions.quarantinedRecords, 0);
  assert.equal(report.accounting.cumulativeStagedBytes, report.accounting.validRecordBytes + report.accounting.diagnosticBytes);
  assert.equal(report.accounting.survivingRecordBytes, report.accounting.validRecordBytes - report.accounting.suppressedRecordBytes);
  assert.equal(report.accounting.suppressedRecordBytes, Buffer.byteLength(JSON.stringify(rawRecord('edition', targets[1]))));
  for (const artifact of [records, review, quarantine, report]) {
    assert.equal(artifact.contract, CONFLICT_INTAKE_CONTRACT); assert.equal(artifact.policySha256, digest(data.policy));
    assert.equal(artifact.sourceManifestSha256, digest(data.manifest)); assert.equal(artifact.targetSnapshotSha256, digest(data.snapshot));
  }
  assert.equal(report.recordsFileSha256, sha256(await readFile(join(data.outputDirectory, 'records.json'))));
  assert.equal(report.quarantineFileSha256, sha256(await readFile(join(data.outputDirectory, 'quarantine.json'))));
  assert.ok(!JSON.stringify(result).includes(canary)); assert.ok(!JSON.stringify(result).includes(targets[1].workId));
  assert.ok(!JSON.stringify(records).includes(canary)); assert.ok(!JSON.stringify(review).includes(canary));
  for (const name of await readdir(data.outputDirectory)) assert.equal((await stat(join(data.outputDirectory, name))).mode & 0o077, 0);
  assert.equal((await stat(data.outputDirectory)).mode & 0o077, 0);
});

test('Edition conflict suppresses the earlier valid Work without refunding its cumulative record charge', async t => {
  const data = await fixture(t, { editions: all('edition', 0) });
  const result = await stageDumpDescriptionsWithConflicts(data), report = await readJson(join(data.outputDirectory, 'report.json'));
  assert.equal(result.quarantinedPairs, 1); assert.equal(result.pairedRecordsSuppressed, 1);
  assert.equal(report.sources.works.matchedRecords, 3); assert.equal(report.sources.editions.matchedRecords, 2);
  assert.equal(report.accounting.suppressedRecordBytes, Buffer.byteLength(JSON.stringify(rawRecord('work'))));
  const records = await readJson(join(data.outputDirectory, 'records.json'));
  assert.ok(records.records.every(item => item.itemId !== targets[0].itemId));
  assert.equal(result.approved, 0); assert.equal(result.databaseWrites, 0); assert.equal(result.providerRequests, 0); assert.equal(result.modelAdmissions, 0);
});

test('both conflict kinds exclude one pair, and a fully quarantined roster produces no review candidates', async t => {
  const data = await fixture(t, { works: conflict('work'), editions: conflict('edition'), selected: [targets[0]],
    selectedPolicy: policy({ maxConflictedPairs: 1 }) });
  const result = await stageDumpDescriptionsWithConflicts(data), report = await readJson(join(data.outputDirectory, 'report.json'));
  assert.equal(result.quarantinedPairs, 1); assert.equal(result.quarantinedRows, 2); assert.equal(result.pairedRecordsSuppressed, 0);
  assert.equal(result.survivingTargets, 0); assert.equal(result.recordsMissing, 0); assert.equal(result.eligibleTexts, 0);
  assert.equal(report.accounting.validRecordBytes, 0); assert.equal(report.accounting.cumulativeStagedBytes, report.accounting.diagnosticBytes);
  assert.deepEqual((await readJson(join(data.outputDirectory, 'records.json'))).records, []);
  assert.deepEqual((await readJson(join(data.outputDirectory, 'review.json'))).candidates, []);
});

test('missing counterparts on quarantined pairs are separate from genuinely missing surviving records', async t => {
  const data = await fixture(t, { works: all('work', 1), editions: row('edition', targets[2]) });
  const result = await stageDumpDescriptionsWithConflicts(data), report = await readJson(join(data.outputDirectory, 'report.json'));
  assert.equal(result.recordsMissing, 1); assert.equal(result.recordsFound, 3); assert.equal(result.pairedRecordsSuppressed, 0);
  assert.equal(report.coverage.quarantinedMissingRecords, 1);
  assert.equal(report.coverage.descriptionStatuses['record-missing'], 1);
});

test('default stage and original stream entry stay fail-fast even when passed a conflict ledger option', async t => {
  const data = await fixture(t, { works: all('work', 0) });
  const ledger = createDumpConflictLedger({ policy: data.policy, selected: targets });
  await assert.rejects(stageDumpDescriptions({ ...data, conflictLedger: ledger }), /provider-identity-mismatch/);
  const state = await readJson(join(data.outputDirectory, 'state.json'));
  assert.equal(state.contract, INTAKE_CONTRACT); assert.equal(state.status, 'failed');
  assert.ok(!(await readdir(data.outputDirectory)).includes('quarantine.json'));
  await assert.rejects(scanDumpStream(Readable.from([await readFile(data.worksPath)]), data.manifest.sources.works,
    'works', targets, at, { bytes: 0 }, { conflictLedger: ledger }), /provider-identity-mismatch/);
  assert.equal(ledger.snapshot().conflicts.length, 0);
});

test('opt-in scanner requires the original branded same-roster ledger before consuming its input', async t => {
  const data = await fixture(t), valid = createDumpConflictLedger({ policy: data.policy, selected: targets });
  let chunks = 0;
  for (const ledger of [undefined, { ...valid }, createDumpConflictLedger({ policy: policy({ maxConflictedPairs: 1 }), selected: [targets[0]] })]) {
    const stream = Readable.from((async function* () { chunks++; yield await readFile(data.worksPath); })());
    await assert.rejects(scanDumpConflictStream(stream, data.manifest.sources.works, 'works', targets, at, { bytes: 0 },
      { conflictLedger: ledger }), /invalid-dump-conflict-ledger/);
    stream.destroy();
  }
  assert.equal(chunks, 0);
});

test('duplicates remain fatal before classification, including a valid row after prior quarantine', async t => {
  for (const works of [conflict('work') + row('work'), conflict('work') + conflict('work'), row('work') + conflict('work')]) {
    const data = await fixture(t, { works });
    await assert.rejects(stageDumpDescriptionsWithConflicts(data), /duplicate-dump-target-record/);
    await noCandidates(data);
  }
});

test('noneligible identity, payload, envelope and metadata failures are never silently quarantined', async t => {
  const cases = [
    { works: conflict('work', targets[0], { location: null }) },
    { works: conflict('work', targets[0], { location: '/books/OL900000M' }) },
    { works: conflict('work', targets[0], { location: `/works/${targets[1].workId}` }) },
    { works: conflict('work', targets[0], { key: '/works/OL900000W' }) },
    { works: conflict('work', targets[0], { type: { key: '/type/redirect' } }) },
    { works: conflict('work', targets[0], { revision: '3' }) },
    { works: conflict('work', targets[0], {}, { revision: '4' }) },
    { works: conflict('work', targets[0], { last_modified: { value: modifiedAt + 'Z' } }) },
    { works: row('work', targets[0], '{PRIVATE malformed JSON') },
    { works: '/type/work\t/works/OL100W\n' },
    { editions: conflict('edition', targets[0], { works: [{ key: '/works/OL900000W' }] }) },
    { editions: all('edition', 0, { revision: null }) },
  ];
  for (const input of cases) {
    const data = await fixture(t, input);
    await assert.rejects(stageDumpDescriptionsWithConflicts(data), /(?:dump-conflict-fatal|malformed-provider-json|malformed-dump-target-row)/);
    await noCandidates(data);
  }
});

test('a counterpart of an already quarantined pair still undergoes all ordinary identity and Work-link checks', async t => {
  const data = await fixture(t, { works: all('work', 0), editions: targets.map((target, index) =>
    row('edition', target, index === 0 ? { works: [{ key: '/works/OL900000W' }] } : {})).join('') });
  await assert.rejects(stageDumpDescriptionsWithConflicts(data), /provider-work-link-mismatch/);
  const state = await noCandidates(data);
  assert.equal(state.sources.works.complete, true); assert.equal(state.sources.editions.complete, false);
});

test('conflicts do not waive full Work or Edition checksum and gzip EOF verification', async t => {
  for (const [kind, corruption] of [['works', 'hash'], ['editions', 'hash'], ['works', 'gzip'], ['editions', 'gzip']]) {
    const data = await fixture(t, { works: all('work', 0) });
    if (corruption === 'hash') data.manifest.sources[kind].sha256 = '0'.repeat(64);
    else {
      const path = kind === 'works' ? data.worksPath : data.editionsPath, truncated = (await readFile(path)).subarray(0, -8);
      await writeFile(path, truncated); data.manifest.sources[kind].sha256 = sha256(truncated); data.manifest.sources[kind].bytes = truncated.length;
    }
    await assert.rejects(stageDumpDescriptionsWithConflicts(data), /dump-(?:checksum-mismatch|operation-failed)/);
    const state = await noCandidates(data);
    assert.equal(state.sources[kind].complete, false);
    if (kind === 'works') assert.equal(state.sources.editions, undefined);
    const quarantine = await readJson(join(data.outputDirectory, 'quarantine.json'));
    assert.equal(quarantine.status, 'diagnostic-only-incomplete-intake');
  }
});

test('row, line and encoding errors after a conflict abort the entire intake without candidate artifacts', async t => {
  for (const mode of ['rows', 'line', 'encoding']) {
    const tail = mode === 'line' ? 'x'.repeat(LIMITS.lineBytes + 1) + '\n'
      : mode === 'encoding' ? Buffer.from([0xff, 0x0a]) : 'unrelated\n';
    const works = Buffer.concat([Buffer.from(conflict('work')), Buffer.from(tail)]);
    const data = await fixture(t, { works });
    if (mode === 'rows') data.manifest.sources.works.maxRows = 1;
    await assert.rejects(stageDumpDescriptionsWithConflicts(data), /(?:dump-row-limit|dump-line-limit|invalid-dump-encoding)/);
    const state = await noCandidates(data);
    assert.equal(state.sources.works.quarantinedRecords, 1); assert.equal(state.sources.editions, undefined);
  }
});

test('late decoded cap, source-length overrun and short EOF still fail after a recorded conflict', async t => {
  const first = Buffer.from(conflict('work')), last = Buffer.from('unrelated\n');
  const data = await fixture(t, { works: Buffer.concat([first, last]), gzip: false });
  for (const mode of ['decoded', 'overrun', 'short']) {
    const source = structuredClone(data.manifest.sources.works), ledger = createDumpConflictLedger({ policy: data.policy, selected: targets });
    if (mode === 'decoded') source.maxDecodedBytes = first.length + last.length - 1;
    if (mode === 'overrun') source.bytes--;
    if (mode === 'short') source.bytes++;
    await assert.rejects(scanDumpConflictStream(Readable.from([first, last]), source, 'works', targets, at, { bytes: 0 },
      { conflictLedger: ledger }), new RegExp(mode === 'decoded' ? 'dump-decoded-byte-limit' : 'dump-file-size-mismatch'));
    assert.equal(ledger.snapshot().conflicts.length, 1);
  }
});

test('pair and diagnostic policy caps fail closed without inventing a broader exclusion budget', async t => {
  const cases = [
    { works: conflict('work') + conflict('work', targets[1]), selectedPolicy: policy({ maxConflictedPairs: 1 }), code: 'dump-conflict-pair-limit' },
    { works: conflict('work'), selectedPolicy: policy({ maxDiagnosticBytes: Buffer.byteLength(conflict('work')) - 2 }), code: 'dump-conflict-diagnostic-limit' },
  ];
  for (const { code, ...input } of cases) {
    const data = await fixture(t, input);
    await assert.rejects(stageDumpDescriptionsWithConflicts(data), new RegExp(code)); await noCandidates(data);
  }
});

test('diagnostics and valid records share one cumulative scan budget with no charge refund after quarantine', async t => {
  const data = await fixture(t, { works: conflict('work') + row('work', targets[1]) });
  const ledger = createDumpConflictLedger({ policy: data.policy, selected: targets }), budget = { bytes: 0 };
  const diagnosticBytes = Buffer.byteLength(conflict('work')) - 1;
  const validBytes = Buffer.byteLength(JSON.stringify(rawRecord('work', targets[1])));
  await assert.rejects(scanDumpConflictStream(Readable.from([await readFile(data.worksPath)]), data.manifest.sources.works,
    'works', targets, at, budget, { conflictLedger: ledger, retainedBytes: diagnosticBytes + validBytes - 1 }), /dump-staging-limit/);
  assert.equal(ledger.snapshot().diagnosticBytes, diagnosticBytes);
  assert.equal(budget.bytes, diagnosticBytes + validBytes);
  assert.equal(ledger.snapshot().conflicts.length, 1);
});

test('quarantine preserves exact CRLF and UTF-8 bytes across compressed chunk boundaries', async t => {
  const plain = conflict('work', targets[0], { privateMarker: 'ä'.repeat(10000) }).replace(/\n$/, '\r\n');
  const data = await fixture(t, { works: plain }), bytes = await readFile(data.worksPath), ledger = createDumpConflictLedger({ policy: data.policy, selected: targets });
  const result = await scanDumpConflictStream(Readable.from([...bytes].map(byte => Buffer.from([byte]))),
    data.manifest.sources.works, 'works', targets, at, { bytes: 0 }, { conflictLedger: ledger });
  const evidence = ledger.snapshot().conflicts[0].evidence;
  assert.equal(result.stats.complete, true); assert.equal(result.stats.quarantinedRecords, 1); assert.equal(result.records.size, 0);
  assert.equal(evidence.terminated, true); assert.equal(evidence.rawBytes, Buffer.byteLength(plain) - 1);
  assert.deepEqual(Buffer.from(evidence.rawBase64, 'base64'), Buffer.from(plain.slice(0, -1)));
});

test('policy validation precedes output claim, and completed private artifacts refuse overwrite or symlink parents', async t => {
  const invalid = await fixture(t, { selectedPolicy: undefined });
  await assert.rejects(stageDumpDescriptionsWithConflicts({ ...invalid, policy: undefined }), /invalid-dump-conflict-policy/);
  assert.ok(!(await readdir(invalid.directory)).includes('staging'));
  const data = await fixture(t, { works: all('work', 0) });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network is forbidden'); };
  try { await stageDumpDescriptionsWithConflicts(data); } finally { globalThis.fetch = originalFetch; }
  const before = await readFile(join(data.outputDirectory, 'state.json'));
  await assert.rejects(stageDumpDescriptionsWithConflicts(data), { code: 'EEXIST' });
  assert.deepEqual(await readFile(join(data.outputDirectory, 'state.json')), before);
  await symlink(data.stagingRoot, join(data.directory, 'link'));
  await assert.rejects(stageDumpDescriptionsWithConflicts({ ...data, stagingRoot: join(data.directory, 'link'),
    outputDirectory: join(data.directory, 'link', 'other') }), /unsafe-dump-output-parent/);
});

test('caller mutations during asynchronous output claim cannot change validated identities, pins, limits or policy', async t => {
  const data = await fixture(t, { works: all('work', 0) });
  const expectedSnapshot = structuredClone(data.snapshot), expectedManifest = structuredClone(data.manifest), expectedPolicy = structuredClone(data.policy);
  const pending = stageDumpDescriptionsWithConflicts(data);
  data.snapshot.targets[0].identityMatches = false;
  data.snapshot.targets[1].workId = 'OL900001W';
  data.manifest.sources.works.maxRows = LIMITS.rows + 1;
  data.manifest.sources.works.sha256 = '0'.repeat(64);
  data.policy.maxConflictedPairs = 0;
  const result = await pending, report = await readJson(join(data.outputDirectory, 'report.json'));
  assert.equal(result.quarantinedPairs, 1);
  assert.deepEqual(await readJson(join(data.outputDirectory, 'targets.json')), expectedSnapshot);
  assert.deepEqual(await readJson(join(data.outputDirectory, 'sources.json')), expectedManifest);
  assert.deepEqual(await readJson(join(data.outputDirectory, 'policy.json')), expectedPolicy);
  assert.equal(report.targetSnapshotSha256, digest(expectedSnapshot)); assert.equal(report.sourceManifestSha256, digest(expectedManifest));
  assert.equal(report.policySha256, digest(expectedPolicy));
});

test('new stream pins are immutable while asynchronous input is being read', async t => {
  const data = await fixture(t, { works: all('work', 0) });
  const source = data.manifest.sources.works, expectedHash = source.sha256, bytes = await readFile(data.worksPath);
  const ledger = createDumpConflictLedger({ policy: data.policy, selected: targets });
  const stream = Readable.from((async function* () {
    source.sha256 = '0'.repeat(64); source.maxRows = 1;
    yield bytes;
  })());
  const result = await scanDumpConflictStream(stream, source, 'works', targets, at, { bytes: 0 }, { conflictLedger: ledger });
  assert.equal(result.stats.complete, true); assert.equal(result.stats.sha256, expectedHash); assert.equal(result.stats.rows, 3);
  assert.equal(ledger.snapshot().conflicts[0].evidence.source.sha256, expectedHash);
});

test('post-verification write and final checkpoint failures remove all candidate artifacts and preserve diagnostic-only state', async t => {
  // Builtin fault injection is isolated in a subprocess so concurrent suites
  // retain their real filesystem API. Both failures occur after complete EOF.
  const childCode = `
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    const [moduleUrl, inputPath, fault] = process.argv.slice(1);
    const read = fs.readFile, write = fs.writeFile, rename = fs.rename;
    let sawRecords = false, failed = false;
    fs.writeFile = async (path, ...args) => {
      if (String(path).endsWith('/records.json')) sawRecords = true;
      if (fault === 'review-write' && String(path).endsWith('/review.json') && !failed) {
        failed = true; throw Object.assign(new Error('PRIVATE-WRITE-FAILURE'), { code: 'ENOSPC' });
      }
      return write(path, ...args);
    };
    fs.rename = async (from, to) => {
      if (fault === 'final-checkpoint' && sawRecords && String(to).endsWith('/state.json') && !failed) {
        failed = true; throw Object.assign(new Error('PRIVATE-RENAME-FAILURE'), { code: 'EACCES' });
      }
      return rename(from, to);
    };
    syncBuiltinESMExports();
    const { stageDumpDescriptionsWithConflicts } = await import(moduleUrl);
    try {
      await stageDumpDescriptionsWithConflicts(JSON.parse(await read(inputPath, 'utf8')));
      process.exitCode = 1;
    } catch (error) {
      if (!failed || !sawRecords) process.exitCode = 2;
      console.log(error.message);
    }
  `;
  for (const fault of ['review-write', 'final-checkpoint']) {
    const data = await fixture(t, { works: all('work', 0) }), inputPath = join(data.directory, 'input.json');
    await writeFile(inputPath, JSON.stringify(data));
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode,
      new URL('./open-library-dump-descriptions.mjs', import.meta.url).href, inputPath, fault],
    { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, 'dump-operation-failed\n'); assert.equal(child.stderr, '');
    const state = await noCandidates(data);
    assert.equal(state.sources.works.complete, true); assert.equal(state.sources.editions.complete, true);
    assert.equal(state.recordsFileSha256, undefined); assert.equal(state.reviewFileSha256, undefined); assert.equal(state.reportFileSha256, undefined);
    assert.equal((await readJson(join(data.outputDirectory, 'quarantine.json'))).status, 'diagnostic-only-incomplete-intake');
    assert.ok(!(await readdir(data.outputDirectory)).some(name => name.endsWith('.next.json')));
  }
});

test('explicit CLI requires policy, keeps default stage strict, and prints only aggregate results and fixed errors', async t => {
  const data = await fixture(t, { works: all('work', 0) });
  const outputDirectory = join(DEFAULT_STAGING_ROOT, basename(data.directory) + '-cli');
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const paths = {};
  for (const [name, value] of Object.entries({ targets: data.snapshot, manifest: data.manifest, policy: data.policy })) {
    paths[name] = join(data.directory, name + '.json'); await writeFile(paths[name], JSON.stringify(value));
  }
  const script = fileURLToPath(new URL('./prepare-open-library-dump-descriptions.mjs', import.meta.url));
  const args = ['--targets', paths.targets, '--manifest', paths.manifest, '--works', data.worksPath,
    '--editions', data.editionsPath, '--out', outputDirectory];
  const cli = values => spawnSync(process.execPath, [script, ...values], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
  for (const badArgs of [['stage-with-conflicts', ...args], ['stage', ...args, '--policy', paths.policy]]) {
    const failed = cli(badArgs); assert.equal(failed.status, 1); assert.equal(failed.stdout, '');
    assert.equal(failed.stderr, '{"status":"error","code":"invalid-dump-command"}\n');
  }
  const success = cli(['stage-with-conflicts', ...args, '--policy', paths.policy]);
  assert.equal(success.status, 0, success.stderr); assert.equal(success.stderr, '');
  const result = JSON.parse(success.stdout);
  assert.equal(result.quarantinedPairs, 1); assert.equal(result.recordsFound, 4); assert.equal(result.approved, 0);
  assert.ok(!success.stdout.includes(canary)); assert.ok(!success.stdout.includes(targets[0].workId));
  assert.ok(!success.stdout.includes(data.directory)); assert.ok(!success.stdout.includes(digest(data.snapshot)));
  const before = await readFile(join(outputDirectory, 'state.json'));
  const repeated = cli(['stage-with-conflicts', ...args, '--policy', paths.policy]);
  assert.equal(repeated.status, 1); assert.equal(repeated.stdout, '');
  assert.equal(repeated.stderr, '{"status":"error","code":"dump-output-already-exists"}\n');
  assert.deepEqual(await readFile(join(outputDirectory, 'state.json')), before);
});
