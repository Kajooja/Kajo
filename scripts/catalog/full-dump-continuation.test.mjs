import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_CONTRACT, acquireReviewedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { LEGACY_FAILURE_EVIDENCE_CONTRACT, FAILURE_EVIDENCE_CONTRACT } from './dump-failure-evidence.mjs';
import { WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN } from './inspect-work-dump-prefix.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { prepareFullDumpContinuationRequest, replayFullDumpContinuationCorrection } from './prepare-full-dump-continuation.mjs';
import { FAILURE_CONTRACT, MAX_PLAINTEXT_BYTES, recipientFingerprint, sealPayload, unsealPayload,
  validatePinnedAcquisitionPayload, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PURPOSE, FULL_CONTINUATION_CORRECTION_HEAD,
  FULL_CONTINUATION_PREVIOUS_REVIEWED, FULL_CONTINUATION_PREVIOUS_PREFIX, sealFullDumpContinuation,
  unsealFullDumpContinuation, validateFullDumpContinuationRequest, validateFullDumpContinuationPredecessors } from './seal-full-dump-continuation.mjs';
import { WORK_PREFIX_REQUEST_CONTRACT, WORK_PREFIX_REQUEST_PURPOSE, WORK_PREFIX_PREVIOUS_ACQUISITION,
  validateWorkPrefixRequest } from './seal-work-prefix-diagnostic.mjs';

const reviewedRequest = JSON.parse(await readFile(new URL('./fixtures/work-prefix-previous-request.json', import.meta.url), 'utf8'));
const sourceHead = 'a'.repeat(40), at = '2026-09-27T18:55:42.844Z';
const rehash = value => { const { requestSha256: _hash, ...body } = value; return { ...body, requestSha256: digest(body) }; };
const request = rehash({ ...reviewedRequest, sourceHead, contract: FULL_CONTINUATION_REQUEST_CONTRACT,
  purpose: FULL_CONTINUATION_REQUEST_PURPOSE, previousReviewedAcquisition: { ...FULL_CONTINUATION_PREVIOUS_REVIEWED },
  previousPrefixDiagnostic: { ...FULL_CONTINUATION_PREVIOUS_PREFIX }, correctionHead: FULL_CONTINUATION_CORRECTION_HEAD });
const prefixRequest = rehash({ contract: WORK_PREFIX_REQUEST_CONTRACT, purpose: WORK_PREFIX_REQUEST_PURPOSE,
  sourceHead: FULL_CONTINUATION_PREVIOUS_PREFIX.sourceHead, release: reviewedRequest.release,
  roster: structuredClone(reviewedRequest.roster), sourcePin: { ...WORK_PREFIX_SOURCE_PIN }, range: { ...WORK_PREFIX_RANGE },
  limits: { ...WORK_PREFIX_LIMITS }, previousAcquisition: { ...WORK_PREFIX_PREVIOUS_ACQUISITION },
  recipientPublicKey: reviewedRequest.recipientPublicKey, recipientFingerprint: reviewedRequest.recipientFingerprint });
const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const pair = request.roster[0];
function rowFor(record = {}) {
  const key = `/works/${pair.workId}`;
  return Buffer.from(['/type/work', key, '7', '2026-08-15T10:00:00', JSON.stringify({ key, type: { key: '/type/work' },
    location: key, revision: 7, last_modified: { value: '2026-08-15T10:00:00' }, ...record })].join('\t') + '\r');
}
function legacyEvidence(record) {
  const raw = rowFor(record);
  return { contract: LEGACY_FAILURE_EVIDENCE_CONTRACT, code: 'provider-identity-mismatch', predicate: 'record-location-present',
    sourceKind: 'works', source: prefixRequest.sourcePin, rosterSha256: digest(request.roster), expected: pair,
    row: 1, fetchedAt: at, rawBase64: raw.toString('base64'), rawBytes: raw.length, rawSha256: sha256(raw), terminated: true };
}
const replay = evidence => replayFullDumpContinuationCorrection(evidence,
  { roster: prefixRequest.roster, source: prefixRequest.sourcePin, limits: prefixRequest.limits });
async function collectedFailure() {
  let failure;
  await assert.rejects(acquireReviewedOpenLibraryDumps({ ...request, transport: async () => ({ status: 200, headers: {},
    body: Readable.from([gzipSync(Buffer.concat([rowFor({ location: null }), Buffer.from('\n')]))]) }) }), error => {
    failure = { contract: FAILURE_CONTRACT, status: 'failed', release: request.release, rosterSha256: digest(request.roster),
      limits: request.limits, code: error.message, accounting: error.accounting }; return true;
  });
  return failure;
}

test('continuation strictly freezes both consumed identities and the exact original roster, key, pins and metadata lineage', () => {
  assert.equal(validateFullDumpContinuationRequest(request), request);
  assert.equal(validateWorkPrefixRequest(prefixRequest), prefixRequest);
  assert.equal(prefixRequest.requestSha256, FULL_CONTINUATION_PREVIOUS_PREFIX.requestSha256);
  assert.equal(validateFullDumpContinuationPredecessors(request, { reviewedRequest, prefixRequest }), request);
  assert.equal(request.roster.length, 383);
  const changes = [value => { value.extra = 'private'; }, value => { value.contract = reviewedRequest.contract; },
    value => { value.purpose = 'retry'; }, value => { value.sourceHead = 'main'; }, value => { value.correctionHead = 'b'.repeat(40); },
    value => { value.roster.reverse(); }, value => { value.roster.pop(); }, value => { value.roster[0].editionId = 'OL999999999M'; },
    value => { value.roster[0].itemId = 'private'; }, value => { value.recipientPublicKey = keys.publicKey;
      value.recipientFingerprint = recipientFingerprint(keys.publicKey); }, value => { value.sourcePins.works.bytes++; },
    value => { value.sourcePins.editions.md5 = '0'.repeat(32); }, value => { value.sourceEvidence.metadataBytes++; },
    value => { value.limits.totalCompressedBytes++; }, value => { value.limits.timeoutMs--; },
    value => { value.previousAcquisition.runId = '1'; }, value => { value.previousDiagnostic.artifactZipBytes++; },
    value => { value.previousReviewedAcquisition.requestHead = 'b'.repeat(40); },
    value => { value.previousPrefixDiagnostic.plaintextSha256 = 'c'.repeat(64); },
    value => { value.previousPrefixDiagnostic.artifactZipSha256 = 'd'.repeat(64); },
    value => { value.previousPrefixDiagnostic.rowSha256 = 'e'.repeat(64); }];
  for (const change of changes) {
    const value = structuredClone(request); change(value);
    assert.throws(() => validateFullDumpContinuationRequest(rehash(value)), /(?:invalid|mismatch)/);
  }
  assert.throws(() => validateFullDumpContinuationRequest({ ...request, requestSha256: '0'.repeat(64) }), /request-hash/);
  assert.throws(() => validateReviewedAcquisitionRequest(request), /invalid-reviewed-acquisition-request/);
});

test('predecessor objects must independently match original canonical hashes and source commits', () => {
  for (const field of ['sourceHead', 'recipientFingerprint', 'requestSha256']) {
    for (const predecessor of ['reviewedRequest', 'prefixRequest']) {
      const inputs = { reviewedRequest: structuredClone(reviewedRequest), prefixRequest: structuredClone(prefixRequest) };
      inputs[predecessor][field] = 'f'.repeat(field === 'sourceHead' ? 40 : 64);
      assert.throws(() => validateFullDumpContinuationPredecessors(request, inputs), /(?:invalid|mismatch)/);
    }
  }
});

test('preparation refuses substituted ciphertext and predecessor hashes before decrypting any private key', () => {
  for (const prefixArtifact of ['{}', JSON.stringify(legacyEvidence()), 'PRIVATE substituted row']) {
    assert.throws(() => prepareFullDumpContinuationRequest({ reviewedRequest, prefixRequest, prefixArtifact,
      privatePem: 'never parsed', sourceHead }), /full-continuation-prefix-artifact-mismatch/);
  }
  const changed = rehash({ ...prefixRequest, sourceHead });
  assert.throws(() => prepareFullDumpContinuationRequest({ reviewedRequest, prefixRequest: changed, prefixArtifact: '{}', sourceHead }),
    /full-continuation-predecessor-mismatch/);
});

test('historical v1 replay accepts only exact self-location with matching outer revision and modified time', () => {
  const evidence = legacyEvidence(), before = JSON.stringify(evidence), accepted = replay(evidence);
  assert.equal(accepted.identityAccepted, true);
  assert.equal(accepted.sourceRevision, 7);
  assert.equal(accepted.rowSha256, evidence.rawSha256);
  assert.equal(JSON.stringify(evidence), before);
  for (const record of [{ location: null }, { location: '/works/OL999W' }, { type: { key: '/type/redirect' } },
    { revision: 8 }, { revision: null }, { last_modified: { value: '2026-08-15T10:00:01' } }, { last_modified: null }])
    assert.throws(() => replay(legacyEvidence(record)), /(?:correction-evidence-mismatch|invalid-dump-failure-evidence)/);
  for (const patch of [{ rawSha256: '0'.repeat(64) }, { terminated: false }, { contract: FAILURE_EVIDENCE_CONTRACT },
    { rawBytes: evidence.rawBytes + 1 }, { expected: { ...pair, editionId: 'OL1M' } }])
    assert.throws(() => replay({ ...evidence, ...patch }), /(?:correction-evidence-mismatch|invalid-dump-failure-evidence)/);
});

test('correction proof keeps description eligibility independent from valid identity', () => {
  assert.equal(replay(legacyEvidence({ description: 'See https://example.com for a complete description.' })).descriptionStatus, 'markup-or-url');
  assert.equal(replay(legacyEvidence({ description: 'A young traveller follows a winding river and uncovers the forgotten story of a village and the people who still call it home.' })).descriptionStatus, 'eligible');
  assert.equal(replay(legacyEvidence()).descriptionStatus, 'missing');
});

test('explicit pinned payload path encrypts new v2 failures with zero metadata and discards candidate records', async () => {
  const failure = await collectedFailure();
  assert.equal(failure.accounting.requests.metadata, 0);
  assert.equal(failure.accounting.requests.editions, 0);
  assert.equal(failure.accounting.failureEvidence.contract, FAILURE_EVIDENCE_CONTRACT);
  assert.equal(failure.records, undefined);
  validatePinnedAcquisitionPayload(failure, request);
  const envelope = sealFullDumpContinuation(failure, request);
  assert.equal(envelope.header.requestSha256, request.requestSha256);
  assert.equal(envelope.header.sourceHead, sourceHead);
  assert.equal(envelope.header.payloadKind, 'failure');
  assert.ok(!JSON.stringify(envelope).includes(failure.accounting.failureEvidence.rawBase64));
  const synthetic = { ...request, recipientPublicKey: keys.publicKey, recipientFingerprint: recipientFingerprint(keys.publicKey) };
  const sealed = sealPayload(failure, synthetic, validatePinnedAcquisitionPayload, MAX_PLAINTEXT_BYTES);
  assert.deepEqual(unsealPayload(sealed, synthetic, keys.privateKey, validatePinnedAcquisitionPayload,
    MAX_PLAINTEXT_BYTES, ['failure', 'collected']), failure);
  assert.throws(() => unsealFullDumpContinuation(envelope, request, keys.privateKey), /acquisition-unseal-failed/);
  for (const change of [value => { value.accounting.failureEvidence.source.md5 = '0'.repeat(32); },
    value => { value.accounting.requests.metadata = 1; }, value => { value.accounting.requests.editions = 1; },
    value => { value.accounting.sources.works.complete = true; }, value => { value.records = []; },
    value => { delete value.accounting.failureEvidence; value.accounting.diagnosticRetainedBytes = 0; },
    value => { value.accounting.failureEvidence.contract = LEGACY_FAILURE_EVIDENCE_CONTRACT;
      value.accounting.failureEvidence.predicate = 'record-location-present'; }]) {
    const invalid = structuredClone(failure); change(invalid);
    assert.throws(() => sealFullDumpContinuation(invalid, request), /invalid-/);
  }
});

test('continuation envelopes bind digest, recipient, source and roster before private-key use', async () => {
  const envelope = sealFullDumpContinuation(await collectedFailure(), request);
  for (const [field, value] of [['requestSha256', '0'.repeat(64)], ['sourceHead', '0'.repeat(40)],
    ['recipientFingerprint', '0'.repeat(64)], ['rosterSha256', '0'.repeat(64)], ['payloadKind', 'metadata-inspection']]) {
    const changed = structuredClone(envelope); changed.header[field] = value;
    assert.throws(() => unsealFullDumpContinuation(changed, request, 'never parsed'), /invalid-acquisition-envelope-binding/);
  }
  const changed = structuredClone(envelope); changed.header.extra = 'unbound';
  assert.throws(() => unsealFullDumpContinuation(changed, request, 'never parsed'), /invalid-acquisition-envelope/);
});

test('complete results require both publisher-verified source manifests and unchanged source evidence', () => {
  const result = { contract: ACQUISITION_CONTRACT, status: 'collected', release: request.release,
    rosterSha256: digest(request.roster), limits: request.limits, approved: 0, databaseWrites: 0,
    individualProviderRequests: 0, rights: 'unreviewed', records: request.roster.map(pair => ({ ...pair, work: null, edition: null })),
    sourceEvidence: request.sourceEvidence, sources: Object.fromEntries(Object.entries(request.sourcePins)
      .map(([kind, pin]) => [kind, { ...pin, complete: true, publisherChecksumsVerified: true, sha256: 'a'.repeat(64) }])),
    accounting: { requests: { metadata: 0, works: 1, editions: 1 }, metadata: { bytes: 0, complete: false, skipped: true },
      individualProviderRequests: 0, databaseWrites: 0, retainedRecordBytes: 0 } };
  assert.equal(sealFullDumpContinuation(result, request).header.payloadKind, 'collected');
  for (const change of [value => { value.sources.editions.complete = false; }, value => { value.sources.works.sha1 = '0'.repeat(40); },
    value => { delete value.sources.editions.sha256; }, value => { value.sourceEvidence = {}; },
    value => { value.records.pop(); }, value => { value.approved = 1; }, value => { value.accounting.requests.works = 0; }]) {
    const invalid = structuredClone(result); change(invalid);
    assert.throws(() => sealFullDumpContinuation(invalid, request), /invalid-/);
  }
});

test('local preparation CLI guard is exercised in isolated child environments and never creates output on failure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-full-prepare-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cli = fileURLToPath(new URL('./prepare-full-dump-continuation.mjs', import.meta.url));
  const isolated = { ...process.env }; delete isolated.GITHUB_ACTIONS;
  for (const env of [{ ...isolated, GITHUB_ACTIONS: 'true' }, isolated]) {
    const result = spawnSync(process.execPath, [cli, 'request', '--out', join(directory, 'request.json')], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), { status: 'failed', code: 'full-continuation-local-operation-failed' });
  }
  assert.deepEqual(await readdir(directory), []);
});


test('preparation rejects a different checkout even when its copied entrypoint bytes are identical', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-full-prepare-source-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scriptUrl = new URL('./prepare-full-dump-continuation.mjs', import.meta.url);
  await mkdir(join(directory, 'scripts/catalog'), { recursive: true });
  await writeFile(join(directory, 'scripts/catalog/prepare-full-dump-continuation.mjs'), await readFile(scriptUrl));
  const args = ['request', ...['reviewed-request', 'prefix-request', 'prefix-input', 'source-head', 'source-receipt',
    'key-dir', 'out'].flatMap(name => [`--${name}`, join(directory, 'must-not-read')]), '--repo', directory];
  const code = `import { runFullDumpContinuationPrepare } from ${JSON.stringify(scriptUrl.href)};
`
    + `try { await runFullDumpContinuationPrepare(${JSON.stringify(args)}); process.exitCode = 2; }
`
    + `catch (error) { process.stdout.write(error.message); }`;
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'full-continuation-source-path-mismatch');
  assert.deepEqual(await readdir(directory), ['scripts']);
});
