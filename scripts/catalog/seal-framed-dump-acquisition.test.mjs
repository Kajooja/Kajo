import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { acquireFramedOpenLibraryDumps, safeConflictAcquisitionError, safeFramedAcquisitionError } from './acquire-open-library-dumps.mjs';
import { validateFramedDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { MAX_PLAINTEXT_BYTES, recipientFingerprint, sealPayload, unsealPayload } from './seal-dump-acquisition.mjs';
import { validateConflictDumpAcquisitionRequest } from './seal-conflict-dump-acquisition.mjs';
import { validateEditionPrefixRequest } from './seal-edition-prefix-diagnostic.mjs';
import { constructFramedDumpAcquisitionRequest, FRAMED_CORE_SOURCE_HEAD, FRAMED_PREVIOUS_EDITION_DIAGNOSTIC,
  validateFramedDumpAcquisitionRequest, validateFramedDumpAcquisitionPredecessor, validateFramedDumpAcquisitionPayload,
  sealFramedDumpAcquisition, unsealFramedDumpAcquisition } from './seal-framed-dump-acquisition.mjs';
import { rehash } from './fixtures/edition-prefix-fixture.mjs';
import { frozenRequest, previousEditionDiagnostic, oversized, streamFixture } from './fixtures/framed-acquisition-fixture.mjs';

const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const kind = () => 'framed-acquisition-result';
const cryptContext = request => rehash({ ...request, recipientPublicKey: keys.publicKey,
  recipientFingerprint: recipientFingerprint(keys.publicKey) });
const decrypt = (envelope, request) => unsealPayload(envelope, request, keys.privateKey,
  validateFramedDumpPayload, MAX_PLAINTEXT_BYTES, ['framed-acquisition-result'], kind);

test('successor reconstructs the exact consumed Edition request and preserves all seven lineage entries and fixed budgets', () => {
  assert.equal(previousEditionDiagnostic.requestSha256, FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.requestSha256);
  assert.equal(validateFramedDumpAcquisitionRequest(frozenRequest), frozenRequest);
  assert.equal(validateFramedDumpAcquisitionPredecessor(frozenRequest, previousEditionDiagnostic), frozenRequest);
  assert.equal(frozenRequest.framingSourceHead, FRAMED_CORE_SOURCE_HEAD);
  assert.equal(frozenRequest.roster.length, 383);
  for (const field of ['roster', 'limits', 'sourcePins', 'sourceEvidence', 'conflictPolicy', 'recipientPublicKey',
    'recipientFingerprint', 'diagnosticLimits', 'previousAcquisition', 'previousDiagnostic', 'previousReviewedAcquisition',
    'previousPrefixDiagnostic', 'previousContinuation', 'previousConflict'])
    assert.deepEqual(frozenRequest[field], previousEditionDiagnostic[field]);
  assert.deepEqual(Object.keys(frozenRequest.previousEditionDiagnostic).sort(), ['requestHead', 'requestSha256', 'runId', 'sourceHead']);
  assert.equal(frozenRequest.conflictPolicy.maxConflictedPairs, 8);
  assert.equal(frozenRequest.conflictPolicy.maxDiagnosticBytes, 8 * 1024 ** 2);
  assert.equal(frozenRequest.limits.totalCompressedBytes, 16644821648);
  assert.equal(frozenRequest.limits.lineBytes, 1049600);
});

test('new request rejects widened, re-keyed, private or unknown fields even with a recomputed digest', () => {
  const mutations = [r => { r.contract = previousEditionDiagnostic.contract; }, r => { r.purpose = 'retry'; },
    r => { r.sourceHead = ['a'.repeat(40)]; }, r => { r.extra = 'PRIVATE'; }, r => { r.framingSourceHead = '0'.repeat(40); },
    r => { r.roster.reverse(); }, r => { r.roster.pop(); }, r => { r.limits.lineBytes++; }, r => { r.limits.timeoutMs++; },
    r => { r.conflictPolicy.maxConflictedPairs++; }, r => { r.conflictPolicy.maxDiagnosticBytes++; },
    r => { r.sourcePins.editions.md5 = '0'.repeat(32); }, r => { r.sourceEvidence.metadataBytes++; },
    r => { r.diagnosticLimits.prefixBytes--; }, r => { delete r.diagnosticLimits; },
    r => { r.recipientPublicKey = keys.publicKey; r.recipientFingerprint = recipientFingerprint(keys.publicKey); },
    r => { r.previousEditionDiagnostic.archiveSha256 = 'f'.repeat(64); },
    r => { r.previousEditionDiagnostic.outerHeader = 'PRIVATE'; },
    ...['previousAcquisition', 'previousDiagnostic', 'previousReviewedAcquisition', 'previousPrefixDiagnostic',
      'previousContinuation', 'previousConflict', 'previousEditionDiagnostic'].map(field => r => { r[field].requestSha256 = '0'.repeat(64); }),
    ...['runId', 'sourceHead', 'requestHead'].map(field => r => { r.previousEditionDiagnostic[field] = 'invalid'; }),
  ];
  for (const mutate of mutations) {
    const request = structuredClone(frozenRequest); mutate(request);
    assert.throws(() => validateFramedDumpAcquisitionRequest(rehash(request)));
  }
  assert.throws(() => validateFramedDumpAcquisitionRequest({ ...frozenRequest, requestSha256: '0'.repeat(64) }), /request-hash/);
});

test('predecessor validation cannot substitute another diagnostic or call historical request dispatch with a successor', () => {
  for (const previous of [rehash({ ...previousEditionDiagnostic, sourceHead: 'b'.repeat(40) }),
    rehash({ ...previousEditionDiagnostic, diagnosticLimits: { ...previousEditionDiagnostic.diagnosticLimits, maxRows: 1 } })]) {
    assert.throws(() => validateFramedDumpAcquisitionPredecessor(frozenRequest, previous), /predecessor-mismatch/);
    assert.throws(() => constructFramedDumpAcquisitionRequest({ previousEditionDiagnostic: previous, sourceHead: frozenRequest.sourceHead }));
  }
  assert.throws(() => validateEditionPrefixRequest(frozenRequest));
  assert.throws(() => validateConflictDumpAcquisitionRequest(frozenRequest));
});

test('production seal accepts a genuine bounded failure, binds the frozen recipient and checks context before private-key use', async () => {
  const result = await acquireFramedOpenLibraryDumps({ ...frozenRequest, signal: AbortSignal.abort() });
  assert.equal(validateFramedDumpAcquisitionPayload(result, frozenRequest), result);
  const sealed = sealFramedDumpAcquisition(result, frozenRequest);
  assert.equal(sealed.header.payloadKind, 'framed-acquisition-result');
  assert.equal(sealed.header.requestSha256, frozenRequest.requestSha256);
  assert.throws(() => unsealFramedDumpAcquisition(sealed, frozenRequest, keys.privateKey), /acquisition-unseal-failed/);
  assert.throws(() => unsealFramedDumpAcquisition(sealed,
    rehash({ ...frozenRequest, sourceHead: 'b'.repeat(40) }), 'never parsed'), /invalid-acquisition-envelope-binding/);
  assert.throws(() => sealFramedDumpAcquisition(result, previousEditionDiagnostic), /invalid-framed-acquisition-request/);
  assert.throws(() => unsealFramedDumpAcquisition(sealed, previousEditionDiagnostic, 'never parsed'), /invalid-framed-acquisition-request/);
});

test('generated test recipient round-trips complete and failed payloads without relaxing the production recipient', async () => {
  for (const editions of [undefined, oversized(undefined, 8192, '')]) {
    const f = streamFixture({ editions }), result = await f.run(), request = cryptContext(f.request);
    const sealed = sealPayload(result, request, validateFramedDumpPayload, MAX_PLAINTEXT_BYTES, kind);
    assert.deepEqual(decrypt(sealed, request), result);
    assert.ok(!JSON.stringify(sealed).includes('PRIVATE_DISCARDED'));
    assert.equal(sealed.header.payloadKind, 'framed-acquisition-result');
    assert.throws(() => validateFramedDumpAcquisitionRequest(request));
    assert.throws(() => unsealPayload(sealed, request, keys.privateKey, validateFramedDumpPayload,
      MAX_PLAINTEXT_BYTES, ['conflict-acquisition-result'], () => 'conflict-acquisition-result'), /invalid-acquisition-envelope/);
  }
});

test('authenticated encryption rejects forged discard counters and a changed payload kind or request binding', async () => {
  const f = streamFixture(), result = await f.run(), request = cryptContext(f.request);
  for (const mutate of [r => { r.accounting.sources.editions.oversizedUnrelatedRows++; },
    r => { r.sources.editions.oversizedUnrelatedBytes = r.accounting.sources.editions.oversizedUnrelatedBytes = 0; },
    r => { r.approved = 1; }, r => { r.records = []; }, r => { r.suppressedRecords = []; }]) {
    const forged = structuredClone(result); mutate(forged);
    const sealed = sealPayload(forged, request, () => {}, MAX_PLAINTEXT_BYTES, kind);
    assert.throws(() => decrypt(sealed, request), /acquisition-unseal-failed/);
  }
  const envelope = sealPayload(result, request, validateFramedDumpPayload, MAX_PLAINTEXT_BYTES, kind);
  for (const patch of [{ payloadKind: 'conflict-acquisition-result' }, { requestSha256: 'f'.repeat(64) },
    { sourceHead: 'f'.repeat(40) }, { plaintextSha256: 'f'.repeat(64) }, { privateCounter: 1 }]) {
    assert.throws(() => decrypt({ ...envelope, header: { ...envelope.header, ...patch } }, request),
      /(?:invalid-acquisition-envelope|acquisition-unseal-failed)/);
  }
});

test('new terminal code cannot be admitted to a historical result; opaque error strings stay opaque', () => {
  assert.equal(safeFramedAcquisitionError(new Error('dump-unterminated-oversized-row')), 'dump-unterminated-oversized-row');
  assert.equal(safeConflictAcquisitionError(new Error('dump-unterminated-oversized-row')), 'acquisition-failed');
  assert.equal(safeFramedAcquisitionError(new Error('PRIVATE arbitrary provider text')), 'acquisition-failed');
});
