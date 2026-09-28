import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { collectFramedDumpStreams, collectConflictDumpStreams, CONFLICT_ACQUISITION_CONTRACT,
  acquireFramedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { inspectFramedDumpPayload, validateFramedDumpPayload, validateConflictDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { frozenRequest, header, line, oversized, roster, snapshot, streamFixture } from './fixtures/framed-acquisition-fixture.mjs';

function failure(result, request, code) {
  assert.equal(result.status, 'failed'); assert.equal(result.code, code);
  assert.equal(result.records, undefined); assert.equal(result.suppressedRecords, undefined);
  assert.equal(result.terminalFailureEvidence, null); assert.equal(result.approved, 0);
  assert.equal(result.databaseWrites, 0); assert.equal(result.modelAdmissions, 0);
  assert.equal(validateFramedDumpPayload(result, request), result);
}

test('full two-source collection verifies both pins, keeps quarantine and replays bounded Edition accounting', async () => {
  const f = streamFixture(), result = await f.run();
  assert.deepEqual(f.calls, ['works', 'editions']); assert.equal(result.status, 'collected');
  assert.equal(validateFramedDumpPayload(result, f.request), result);
  const e = result.sources.editions;
  assert.equal(e.oversizedUnrelatedRows, 1);
  assert.equal(e.oversizedUnrelatedBytes, Buffer.byteLength(oversized()) - 1);
  assert.equal(e.decodedBytes, Buffer.byteLength(f.texts.editions));
  assert.equal(e.rows, 3); assert.equal(e.unrelatedRows, 1); assert.equal(e.malformedUnrelatedRows, 0);
  assert.ok(e.maxBufferedLineBytes <= f.request.limits.lineBytes);
  assert.equal(result.sources.works.oversizedUnrelatedRows, undefined);
  assert.equal(result.coverage.quarantinedPairs, 1); assert.equal(result.coverage.pairedRecordsSuppressed, 1);
  assert.equal(result.coverage.recordsFound, 2);
  for (const kind of ['works', 'editions']) {
    assert.equal(result.sources[kind].md5, f.request.sourcePins[kind].md5);
    assert.equal(result.sources[kind].sha1, f.request.sourcePins[kind].sha1);
    assert.equal(result.accounting.sources[kind].publisherChecksumsVerified, true);
  }
  assert.ok(!JSON.stringify(result).includes('PRIVATE_DISCARDED'));
});

test('private inspection supplies only unreconciled or freshly reconciled unapproved survivors', async () => {
  const f = streamFixture(), result = await f.run(), originalSnapshot = snapshot();
  const inspected = inspectFramedDumpPayload({ request: f.request, result, originalSnapshot });
  assert.equal(inspected.summary.provenanceVerified, false);
  assert.equal(inspected.summary.fullDumpChecksumsRecomputedLocally, false);
  assert.match(inspected.summary.framingScope, /absent from recovery/);
  assert.equal(inspected.candidates.length, 2);
  assert.ok(inspected.candidates.every(row => row.workId === roster[1].workId && row.catalogBinding === 'unreconciled'
    && row.reviewEligible === false && row.approved === false && row.rights === 'unreviewed'));
  const freshSnapshot = snapshot(new Date(Date.now() + 1000).toISOString());
  freshSnapshot.targets[1].itemUpdatedAt = freshSnapshot.checkedAt;
  const changed = inspectFramedDumpPayload({ request: f.request, result, originalSnapshot, freshSnapshot });
  assert.ok(changed.candidates.every(row => row.catalogBinding === 'changed' && row.catalogChanges.includes('itemVersionChanged')));
  assert.throws(() => inspectFramedDumpPayload({ request: f.request, result, originalSnapshot, freshSnapshot: snapshot() }), /predates/);
});

test('an Edition conflict after a discard suppresses its previously retained Work and replays the diagnostic buffer bound', async () => {
  const f = streamFixture({ works: line(0, 'works') + line(1, 'works'),
    editions: oversized() + line(0, 'editions', { location: '/books/OL999M' }) + line(1, 'editions') });
  const result = await f.run(); validateFramedDumpPayload(result, f.request);
  assert.equal(result.quarantine.conflicts[0].evidence.sourceKind, 'editions');
  assert.equal(JSON.parse(result.suppressedRecords[0].work.raw).key, '/works/OL101W');
  assert.equal(result.suppressedRecords[0].edition, null);
  result.sources.editions.maxBufferedLineBytes = result.accounting.sources.editions.maxBufferedLineBytes = 0;
  assert.throws(() => validateFramedDumpPayload(result, f.request), /framed-source-accounting/);
});

test('selected and unknown oversized Editions fail even for a pair already quarantined by Work', async () => {
  for (const row of [oversized('/books/OL201M'), oversized('/books/OL202M'), 'broken\t' + 'x'.repeat(4096) + '\n']) {
    const f = streamFixture({ editions: row }), result = await f.run();
    failure(result, f.request, 'dump-line-limit'); assert.equal(result.quarantine.conflicts.length, 1);
    assert.equal(result.accounting.sources.editions.oversizedUnrelatedBytes, 0);
    assert.deepEqual(inspectFramedDumpPayload({ request: f.request, result, originalSnapshot: snapshot() }).candidates, []);
  }
});

test('oversized Work rows remain fatal before any Edition request', async () => {
  const f = streamFixture({ works: '/type/work\t/works/OL999W\t1\t2026-08-15T00:00:00\t' + 'x'.repeat(4096) + '\n' });
  failure(await f.run(), f.request, 'dump-line-limit'); assert.deepEqual(f.calls, ['works']);
});

test('an unterminated unrelated tail is a distinct failure and retains no candidate or header', async () => {
  const f = streamFixture({ editions: oversized() + oversized(undefined, 8192, '') }), result = await f.run();
  failure(result, f.request, 'dump-unterminated-oversized-row');
  assert.equal(result.accounting.sources.editions.oversizedUnrelatedRows, 1);
  assert.equal(result.accounting.sources.editions.oversizedUnrelatedBytes, Buffer.byteLength(f.texts.editions) - 1);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_DISCARDED'));
});

test('exact row budget succeeds; a subsequent nonempty or blank row fails with honest partial counts', async () => {
  for (const tail of ['', 'next', '\n']) {
    const f = streamFixture({ works: line(1, 'works'), editions: oversized() + tail, limits: { maxRows: 1 } });
    const result = await f.run();
    if (!tail) { assert.equal(result.status, 'collected'); validateFramedDumpPayload(result, f.request); }
    else { failure(result, f.request, 'dump-row-limit'); assert.equal(result.accounting.sources.editions.rows, tail === '\n' ? 2 : 1); }
  }
});

test('decode, retention and exclusion ceilings remain shared across full-source processing', async () => {
  for (const options of [
    { limits: { maxDecodedBytes: 1024 }, code: 'dump-decoded-byte-limit' },
    { limits: { retainedBytes: 800 }, code: 'dump-staging-limit' },
    { works: line(0, 'works', { location: '/works/OL999W' }) + line(1, 'works', { location: '/works/OL999W' }), code: 'dump-conflict-pair-limit' },
  ]) {
    const f = streamFixture(options); failure(await f.run(), f.request, options.code);
  }
});

test('full checksums and EOF still fail after a completed discard, with all candidates removed', async () => {
  for (const kind of ['works', 'editions']) {
    const f = streamFixture(); f.request.sourcePins[kind].md5 = '0'.repeat(32);
    const result = await f.run(); failure(result, f.request, 'dump-checksum-mismatch');
    assert.equal(f.calls.includes('editions'), kind === 'editions');
  }
  const f = streamFixture();
  failure(await f.run({ openSource: async (kind, source, options, onRequest) => {
    if (kind === 'works') return f.openSource(kind, source, options, onRequest);
    onRequest(); return { status: 200, headers: {}, url: source.url, redirects: [], body: Readable.from([f.bytes[kind].subarray(0, -8)]) };
  } }), f.request, 'acquisition-failed');
});

test('payload replay rejects missing, impossible or mismatched discard counters and forged rights', async () => {
  const f = streamFixture(), original = await f.run();
  for (const mutate of [
    r => { delete r.accounting.sources.editions.oversizedUnrelatedRows; },
    r => { r.sources.editions.oversizedUnrelatedRows++; },
    r => { r.accounting.sources.works.oversizedUnrelatedRows = 0; },
    r => { r.sources.editions.oversizedUnrelatedRows = r.accounting.sources.editions.oversizedUnrelatedRows = 2; },
    r => { r.sources.editions.oversizedUnrelatedBytes = r.accounting.sources.editions.oversizedUnrelatedBytes = 1; },
    r => { r.sources.editions.oversizedUnrelatedBytes = r.accounting.sources.editions.oversizedUnrelatedBytes = r.sources.editions.decodedBytes; },
    r => { r.sources.editions.maxBufferedLineBytes = r.accounting.sources.editions.maxBufferedLineBytes = f.request.limits.lineBytes + 1; },
    r => { r.sources.editions.maxBufferedLineBytes = r.accounting.sources.editions.maxBufferedLineBytes = 0; },
    r => { r.sources.editions.malformedUnrelatedRows = r.accounting.sources.editions.malformedUnrelatedRows = 1; },
    r => { r.sources.editions.oversizedUnrelatedRows = r.accounting.sources.editions.oversizedUnrelatedRows = 0; },
    r => { r.records.push(r.suppressedRecords[0]); },
    r => { r.rights = 'approved'; }, r => { r.modelAdmissions = 1; },
  ]) {
    const result = structuredClone(original); mutate(result);
    assert.throws(() => validateFramedDumpPayload(result, f.request));
  }
});

test('failure replay refuses candidates and forged unterminated or row-limit reasons', async () => {
  const f = streamFixture({ editions: oversized('/books/OL201M') }), original = await f.run();
  for (const mutate of [r => { r.records = []; }, r => { r.terminalFailureEvidence = {}; },
    r => { r.code = 'dump-unterminated-oversized-row'; }, r => { r.code = 'dump-row-limit'; },
    r => { r.accounting.sources.editions.oversizedUnrelatedBytes = r.accounting.sources.editions.decodedBytes + 1; }]) {
    const changed = structuredClone(original); mutate(changed);
    assert.throws(() => validateFramedDumpPayload(changed, f.request));
  }
});

test('old entrypoints and validators cannot opt into new behavior through extra options', async () => {
  const f = streamFixture(), old = await f.run({ editionFraming: true, framed: true }, collectConflictDumpStreams);
  old.contract = CONFLICT_ACQUISITION_CONTRACT;
  assert.equal(old.code, 'dump-line-limit'); assert.equal(old.accounting.sources.editions.oversizedUnrelatedRows, undefined);
  assert.equal(validateConflictDumpPayload(old, f.request, true), old);
  assert.throws(() => validateFramedDumpPayload(old, f.request));
  const framed = await f.run(); assert.throws(() => validateConflictDumpPayload(framed, f.request));
  framed.contract = CONFLICT_ACQUISITION_CONTRACT;
  assert.throws(() => validateConflictDumpPayload(framed, f.request));
});

test('all-zero new Edition counters replay when its opener fails before a response', async () => {
  const f = streamFixture(), result = await f.run({ openSource: async (kind, source, options, onRequest) => {
    if (kind === 'works') return f.openSource(kind, source, options, onRequest);
    throw new Error('dump-unterminated-oversized-row');
  } });
  failure(result, f.request, 'acquisition-transport-failed');
  assert.equal(result.accounting.sources.editions.oversizedUnrelatedBytes, 0);
  assert.equal(result.accounting.requests.editions, 0);
});

test('aborted and invalid requests open nothing; production wrapper preserves exact fixed pins and roster', async () => {
  const f = streamFixture();
  failure(await f.run({ signal: AbortSignal.abort() }), f.request, 'acquisition-aborted'); assert.deepEqual(f.calls, []);
  let calls = 0;
  for (const patch of [{ roster }, { limits: f.request.limits }, { sourcePins: f.request.sourcePins }]) {
    await assert.rejects(acquireFramedOpenLibraryDumps({ ...frozenRequest, ...patch, transport: async () => { calls++; } }), /invalid-framed/);
  }
  const production = await acquireFramedOpenLibraryDumps({ ...frozenRequest, signal: AbortSignal.abort(), transport: async () => { calls++; } });
  failure(production, frozenRequest, 'acquisition-aborted'); assert.equal(calls, 0);
  await assert.rejects(collectFramedDumpStreams({ ...f.request, openSource: undefined }), /invalid-framed/);
});

test('one cumulative timeout covers both openers and closes a late Edition body without changing returned accounting', async () => {
  const f = streamFixture({ limits: { timeoutMs: 1000 } }); let resolveLate, countLate, remaining;
  const result = await f.run({ openSource: async (kind, source, options, onRequest) => {
    if (kind === 'works') { await delay(30); return f.openSource(kind, source, options, onRequest); }
    remaining = options.timeoutMs; onRequest(); countLate = onRequest;
    return new Promise(resolve => { resolveLate = resolve; });
  } });
  failure(result, f.request, 'acquisition-aborted'); assert.ok(remaining < f.request.limits.timeoutMs);
  const saved = JSON.stringify(result), body = new PassThrough();
  assert.throws(() => countLate(), /acquisition-invalid-response/);
  resolveLate({ body }); await delay(0); assert.equal(body.destroyed, true);
  assert.equal(JSON.stringify(result), saved); assert.equal(result.accounting.requests.editions, 1);
});

test('pending Work stream or opener cannot make a fresh process exit before its bounded failure receipt', () => {
  const fixtureUrl = new URL('./fixtures/framed-acquisition-fixture.mjs', import.meta.url).href;
  for (const mode of ['opener', 'stream']) {
    const code = `import { PassThrough } from 'node:stream';
import { streamFixture } from ${JSON.stringify(fixtureUrl)};
const f=streamFixture({limits:{timeoutMs:40}});
const r=await f.run({openSource:async(k,s,o,count)=>{count();
return ${mode === 'opener' ? 'new Promise(()=>{})' : '{status:200,headers:{},url:s.url,redirects:[],body:new PassThrough()}'};}});
if(r.code!=='acquisition-aborted')throw Error('wrong outcome');
process.stdout.write('bounded-failure');`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, 'bounded-failure');
  }
});

test('split headers, CRLF and multiple oversized unrelated rows preserve exact complete accounting', async () => {
  const text = oversized(undefined, 4096, '\r\n') + header('/books/OL999998M') + 'x'.repeat(4096) + '\n' + line(1, 'editions');
  const f = streamFixture({ editions: text, chunkSize: 1 }), result = await f.run();
  validateFramedDumpPayload(result, f.request);
  assert.equal(result.sources.editions.oversizedUnrelatedRows, 2);
  assert.equal(result.sources.editions.oversizedUnrelatedBytes, Buffer.byteLength(text) - Buffer.byteLength(line(1, 'editions')) - 2);
});
