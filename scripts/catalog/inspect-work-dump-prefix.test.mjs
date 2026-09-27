import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { curlAcquisitionTransport } from './acquire-open-library-dumps.mjs';
import { FAILURE_EVIDENCE_CONTRACT, validateDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { sha256 } from './open-library-descriptions.mjs';
import { scanDumpFailurePrefix } from './open-library-dump-descriptions.mjs';
import { WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN,
  inspectWorkDumpPrefix, validateWorkPrefixHeaders } from './inspect-work-dump-prefix.mjs';

const at = '2026-09-24T14:00:00Z';
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }, { workId: 'OL789W', editionId: 'OL789M' }];
const args = () => ({ release: '2026-08-31', roster: structuredClone(roster),
  sourcePin: { ...WORK_PREFIX_SOURCE_PIN }, range: { ...WORK_PREFIX_RANGE }, limits: { ...WORK_PREFIX_LIMITS } });
const headers = () => ({ 'content-range': 'bytes 0-104857599/4058336593', 'content-length': '104857600' });
function row(workId = 'OL123W', changes = {}) {
  const value = { key: `/works/${workId}`, type: { key: '/type/work' }, revision: 1,
    last_modified: { value: '2026-08-01T00:00:00Z' }, description: 'A private unapproved story description retained by no diagnostic candidate.', ...changes };
  return `/type/work\t/works/${workId}\t1\t2026-08-01T00:00:00Z\t${JSON.stringify(value)}\n`;
}
function injected(bytes, seen = []) {
  return async (url, options) => {
    seen.push({ url, range: options.range, maxBytes: options.maxBytes });
    return { status: 206, headers: headers(), body: Readable.from((async function* () {
      for (let offset = 0; offset < bytes.length; offset += 17) {
        const chunk = bytes.subarray(offset, offset + 17);
        options.observeBodyBytes(chunk.length); yield chunk;
      }
    })()) };
  };
}
function scan(bytes, overrides = {}, selected = roster, input = Readable.from([bytes])) {
  return scanDumpFailurePrefix(input, WORK_PREFIX_SOURCE_PIN, selected, at,
    { ...WORK_PREFIX_LIMITS, compressedBytes: bytes.length, ...overrides });
}
function curlFixture(chunks, { code = 0 } = {}) {
  let killed = 0, invocation;
  const spawn = (command, argv, options) => {
    invocation = { command, argv, options };
    const child = new EventEmitter(); child.stdout = new PassThrough();
    child.kill = () => { killed++; process.nextTick(() => child.emit('close', 143)); return true; };
    process.nextTick(() => {
      child.stdout.once('end', () => process.nextTick(() => child.emit('close', code)));
      for (const chunk of chunks) child.stdout.write(chunk);
      child.stdout.end();
    });
    return child;
  };
  return { spawn, killed: () => killed, invocation: () => invocation };
}
const rawHeaders = (status = '206 Partial Content', extra = '') =>
  `HTTP/1.1 ${status}\r\nContent-Range: bytes 0-104857599/4058336593\r\nContent-Length: 104857600\r\n${extra}\r\n`;

test('fixed source, range, limits and public roster reject widening before transport', async () => {
  let calls = 0;
  for (const change of [value => { value.range.start = 1; }, value => { value.range.end++; },
    value => { value.sourcePin.md5 = '0'.repeat(32); }, value => { value.limits.compressedBytes++; },
    value => { value.limits.timeoutMs++; }, value => { value.roster[0].itemId = 'private'; }]) {
    const value = args(); change(value);
    await assert.rejects(inspectWorkDumpPrefix({ ...value, transport: () => calls++ }), /invalid-/);
  }
  assert.equal(calls, 0);
});

test('prefix scanner passes a self-location then diagnoses the first rejected identity as v2, discarding prior records', async () => {
  const rejected = row('OL789W', { location: null });
  const bytes = gzipSync(row('OL123W', { location: '/works/OL123W' }) + rejected + row('OL789W', { key: '/works/OL999W' }));
  const calls = [], result = await inspectWorkDumpPrefix({ ...args(), transport: injected(bytes, calls) });
  assert.equal(result.status, 'diagnosed'); assert.equal(result.code, 'provider-identity-mismatch');
  assert.equal(result.failureEvidence.predicate, 'record-location-mismatch');
  assert.equal(result.failureEvidence.contract, FAILURE_EVIDENCE_CONTRACT);
  assert.equal(result.failureEvidence.row, 2);
  assert.equal(result.failureEvidence.terminated, true);
  assert.equal(Buffer.from(result.failureEvidence.rawBase64, 'base64').toString(), rejected.slice(0, -1));
  validateDumpFailureEvidence(result.failureEvidence, { roster, source: WORK_PREFIX_SOURCE_PIN, limits: WORK_PREFIX_LIMITS });
  assert.equal(result.accounting.matchedRecords, 1);
  assert.equal(result.accounting.retainedRecordBytes, 0);
  assert.equal(result.accounting.failureEvidenceBytes, Buffer.byteLength(rejected) - 1);
  assert.equal(result.records, undefined); assert.equal(result.sourceManifest, undefined);
  assert.equal(result.candidates, 0); assert.equal(result.fullSourceComplete, false);
  assert.equal(result.publisherChecksumsVerified, false);
  assert.equal(result.accounting.prefixComplete, false);
  assert.deepEqual(result.accounting.requests, { works: 1, editions: 0, metadata: 0 });
  assert.deepEqual(calls, [{ url: WORK_PREFIX_SOURCE_PIN.url, range: WORK_PREFIX_RANGE, maxBytes: 104857600 }]);
});

test('all four identity predicates replay exactly and transport lookalikes cannot diagnose', async () => {
  const changes = [{ key: '/works/OL999W' }, { type: { key: '/type/edition' } }, { location: null }];
  for (const change of changes) {
    const result = await scan(gzipSync(row('OL123W', change)));
    assert.equal(result.status, 'diagnosed');
    validateDumpFailureEvidence(result.failureEvidence, { roster, source: WORK_PREFIX_SOURCE_PIN, limits: WORK_PREFIX_LIMITS });
  }
  const malformedObject = row().replace(/\{.*\}\n$/, 'null\n');
  const result = await scan(gzipSync(malformedObject));
  assert.equal(result.failureEvidence.predicate, 'record-not-object');
  for (const code of ['provider-identity-mismatch', 'work-prefix-row-limit', 'work-prefix-range-exhausted']) {
    const forged = Object.assign(new Error(code), { identityPredicate: 'record-not-object', failureEvidence: result.failureEvidence });
    const failed = await inspectWorkDumpPrefix({ ...args(), transport: async () => { throw forged; } });
    assert.equal(failed.status, 'failed'); assert.equal(failed.failureEvidence, null);
  }
});

test('exact complete range with absent gzip trailer or unfinished TSV tail is inconclusive, never a candidate', async () => {
  const full = gzipSync(row('OL999W'));
  const truncated = full.subarray(0, -8);
  const result = await scan(truncated);
  assert.equal(result.status, 'inconclusive'); assert.equal(result.code, 'work-prefix-range-exhausted');
  assert.equal(result.prefixComplete, true); assert.equal(result.prefixSha256, sha256(truncated));
  const tail = await scan(gzipSync(row().slice(0, -12)));
  assert.equal(tail.status, 'inconclusive'); assert.equal(tail.failureEvidence, null);
  assert.equal(tail.stats.rows, 0); assert.equal(tail.stats.matchedRecords, 0);
});

test('early EOF, corrupt gzip and forged zlib transport errors remain failures', async () => {
  const bytes = gzipSync(row('OL999W'));
  const early = await scan(bytes.subarray(0, -8), { compressedBytes: bytes.length });
  assert.equal(early.status, 'failed'); assert.equal(early.code, 'work-prefix-truncated');
  const corrupted = Buffer.from(bytes); corrupted[corrupted.length - 8] ^= 1;
  const invalid = await scan(corrupted);
  assert.equal(invalid.status, 'failed'); assert.equal(invalid.code, 'work-prefix-gzip-invalid');
  const fake = Object.assign(new Error('unexpected end of file'), { code: 'Z_BUF_ERROR' });
  const input = Readable.from((async function* () { yield bytes.subarray(0, -8); throw fake; })());
  const transport = await scan(bytes.subarray(0, -8), {}, roster, input);
  assert.equal(transport.status, 'failed'); assert.equal(transport.failureEvidence, null);
});

test('decoded and row bounds are owned stops with exact accepted counts, while duplicate/line errors still fail', async () => {
  const bytes = gzipSync(row('OL999W') + row('OL998W') + row('OL123W', { location: null }));
  const rows = await scan(bytes, { maxRows: 2 });
  assert.equal(rows.status, 'inconclusive'); assert.equal(rows.code, 'work-prefix-row-limit');
  assert.equal(rows.stats.rows, 2); assert.equal(rows.failureEvidence, null);
  const decoded = await scan(bytes, { maxDecodedBytes: 32 });
  assert.equal(decoded.status, 'inconclusive'); assert.equal(decoded.code, 'work-prefix-decoded-limit');
  assert.equal(decoded.stats.decodedBytes, 32); assert.equal(decoded.failureEvidence, null);
  const duplicate = await scan(gzipSync(row() + row() + row('OL789W', { location: null })));
  assert.equal(duplicate.status, 'failed'); assert.equal(duplicate.code, 'duplicate-dump-target-record');
  assert.equal(duplicate.failureEvidence, null);
  const line = await scan(gzipSync(row()), { lineBytes: 10 });
  assert.equal(line.status, 'failed'); assert.equal(line.code, 'dump-line-limit');
  const overflow = await scan(bytes, { compressedBytes: bytes.length - 1 });
  assert.equal(overflow.status, 'failed'); assert.equal(overflow.code, 'work-prefix-range-overflow');
  assert.equal(overflow.stats.bytes, 0);
});

test('response policy requires exact single206 range/length and rejects ignored ranges, encoding and multipart', () => {
  assert.equal(validateWorkPrefixHeaders({ status: 206, headers: headers() }), true);
  for (const response of [{ status: 200, headers: headers() }, { status: 416, headers: headers() },
    { status: 206, headers: { ...headers(), 'content-range': 'bytes 1-104857600/4058336593' } },
    { status: 206, headers: { ...headers(), 'content-range': 'bytes 0-104857599/*' } },
    { status: 206, headers: { ...headers(), 'content-length': '4058336593' } },
    { status: 206, headers: { ...headers(), 'content-type': 'multipart/byteranges; boundary=x' } },
    { status: 206, headers: { ...headers(), 'content-encoding': 'gzip' } },
    { status: 206, headers: { ...headers(), 'transfer-encoding': 'chunked' } }])
    assert.throws(() => validateWorkPrefixHeaders(response), /work-prefix-range-/);
});

test('curl validates headers before forwarding bundled body, rejects duplicate range, and kills redirect body immediately', async () => {
  const tail = Buffer.from('PRIVATE rejected body');
  for (const [header, code] of [[rawHeaders('200 OK'), 'work-prefix-range-not-honored'],
    [rawHeaders('206 Partial Content', 'Content-Range: bytes 0-104857599/4058336593\r\n'), 'acquisition-invalid-response']]) {
    const fixture = curlFixture([Buffer.concat([Buffer.from(header), tail])]);
    await assert.rejects(curlAcquisitionTransport(WORK_PREFIX_SOURCE_PIN.url,
      { signal: new AbortController().signal, timeoutMs: 1000, maxBytes: 104857600, range: WORK_PREFIX_RANGE,
        acceptHeaders: validateWorkPrefixHeaders }, fixture.spawn), error => error.message === code);
    assert.ok(fixture.killed() >= 1);
  }
  const redirected = curlFixture([Buffer.concat([Buffer.from('HTTP/1.1 302 Found\r\nLocation: /serve/ol_dump_2026-08-31/ol_dump_works_2026-08-31.txt.gz\r\n\r\n'), tail])]);
  let observed = 0;
  const response = await curlAcquisitionTransport(WORK_PREFIX_SOURCE_PIN.url, { signal: new AbortController().signal,
    timeoutMs: 1000, maxBytes: 104857600, range: WORK_PREFIX_RANGE, acceptHeaders: validateWorkPrefixHeaders,
    observeBodyBytes: count => { observed += count; } }, redirected.spawn);
  const chunks = []; for await (const chunk of response.body) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).length, 0); assert.equal(observed, tail.length); assert.ok(redirected.killed() >= 1);
  const argv = redirected.invocation().argv;
  assert.equal(argv[0], '--disable'); assert.ok(argv.includes('0-104857599')); assert.ok(argv.includes('Accept-Encoding: identity'));
  assert.ok(!argv.includes('--location') && !argv.includes('--retry') && !argv.includes('--insecure') && !argv.includes('--noproxy'));
});

test('safe redirects preserve fixed range, query/foreign/loop/excess routes stop with no metadata or Edition access', async () => {
  const target = 'https://ia800909.us.archive.org/1/items/ol_dump_2026-08-31/ol_dump_works_2026-08-31.txt.gz';
  const bytes = gzipSync(row('OL123W', { location: null })), calls = [];
  const result = await inspectWorkDumpPrefix({ ...args(), transport: async (url, options) => {
    calls.push(url); assert.deepEqual(options.range, WORK_PREFIX_RANGE); assert.equal(options.maxBytes, 104857600);
    if (calls.length === 1) { options.observeBodyBytes(20); return { status: 302, headers: { location: target }, body: Readable.from([]) }; }
    return injected(bytes)(url, options);
  } });
  assert.equal(result.status, 'diagnosed'); assert.equal(result.accounting.requests.works, 2);
  assert.equal(result.response.redirects.length, 1);
  for (const location of ['https://example.com/file', target + '?other=1', WORK_PREFIX_SOURCE_PIN.url,
    'https://archive.org/works/OL123W.json']) {
    let count = 0;
    const rejected = await inspectWorkDumpPrefix({ ...args(), transport: async () => {
      count++; return { status: 302, headers: { location }, body: Readable.from([]) };
    } });
    assert.equal(rejected.status, 'failed'); assert.equal(count, 1);
  }
  let count = 0;
  const limited = await inspectWorkDumpPrefix({ ...args(), transport: async () => ({ status: 302,
    headers: { location: `https://ia${++count}.archive.org/items/ol_dump_2026-08-31/ol_dump_works_2026-08-31.txt.gz` },
    body: Readable.from([]) }) });
  assert.equal(limited.status, 'failed'); assert.equal(limited.code, 'acquisition-redirect-limit');
  assert.equal(count, 5);
});

test('observed cumulative body crossing is an honest failed transport count, never an inconclusive row result', async () => {
  let count = 0;
  const result = await inspectWorkDumpPrefix({ ...args(), transport: async (_url, options) => {
    count++; options.observeBodyBytes(104857600 + 17); throw new Error('unreachable');
  } });
  assert.equal(result.status, 'failed'); assert.equal(result.code, 'work-prefix-body-limit');
  assert.equal(result.response, null); assert.equal(result.accounting.receivedBodyBytes, 104857617);
  assert.equal(result.accounting.compressedBytes, 0); assert.equal(result.failureEvidence, null); assert.equal(count, 1);
  const exhausted = await inspectWorkDumpPrefix({ ...args(), transport: async (_url, options) => {
    options.observeBodyBytes(104857600);
    return { status: 302, headers: { location: 'https://ia1.archive.org/items/ol_dump_2026-08-31/ol_dump_works_2026-08-31.txt.gz' }, body: Readable.from([]) };
  } });
  assert.equal(exhausted.code, 'work-prefix-body-limit'); assert.equal(exhausted.accounting.receivedBodyBytes, 104857600);
  assert.equal(exhausted.accounting.requests.works, 1);
  const controller = new AbortController(), partial = gzipSync(row('OL999W')).subarray(0, 10);
  const simultaneous = await inspectWorkDumpPrefix({ ...args(), signal: controller.signal,
    transport: async (_url, options) => ({ status: 206, headers: headers(), body: Readable.from((async function* () {
      options.observeBodyBytes(partial.length); yield partial;
      try { options.observeBodyBytes(104857600); }
      catch (error) { controller.abort(); throw error; }
    })()) }) });
  assert.equal(simultaneous.status, 'failed'); assert.equal(simultaneous.code, 'work-prefix-body-limit');
  assert.equal(simultaneous.accounting.receivedBodyBytes, 104857610);
});

test('validated caller input is replaced by immutable pins and bounds before await transport', async () => {
  const input = args();
  const result = await inspectWorkDumpPrefix({ ...input, transport: async (url, options) => {
    input.sourcePin.md5 = '0'.repeat(32); input.range.end = 999999999; input.limits.maxRows = 999999999;
    input.roster[0].workId = 'OL999W';
    return injected(gzipSync(row('OL123W', { location: null })))(url, options);
  } });
  assert.equal(result.status, 'diagnosed'); assert.deepEqual(result.sourcePin, WORK_PREFIX_SOURCE_PIN);
  assert.deepEqual(result.range, WORK_PREFIX_RANGE); assert.deepEqual(result.limits, WORK_PREFIX_LIMITS);
  assert.equal(result.failureEvidence.expected.workId, 'OL123W');
});

test('external abort and fixed ten-minute deadline cancel pending transport with no fallback', async t => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  const aborted = await inspectWorkDumpPrefix({ ...args(), signal: controller.signal, transport: () => calls++ });
  assert.equal(aborted.status, 'failed'); assert.equal(aborted.code, 'work-prefix-aborted'); assert.equal(calls, 0);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = inspectWorkDumpPrefix({ ...args(), transport: async (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++; signal.addEventListener('abort', () => reject(new Error('PRIVATE timeout detail')), { once: true });
  }) });
  t.mock.timers.tick(600000);
  const expired = await pending;
  assert.equal(expired.status, 'failed'); assert.equal(expired.code, 'work-prefix-timeout'); assert.equal(calls, 1);
});
