import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { CONFLICT_ACQUISITION_CONTRACT, acquireConflictAwareOpenLibraryDumps, collectConflictDumpStreams } from './acquire-open-library-dumps.mjs';
import { CONFLICT_POLICY_CONTRACT } from './dump-conflict-policy.mjs';
import { digest } from './open-library-descriptions.mjs';
import { MAX_PLAINTEXT_BYTES, recipientFingerprint, sealPayload, unsealPayload,
  validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PURPOSE,
  FULL_CONTINUATION_PREVIOUS_REVIEWED, FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_CORRECTION_HEAD,
  validateFullDumpContinuationRequest } from './seal-full-dump-continuation.mjs';
import { CONFLICT_REQUEST_CONTRACT, CONFLICT_REQUEST_PURPOSE, CONFLICT_POLICY_SOURCE_HEAD, CONFLICT_PREVIOUS_CONTINUATION,
  validateConflictDumpAcquisitionRequest, validateConflictDumpAcquisitionPredecessor,
  validateConflictDumpAcquisitionPayload, sealConflictDumpAcquisition, unsealConflictDumpAcquisition } from './seal-conflict-dump-acquisition.mjs';
import { validateConflictDumpPayload } from './inspect-conflict-dump-acquisition.mjs';

// Construct only public historical request values, never private evidence.
const reviewed = JSON.parse(await readFile(new URL('./fixtures/work-prefix-previous-request.json', import.meta.url), 'utf8'));
const rehash = value => { const { requestSha256: _digest, ...body } = value; return { ...body, requestSha256: digest(body) }; };
const previous = rehash({ ...reviewed, contract: FULL_CONTINUATION_REQUEST_CONTRACT, purpose: FULL_CONTINUATION_REQUEST_PURPOSE,
  sourceHead: CONFLICT_PREVIOUS_CONTINUATION.sourceHead, previousReviewedAcquisition: FULL_CONTINUATION_PREVIOUS_REVIEWED,
  previousPrefixDiagnostic: FULL_CONTINUATION_PREVIOUS_PREFIX, correctionHead: FULL_CONTINUATION_CORRECTION_HEAD });
const request = rehash({ ...previous, contract: CONFLICT_REQUEST_CONTRACT, purpose: CONFLICT_REQUEST_PURPOSE,
  sourceHead: 'a'.repeat(40), policySourceHead: CONFLICT_POLICY_SOURCE_HEAD,
  previousContinuation: { ...CONFLICT_PREVIOUS_CONTINUATION },
  conflictPolicy: { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 1, maxDiagnosticBytes: 1049600 } });
const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const payloadKind = () => 'conflict-acquisition-result';

test('distinct request binds the exact public continuation and original roster/key/pins without new private predecessor identities', () => {
  assert.equal(validateFullDumpContinuationRequest(previous), previous);
  assert.equal(previous.requestSha256, CONFLICT_PREVIOUS_CONTINUATION.requestSha256);
  assert.equal(validateConflictDumpAcquisitionRequest(request), request);
  assert.equal(validateConflictDumpAcquisitionPredecessor(request, previous), request);
  assert.equal(request.roster.length, 383);
  assert.deepEqual(Object.keys(request.previousContinuation).sort(), ['requestHead', 'requestSha256', 'runId', 'sourceHead']);
  for (const mutate of [value => { value.extra = 'private'; }, value => { value.contract = previous.contract; },
    value => { value.purpose = 'retry'; }, value => { value.sourceHead = 'main'; },
    value => { value.sourceHead = ['a'.repeat(40)]; }, value => { value.policySourceHead = 'f'.repeat(40); },
    value => { value.previousContinuation.runId = '1'; }, value => { value.previousContinuation.requestHead = 'f'.repeat(40); },
    value => { value.previousContinuation.requestSha256 = 'f'.repeat(64); },
    value => { value.previousContinuation.sourceHead = 'f'.repeat(40); },
    value => { delete value.previousContinuation.runId; },
    value => { value.previousContinuation.artifactSha256 = 'f'.repeat(64); },
    value => { value.previousContinuation.privateReceiptSha256 = 'f'.repeat(64); },
    value => { value.roster.reverse(); }, value => { value.roster.pop(); }, value => { value.roster[0].editionId = 'OL9999999M'; },
    value => { value.roster[0].itemId = 'private'; }, value => { value.recipientPublicKey = keys.publicKey;
      value.recipientFingerprint = recipientFingerprint(keys.publicKey); },
    value => { value.sourcePins.works.bytes++; }, value => { value.sourcePins.editions.md5 = 'f'.repeat(32); },
    value => { value.sourceEvidence.metadataSha256 = 'f'.repeat(64); }, value => { value.limits.retainedBytes++; },
    value => { value.previousAcquisition.runId = '1'; }, value => { value.previousDiagnostic.runId = '1'; },
    value => { value.previousPrefixDiagnostic.requestSha256 = 'f'.repeat(64); }]) {
    const invalid = structuredClone(request); mutate(invalid);
    assert.throws(() => validateConflictDumpAcquisitionRequest(rehash(invalid)), /(?:invalid|mismatch)/);
  }
  assert.throws(() => validateConflictDumpAcquisitionRequest({ ...request, requestSha256: 'f'.repeat(64) }), /request-hash/);
});

test('schema requires explicit policy budgets but selects no operational allowance', () => {
  for (const conflictPolicy of [undefined, null, {}, { contract: CONFLICT_POLICY_CONTRACT },
    { ...request.conflictPolicy, maxConflictedPairs: 0 }, { ...request.conflictPolicy, maxConflictedPairs: 384 },
    { ...request.conflictPolicy, maxDiagnosticBytes: 0 }, { ...request.conflictPolicy, maxDiagnosticBytes: 64 * 1024 * 1024 + 1 },
    { ...request.conflictPolicy, maxConflictedPairs: 1.5 }, { ...request.conflictPolicy, terminalRowBudget: 1 }]) {
    const invalid = { ...request, conflictPolicy };
    if (conflictPolicy === undefined) delete invalid.conflictPolicy;
    assert.throws(() => validateConflictDumpAcquisitionRequest(rehash(invalid)), /invalid-/);
  }
  for (const caps of [{ maxConflictedPairs: 1, maxDiagnosticBytes: 1 },
    { maxConflictedPairs: 383, maxDiagnosticBytes: 64 * 1024 * 1024 }]) {
    const explicitlyBound = rehash({ ...request, conflictPolicy: { contract: CONFLICT_POLICY_CONTRACT, ...caps } });
    assert.equal(validateConflictDumpAcquisitionRequest(explicitlyBound), explicitlyBound);
    assert.notEqual(explicitlyBound.requestSha256, request.requestSha256);
  }
});

test('predecessor source and exact digest are independently checked and historical dispatch stays strict', () => {
  assert.throws(() => validateConflictDumpAcquisitionPredecessor(request, rehash({ ...previous, sourceHead: 'b'.repeat(40) })),
    /conflict-acquisition-predecessor-mismatch/);
  assert.throws(() => validateConflictDumpAcquisitionPredecessor(request, { ...previous, requestSha256: 'b'.repeat(64) }), /request-hash/);
  assert.throws(() => validateFullDumpContinuationRequest(request), /invalid-full-continuation-request/);
  assert.throws(() => validateReviewedAcquisitionRequest(request), /invalid-reviewed-acquisition-request/);
});


async function failedCollection({ eligibleConflict = false } = {}) {
  const pair = request.roster[0];
  const raw = JSON.stringify({ key: `/works/${pair.workId}`, type: { key: '/type/work' },
    location: eligibleConflict ? '/works/OL999999999999W' : null,
    revision: 1, last_modified: { value: '2026-08-15T10:00:00.000' },
    description: 'PRIVATE synthetic transport contents must never be printed or retained as candidates.' });
  const row = ['/type/work', `/works/${pair.workId}`, '1', '2026-08-15T10:00:00.000', raw].join('\t') + '\n';
  const calls = [];
  const result = await acquireConflictAwareOpenLibraryDumps({ ...request, transport: async url => {
    calls.push(url);
    return { status: 200, headers: {}, body: Readable.from([gzipSync(row)]) };
  } });
  assert.deepEqual(calls, [request.sourcePins.works.url]);
  assert.equal(result.status, 'failed');
  return result;
}

const cryptContext = rehash({ ...request, recipientPublicKey: keys.publicKey, recipientFingerprint: recipientFingerprint(keys.publicKey) });
const decryptSynthetic = envelope => unsealPayload(envelope, cryptContext, keys.privateKey,
  validateConflictDumpPayload, MAX_PLAINTEXT_BYTES, ['conflict-acquisition-result'], payloadKind);

test('separate seal validates actual bounded failures and never treats terminal evidence as retained', async () => {
  for (const eligibleConflict of [false, true]) {
    const result = await failedCollection({ eligibleConflict });
    assert.equal(result.code, eligibleConflict ? 'dump-file-size-mismatch' : 'dump-conflict-fatal');
    assert.equal(result.terminalFailureEvidence, null);
    assert.equal(result.records, undefined); assert.equal(result.suppressedRecords, undefined);
    assert.equal(result.quarantine.conflicts.length, eligibleConflict ? 1 : 0);
    assert.equal(validateConflictDumpAcquisitionPayload(result, request), result);
    const sealed = sealConflictDumpAcquisition(result, request);
    assert.equal(sealed.header.payloadKind, 'conflict-acquisition-result');
    assert.equal(sealed.header.requestSha256, request.requestSha256);
    assert.ok(!JSON.stringify(sealed).includes('PRIVATE'));
    if (eligibleConflict) assert.ok(!JSON.stringify(sealed).includes(result.quarantine.conflicts[0].evidence.rawBase64));
    assert.throws(() => unsealConflictDumpAcquisition(sealed, request, keys.privateKey), /acquisition-unseal-failed/);
    assert.throws(() => sealConflictDumpAcquisition(result, previous), /invalid-conflict-acquisition-request/);
    assert.throws(() => unsealConflictDumpAcquisition(sealed, previous, keys.privateKey), /invalid-conflict-acquisition-request/);
    // A generated test key exercises the shared envelope without loosening the
    // production request's frozen original recipient or carrying a private key.
    const synthetic = sealPayload(result, cryptContext, validateConflictDumpPayload, MAX_PLAINTEXT_BYTES, payloadKind);
    assert.deepEqual(decryptSynthetic(synthetic), result);
  }
});

test('policy and source changes bind new request identities before private-key use', async () => {
  const sealed = sealConflictDumpAcquisition(await failedCollection(), request);
  for (const changed of [rehash({ ...request, conflictPolicy: { ...request.conflictPolicy, maxConflictedPairs: 2 } }),
    rehash({ ...request, sourceHead: 'b'.repeat(40) })]) {
    assert.equal(validateConflictDumpAcquisitionRequest(changed), changed);
    assert.throws(() => unsealConflictDumpAcquisition(sealed, changed, 'never parsed'), /invalid-acquisition-envelope-binding/);
  }
});

test('all authenticated header fields and envelope framing reject tampering with a valid test private key', async () => {
  const result = await failedCollection(), envelope = sealPayload(result, cryptContext,
    validateConflictDumpPayload, MAX_PLAINTEXT_BYTES, payloadKind);
  for (const [name, value] of Object.entries({ contract: 'other', algorithm: 'other', payloadKind: 'collected',
    requestSha256: 'f'.repeat(64), recipientFingerprint: 'f'.repeat(64), release: '2026-09-01',
    sourceHead: 'f'.repeat(40), rosterSha256: 'f'.repeat(64), plaintextSha256: 'f'.repeat(64),
    plaintextBytes: envelope.header.plaintextBytes + 1 })) {
    const changed = structuredClone(envelope); changed.header[name] = value;
    assert.throws(() => decryptSynthetic(changed), /(?:invalid-acquisition-envelope|acquisition-unseal-failed)/);
  }
  for (const mutate of [value => { value.extra = 'unknown'; }, value => { delete value.tag; },
    value => { value.header.extra = 'unknown'; }, value => { delete value.header.sourceHead; },
    value => { value.header.plaintextBytes = MAX_PLAINTEXT_BYTES + 1; },
    value => { value.iv = '?'; }, value => { value.wrappedKey = ''; }, value => { value.tag = value.tag.slice(1); },
    value => { value.ciphertext = value.ciphertext.slice(0, -4) + 'AAAA'; }]) {
    const changed = structuredClone(envelope); mutate(changed);
    assert.throws(() => decryptSynthetic(changed), /(?:invalid-acquisition-envelope|acquisition-unseal-failed)/);
  }
});

test('authenticated ciphertext cannot hide forged payloads or candidate arrays on failure', async () => {
  const result = await failedCollection({ eligibleConflict: true });
  for (const mutate of [value => { value.records = []; }, value => { value.suppressedRecords = []; },
    value => { value.approved = 1; }, value => { value.accounting.requests.metadata = 1; },
    value => { value.terminalFailureEvidence = value.quarantine.conflicts[0].evidence; },
    value => { value.policySha256 = 'f'.repeat(64); }, value => { value.quarantine.conflicts[0].assessment.decision = 'accepted'; }]) {
    const forged = structuredClone(result); mutate(forged);
    assert.throws(() => sealConflictDumpAcquisition(forged, request));
    const encrypted = sealPayload(forged, cryptContext, () => {}, MAX_PLAINTEXT_BYTES, payloadKind);
    assert.throws(() => decryptSynthetic(encrypted), /acquisition-unseal-failed/);
  }
});


test('neutral encrypted result also replays complete sources and suppressed counterparts without making them candidates', async () => {
  const pair = request.roster[0], timestamp = '2026-08-15T10:00:00.000';
  const bodies = Object.fromEntries(['works', 'editions'].map(kind => {
    const type = kind === 'works' ? 'work' : 'edition', key = kind === 'works' ? `/works/${pair.workId}` : `/books/${pair.editionId}`;
    const raw = JSON.stringify({ key, type: { key: `/type/${type}` }, revision: 1,
      last_modified: { value: timestamp }, ...(kind === 'works' ? { location: '/works/OL999999999999W' }
        : { works: [{ key: `/works/${pair.workId}` }] }),
      description: 'A synthetic traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.' });
    return [kind, gzipSync([`/type/${type}`, key, '1', timestamp, raw].join('\t') + '\n')];
  }));
  const pins = Object.fromEntries(Object.entries(bodies).map(([kind, bytes]) => [kind, {
    ...request.sourcePins[kind], bytes: bytes.length,
    md5: createHash('md5').update(bytes).digest('hex'), sha1: createHash('sha1').update(bytes).digest('hex'),
  }]));
  const core = await collectConflictDumpStreams({ ...request, sourcePins: pins,
    openSource: async (kind, source, _options, onRequest) => {
      onRequest(); return { status: 200, url: source.url, redirects: [], headers: {}, body: Readable.from([bodies[kind]]) };
    } });
  assert.equal(core.status, 'collected');
  const result = { contract: CONFLICT_ACQUISITION_CONTRACT, ...core, sourceEvidence: request.sourceEvidence,
    approved: 0, databaseWrites: 0, individualProviderRequests: 0, modelAdmissions: 0, rights: 'unreviewed' };
  const synthetic = rehash({ ...cryptContext, sourcePins: pins });
  assert.equal(validateConflictDumpPayload(result, synthetic), result);
  assert.equal(result.records.length, 382);
  assert.equal(result.suppressedRecords.length, 1);
  assert.equal(result.suppressedRecords[0].work, null);
  assert.equal(result.suppressedRecords[0].edition.inspection.status, 'found');
  assert.equal(result.coverage.eligibleTexts, 0);
  assert.equal(result.coverage.pairedRecordsSuppressed, 1);
  const envelope = sealPayload(result, synthetic, validateConflictDumpPayload, MAX_PLAINTEXT_BYTES, payloadKind);
  assert.deepEqual(unsealPayload(envelope, synthetic, keys.privateKey, validateConflictDumpPayload,
    MAX_PLAINTEXT_BYTES, ['conflict-acquisition-result'], payloadKind), result);
  assert.throws(() => validateConflictDumpAcquisitionPayload(result, synthetic), /invalid-reviewed-acquisition-request/);
});
