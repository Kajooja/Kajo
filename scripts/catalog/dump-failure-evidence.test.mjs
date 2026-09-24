import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_LIMITS, ACQUISITION_RELEASE, REVIEWED_ACQUISITION_LIMITS, REVIEWED_SOURCE_EVIDENCE,
  REVIEWED_SOURCE_PINS, acquireOpenLibraryDumps, acquireReviewedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { FAILURE_EVIDENCE_LIMITS, canonicalDumpSource, validateDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { digest, inspectRecord, providerIdentityFailure, sha256 } from './open-library-descriptions.mjs';
import { LIMITS, readDumpFailureEvidence, scanDumpStream } from './open-library-dump-descriptions.mjs';

const release = ACQUISITION_RELEASE, at = '2026-09-24T13:11:33.173Z', modifiedAt = '2026-08-15T10:00:00.000';
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }, { workId: 'OL789W', editionId: 'OL790M' }];
const description = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const key = (kind, expected) => kind === 'works' ? `/works/${expected.workId}` : `/books/${expected.editionId}`;
function record(kind = 'works', expected = roster[0]) {
  return { key: key(kind, expected), type: { key: kind === 'works' ? '/type/work' : '/type/edition' },
    revision: 1, last_modified: { value: modifiedAt }, description,
    ...(kind === 'editions' ? { works: [{ key: `/works/${expected.workId}` }] } : {}) };
}
function row(value, { kind = 'works', expected = roster[0], ending = '\n', outer = {} } = {}) {
  return Buffer.from([outer.type ?? (kind === 'works' ? '/type/work' : '/type/edition'), outer.key ?? key(kind, expected),
    outer.revision ?? '1', outer.modifiedAt ?? modifiedAt, JSON.stringify(value)].join('\t') + ending);
}
function source(bytes, kind = 'works') {
  return { url: `https://archive.org/download/ol_dump_${release}/ol_dump_${kind}_${release}.txt.gz`,
    bytes: bytes.length, md5: hash('md5', bytes), sha1: hash('sha1', bytes), compression: 'gzip',
    maxDecodedBytes: 4 * 1024 ** 2, maxRows: 100 };
}
async function scan(bytes, { kind = 'works', selected = roster, lineBytes = LIMITS.lineBytes, chunkBytes = 17 } = {}) {
  const compressed = gzipSync(bytes), pin = source(compressed, kind), budget = { bytes: 0 };
  let stats, result, error;
  const chunks = Array.from({ length: Math.ceil(compressed.length / chunkBytes) }, (_, i) => compressed.subarray(i * chunkBytes, (i + 1) * chunkBytes));
  try { result = await scanDumpStream(Readable.from(chunks), pin, kind, selected, at, budget,
    { lineBytes, keyOf: candidate => candidate.workId, observeProgress: value => { stats = value; } }); }
  catch (failure) { error = failure; }
  return { result, error, evidence: error && readDumpFailureEvidence(error), stats, budget, pin,
    validate: evidence => validateDumpFailureEvidence(evidence, { roster: selected, source: pin, limits: { lineBytes, maxRows: pin.maxRows } }) };
}

test('ordered private predicates preserve the exact preexisting identity rejection, including location:null', () => {
  const good = record();
  for (const [value, predicate] of [[null, 'record-not-object'], [[], 'record-not-object'], [1, 'record-not-object'],
    [{ ...good, key: '/works/OL999W', type: null, location: null }, 'record-key-mismatch'],
    [{ ...good, type: { key: '/type/redirect' }, location: null }, 'record-type-mismatch'],
    [{ ...good, location: null }, 'record-location-present']]) {
    assert.equal(providerIdentityFailure(value, roster[0], 'work'), predicate);
    assert.throws(() => inspectRecord(JSON.stringify(value), roster[0], 'work', at), error => {
      assert.equal(error.message, 'provider-identity-mismatch');
      assert.equal(error.identityPredicate, predicate);
      assert.deepEqual(Object.keys(error), []);
      return true;
    });
  }
  assert.equal(providerIdentityFailure(good, roster[0], 'work'), null);
  assert.equal(inspectRecord(JSON.stringify(good), roster[0], 'work', at).status, 'found');
});

test('each rejected selected identity is reproducible with exact source and roster binding', async () => {
  for (const value of [null, { ...record(), key: '/works/OL999W' }, { ...record(), type: null }, { ...record(), location: null }]) {
    const f = await scan(row(value));
    assert.equal(f.error.message, 'provider-identity-mismatch');
    assert.equal(f.evidence.predicate, providerIdentityFailure(value, roster[0], 'work'));
    assert.equal(f.validate(f.evidence), f.evidence);
    assert.deepEqual(f.evidence.source, canonicalDumpSource(f.pin));
    assert.equal(f.evidence.rosterSha256, digest(roster));
    assert.equal(f.stats.rows, 1);
    assert.equal(f.stats.matchedRecords, 0);
    assert.equal(f.budget.bytes, 0);
    assert.equal(f.result, undefined);
  }
});

test('LF, CRLF and final EOF framing roundtrip exact original selected-row bytes across stream chunks', async () => {
  for (const ending of ['\n', '\r\n', '', '\r']) {
    const original = row({ ...record(), description: 'ää 🌲 \\n', location: null }, { ending });
    const f = await scan(original, { chunkBytes: 1 });
    const terminated = ending.endsWith('\n');
    assert.equal(f.evidence.terminated, terminated);
    const raw = Buffer.from(f.evidence.rawBase64, 'base64');
    assert.deepEqual(Buffer.concat([raw, ...(terminated ? [Buffer.from('\n')] : [])]), original);
    assert.equal(f.evidence.rawSha256, sha256(raw));
    assert.equal(f.evidence.rawBytes, original.length - Number(terminated));
    assert.equal(f.validate(f.evidence), f.evidence);
  }
});

test('one offending row excludes prior selected records, unrelated rows and private snapshot bindings', async () => {
  const good = row(record()), unrelated = Buffer.from('unrelated secret line\n');
  const bad = row({ ...record('works', roster[1]), location: null }, { expected: roster[1] });
  const f = await scan(Buffer.concat([good, unrelated, bad, row(record())]),
    { selected: roster.map((expected, i) => ({ ...expected, itemId: `private-item-${i}`, sourceId: `private-source-${i}` })) });
  assert.equal(f.evidence.row, 3);
  assert.equal(f.stats.rows, 3);
  assert.equal(f.stats.matchedRecords, 1);
  assert.equal(f.stats.unrelatedRows, 1);
  assert.equal(f.budget.bytes, Buffer.byteLength(JSON.stringify(record())));
  assert.deepEqual(Buffer.from(f.evidence.rawBase64, 'base64'), bad.subarray(0, -1));
  assert.equal(f.evidence.rosterSha256, digest(roster));
  assert.ok(!JSON.stringify(f.evidence).includes('private-'));
  assert.equal(f.validate(f.evidence), f.evidence);
});

test('Edition identity failures retain the selected Work/Edition pair without entering Work-link validation', async () => {
  const bad = { ...record('editions'), type: { key: '/type/work' }, works: [] };
  const f = await scan(row(bad, { kind: 'editions' }), { kind: 'editions' });
  assert.equal(f.evidence.sourceKind, 'editions');
  assert.equal(f.evidence.predicate, 'record-type-mismatch');
  assert.deepEqual(f.evidence.expected, roster[0]);
  assert.equal(f.validate(f.evidence), f.evidence);
});

test('unrelated, malformed, duplicate, over-limit and nonidentity failures never acquire selected-row evidence', async () => {
  const bad = { ...record(), location: null };
  const cases = [
    [row(bad, { outer: { type: '/type/edition' } }), {}, 'invalid-dump-target-envelope'],
    [row(bad, { outer: { revision: '0' } }), {}, 'invalid-dump-target-envelope'],
    [row(bad, { outer: { modifiedAt: 'invalid' } }), {}, 'invalid-dump-target-envelope'],
    [Buffer.from('/type/work\t/works/OL123W\t1\t' + modifiedAt + '\t{bad\n'), {}, 'malformed-provider-json'],
    [Buffer.concat([row(record()), row(bad)]), {}, 'duplicate-dump-target-record'],
    [row({ ...bad, description: 'x'.repeat(1048576) }), {}, 'record-too-large'],
    [row(bad), { lineBytes: 32 }, 'dump-line-limit'],
    [row({ ...record('editions'), works: [] }, { kind: 'editions' }), { kind: 'editions' }, 'provider-work-link-mismatch'],
  ];
  for (const [bytes, options, code] of cases) {
    const f = await scan(bytes, options);
    assert.equal(f.error.message, code);
    assert.equal(f.evidence, undefined);
  }
  const unrelated = await scan(row(bad, { outer: { key: '/works/OL999W' } }));
  assert.equal(unrelated.error, undefined);
  assert.equal(unrelated.result.stats.complete, true);
  assert.equal(unrelated.result.records.size, 0);
});

test('existing raw-line bound is inclusive; neither evidence nor base64 decode can broaden it', async () => {
  const original = row({ ...record(), location: null }, { ending: '\r\n' });
  const size = original.length - 1;
  const accepted = await scan(original, { lineBytes: size });
  assert.equal(accepted.evidence.rawBytes, size);
  assert.equal(accepted.validate(accepted.evidence), accepted.evidence);
  const rejected = await scan(original, { lineBytes: size - 1 });
  assert.equal(rejected.error.message, 'dump-line-limit');
  assert.equal(rejected.evidence, undefined);
  assert.equal(FAILURE_EVIDENCE_LIMITS.lineBytes, 1049600);
  const tooLarge = { ...accepted.evidence, rawBytes: 1049601, rawBase64: 'A'.repeat(4 * Math.ceil(1049601 / 3)) };
  assert.throws(() => accepted.validate(tooLarge), /invalid-dump-failure-evidence/);
});

test('actual 1 MiB provider JSON and 1,049,600-byte CRLF row remain bounded and recoverable', async () => {
  const bad = { ...record(), title: 'ää 🌲', description: '', location: null };
  bad.description = 'x'.repeat(1048576 - Buffer.byteLength(JSON.stringify(bad)));
  assert.equal(Buffer.byteLength(JSON.stringify(bad)), 1048576);
  const original = row(bad, { ending: '\r\n' });
  // Legal fractional-second zeros fill the outer envelope to its existing cap;
  // identity failure still precedes inner/outer modification-time comparison.
  const padding = LIMITS.lineBytes - (original.length - 1);
  const outer = { modifiedAt: modifiedAt + '0'.repeat(padding) };
  const maximum = row(bad, { ending: '\r\n', outer });
  assert.equal(maximum.length - 1, 1049600);
  const f = await scan(maximum);
  assert.equal(f.error.message, 'provider-identity-mismatch');
  assert.equal(f.evidence.rawBytes, LIMITS.lineBytes);
  assert.equal(f.validate(f.evidence), f.evidence);
  assert.deepEqual(Buffer.from(f.evidence.rawBase64, 'base64'), maximum.subarray(0, -1));
  const rejected = await scan(row(bad, { ending: '\r\n', outer: { modifiedAt: outer.modifiedAt + '0' } }));
  assert.equal(rejected.error.message, 'dump-line-limit');
  assert.equal(rejected.evidence, undefined);
});

test('recovery rejects altered shape, predicate, identities, source pins, row, bounds, UTF8, bytes or outer envelope', async () => {
  const f = await scan(row({ ...record(), location: null }));
  const alterRaw = (value, bytes) => Object.assign(value, { rawBase64: bytes.toString('base64'), rawBytes: bytes.length, rawSha256: sha256(bytes) });
  for (const change of [
    value => { value.extra = 'private'; }, value => { delete value.terminated; }, value => { value.terminated = 'true'; },
    value => { value.code = 'other'; }, value => { value.predicate = 'record-key-mismatch'; },
    value => { value.predicate = 'provider supplied text'; }, value => { value.sourceKind = 'editions'; },
    value => { value.expected = roster[1]; }, value => { value.expected.itemId = 'private'; },
    value => { value.rosterSha256 = '0'.repeat(64); }, value => { value.source.md5 = '0'.repeat(32); },
    value => { value.source.url += '?different'; }, value => { value.source.complete = true; },
    value => { value.row = 0; }, value => { value.row = 0.5; }, value => { value.row = 101; },
    value => { value.fetchedAt = 'invalid'; }, value => { value.rawBytes++; }, value => { value.rawSha256 = '0'.repeat(64); },
    value => { value.rawBase64 += '\n'; }, value => { value.rawBase64 = value.rawBase64.replace(/=+$/, ''); },
    value => { alterRaw(value, Buffer.from([255])); }, value => { alterRaw(value, Buffer.from(value.rawBase64, 'base64').subarray(0, -1)); },
    value => { alterRaw(value, row({ ...record(), location: null })); },
    value => { alterRaw(value, row({ ...record(), location: null }, { ending: '', outer: { type: '/type/edition' } })); },
    value => { alterRaw(value, row(record(), { ending: '' })); },
    value => { alterRaw(value, row({ ...record(), key: '/works/OL999W' }, { ending: '' })); },
  ]) {
    const value = structuredClone(f.evidence); change(value);
    assert.throws(() => f.validate(value), /invalid-dump-failure-evidence/);
  }
  assert.throws(() => validateDumpFailureEvidence(f.evidence, { roster: [roster[0]], source: f.pin, limits: ACQUISITION_LIMITS }), /invalid-dump-failure-evidence/);
  assert.throws(() => validateDumpFailureEvidence(f.evidence, { roster, limits: ACQUISITION_LIMITS }), /invalid-dump-failure-evidence/);
  assert.equal(validateDumpFailureEvidence(undefined), null);
  assert.throws(() => validateDumpFailureEvidence(null), /invalid-dump-failure-evidence/);
});

test('reviewed collector forwards only the branded failure row, never complete hashes, candidates or further requests', async () => {
  const good = row(record()), bad = row({ ...record('works', roster[1]), location: null }, { expected: roster[1] });
  const body = gzipSync(Buffer.concat([good, bad])), calls = [];
  await assert.rejects(acquireReviewedOpenLibraryDumps({ release, roster, sourcePins: REVIEWED_SOURCE_PINS,
    sourceEvidence: REVIEWED_SOURCE_EVIDENCE, limits: REVIEWED_ACQUISITION_LIMITS,
    transport: async url => { calls.push(url); return { status: 200, headers: {}, body: Readable.from([body]) }; } }), error => {
    assert.equal(error.message, 'provider-identity-mismatch');
    const accounting = error.accounting, evidence = accounting.failureEvidence;
    assert.equal(validateDumpFailureEvidence(evidence, { roster, source: REVIEWED_SOURCE_PINS.works, limits: REVIEWED_ACQUISITION_LIMITS }), evidence);
    assert.equal(accounting.diagnosticRetainedBytes, bad.length - 1);
    assert.equal(accounting.retainedRecordBytes, Buffer.byteLength(JSON.stringify(record())));
    assert.equal(accounting.sources.works.matchedRecords, 1);
    assert.equal(accounting.sources.works.rows, 2);
    assert.equal(accounting.sources.works.complete, false);
    assert.equal(accounting.sources.works.sha256, undefined);
    assert.equal(accounting.sources.works.publisherChecksumsVerified, undefined);
    assert.deepEqual(accounting.requests, { metadata: 0, works: 1, editions: 0 });
    assert.equal(error.records, undefined);
    return true;
  });
  assert.deepEqual(calls, [REVIEWED_SOURCE_PINS.works.url]);
});

test('original collector preserves metadata source binding and complete prior source separately from an Edition failure', async () => {
  const bytes = { works: gzipSync(row(record())), editions: gzipSync(row({ ...record('editions'), location: null }, { kind: 'editions' })) };
  const document = { metadata: { identifier: `ol_dump_${release}` }, files: Object.entries(bytes).map(([kind, data]) => ({
    name: `ol_dump_${kind}_${release}.txt.gz`, size: String(data.length), md5: hash('md5', data), sha1: hash('sha1', data) })) };
  await assert.rejects(acquireOpenLibraryDumps({ release, roster, transport: async url => ({ status: 200, headers: {},
    body: Readable.from([url.includes('/metadata/') ? Buffer.from(JSON.stringify(document)) : bytes[url.includes('_works_') ? 'works' : 'editions']]) }) }), error => {
    assert.equal(error.message, 'provider-identity-mismatch');
    assert.equal(error.accounting.sources.works.complete, true);
    assert.equal(error.accounting.sources.editions.complete, false);
    assert.equal(error.accounting.failureEvidence.sourceKind, 'editions');
    assert.equal(validateDumpFailureEvidence(error.accounting.failureEvidence, { roster, source: source(bytes.editions, 'editions'), limits: ACQUISITION_LIMITS }), error.accounting.failureEvidence);
    assert.deepEqual(error.accounting.requests, { metadata: 1, works: 1, editions: 1 });
    assert.equal(error.records, undefined);
    return true;
  });
});

test('transport exceptions cannot forge a selected-row receipt through arbitrary error properties', async () => {
  const f = await scan(row({ ...record(), location: null }));
  const forged = new Error('provider-identity-mismatch');
  forged.failureEvidence = f.evidence;
  forged.identityPredicate = f.evidence.predicate;
  forged.accounting = { failureEvidence: f.evidence };
  assert.equal(readDumpFailureEvidence(forged), undefined);
  for (const mode of ['open', 'stream']) {
    await assert.rejects(acquireReviewedOpenLibraryDumps({ release, roster, sourcePins: REVIEWED_SOURCE_PINS,
      sourceEvidence: REVIEWED_SOURCE_EVIDENCE, limits: REVIEWED_ACQUISITION_LIMITS,
      transport: async () => {
        if (mode === 'open') throw forged;
        return { status: 200, headers: {}, body: Readable.from((async function* () { throw forged; })()) };
      } }), error => {
      assert.equal(error.accounting.failureEvidence, undefined);
      assert.equal(error.accounting.diagnosticRetainedBytes, undefined);
      return true;
    });
  }
});
