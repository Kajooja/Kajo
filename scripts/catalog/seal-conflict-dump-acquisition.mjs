// Protocol core only: no request preparation, activation or provider budget.
// Existing request dispatch and historical recovery remain unchanged.
import { validateDumpConflictPolicy } from './dump-conflict-policy.mjs';
import { validateConflictDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { MAX_PLAINTEXT_BYTES, sealPayload, unsealPayload } from './seal-dump-acquisition.mjs';
import { FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PURPOSE,
  validateFullDumpContinuationRequest } from './seal-full-dump-continuation.mjs';

export const CONFLICT_REQUEST_CONTRACT = 'open-library-conflict-aware-dump-acquisition-request-v1';
export const CONFLICT_REQUEST_PURPOSE = 'full-acquisition-with-bounded-pair-exclusion';
export const CONFLICT_POLICY_SOURCE_HEAD = '1f3bd049a37f182a773a4101791f9962b87cfb99';
// Public Git/run lineage only. No new private artifact, archive, plaintext or
// diagnostic-row identity is published as part of this successor protocol.
export const CONFLICT_PREVIOUS_CONTINUATION = Object.freeze({ runId: '36349027698',
  sourceHead: '8a9aefbf87870abd932dac53c6d4abae7fd0683d', requestHead: 'f2558795be45be17bd2632071cf25746e4ec82a2',
  requestSha256: '87af5341a6c4523c1b87a8dc3c02a1ee985b42d3340b04cff9114cc489258134' });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const retainedFields = ['release', 'roster', 'limits', 'sourcePins', 'sourceEvidence', 'previousAcquisition',
  'previousDiagnostic', 'recipientPublicKey', 'recipientFingerprint', 'previousReviewedAcquisition',
  'previousPrefixDiagnostic', 'correctionHead'];
const payloadKind = () => 'conflict-acquisition-result';

// Reconstruct the original request's own immutable body and verify its exact
// canonical digest. Never pass a successor to a historical request validator.
function retainedContinuationRequest(request) {
  const body = { contract: FULL_CONTINUATION_REQUEST_CONTRACT, purpose: FULL_CONTINUATION_REQUEST_PURPOSE,
    sourceHead: CONFLICT_PREVIOUS_CONTINUATION.sourceHead,
    ...Object.fromEntries(retainedFields.map(field => [field, request[field]])) };
  return { ...body, requestSha256: digest(body) };
}

export function validateConflictDumpAcquisitionRequest(request) {
  requireValue(exactKeys(request, ['contract', 'purpose', 'sourceHead', ...retainedFields,
    'policySourceHead', 'previousContinuation', 'conflictPolicy', 'requestSha256'])
    && request.contract === CONFLICT_REQUEST_CONTRACT && request.purpose === CONFLICT_REQUEST_PURPOSE
    && typeof request.sourceHead === 'string' && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && request.policySourceHead === CONFLICT_POLICY_SOURCE_HEAD
    && digest(request.previousContinuation) === digest(CONFLICT_PREVIOUS_CONTINUATION), 'invalid-conflict-acquisition-request');
  const previous = validateFullDumpContinuationRequest(retainedContinuationRequest(request));
  requireValue(previous.requestSha256 === CONFLICT_PREVIOUS_CONTINUATION.requestSha256,
    'conflict-acquisition-retained-request-mismatch');
  // These are schema ceilings, not a selected operational allowance. Every
  // future request must explicitly freeze a policy before separate activation.
  validateDumpConflictPolicy(request.conflictPolicy, request.roster);
  const { requestSha256, ...body } = request;
  requireValue(/^[0-9a-f]{64}$/.test(requestSha256) && digest(body) === requestSha256, 'invalid-acquisition-request-hash');
  return request;
}

export function validateConflictDumpAcquisitionPredecessor(request, previousContinuation) {
  validateConflictDumpAcquisitionRequest(request);
  validateFullDumpContinuationRequest(previousContinuation);
  requireValue(previousContinuation.sourceHead === CONFLICT_PREVIOUS_CONTINUATION.sourceHead
    && previousContinuation.requestSha256 === CONFLICT_PREVIOUS_CONTINUATION.requestSha256
    && retainedFields.every(field => digest(previousContinuation[field]) === digest(request[field])),
  'conflict-acquisition-predecessor-mismatch');
  return request;
}

export function validateConflictDumpAcquisitionPayload(result, request) {
  validateConflictDumpAcquisitionRequest(request);
  return validateConflictDumpPayload(result, request);
}

export function sealConflictDumpAcquisition(result, request) {
  validateConflictDumpAcquisitionRequest(request);
  return sealPayload(result, request, validateConflictDumpPayload, MAX_PLAINTEXT_BYTES, payloadKind);
}

export function unsealConflictDumpAcquisition(envelope, request, privatePem) {
  validateConflictDumpAcquisitionRequest(request);
  return unsealPayload(envelope, request, privatePem, validateConflictDumpPayload, MAX_PLAINTEXT_BYTES,
    ['conflict-acquisition-result'], payloadKind);
}
