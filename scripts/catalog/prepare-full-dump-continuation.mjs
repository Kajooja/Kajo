#!/usr/bin/env node
// Authenticate consumed private evidence locally before preparing a distinct
// request. Recovery belongs to the provenance-checking offline inspector.
import { realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { verifyFullContinuationSource } from './inspect-full-dump-continuation.mjs';
import { LEGACY_FAILURE_EVIDENCE_CONTRACT, validateDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { digest, inspectRecord, requireValue, sha256 } from './open-library-descriptions.mjs';
import { readLocalFile } from './prepare-dump-acquisition-request.mjs';
import { FULL_CONTINUATION_CORRECTION_HEAD, FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_PREVIOUS_REVIEWED,
  FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PURPOSE,
  validateFullDumpContinuationPredecessors } from './seal-full-dump-continuation.mjs';
import { validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_MAX_PLAINTEXT_BYTES, unsealWorkPrefixDiagnostic, validateWorkPrefixRequest } from './seal-work-prefix-diagnostic.mjs';

// Replay the versioned historical failure first, then independently apply the
// live guard. A passing identity never grants approval to description text.
export function replayFullDumpContinuationCorrection(evidence, context) {
  validateDumpFailureEvidence(evidence, context);
  requireValue(evidence?.contract === LEGACY_FAILURE_EVIDENCE_CONTRACT
    && evidence.predicate === 'record-location-present' && evidence.sourceKind === 'works'
    && evidence.terminated === true, 'full-continuation-correction-evidence-mismatch');
  const bytes = Buffer.from(evidence.rawBase64, 'base64');
  const line = new TextDecoder('utf-8', { fatal: true }).decode(bytes.at(-1) === 13 ? bytes.subarray(0, -1) : bytes);
  const fields = []; let start = 0;
  for (let i = 0; i < 4; i++) {
    const end = line.indexOf('\t', start);
    requireValue(end !== -1, 'full-continuation-correction-evidence-mismatch');
    fields.push(line.slice(start, end)); start = end + 1;
  }
  const raw = line.slice(start), record = JSON.parse(raw), key = `/works/${evidence.expected.workId}`;
  requireValue(fields[0] === '/type/work' && fields[1] === key && record.key === key
    && record.type?.key === '/type/work' && record.location === key
    && String(record.revision) === fields[2] && record.last_modified?.value === fields[3],
  'full-continuation-correction-evidence-mismatch');
  const inspected = inspectRecord(raw, evidence.expected, 'work', evidence.fetchedAt);
  requireValue(inspected.status === 'found' && inspected.sourceRevision === Number(fields[2])
    && inspected.sourceModifiedAt === fields[3], 'full-continuation-correction-evidence-mismatch');
  return { rowSha256: evidence.rawSha256, rawRecordSha256: inspected.recordSha256,
    sourceRevision: inspected.sourceRevision, sourceModifiedAt: inspected.sourceModifiedAt,
    identityAccepted: true, descriptionStatus: inspected.description.status };
}

export function prepareFullDumpContinuationRequest({ reviewedRequest, prefixRequest, prefixArtifact, privatePem, sourceHead }) {
  validateReviewedAcquisitionRequest(reviewedRequest);
  validateWorkPrefixRequest(prefixRequest);
  const { contract: _contract, purpose: _purpose, sourceHead: _source, requestSha256: _hash, ...retained } = reviewedRequest;
  const body = { contract: FULL_CONTINUATION_REQUEST_CONTRACT, purpose: FULL_CONTINUATION_REQUEST_PURPOSE,
    ...structuredClone(retained), sourceHead, previousReviewedAcquisition: { ...FULL_CONTINUATION_PREVIOUS_REVIEWED },
    previousPrefixDiagnostic: { ...FULL_CONTINUATION_PREVIOUS_PREFIX }, correctionHead: FULL_CONTINUATION_CORRECTION_HEAD };
  const request = validateFullDumpContinuationPredecessors({ ...body, requestSha256: digest(body) }, { reviewedRequest, prefixRequest });
  requireValue(typeof prefixArtifact === 'string' && sha256(prefixArtifact) === FULL_CONTINUATION_PREVIOUS_PREFIX.sealedArtifactSha256,
    'full-continuation-prefix-artifact-mismatch');
  const envelope = JSON.parse(prefixArtifact);
  requireValue(envelope.header?.plaintextSha256 === FULL_CONTINUATION_PREVIOUS_PREFIX.plaintextSha256,
    'full-continuation-prefix-plaintext-mismatch');
  const diagnostic = unsealWorkPrefixDiagnostic(envelope, prefixRequest, privatePem), evidence = diagnostic.failureEvidence;
  requireValue(diagnostic.status === 'diagnosed' && diagnostic.code === 'provider-identity-mismatch'
    && diagnostic.retrievedAt === '2026-09-27T18:55:42.844Z' && diagnostic.completedAt === '2026-09-27T18:55:52.033Z'
    && evidence?.rawSha256 === FULL_CONTINUATION_PREVIOUS_PREFIX.rowSha256 && evidence.rawBytes === 5234
    && evidence.row === 804172 && evidence.expected.workId === 'OL82565W' && evidence.expected.editionId === 'OL59004684M',
  'full-continuation-prefix-evidence-mismatch');
  const replay = replayFullDumpContinuationCorrection(evidence,
    { roster: prefixRequest.roster, source: prefixRequest.sourcePin, limits: prefixRequest.limits });
  requireValue(replay.rawRecordSha256 === '441169211d18fe624656b64c421377621052cebddc87792dcefe1e45a1f75f0b'
    && replay.sourceRevision === 47 && replay.sourceModifiedAt === '2026-02-27T23:31:05.079961',
  'full-continuation-correction-evidence-mismatch');
  return request;
}

export async function runFullDumpContinuationPrepare(args = process.argv.slice(2)) {
  requireValue(!process.env.GITHUB_ACTIONS, 'full-continuation-local-only');
  const required = ['reviewed-request', 'prefix-request', 'prefix-input', 'source-head', 'source-receipt', 'repo', 'key-dir', 'out'];
  const { positionals, values } = parseArgs({ args, allowPositionals: true,
    options: Object.fromEntries(required.map(key => [key, { type: 'string' }])) });
  requireValue(positionals.length === 1 && positionals[0] === 'request' && required.every(key => values[key])
    && Object.keys(values).every(key => required.includes(key)), 'invalid-full-continuation-command');
  // Static relative imports must originate in the verified checkout, not an
  // otherwise identical CLI copied from a different implementation tree.
  requireValue(await realpath(fileURLToPath(import.meta.url))
    === await realpath(join(values.repo, 'scripts/catalog/prepare-full-dump-continuation.mjs')),
  'full-continuation-source-path-mismatch');
  // Exact source receipt verification is shared with private recovery; it also
  // checks that the accepted source descends from the correction commit.
  const sourceReceipt = JSON.parse(await readLocalFile(values['source-receipt'], 1024 * 1024));
  await verifyFullContinuationSource({ repo: values.repo, sourceReceipt, sourceHead: values['source-head'] });
  const reviewedRequest = JSON.parse(await readLocalFile(values['reviewed-request'], 256 * 1024));
  const prefixRequest = JSON.parse(await readLocalFile(values['prefix-request'], 256 * 1024));
  const prefixArtifact = await readLocalFile(values['prefix-input'], 2 * WORK_PREFIX_MAX_PLAINTEXT_BYTES);
  const privatePem = await readLocalFile(join(values['key-dir'], 'recipient-private.pem'), 4096, true);
  const request = prepareFullDumpContinuationRequest({ reviewedRequest, prefixRequest, prefixArtifact, privatePem,
    sourceHead: values['source-head'] });
  await writeFile(values.out, JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const result = { status: 'prepared', requestSha256: request.requestSha256, targets: request.roster.length,
    recipientFingerprint: request.recipientFingerprint, maximumMetadataRequests: 0,
    totalCompressedBytes: request.limits.totalCompressedBytes, approved: 0, databaseWrites: 0 };
  console.log(JSON.stringify(result));
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFullDumpContinuationPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'full-continuation-local-operation-failed' })); process.exitCode = 1;
  });
}
