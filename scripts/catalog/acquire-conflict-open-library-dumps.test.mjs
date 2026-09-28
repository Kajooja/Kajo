import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_RELEASE, CONFLICT_ACQUISITION_CONTRACT, CONFLICT_ACQUISITION_ROSTER_SHA256, REVIEWED_ACQUISITION_LIMITS,
  REVIEWED_SOURCE_EVIDENCE, REVIEWED_SOURCE_PINS, acquireConflictAwareOpenLibraryDumps,
  acquireReviewedOpenLibraryDumps, collectConflictDumpStreams, safeAcquisitionError,
  safeConflictAcquisitionError } from './acquire-open-library-dumps.mjs';
import { CONFLICT_POLICY_CONTRACT } from './dump-conflict-policy.mjs';
import { validateConflictDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';

const roster = [{ workId: 'OL100W', editionId: 'OL200M' }, { workId: 'OL101W', editionId: 'OL201M' },
  { workId: 'OL102W', editionId: 'OL202M' }];
const publicRoster = JSON.parse(await readFile(new URL('./fixtures/work-prefix-previous-request.json', import.meta.url), 'utf8')).roster;
const at = '2026-08-15T10:00:00.000', canary = 'PRIVATE selected raw conflict';
const description = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const policy = (extra = {}) => ({ contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 2, maxDiagnosticBytes: 2 * 1024 * 1024, ...extra });
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
function row(kind, index = 0, extra = {}, envelope = {}) {
  const target = roster[index], key = kind === 'work' ? `/works/${target.workId}` : `/books/${target.editionId}`;
  const raw = JSON.stringify({ key, type: { key: `/type/${kind}` }, revision: 3,
    last_modified: { value: at }, description,
    ...(kind === 'edition' ? { works: [{ key: `/works/${target.workId}` }] } : {}), ...extra });
  return [envelope.type ?? `/type/${kind}`, envelope.key ?? key, envelope.revision ?? '3', envelope.modifiedAt ?? at, raw].join('\t') + '\n';
}
const conflict = (kind, index = 0, extra = {}) => row(kind, index,
  { location: kind === 'work' ? '/works/OL900000W' : '/books/OL900000M', privateMarker: canary, ...extra });
const all = (kind, conflictIndex) => roster.map((_, index) => index === conflictIndex ? conflict(kind, index) : row(kind, index)).join('');

function fixture({ works = all('work'), editions = all('edition'), conflictPolicy = policy(), limits: overrideLimits = {} } = {}) {
  const bytes = { works: gzipSync(works), editions: gzipSync(editions) }, sourcePins = {}, calls = [];
  for (const kind of ['works', 'editions']) sourcePins[kind] = { ...REVIEWED_SOURCE_PINS[kind], bytes: bytes[kind].length,
    md5: hash('md5', bytes[kind]), sha1: hash('sha1', bytes[kind]) };
  const input = { release: ACQUISITION_RELEASE, roster: structuredClone(roster), sourcePins,
    limits: { ...REVIEWED_ACQUISITION_LIMITS, maxRows: 100, maxDecodedBytes: 4 * 1024 * 1024, ...overrideLimits }, conflictPolicy };
  const openSource = async (kind, source, options, onRequest) => {
    calls.push(kind); onRequest();
    assert.equal(options.maxBytes, bytes[kind].length);
    assert.ok(options.timeoutMs > 0 && options.timeoutMs <= input.limits.timeoutMs);
    return { status: 200, headers: { 'content-length': String(bytes[kind].length) },
      body: Readable.from([bytes[kind]]), url: source.url, redirects: [] };
  };
  return { input, bytes, calls, openSource, run: patch => collectConflictDumpStreams({ ...input, openSource, ...patch }) };
}
function assertFailure(result, code) {
  assert.equal(result.status, 'failed'); assert.equal(result.code, code); assert.equal(result.terminalFailureEvidence, null);
  for (const field of ['records', 'suppressedRecords', 'sources', 'sourceManifest', 'coverage']) assert.equal(result[field], undefined);
  for (const field of ['validRecordBytes', 'survivingRecordBytes', 'suppressedRecordBytes', 'failureEvidence', 'diagnosticRetainedBytes'])
    assert.equal(result.accounting[field], undefined);
  assert.equal(result.accounting.requests.metadata, 0);
}

test('tiny real-gzip two-source collection retains disjoint survivors and suppressed raw counterparts with complete integrity', async () => {
  const f = fixture({ works: all('work', 1) + 'unrelated\n' }), result = await f.run();
  assert.equal(result.status, 'collected'); assert.deepEqual(f.calls, ['works', 'editions']);
  assert.deepEqual(result.records.map(value => value.workId), [roster[0].workId, roster[2].workId]);
  assert.deepEqual(result.suppressedRecords.map(value => value.workId), [roster[1].workId]);
  assert.equal(result.suppressedRecords[0].work, null);
  assert.equal(result.suppressedRecords[0].edition.inspection.description.text, description);
  assert.equal(result.quarantine.conflicts.length, 1); assert.equal(result.coverage.quarantinedPairs, 1);
  assert.equal(result.coverage.pairedRecordsSuppressed, 1); assert.equal(result.coverage.recordsFound, 4);
  assert.equal(result.coverage.validMatchedRecords, 5); assert.equal(result.coverage.recordsMissing, 0);
  assert.equal(result.coverage.eligibleTexts, 4); assert.equal(result.coverage.targetWithEligibleText, 2);
  let validBytes = 0, survivingBytes = 0;
  for (const [name, rows] of [['records', result.records], ['suppressedRecords', result.suppressedRecords]])
    for (const item of rows) for (const kind of ['work', 'edition']) if (item[kind]) {
      validBytes += Buffer.byteLength(item[kind].raw);
      if (name === 'records') survivingBytes += Buffer.byteLength(item[kind].raw);
      assert.equal(sha256(item[kind].raw), item[kind].inspection.recordSha256);
    }
  assert.equal(result.accounting.validRecordBytes, validBytes);
  assert.equal(result.accounting.survivingRecordBytes, survivingBytes);
  assert.equal(result.accounting.suppressedRecordBytes, validBytes - survivingBytes);
  assert.equal(result.accounting.cumulativeStagedBytes, validBytes + result.quarantine.diagnosticBytes);
  assert.equal(result.accounting.diagnosticBytes, result.quarantine.diagnosticBytes);
  for (const kind of ['works', 'editions']) {
    assert.equal(result.sources[kind].complete, true); assert.equal(result.sources[kind].publisherChecksumsVerified, true);
    assert.equal(result.sources[kind].sha256, sha256(f.bytes[kind]));
    assert.equal(result.sources[kind].md5, hash('md5', f.bytes[kind]));
    assert.equal(result.sources[kind].sha1, hash('sha1', f.bytes[kind]));
    assert.equal(result.sources[kind].rows, result.sources[kind].matchedRecords + result.sources[kind].quarantinedRecords + result.sources[kind].unrelatedRows);
    assert.equal(result.sourceManifest.sources[kind].sha256, sha256(f.bytes[kind]));
  }
});

test('Edition conflict retains earlier valid Work only in suppressedRecords and never gives it a candidate count', async () => {
  const f = fixture({ editions: all('edition', 0) }), result = await f.run();
  assert.equal(result.status, 'collected'); assert.equal(result.sources.works.matchedRecords, 3);
  assert.equal(result.suppressedRecords[0].work.inspection.description.status, 'eligible');
  assert.equal(result.suppressedRecords[0].edition, null);
  assert.equal(result.coverage.eligibleTexts, 4); assert.equal(result.coverage.pairedRecordsSuppressed, 1);
  assert.ok(result.accounting.suppressedRecordBytes > 0);
});

test('two conflicts on one pair and missing counterparts remain explicit rather than counted as missing candidates', async () => {
  const f = fixture({ works: conflict('work') + conflict('work', 1), editions: conflict('edition') });
  const result = await f.run();
  assert.equal(result.status, 'collected'); assert.equal(result.quarantine.conflicts.length, 3);
  assert.equal(result.coverage.quarantinedPairs, 2); assert.equal(result.coverage.quarantinedRows, 3);
  assert.equal(result.coverage.quarantinedMissingRecords, 1); assert.equal(result.coverage.recordsMissing, 2);
  assert.equal(result.coverage.pairedRecordsSuppressed, 0); assert.equal(result.coverage.eligibleTexts, 0);
  assert.ok(result.suppressedRecords.every(value => value.work === null && value.edition === null));
});

test('first unsupported conflict fails without terminal raw allocation and cannot start Edition', async () => {
  const f = fixture({ works: conflict('work', 0, { location: null }) }), result = await f.run();
  assertFailure(result, 'dump-conflict-fatal'); assert.deepEqual(f.calls, ['works']);
  assert.equal(result.quarantine.conflicts.length, 0); assert.equal(result.accounting.diagnosticBytes, 0);
  assert.ok(!JSON.stringify(result).includes(canary)); assert.equal(result.accounting.sources.works.complete, false);
});

test('duplicate and malformed rows after a quarantine keep only prior bounded ledger and discard all candidate arrays', async () => {
  for (const tail of [row('work'), '/type/work\t/works/OL101W\t3\t' + at + '\t{malformed\n']) {
    const f = fixture({ works: conflict('work') + tail }), result = await f.run();
    assertFailure(result, tail.startsWith(row('work')) ? 'duplicate-dump-target-record' : 'malformed-provider-json');
    assert.equal(result.quarantine.conflicts.length, 1); assert.deepEqual(f.calls, ['works']);
  }
});

test('Edition failure after verified Work discards surviving and suppressed candidates and preserves honest Work accounting', async () => {
  const f = fixture({ works: all('work', 0), editions: row('edition', 0, { works: [{ key: '/works/OL900000W' }] }) });
  const result = await f.run();
  assertFailure(result, 'provider-work-link-mismatch'); assert.deepEqual(f.calls, ['works', 'editions']);
  assert.equal(result.accounting.sources.works.complete, true); assert.equal(result.accounting.sources.editions.complete, false);
  assert.equal(result.quarantine.conflicts.length, 1); assert.ok(result.accounting.cumulativeStagedBytes > result.accounting.diagnosticBytes);
});

test('late publisher checksum and gzip errors after quarantine cannot produce partial success', async () => {
  for (const [kind, errorType] of [['works', 'md5'], ['editions', 'sha1'], ['works', 'gzip'], ['editions', 'gzip']]) {
    const f = fixture({ works: all('work', 0) });
    if (errorType === 'gzip') {
      f.bytes[kind] = f.bytes[kind].subarray(0, -8);
      Object.assign(f.input.sourcePins[kind], { bytes: f.bytes[kind].length, md5: hash('md5', f.bytes[kind]), sha1: hash('sha1', f.bytes[kind]) });
    } else f.input.sourcePins[kind][errorType] = '0'.repeat(errorType === 'md5' ? 32 : 40);
    const result = await f.run();
    assertFailure(result, errorType === 'gzip' ? 'acquisition-failed' : 'dump-checksum-mismatch');
    assert.equal(result.accounting.sources[kind].complete, false); assert.equal(result.quarantine.conflicts.length, 1);
    if (kind === 'works') assert.equal(result.accounting.requests.editions, 0);
  }
});

test('explicit pair and diagnostic caps preserve prior ledger without reserving extra terminal evidence', async () => {
  const pair = fixture({ works: conflict('work') + conflict('work', 1), conflictPolicy: policy({ maxConflictedPairs: 1 }) });
  const first = await pair.run(); assertFailure(first, 'dump-conflict-pair-limit'); assert.equal(first.quarantine.conflicts.length, 1);
  const bytes = fixture({ works: conflict('work'), conflictPolicy: policy({ maxDiagnosticBytes: 1 }) });
  const second = await bytes.run(); assertFailure(second, 'dump-conflict-diagnostic-limit'); assert.equal(second.quarantine.conflicts.length, 0);
  assert.equal(second.accounting.cumulativeStagedBytes, 0);
});

test('one cumulative budget charges diagnostics and valid raw records and retains truthful over-limit attempted bytes', async () => {
  const validRawBytes = Buffer.byteLength(row('work', 1).split('\t').slice(4).join('\t').trimEnd());
  const diagnosticBytes = Buffer.byteLength(conflict('work')) - 1;
  const f = fixture({ works: conflict('work') + row('work', 1), limits: { retainedBytes: diagnosticBytes + validRawBytes - 1 } });
  const result = await f.run(); assertFailure(result, 'dump-staging-limit');
  assert.equal(result.quarantine.conflicts.length, 1); assert.equal(result.accounting.cumulativeStagedBytes, diagnosticBytes + validRawBytes);
  assert.equal(result.accounting.diagnosticBytes, diagnosticBytes);
});

test('low-level seam has no network default and rejects unbounded or changed source inputs before openSource', async () => {
  let calls = 0;
  for (const change of [value => { delete value.openSource; }, value => { delete value.conflictPolicy; },
    value => { value.sourcePins.works.url = 'https://other.example/file'; }, value => { value.sourcePins.editions.bytes = Number.MAX_SAFE_INTEGER; },
    value => { value.limits.timeoutMs++; }, value => { value.limits.maxRedirects = 5; }, value => { value.sourcePins.ratings = {}; }]) {
    const f = fixture(), input = { ...f.input, openSource: async () => { calls++; } };
    change(input);
    await assert.rejects(collectConflictDumpStreams(input), /invalid-(?:conflict-acquisition-input|dump-conflict-policy)/);
  }
  assert.equal(calls, 0);
});

test('input mutation during source opening cannot change pins, limits, selected identities or policy', async () => {
  const f = fixture({ works: all('work', 0) }), expectedPins = structuredClone(f.input.sourcePins), expectedRoster = structuredClone(f.input.roster);
  const result = await f.run({ openSource: async (kind, source, options, onRequest) => {
    onRequest(); f.input.sourcePins.works.md5 = '0'.repeat(32); f.input.limits.maxRows = 1;
    f.input.roster[0].workId = 'OL900000W'; f.input.conflictPolicy.maxConflictedPairs = 0;
    const url = source.url; source.bytes = 1; source.md5 = '0'.repeat(32);
    return { status: 200, headers: {}, body: Readable.from([f.bytes[kind]]), url, redirects: [] };
  } });
  assert.equal(result.status, 'collected'); assert.equal(result.sources.works.md5, expectedPins.works.md5);
  assert.equal(result.limits.maxRows, 100); assert.equal(result.conflictPolicy.maxConflictedPairs, 2);
  assert.equal(result.rosterSha256, digest(expectedRoster));
  assert.equal(result.suppressedRecords[0].workId, expectedRoster[0].workId);
});

test('response audit metadata is snapshotted before stream consumption and remains independent of the opener', async () => {
  const f = fixture(), saved = {};
  const result = await f.run({ openSource: async (kind, source, _options, onRequest) => {
    onRequest(); onRequest();
    const url = source.url.replace('https://archive.org/', 'https://ia800000.us.archive.org/');
    const redirects = [{ from: source.url, to: url, status: 302 }], headers = { 'content-length': String(f.bytes[kind].length) };
    saved[kind] = { url, redirects, headers, onRequest };
    const body = Readable.from((async function* () {
      redirects[0].to = 'https://changed.example/'; headers['content-length'] = '1';
      yield f.bytes[kind];
    })());
    return { status: 200, headers, body, url, redirects };
  } });
  assert.equal(result.status, 'collected');
  for (const kind of ['works', 'editions']) {
    assert.equal(result.sources[kind].finalUrl, saved[kind].url);
    assert.equal(result.sources[kind].redirects[0].to, saved[kind].url);
    assert.equal(result.accounting.requests[kind], 2);
    assert.throws(() => saved[kind].onRequest(), /acquisition-invalid-response/);
    assert.equal(result.accounting.requests[kind], 2);
  }
});

test('invalid opener response destroys the body and request budget rejects an unperformed extra attempt', async () => {
  for (const change of [value => { value.status = 206; }, value => { value.url = 'https://changed.example/'; },
    value => { value.redirects = [{ from: value.url, to: value.url, status: 302 }]; }, value => { value.headers = []; }]) {
    const f = fixture(), body = new PassThrough();
    const result = await f.run({ openSource: async (_kind, source, _options, onRequest) => {
      onRequest(); const response = { status: 200, headers: {}, body, url: source.url, redirects: [] };
      change(response); return response;
    } });
    assertFailure(result, 'acquisition-invalid-response'); assert.equal(body.destroyed, true);
    assert.equal(result.accounting.requests.editions, 0);
  }
  const f = fixture(); let permitted = 0;
  const result = await f.run({ openSource: async (_kind, _source, _options, onRequest) => {
    for (let i = 0; i <= f.input.limits.maxRedirects + 1; i++) { onRequest(); permitted++; }
    assert.fail('Excess request was allowed');
  } });
  assertFailure(result, 'acquisition-redirect-limit'); assert.equal(permitted, f.input.limits.maxRedirects + 1);
  assert.equal(result.accounting.requests.works, permitted);
});

test('pre-abort and in-flight cancellation retain no fabricated results and prevent subsequent source access', async () => {
  const before = fixture(), stopped = new AbortController(); stopped.abort();
  const pre = await before.run({ signal: stopped.signal }); assertFailure(pre, 'acquisition-aborted'); assert.deepEqual(before.calls, []);
  const active = fixture(), controller = new AbortController(), body = new PassThrough(); let calls = 0;
  const interrupted = await active.run({ signal: controller.signal, openSource: async (_kind, source, _options, onRequest) => {
    calls++; onRequest(); setImmediate(() => controller.abort()); return { status: 200, headers: {}, body, url: source.url, redirects: [] };
  } });
  assertFailure(interrupted, 'acquisition-aborted'); assert.equal(calls, 1); assert.equal(body.destroyed, true);
});

test('opaque opener exceptions cannot impersonate a scanner failure and remain independently recoverable', async () => {
  for (const message of ['dump-row-limit', 'dump-conflict-fatal', canary]) {
    const f = fixture(), core = await f.run({ openSource: async (_kind, _source, _options, onRequest) => {
      onRequest(); throw new Error(message);
    } });
    assertFailure(core, 'acquisition-transport-failed'); assert.equal(core.accounting.sources.works.rows, 0);
    assert.equal(core.accounting.requests.works, 1); assert.equal(core.quarantine.conflicts.length, 0);
    assert.ok(!JSON.stringify(core).includes(canary));
    const sourceEvidence = { contract: 'simulated-source-evidence' };
    const result = { contract: CONFLICT_ACQUISITION_CONTRACT, ...core, sourceEvidence,
      approved: 0, databaseWrites: 0, individualProviderRequests: 0, modelAdmissions: 0, rights: 'unreviewed' };
    assert.doesNotThrow(() => validateConflictDumpPayload(result, { ...f.input, sourceEvidence }));
  }
});

test('production entrypoint binds exact reviewed sources, original bounds and zero-metadata provenance before transport', async () => {
  const input = () => ({ release: ACQUISITION_RELEASE, roster: structuredClone(publicRoster), sourcePins: structuredClone(REVIEWED_SOURCE_PINS),
    sourceEvidence: { ...REVIEWED_SOURCE_EVIDENCE }, limits: { ...REVIEWED_ACQUISITION_LIMITS }, conflictPolicy: policy() });
  let calls = 0;
  for (const change of [value => { value.release = 'latest'; }, value => { value.sourcePins.works.bytes--; },
    value => { value.sourceEvidence.metadataSha256 = '0'.repeat(64); }, value => { value.limits.timeoutMs--; },
    value => { value.roster = structuredClone(roster); }, value => { value.roster[0].editionId = 'OL900000000M'; },
    value => { delete value.conflictPolicy; }]) {
    const value = input(); change(value);
    await assert.rejects(acquireConflictAwareOpenLibraryDumps({ ...value, transport: async () => { calls++; } }), /invalid-/);
  }
  assert.equal(calls, 0);
  assert.equal(digest(publicRoster), CONFLICT_ACQUISITION_ROSTER_SHA256);
  const value = input(), key = `/works/${publicRoster[0].workId}`;
  // Only the public roster is real; this tiny stream is wholly synthetic and
  // deliberately cannot satisfy the frozen real dump byte count.
  const tiny = gzipSync(row('work', 0, { key, location: '/works/OL900000000W', privateMarker: canary }, { key }));
  const result = await acquireConflictAwareOpenLibraryDumps({ ...value, transport: async url => {
    calls++; assert.equal(url, REVIEWED_SOURCE_PINS.works.url);
    value.roster[0].workId = 'OL900000W'; value.sourcePins.works.bytes = tiny.length;
    value.limits.retainedBytes = 1; value.conflictPolicy.maxConflictedPairs = 0;
    return { status: 200, headers: {}, body: Readable.from([tiny]) };
  } });
  assertFailure(result, 'dump-file-size-mismatch'); assert.equal(calls, 1);
  assert.equal(result.contract, CONFLICT_ACQUISITION_CONTRACT); assert.equal(result.limits.retainedBytes, REVIEWED_ACQUISITION_LIMITS.retainedBytes);
  assert.equal(result.quarantine.conflicts.length, 1); assert.deepEqual(result.sourceEvidence, REVIEWED_SOURCE_EVIDENCE);
  assert.equal(result.approved, 0); assert.equal(result.databaseWrites, 0); assert.equal(result.modelAdmissions, 0);
  assert.equal(result.rights, 'unreviewed'); assert.equal(result.individualProviderRequests, 0);
});

test('strict historical cloud entry cannot opt in via unknown options and keeps its original error mapping', async () => {
  const tiny = gzipSync(conflict('work')); let calls = 0;
  await assert.rejects(acquireReviewedOpenLibraryDumps({ release: ACQUISITION_RELEASE, roster,
    sourcePins: REVIEWED_SOURCE_PINS, sourceEvidence: REVIEWED_SOURCE_EVIDENCE, limits: REVIEWED_ACQUISITION_LIMITS,
    conflictPolicy: policy(), openSource: () => assert.fail('Unexpected opt-in'), transport: async () => {
      calls++; return { status: 200, headers: {}, body: Readable.from([tiny]) };
    } }), /provider-identity-mismatch/);
  assert.equal(calls, 1); assert.equal(safeAcquisitionError(new Error('dump-conflict-pair-limit')), 'acquisition-failed');
  assert.equal(safeConflictAcquisitionError(new Error('dump-conflict-pair-limit')), 'dump-conflict-pair-limit');
  assert.equal(safeConflictAcquisitionError(new Error(canary)), 'acquisition-failed');
});
