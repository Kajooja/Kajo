import assert from 'node:assert/strict';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_LIMITS, ACQUISITION_RELEASE, REVIEWED_ACQUISITION_LIMITS, REVIEWED_SOURCE_EVIDENCE,
  REVIEWED_SOURCE_PINS, acquireOpenLibraryDumps, acquireReviewedOpenLibraryDumps,
  validateAcquisitionMetadata } from './acquire-open-library-dumps.mjs';

const roster = [{ workId: 'OL123W', editionId: 'OL456M' }];
const request = () => ({ release: ACQUISITION_RELEASE, roster: structuredClone(roster),
  sourcePins: structuredClone(REVIEWED_SOURCE_PINS), sourceEvidence: structuredClone(REVIEWED_SOURCE_EVIDENCE),
  limits: { ...REVIEWED_ACQUISITION_LIMITS } });
const raw = ['/type/work', '/works/OL123W', '1', '2026-08-15T10:00:00.000', JSON.stringify({
  key: '/works/OL123W', type: { key: '/type/work' }, revision: 1,
  last_modified: { value: '2026-08-15T10:00:00.000' },
  description: 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.',
})].join('\t') + '\n';
const shortBody = gzipSync(raw);

test('reviewed pins have the exact independently diagnosed size while the old cap remains immutable', async () => {
  assert.equal(REVIEWED_SOURCE_PINS.works.bytes, 4058336593);
  assert.equal(REVIEWED_SOURCE_PINS.editions.bytes, 12586485055);
  assert.equal(REVIEWED_SOURCE_PINS.works.bytes + REVIEWED_SOURCE_PINS.editions.bytes, 16644821648);
  assert.equal(REVIEWED_ACQUISITION_LIMITS.totalCompressedBytes, 16644821648);
  assert.equal(ACQUISITION_LIMITS.totalCompressedBytes, 15000000000);
  assert.equal(REVIEWED_ACQUISITION_LIMITS.timeoutMs, 6600000);
  for (const key of Object.keys(ACQUISITION_LIMITS).filter(key => !['totalCompressedBytes', 'timeoutMs'].includes(key)))
    assert.equal(REVIEWED_ACQUISITION_LIMITS[key], ACQUISITION_LIMITS[key]);
  assert.ok(Object.isFrozen(REVIEWED_SOURCE_PINS.works));
  assert.ok(Object.isFrozen(REVIEWED_SOURCE_PINS.editions));
  const metadata = { metadata: { identifier: `ol_dump_${ACQUISITION_RELEASE}` },
    files: Object.values(REVIEWED_SOURCE_PINS).map(source => ({ name: source.url.split('/').at(-1),
      size: String(source.bytes), md5: source.md5, sha1: source.sha1 })) };
  assert.throws(() => validateAcquisitionMetadata(metadata, ACQUISITION_RELEASE), /acquisition-compressed-byte-limit/);
  const validated = validateAcquisitionMetadata(metadata, ACQUISITION_RELEASE, REVIEWED_ACQUISITION_LIMITS);
  assert.equal(validated.editions.bytes, REVIEWED_SOURCE_PINS.editions.bytes);
  let calls = 0;
  await assert.rejects(acquireOpenLibraryDumps({ release: ACQUISITION_RELEASE, roster,
    limits: { totalCompressedBytes: REVIEWED_ACQUISITION_LIMITS.totalCompressedBytes },
    transport: async () => { calls++; } }), /invalid-acquisition-limits/);
  assert.equal(calls, 0);
});

test('new entry rejects altered pins, evidence, release or limits before any transport request', async () => {
  let calls = 0;
  for (const change of [value => { value.release = 'latest'; },
    value => { value.sourcePins.works.bytes++; }, value => { value.sourcePins.editions.md5 = '0'.repeat(32); },
    value => { value.sourcePins.works.sha1 = '0'.repeat(40); },
    value => { value.sourcePins.works.url = value.sourcePins.editions.url; },
    value => { value.sourcePins.ratings = value.sourcePins.works; },
    value => { value.sourceEvidence.metadataSha256 = '0'.repeat(64); },
    value => { value.sourceEvidence.diagnosticRequestHead = '0'.repeat(40); },
    value => { value.limits.totalCompressedBytes++; }, value => { value.limits.timeoutMs++; },
    value => { delete value.sourcePins; }, value => { value.roster[0].itemId = 'private'; }]) {
    const input = request(); change(input);
    await assert.rejects(acquireReviewedOpenLibraryDumps({ ...input, transport: async () => { calls++; } }),
      /invalid-(?:reviewed-acquisition-input|acquisition-roster)/);
  }
  assert.equal(calls, 0);
});

test('new entry starts the pinned Work directly and refuses short EOF even after finding every requested target', async () => {
  const calls = [];
  await assert.rejects(acquireReviewedOpenLibraryDumps({ ...request(), transport: async (url, options) => {
    calls.push(url);
    assert.equal(url, REVIEWED_SOURCE_PINS.works.url);
    assert.equal(options.maxBytes, REVIEWED_SOURCE_PINS.works.bytes);
    assert.ok(options.timeoutMs > 0 && options.timeoutMs <= REVIEWED_ACQUISITION_LIMITS.timeoutMs);
    return { status: 200, headers: {}, body: Readable.from([shortBody]) };
  } }), error => {
    assert.equal(error.message, 'dump-file-size-mismatch');
    assert.deepEqual(error.sourceEvidence, REVIEWED_SOURCE_EVIDENCE);
    assert.deepEqual(error.accounting.requests, { metadata: 0, works: 1, editions: 0 });
    assert.equal(error.accounting.metadata.bytes, 0);
    assert.equal(error.accounting.metadata.skipped, true);
    assert.equal(error.accounting.sources.works.bytes, shortBody.length);
    assert.equal(error.accounting.sources.works.matchedRecords, 1);
    assert.equal(error.accounting.sources.works.complete, false);
    assert.equal(error.accounting.sources.works.expectedBytes, REVIEWED_SOURCE_PINS.works.bytes);
    assert.equal(error.accounting.sources.editions, undefined);
    return true;
  });
  assert.equal(calls.length, 1);
});

test('incorrect declared size fails before body collection and cannot trigger Edition or metadata acquisition', async () => {
  const body = new PassThrough();
  await assert.rejects(acquireReviewedOpenLibraryDumps({ ...request(), transport: async () => ({ status: 200,
    headers: { 'content-length': String(REVIEWED_SOURCE_PINS.works.bytes + 1) }, body }) }), error => {
    assert.equal(error.message, 'dump-file-size-mismatch');
    assert.deepEqual(error.accounting.requests, { metadata: 0, works: 1, editions: 0 });
    assert.equal(error.accounting.sources.works.bytes, 0);
    return true;
  });
  assert.equal(body.destroyed, true);
});

test('reviewed requests use immutable pins after validation and retain actual redirect accounting', async () => {
  const input = request(), calls = [];
  const cdn = 'https://ia600909.us.archive.org/1/items/ol_dump_2026-08-31/ol_dump_works_2026-08-31.txt.gz';
  await assert.rejects(acquireReviewedOpenLibraryDumps({ ...input, transport: async (url, options) => {
    calls.push(url);
    input.sourcePins.works.bytes = 1;
    input.limits.totalCompressedBytes = 1;
    assert.equal(options.maxBytes, REVIEWED_SOURCE_PINS.works.bytes);
    return calls.length === 1 ? { status: 302, headers: { location: cdn }, body: Readable.from([]) }
      : { status: 200, headers: {}, body: Readable.from([shortBody]) };
  } }), error => {
    assert.equal(error.message, 'dump-file-size-mismatch');
    assert.deepEqual(error.accounting.requests, { metadata: 0, works: 2, editions: 0 });
    return true;
  });
  assert.deepEqual(calls, [REVIEWED_SOURCE_PINS.works.url, cdn]);
});

test('pre-abort prevents source requests and interruption closes the current stream without retry', async () => {
  const stopped = new AbortController(); stopped.abort();
  let calls = 0;
  await assert.rejects(acquireReviewedOpenLibraryDumps({ ...request(), signal: stopped.signal,
    transport: async () => { calls++; } }), error => {
    assert.equal(error.message, 'acquisition-aborted');
    assert.deepEqual(error.accounting.requests, { metadata: 0, works: 0, editions: 0 });
    return true;
  });
  assert.equal(calls, 0);
  const controller = new AbortController(), body = new PassThrough();
  await assert.rejects(acquireReviewedOpenLibraryDumps({ ...request(), signal: controller.signal,
    transport: async () => {
      calls++;
      setImmediate(() => controller.abort());
      return { status: 200, headers: {}, body };
    } }), /acquisition-aborted/);
  assert.equal(calls, 1);
  assert.equal(body.destroyed, true);
});
