import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { DEFAULT_STAGING_ROOT, LIMITS, readDumpFailureEvidence, scanDumpStream, scanEditionLinePrefix } from './open-library-dump-descriptions.mjs';
import { createEditionLineEvidence, validateEditionLineContext, validateEditionLineDiagnostic,
  validateEditionLineEvidence } from './dump-failure-evidence.mjs';
import { CONFLICT_POLICY_CONTRACT } from './dump-conflict-policy.mjs';
import { FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PURPOSE,
  FULL_CONTINUATION_PREVIOUS_REVIEWED, FULL_CONTINUATION_PREVIOUS_PREFIX,
  FULL_CONTINUATION_CORRECTION_HEAD } from './seal-full-dump-continuation.mjs';
import { CONFLICT_REQUEST_CONTRACT, CONFLICT_REQUEST_PURPOSE, CONFLICT_POLICY_SOURCE_HEAD,
  CONFLICT_PREVIOUS_CONTINUATION } from './seal-conflict-dump-acquisition.mjs';

const fetchedAt = '2026-09-28T07:00:00.000Z', modifiedAt = '2026-08-15T10:00:00.000';
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }];
const header = (key = '/books/OL999M') => `/type/edition\t${key}\t3\t${modifiedAt}\t`;
const valid = () => header('/books/OL456M') + JSON.stringify({ key: '/books/OL456M', type: { key: '/type/edition' },
  revision: 3, last_modified: { value: modifiedAt }, works: [{ key: '/works/OL123W' }] }) + '\n';
function fixture(raw, overrides = {}) {
  const zipped = gzipSync(raw), source = { url: 'https://archive.org/download/ol_dump_2026-08-31/ol_dump_editions_2026-08-31.txt.gz',
    bytes: zipped.length, compression: 'gzip', md5: createHash('md5').update(zipped).digest('hex'),
    sha1: createHash('sha1').update(zipped).digest('hex') };
  const context = { source, roster: structuredClone(roster), fetchedAt,
    limits: { compressedBytes: zipped.length, maxDecodedBytes: 8192, maxRows: 20, lineBytes: 512, prefixBytes: 128, timeoutMs: 1000,
      ...overrides } };
  return { zipped, context };
}
function stream(bytes, size = bytes.length) {
  return Readable.from((function* () { for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size); })());
}
async function diagnose(raw, overrides, chunkSize) {
  const { zipped, context } = fixture(raw, overrides);
  const input = stream(zipped, chunkSize), result = await scanEditionLinePrefix(input, context);
  assert.equal(result.candidates, 0); assert.equal(result.approved, 0); assert.equal(result.databaseWrites, 0);
  assert.equal(result.fullSourceComplete, false); assert.equal(result.publisherChecksumsVerified, false);
  assert.equal(result.provenanceVerified, false); assert.equal(result.inspectionSourceRequests, 0);
  assert.equal(result.prefixSha256, sha256(zipped.subarray(0, result.stats.bytes)));
  assert.equal(input.destroyed, true);
  assert.equal(validateEditionLineDiagnostic(result, context), result);
  return { result, context, zipped };
}

test('selected and unrelated oversized envelopes diagnose without retaining JSON or accepting inner identity', async () => {
  for (const [key, status] of [['/books/OL456M', 'selected'], ['/books/OL999M', 'unrelated']]) {
    const { result, context } = await diagnose(header(key) + '{"key":"wrong","private":"' + 'x'.repeat(900) + '"}\n');
    const evidence = result.failureEvidence;
    assert.equal(result.status, 'diagnosed'); assert.equal(result.code, 'dump-line-limit');
    assert.equal(evidence.envelopeSelection.status, status);
    assert.equal(evidence.row, 1); assert.equal(evidence.lineStartByte, 0);
    assert.equal(evidence.observedLineBytesAtLeast, 513);
    assert.equal(Buffer.from(evidence.prefixBase64, 'base64').toString(), header(key));
    assert.ok(!JSON.stringify(evidence).includes('private'));
    assert.equal(evidence.rowBytes, null); assert.equal(evidence.rowSha256, null); assert.equal(evidence.rowComplete, false);
    assert.equal(validateEditionLineEvidence(evidence, context), evidence);
  }
});

test('same prefix, row and exact decoded line start survive compressed and decoded chunk boundaries', async () => {
  const prior = 'ö\r\n' + valid(), raw = prior + header() + 'x'.repeat(20000) + '\n';
  let expected;
  for (const chunk of [1, 7, 41, 65536]) {
    const { result } = await diagnose(raw, { maxDecodedBytes: 50000 }, chunk);
    const evidence = result.failureEvidence;
    assert.equal(evidence.row, 3); assert.equal(evidence.lineStartByte, Buffer.byteLength(prior));
    assert.equal(result.stats.rows, 2); assert.equal(result.stats.matchedRecords, 1);
    if (expected) assert.deepEqual(evidence, expected); else expected = evidence;
  }
});

test('unknown selection is explicit for incomplete, invalid or invalid-UTF8 headers', async () => {
  for (const [raw, limits, reason] of [
    [header() + 'x'.repeat(900), { prefixBytes: 12 }, 'header-prefix-incomplete'],
    ['/type/work\t/books/OL456M\t3\t' + modifiedAt + '\t' + 'x'.repeat(900), {}, 'invalid-edition-envelope'],
    [header().replace('\t3\t', '\t9007199254740992\t') + 'x'.repeat(900), {}, 'invalid-edition-envelope'],
    [header().replace(modifiedAt, '2027-01-01T00:00:00Z') + 'x'.repeat(900), {}, 'invalid-edition-envelope'],
    [Buffer.concat([Buffer.from('/type/edition\t/books/'), Buffer.from([255]), Buffer.from('M\t3\t' + modifiedAt + '\t' + 'x'.repeat(900))]), {}, 'invalid-header-encoding'],
  ]) {
    const { result } = await diagnose(raw, limits);
    assert.equal(result.status, 'diagnosed');
    assert.deepEqual(result.failureEvidence.envelopeSelection, { status: 'unknown', reason, editionId: null, workId: null });
  }
});

test('byte limit counts UTF-8 bytes and the original CR while excluding LF', async () => {
  const atLimit = header() + 'x'.repeat(512 - Buffer.byteLength(header()) - 1) + '\r\n';
  const exact = await diagnose(atLimit);
  assert.equal(exact.result.status, 'inconclusive'); assert.equal(exact.result.stats.rows, 1);
  const over = await diagnose(atLimit.replace('\r\n', 'x\r\n'));
  assert.equal(over.result.status, 'diagnosed'); assert.equal(over.result.failureEvidence.observedLineBytesAtLeast, 513);
  const unicode = await diagnose(header() + 'ö'.repeat(240));
  assert.equal(unicode.result.status, 'diagnosed');
});

test('unterminated oversized tails diagnose; under-limit tails remain uninspected partial input', async () => {
  assert.equal((await diagnose(header() + 'x'.repeat(700))).result.status, 'diagnosed');
  const { result } = await diagnose(header('/books/OL456M') + '{bad-json');
  assert.equal(result.status, 'inconclusive'); assert.equal(result.stats.rows, 0); assert.equal(result.failureEvidence, null);
});

test('row budget stops at the exact completed row before a later oversized target', async () => {
  const { result } = await diagnose('unrelated\n' + header('/books/OL456M') + 'x'.repeat(900), { maxRows: 1 });
  assert.equal(result.status, 'inconclusive'); assert.equal(result.code, 'edition-line-row-limit');
  assert.equal(result.stats.rows, 1); assert.equal(result.failureEvidence, null);
});

test('decoded-byte budget admits no lookahead and line witness wins only when inside that budget', async () => {
  const raw = header() + 'x'.repeat(2000);
  const before = await diagnose(raw, { maxDecodedBytes: 512 });
  assert.equal(before.result.code, 'edition-line-decoded-limit'); assert.equal(before.result.stats.decodedBytes, 512);
  const witness = await diagnose(raw, { maxDecodedBytes: 513 });
  assert.equal(witness.result.status, 'diagnosed'); assert.equal(witness.result.stats.decodedBytes, 513);
});

test('exact compressed-prefix exhaustion is inconclusive; early EOF and overflow are failures', async () => {
  const { zipped, context } = fixture('unrelated\n'.repeat(100), { maxRows: 1000 });
  context.limits.compressedBytes = zipped.length - 8;
  const partial = await scanEditionLinePrefix(stream(zipped.subarray(0, -8), 1), context);
  assert.equal(partial.status, 'inconclusive'); assert.equal(partial.code, 'edition-line-prefix-exhausted');
  assert.equal(partial.prefixComplete, true);
  const short = await scanEditionLinePrefix(stream(zipped.subarray(0, -10), 1), context);
  assert.equal(short.status, 'failed'); assert.equal(short.code, 'edition-line-prefix-truncated');
  const excess = await scanEditionLinePrefix(stream(zipped), context);
  assert.equal(excess.status, 'failed'); assert.equal(excess.code, 'edition-line-prefix-overflow');
  assert.ok(excess.stats.bytes <= context.limits.compressedBytes);
});

test('full-size truncated gzip and corrupt gzip never become expected partial exhaustion', async () => {
  for (const mutate of [bytes => bytes.subarray(0, -4), bytes => { bytes[bytes.length - 5] ^= 255; return bytes; }]) {
    const { zipped, context } = fixture('unrelated\n');
    const damaged = mutate(Buffer.from(zipped)); context.source.bytes = context.limits.compressedBytes = damaged.length;
    const result = await scanEditionLinePrefix(stream(damaged), context);
    assert.equal(result.status, 'failed'); assert.equal(result.failureEvidence, null);
    assert.match(result.code, /^edition-line-(?:prefix-truncated|gzip-invalid)$/);
  }
});

test('framing diagnosis preserves completed-row encoding, duplicate and selected identity guards', async () => {
  for (const [raw, code] of [
    [Buffer.from([255, 10]), 'invalid-dump-encoding'],
    [valid() + valid(), 'duplicate-dump-target-record'],
    [valid().replace('"key":"/books/OL456M"', '"key":"/books/OL999M"'), 'provider-identity-mismatch'],
    [header('/books/OL456M') + '{bad}\n', 'malformed-provider-json'],
    [valid().replace('/works/OL123W', '/works/OL999W'), 'provider-work-link-mismatch'],
  ]) {
    const { result } = await diagnose(raw);
    assert.equal(result.status, 'failed'); assert.equal(result.code, code); assert.equal(result.failureEvidence, null);
  }
});

test('existing strict scanner still rejects oversized lines without new evidence or option-based bypass', async () => {
  const { zipped, context } = fixture(header() + 'x'.repeat(900));
  await assert.rejects(scanDumpStream(stream(zipped), { ...context.source, maxRows: 20, maxDecodedBytes: 8192 },
    'editions', roster, fetchedAt, { bytes: 0 }, { lineBytes: 512, lineDiagnostic: context }), error => {
    assert.equal(error.message, 'dump-line-limit'); assert.equal(readDumpFailureEvidence(error), undefined); return true;
  });
});

test('transport messages and forged evidence cannot impersonate a parser diagnosis', async () => {
  const { context } = fixture(header() + 'x'.repeat(900));
  const input = new Readable({ read() { this.destroy(Object.assign(new Error('dump-line-limit'),
    { failureEvidence: { privateText: 'must-not-leak' }, code: 'Z_BUF_ERROR' })); } });
  const result = await scanEditionLinePrefix(input, context);
  assert.equal(result.status, 'failed'); assert.equal(result.code, 'edition-line-stream-failed');
  assert.equal(result.failureEvidence, null); assert.ok(!JSON.stringify(result).includes('must-not-leak'));
});

test('explicit abort and timeout close their streams without a fabricated diagnosis', async () => {
  for (const preAbort of [true, false]) {
    const { context } = fixture('unrelated\n', { timeoutMs: 15 });
    const controller = new AbortController(); if (preAbort) controller.abort();
    const input = new Readable({ read() {} });
    const keepAlive = setInterval(() => {}, 100);
    try {
      const result = await scanEditionLinePrefix(input, { ...context, signal: controller.signal });
      assert.equal(result.code, 'edition-line-aborted'); assert.equal(result.failureEvidence, null); assert.equal(input.destroyed, true);
    } finally { clearInterval(keepAlive); input.destroy(); }
  }
});

test('all bounds and the canonical dated Edition source are checked before consuming input', async () => {
  const { context } = fixture('unrelated\n');
  for (const mutate of [
    c => { delete c.limits.prefixBytes; }, c => { c.limits.prefixBytes = 4097; }, c => { c.limits.lineBytes = LIMITS.lineBytes + 1; },
    c => { c.limits.compressedBytes = c.source.bytes + 1; }, c => { c.limits.maxRows = 0; },
    c => { c.limits.maxDecodedBytes = 1.5; }, c => { c.limits.timeoutMs = 6600001; }, c => { c.limits.extra = 1; },
    c => { c.source.url = c.source.url.replace('editions', 'works'); }, c => { c.source.url += '?private=secret'; },
    c => { c.source.url = c.source.url.replace('/download/ol_dump_2026-08-31/', '/other-upload/'); },
    c => { c.source.url = c.source.url.replaceAll('2026-08-31', '2026-02-30'); },
    c => { c.source.md5 = ['a'.repeat(32)]; }, c => { c.source.extra = 'unbound'; },
    c => { c.roster.push(c.roster[0]); }, c => { c.fetchedAt = '2026-01-01T00:00:00Z'; },
  ]) {
    const invalid = structuredClone(context); mutate(invalid); let reads = 0;
    const input = new Readable({ read() { reads++; this.push(null); } });
    await assert.rejects(scanEditionLinePrefix(input, invalid), /invalid-edition-line-diagnostic/);
    assert.equal(reads, 0); input.destroy();
  }
});

test('mutable caller context cannot alter in-flight source, roster or policy bindings', async () => {
  const { zipped, context } = fixture(header('/books/OL456M') + 'x'.repeat(900));
  const input = Readable.from((async function* () {
    context.roster[0].editionId = 'OL999M'; context.limits.prefixBytes = 1; context.source.md5 = '0'.repeat(32); yield zipped;
  })());
  const result = await scanEditionLinePrefix(input, context);
  assert.equal(result.failureEvidence.envelopeSelection.status, 'selected'); assert.equal(result.limits.prefixBytes, 128);
  assert.notEqual(result.source.md5, context.source.md5);
});

test('closed evidence schema replays header classification and rejects changed bindings or full-row claims', async () => {
  const { result, context } = await diagnose(header() + 'x'.repeat(900));
  for (const mutate of [
    e => { e.row = 0; }, e => { e.lineStartByte = -1; }, e => { e.observedLineBytesAtLeast++; },
    e => { e.prefixSha256 = '0'.repeat(64); }, e => { e.prefixBase64 += '='; }, e => { e.prefixBytes++; },
    e => { e.envelopeSelection.status = 'selected'; }, e => { e.source.bytes++; }, e => { e.rosterSha256 = '0'.repeat(64); },
    e => { e.limitsSha256 = '0'.repeat(64); }, e => { e.rowComplete = true; }, e => { e.rowBytes = 1000; },
    e => { e.rowSha256 = '0'.repeat(64); }, e => { e.extra = 'private'; },
    e => { const raw = Buffer.from(header() + 'JSON-MUST-NOT-BE-RETAINED'); e.prefixBase64 = raw.toString('base64'); e.prefixBytes = raw.length; e.prefixSha256 = sha256(raw); },
  ]) {
    const evidence = structuredClone(result.failureEvidence); mutate(evidence);
    assert.throws(() => validateEditionLineEvidence(evidence, context), /invalid-edition-line-diagnostic/);
  }
  assert.throws(() => createEditionLineEvidence({ pending: Buffer.alloc(0), part: Buffer.alloc(512), row: 1,
    lineStartByte: 0, context }), /invalid-edition-line-diagnostic/);
  assert.throws(() => createEditionLineEvidence({ pending: Buffer.alloc(0), part: Buffer.from(header() + '\n' + 'x'.repeat(900)),
    row: 1, lineStartByte: 0, context }), /invalid-edition-line-diagnostic/);
});

test('closed result schema rejects altered accounting, outcome labels, provenance and approval', async () => {
  const { result, context } = await diagnose(header() + 'x'.repeat(900));
  for (const mutate of [
    r => { r.stats.rows++; }, r => { r.stats.decodedBytes = 1; }, r => { r.stats.bytes = r.limits.compressedBytes + 1; },
    r => { r.stats.matchedRecords = 2; }, r => { r.status = 'inconclusive'; }, r => { r.code = 'private-provider-message'; },
    r => { r.failureEvidence = null; }, r => { r.fullSourceComplete = true; }, r => { r.publisherChecksumsVerified = true; },
    r => { r.provenanceVerified = true; }, r => { r.approved = 1; }, r => { r.candidates = 1; },
    r => { r.inspectionSourceRequests = 1; }, r => { r.prefixSha256 = 'broken'; }, r => { r.extra = true; },
  ]) {
    const invalid = structuredClone(result); mutate(invalid);
    assert.throws(() => validateEditionLineDiagnostic(invalid, context), /invalid-edition-line-diagnostic/);
  }
});

// Same already-public fixture as the existing protocol tests. All diagnostic
// bytes below are invented; no private captured rows or identities are fixtures.
const reviewed = JSON.parse(await readFile(new URL('./fixtures/work-prefix-previous-request.json', import.meta.url), 'utf8'));
const sign = value => { const { requestSha256: _old, ...body } = value; return { ...body, requestSha256: digest(body) }; };
const previous = sign({ ...reviewed, contract: FULL_CONTINUATION_REQUEST_CONTRACT, purpose: FULL_CONTINUATION_REQUEST_PURPOSE,
  sourceHead: CONFLICT_PREVIOUS_CONTINUATION.sourceHead, previousReviewedAcquisition: FULL_CONTINUATION_PREVIOUS_REVIEWED,
  previousPrefixDiagnostic: FULL_CONTINUATION_PREVIOUS_PREFIX, correctionHead: FULL_CONTINUATION_CORRECTION_HEAD });
const request = sign({ ...previous, contract: CONFLICT_REQUEST_CONTRACT, purpose: CONFLICT_REQUEST_PURPOSE,
  sourceHead: 'a'.repeat(40), policySourceHead: CONFLICT_POLICY_SOURCE_HEAD, previousContinuation: CONFLICT_PREVIOUS_CONTINUATION,
  conflictPolicy: { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 1, maxDiagnosticBytes: 1024 } });
const cli = fileURLToPath(new URL('./inspect-edition-line-prefix.mjs', import.meta.url));
async function local(t) {
  const root = await mkdtemp(join(tmpdir(), 'kajo-line-cli-'));
  const out = join(DEFAULT_STAGING_ROOT, 'line-test-' + randomUUID());
  t.after(async () => { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); });
  const data = gzipSync(header('/books/OL999999999M') + 'x'.repeat(LIMITS.lineBytes + 1));
  const limits = { compressedBytes: data.length, maxDecodedBytes: 2 * LIMITS.lineBytes, maxRows: 10,
    lineBytes: LIMITS.lineBytes, prefixBytes: 128, timeoutMs: 1000 };
  for (const [name, value] of [['request', request], ['limits', limits]]) await writeFile(join(root, name + '.json'), JSON.stringify(value));
  await writeFile(join(root, 'editions.gz'), data);
  const args = [cli, '--request', join(root, 'request.json'), '--limits', join(root, 'limits.json'), '--editions', join(root, 'editions.gz'), '--out', out];
  const env = { ...process.env, GITHUB_ACTIONS: '', NODE_OPTIONS: '' };
  return { root, out, args, env, limits };
}

test('real local CLI saves private evidence last and prints no rows, hashes, paths or identifiers', async t => {
  const f = await local(t), child = spawnSync(process.execPath, f.args, { env: f.env, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stderr, '');
  assert.deepEqual(JSON.parse(child.stdout), { status: 'diagnosed', code: 'dump-line-limit', candidates: 0,
    approved: 0, providerRequests: 0, databaseWrites: 0, modelAdmissions: 0 });
  assert.deepEqual((await readdir(f.out)).sort(), ['diagnostic.json', 'limits.json', 'request.json']);
  for (const path of [f.out, ...['diagnostic', 'limits', 'request'].map(name => join(f.out, name + '.json'))])
    assert.equal((await lstat(path)).mode & 0o077, 0);
  const saved = JSON.parse(await readFile(join(f.out, 'diagnostic.json'), 'utf8'));
  assert.equal(saved.requestSha256, request.requestSha256); assert.equal(saved.sourceAuthentication, 'not-performed');
  assert.equal(saved.diagnostic.failureEvidence.envelopeSelection.status, 'unrelated');
  const before = await readFile(join(f.out, 'diagnostic.json'));
  const repeat = spawnSync(process.execPath, f.args, { env: f.env, encoding: 'utf8' });
  assert.equal(repeat.status, 1); assert.equal(repeat.stdout, ''); assert.deepEqual(await readFile(join(f.out, 'diagnostic.json')), before);
});

test('CLI rejects CI, changed consumed-request line limit, symlink input and output outside ignored staging', async t => {
  const f = await local(t);
  const blocked = spawnSync(process.execPath, f.args, { env: { ...f.env, GITHUB_ACTIONS: 'true' }, encoding: 'utf8' });
  assert.equal(blocked.status, 1); assert.equal(blocked.stdout, '');
  assert.deepEqual(JSON.parse(blocked.stderr), { status: 'failed', code: 'local-edition-line-inspection-failed' });
  await writeFile(join(f.root, 'limits.json'), JSON.stringify({ ...f.limits, lineBytes: LIMITS.lineBytes - 1 }));
  assert.equal(spawnSync(process.execPath, f.args, { env: f.env }).status, 1);
  await writeFile(join(f.root, 'limits.json'), JSON.stringify(f.limits));
  const linked = join(f.root, 'linked.gz'); await symlink(join(f.root, 'editions.gz'), linked);
  assert.equal(spawnSync(process.execPath, f.args.map(arg => arg === join(f.root, 'editions.gz') ? linked : arg), { env: f.env }).status, 1);
  assert.equal(spawnSync(process.execPath, f.args.map(arg => arg === f.out ? join(f.root, 'outside') : arg), { env: f.env }).status, 1);
  await assert.rejects(lstat(f.out), { code: 'ENOENT' });
});
