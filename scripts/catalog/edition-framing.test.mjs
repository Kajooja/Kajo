import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createGzip, gzipSync } from 'node:zlib';
import { canonicalDumpSource } from './dump-failure-evidence.mjs';
import { CONFLICT_POLICY_CONTRACT, createDumpConflictLedger } from './dump-conflict-policy.mjs';
import { LIMITS, readDumpFailureEvidence, scanDumpConflictStream, scanDumpFailurePrefix,
  scanDumpStream, scanEditionFramedStream, scanEditionLinePrefix } from './open-library-dump-descriptions.mjs';

const fetchedAt = '2026-09-28T07:00:00.000Z', modifiedAt = '2026-08-15T10:00:00.000';
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }, { workId: 'OL124W', editionId: 'OL457M' }];
const options = { lineBytes: 512, retainedBytes: 8192, timeoutMs: 5000 };
const header = (key = '/books/OL999M') => `/type/edition\t${key}\t3\t${modifiedAt}\t`;
const record = (index = 0, extra = {}) => ({ key: `/books/${roster[index].editionId}`, type: { key: '/type/edition' },
  revision: 3, last_modified: { value: modifiedAt }, works: [{ key: `/works/${roster[index].workId}` }], ...extra });
const row = (index = 0, extra = {}) => header(`/books/${roster[index].editionId}`) + JSON.stringify(record(index, extra)) + '\n';
const oversized = (key, length = 20000, ending = '\n') => header(key) + 'x'.repeat(length) + ending;
const hash = (name, bytes) => createHash(name).update(bytes).digest('hex');
function fixture(raw, overrides = {}) {
  const bytes = gzipSync(raw);
  return { bytes, source: { url: 'https://archive.org/download/ol_dump_2026-08-31/ol_dump_editions_2026-08-31.txt.gz',
    bytes: bytes.length, compression: 'gzip', sha256: hash('sha256', bytes), md5: hash('md5', bytes), sha1: hash('sha1', bytes),
    maxRows: 100, maxDecodedBytes: 2 * 1024 * 1024, ...overrides } };
}
const stream = (bytes, size = bytes.length) => Readable.from((function* () {
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size);
})());
function scan(f, patch = {}, selected = roster, input = stream(f.bytes)) {
  return scanEditionFramedStream(input, f.source, selected, fetchedAt, { bytes: 0 }, { ...options, ...patch });
}
const ledger = () => createDumpConflictLedger({ selected: roster,
  policy: { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 2, maxDiagnosticBytes: 8192 } });

test('unrelated oversized rows recover at LF and preserve selected records, full checksums and exact counters', async () => {
  const skipped = oversized(undefined, 20000, '\r\n'), raw = row() + skipped + row(1);
  const f = fixture(raw), budget = { bytes: 0 }, input = stream(f.bytes, 7);
  const result = await scanEditionFramedStream(input, f.source, roster, fetchedAt, budget, options);
  assert.deepEqual([...result.records.keys()], ['OL123W', 'OL124W']);
  assert.equal(result.records.get('OL124W').dump.row, 3);
  assert.equal(result.stats.rows, 3); assert.equal(result.stats.matchedRecords, 2);
  assert.equal(result.stats.unrelatedRows, 1); assert.equal(result.stats.malformedUnrelatedRows, 0);
  assert.equal(result.stats.oversizedUnrelatedRows, 1);
  assert.equal(result.stats.oversizedUnrelatedBytes, Buffer.byteLength(skipped) - 1);
  assert.equal(result.stats.bytes, f.bytes.length); assert.equal(result.stats.decodedBytes, Buffer.byteLength(raw));
  assert.equal(result.stats.complete, true); assert.equal(input.destroyed, true);
  for (const name of ['sha256', 'md5', 'sha1']) assert.equal(result.stats[name], hash(name, f.bytes));
  assert.equal(budget.bytes, Buffer.byteLength(JSON.stringify(record())) + Buffer.byteLength(JSON.stringify(record(1))));
});

test('split headers, overflow, CRLF and adjacent oversized rows preserve framing across compressed chunk sizes', async () => {
  for (const offset of [0, 1, 20, 48, 64]) {
    const first = oversized(undefined, 16384 - Buffer.byteLength(header()) - offset - 1);
    const second = oversized('/books/OL998M', 20000, '\r\n');
    const f = fixture(first + second + row());
    for (const size of [1, 7, 4096]) {
      const result = await scan(f, {}, roster, stream(f.bytes, size));
      assert.equal(result.records.get('OL123W').dump.row, 3);
      assert.equal(result.stats.oversizedUnrelatedRows, 2);
      assert.equal(result.stats.oversizedUnrelatedBytes, Buffer.byteLength(first + second) - 2);
      assert.ok(result.stats.maxBufferedLineBytes <= options.lineBytes);
    }
  }
});

test('exact byte ceiling retains normal behavior; CR and multibyte data count before LF', async () => {
  for (const body of ['x'.repeat(512 - Buffer.byteLength(header())), 'ö'.repeat(230)]) {
    for (const ending of ['\n', '\r\n']) {
      const raw = header() + body + ending, length = Buffer.byteLength(raw) - 1;
      const result = await scan(fixture(raw));
      assert.equal(result.stats.oversizedUnrelatedRows, Number(length > 512));
      assert.equal(result.stats.oversizedUnrelatedBytes, length > 512 ? length : 0);
      assert.equal(result.stats.rows, 1);
    }
  }
});

test('discarded body is opaque, never decoded or mistaken for a selected inner key', async () => {
  const raw = Buffer.concat([Buffer.from(header() + 'x'.repeat(20000)), Buffer.from([255, 0, 13]),
    Buffer.from('\t' + JSON.stringify(record()) + '\n' + row())]);
  const result = await scan(fixture(raw));
  assert.equal(result.stats.oversizedUnrelatedRows, 1); assert.equal(result.stats.matchedRecords, 1);
  assert.equal(result.records.get('OL123W').dump.row, 2);
});

test('invalid UTF-8 in an ordinary unrelated row is still fatal', async () => {
  await assert.rejects(scan(fixture(Buffer.concat([Buffer.from(header()), Buffer.from([255, 10])]))), /invalid-dump-encoding/);
});

test('selected oversized rows fail even with unrelated inner keys or conflict options', async () => {
  for (const pair of roster) {
    const f = fixture(header(`/books/${pair.editionId}`) + JSON.stringify({ key: '/books/OL999M', text: 'x'.repeat(20000) }) + '\n');
    await assert.rejects(scan(f), /dump-line-limit/);
    await assert.rejects(scan(f, { conflictLedger: ledger() }), /dump-line-limit/);
  }
});

test('incomplete, noncanonical, future, impossible-date and invalid-encoding headers cannot authorize discard', async () => {
  const variants = [
    '/type/edition\t/books/OL999M\t3\t',
    header().replace('/type/edition', '/type/work'), header().replace('/books/OL999M', '/books/OL999W'),
    header().replace('/books/OL999M', '/books/OL999M?x'), header().replace('\t3\t', '\t03\t'),
    header().replace('\t3\t', '\t9007199254740992\t'), header().replace(modifiedAt, '2027-01-01T00:00:00Z'),
    header().replace(modifiedAt, '2026-02-30T00:00:00Z'), header().replace(modifiedAt, '2026-08-15T24:00:00Z'),
    '\ufeff' + header(), header().replace('/books/', '/books/\r'),
    Buffer.concat([Buffer.from([255]), Buffer.from(header())]),
  ];
  for (const prefix of variants)
    await assert.rejects(scan(fixture(Buffer.concat([Buffer.from(prefix), Buffer.from('x'.repeat(20000) + '\n')]))), /dump-line-limit/);
});

test('header proof ends within 4 KiB and cannot read later bytes to justify discard', async () => {
  for (const bytes of [4096, 4097]) {
    const prefix = header().replace('OL999M', 'OL' + '9'.repeat(bytes - Buffer.byteLength(header()) + 3) + 'M');
    assert.equal(Buffer.byteLength(prefix), bytes);
    const f = fixture(prefix + 'x'.repeat(10000) + '\n');
    if (bytes === 4096) assert.equal((await scan(f, { lineBytes: 8192 })).stats.oversizedUnrelatedRows, 1);
    else await assert.rejects(scan(f, { lineBytes: 8192 }), /dump-line-limit/);
  }
});

test('original roster includes pairs already quarantined by the complete Work scan', async () => {
  const conflictLedger = ledger(), budget = { bytes: 0 };
  const raw = `/type/work\t/works/OL123W\t3\t${modifiedAt}\t` + JSON.stringify({ key: '/works/OL123W',
    type: { key: '/type/work' }, revision: 3, last_modified: { value: modifiedAt }, location: '/works/OL999W' }) + '\n';
  const work = fixture(raw); work.source.url = work.source.url.replace('editions_', 'works_');
  await scanDumpConflictStream(stream(work.bytes), work.source, 'works', roster, fetchedAt, budget,
    { ...options, conflictLedger, keyOf: pair => pair.workId });
  assert.equal(conflictLedger.has('OL123W'), true);
  await assert.rejects(scan(fixture(oversized('/books/OL456M')), { conflictLedger }), /dump-line-limit/);
  await assert.rejects(scan(fixture(oversized('/books/OL456M')), { conflictLedger }, roster.slice(1)), /invalid-dump-conflict-ledger/);
});

test('selected identity, metadata, Work linkage and duplicate guards remain after discard', async () => {
  for (const [extra, code] of [
    [{ key: '/books/OL999M' }, 'provider-identity-mismatch'],
    [{ type: { key: '/type/redirect' } }, 'provider-identity-mismatch'],
    [{ location: '/books/OL999M' }, 'provider-identity-mismatch'],
    [{ works: [{ key: '/works/OL999W' }] }, 'provider-work-link-mismatch'],
    [{ revision: 4 }, 'invalid-dump-target-envelope'],
  ]) {
    await assert.rejects(scan(fixture(oversized() + row(0, extra))), new RegExp(code));
  }
  await assert.rejects(scan(fixture(row() + oversized() + row())), /duplicate-dump-target-record/);
  const result = await scan(fixture(oversized() + row(0, { location: '/books/OL456M' })));
  assert.equal(result.stats.matchedRecords, 1);
});

test('selected failure evidence retains decoded row position and the explicit conflict policy remains narrow', async () => {
  const raw = oversized() + row(0, { location: '/books/OL999M' });
  await assert.rejects(scan(fixture(raw)), error => {
    const evidence = readDumpFailureEvidence(error);
    assert.equal(evidence.row, 2); assert.equal(evidence.expected.editionId, 'OL456M');
    return error.message === 'provider-identity-mismatch';
  });
  const conflictLedger = ledger(), result = await scan(fixture(raw), { conflictLedger });
  assert.equal(result.stats.quarantinedRecords, 1); assert.equal(result.records.size, 0);
  assert.equal(conflictLedger.has('OL123W'), true);
  await assert.rejects(scan(fixture(oversized() + row(0, { key: '/books/OL999M' })), { conflictLedger: ledger() }), /dump-conflict-fatal/);
});

test('discarded bytes and rows cannot bypass decoded, compressed, row or staging caps', async () => {
  const raw = oversized() + row();
  await assert.rejects(scan(fixture(raw, { maxDecodedBytes: 10000 })), /dump-decoded-byte-limit/);
  const exact = fixture(raw, { maxDecodedBytes: Buffer.byteLength(raw), maxRows: 2 });
  assert.equal((await scan(exact)).stats.complete, true);
  for (const bytes of [exact.bytes.length - 1, exact.bytes.length + 1])
    await assert.rejects(scan({ ...exact, source: { ...exact.source, bytes } }), /dump-file-size-mismatch/);
  await assert.rejects(scan(fixture(raw, { maxRows: 1 })), /dump-row-limit/);
  await assert.rejects(scan(fixture(oversized() + oversized(), { maxRows: 1 })), /dump-row-limit/);
  await assert.rejects(scan(fixture(raw), { retainedBytes: 1 }), /dump-staging-limit/);
});

test('full-stream integrity includes discarded bytes, gzip footer and bytes after every target', async () => {
  const f = fixture(row() + row(1) + oversized());
  for (const name of ['sha256', 'md5', 'sha1'])
    await assert.rejects(scan({ ...f, source: { ...f.source, [name]: '0'.repeat(f.source[name].length) } }), /dump-checksum-mismatch/);
  const corrupt = Buffer.from(f.bytes); corrupt[corrupt.length - 8] ^= 1;
  await assert.rejects(scan(f, {}, roster, stream(corrupt)), /incorrect data check/);
  await assert.rejects(scan(f, {}, roster, stream(f.bytes.subarray(0, -5))), /unexpected end of file/);
});

test('unterminated oversized tail fails while complete under-limit EOF keeps its original semantics', async () => {
  await assert.rejects(scan(fixture(row() + oversized(undefined, 20000, ''))), /dump-unterminated-oversized-row/);
  assert.equal((await scan(fixture(row().trimEnd()))).stats.matchedRecords, 1);
});

test('transport error, premature close, caller abort and timeout destroy the stream without a result', async () => {
  const f = fixture(oversized());
  for (const failure of ['error', 'close', 'abort', 'timeout']) {
    const controller = new AbortController(); let progress, scheduled = false, input;
    input = new Readable({ read() {
      if (scheduled) return; scheduled = true;
      this.push(f.bytes.subarray(0, -8));
      const terminate = async () => {
        if (input.destroyed) return;
        if (!progress?.oversizedUnrelatedBytes) { await setImmediate(); return terminate(); }
        if (failure === 'error') input.destroy(new Error('fixture-stream-failed'));
        if (failure === 'close') input.destroy();
        if (failure === 'abort') controller.abort();
      };
      void terminate();
    } });
    await assert.rejects(scan(f, { timeoutMs: failure === 'timeout' ? 25 : 5000, signal: controller.signal,
      observeProgress: stats => { progress = stats; } }, roster, input), error => failure === 'error'
      ? error.message === 'fixture-stream-failed' : failure === 'close'
        ? error.code === 'ERR_STREAM_PREMATURE_CLOSE' : error.name === 'AbortError');
    assert.equal(input.destroyed, true); assert.equal(progress.complete, false);
    if (failure !== 'timeout') assert.ok(progress.oversizedUnrelatedBytes > 0);
  }
});

test('standalone stalled stream stays alive until its deadline and releases the timer after rejection', () => {
  const moduleUrl = new URL('./open-library-dump-descriptions.mjs', import.meta.url).href;
  const script = `import assert from 'node:assert/strict';
    import { Readable } from 'node:stream';
    import { scanEditionFramedStream } from ${JSON.stringify(moduleUrl)};
    const input = new Readable({ read() {} });
    await assert.rejects(scanEditionFramedStream(input, ${JSON.stringify(fixture('').source)},
      ${JSON.stringify(roster)}, ${JSON.stringify(fetchedAt)}, { bytes: 0 },
      ${JSON.stringify({ ...options, timeoutMs: 25 })}), { name: 'AbortError' });
    assert.equal(input.destroyed, true);
    process.stdout.write('deadline-observed');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'deadline-observed');
});

test('explicit validated limits and unique roster are required before any stream read', async () => {
  for (const mutate of [
    f => { f.source.maxRows = 0; }, f => { f.source.maxDecodedBytes = LIMITS.decodedBytes + 1; },
    f => { f.source.url = f.source.url.replace('editions_', 'works_'); }, f => { f.source.extra = true; },
  ]) {
    const f = fixture(row()); mutate(f); let reads = 0;
    const input = new Readable({ read() { reads++; this.push(null); } });
    await assert.rejects(scan(f, {}, roster, input), /invalid-edition/); assert.equal(reads, 0); input.destroy();
  }
  for (const patch of [{ lineBytes: undefined }, { lineBytes: LIMITS.lineBytes + 1 }, { retainedBytes: undefined },
    { timeoutMs: undefined }, { timeoutMs: 6600001 }, { conflictLedger: {} }])
    await assert.rejects(scan(fixture(row()), patch), /invalid-(?:edition|dump-conflict)/);
  await assert.rejects(scan(fixture(row()), {}, [roster[0], roster[0]]), /invalid-edition/);
});

test('source and entire roster are copied before caller progress callbacks can mutate them', async () => {
  const f = fixture(oversized('/books/OL456M')), selected = structuredClone(roster);
  await assert.rejects(scan(f, { observeProgress: () => {
    selected.splice(0, selected.length); f.source.maxDecodedBytes = 1; f.source.sha256 = '0'.repeat(64);
  } }, selected), /dump-line-limit/);
});

test('historical strict, conflict and prefix entrypoints cannot enable the new framing through extra options', async () => {
  const f = fixture(oversized()), extra = { ...options, editionFraming: true, skipOversizedUnrelated: true };
  await assert.rejects(scanDumpStream(stream(f.bytes), f.source, 'editions', roster, fetchedAt, { bytes: 0 }, extra), /dump-line-limit/);
  await assert.rejects(scanDumpConflictStream(stream(f.bytes), f.source, 'editions', roster, fetchedAt, { bytes: 0 },
    { ...extra, conflictLedger: ledger() }), /dump-line-limit/);
  const limits = { ...options, compressedBytes: f.bytes.length, maxDecodedBytes: f.source.maxDecodedBytes,
    maxRows: 100, prefixBytes: 128 }; delete limits.retainedBytes;
  const diagnosis = await scanEditionLinePrefix(stream(f.bytes), { source: canonicalDumpSource(f.source), roster, fetchedAt, limits, ...extra });
  assert.equal(diagnosis.status, 'diagnosed'); assert.equal(diagnosis.code, 'dump-line-limit');
  assert.equal(diagnosis.stats.oversizedUnrelatedRows, undefined);
  const work = await scanDumpFailurePrefix(stream(f.bytes), f.source, roster, fetchedAt, { ...limits, ...extra });
  assert.equal(work.status, 'failed'); assert.equal(work.code, 'dump-line-limit');
});

test('large streamed discard keeps allocation and retained-row bounds independent of row size', async () => {
  const block = Buffer.alloc(65536, 120), blocks = 512;
  const compressed = Readable.from((function* () {
    yield header(); for (let i = 0; i < blocks; i++) yield block; yield '\n' + row();
  })()).pipe(createGzip());
  const chunks = []; for await (const chunk of compressed) chunks.push(chunk);
  const bytes = Buffer.concat(chunks), f = fixture('');
  f.bytes = bytes; f.source.bytes = bytes.length;
  for (const name of ['sha256', 'md5', 'sha1']) f.source[name] = hash(name, bytes);
  f.source.maxDecodedBytes = block.length * blocks + 4096;
  // Catch accidental whole-row accumulation independently of the reported peak.
  const concat = Buffer.concat; let peakAllocation = 0;
  Buffer.concat = (parts, length) => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    peakAllocation = Math.max(peakAllocation, total);
    assert.ok(total <= LIMITS.lineBytes * 2, 'row-sized allocation during discard');
    return concat(parts, length);
  };
  let result;
  try { result = await scan(f, { timeoutMs: 10000 }, roster, stream(bytes, 37)); }
  finally { Buffer.concat = concat; }
  assert.equal(result.stats.oversizedUnrelatedBytes, Buffer.byteLength(header()) + block.length * blocks);
  assert.equal(result.stats.oversizedUnrelatedRows, 1); assert.equal(result.stats.matchedRecords, 1);
  assert.ok(result.stats.maxBufferedLineBytes <= 512); assert.ok(peakAllocation <= LIMITS.lineBytes * 2);
});
