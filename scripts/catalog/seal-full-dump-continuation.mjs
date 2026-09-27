// One distinct full acquisition. Historical request contracts stay unchanged.
import { FAILURE_EVIDENCE_CONTRACT } from './dump-failure-evidence.mjs';
import { ACQUISITION_RELEASE } from './acquire-open-library-dumps.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { DIAGNOSTIC_PREVIOUS_ACQUISITION, MAX_PLAINTEXT_BYTES, REVIEWED_PREVIOUS_DIAGNOSTIC,
  REVIEWED_REQUEST_CONTRACT, REVIEWED_REQUEST_PURPOSE, sealPayload, unsealPayload,
  validateAcquisitionRequest, validateMetadataDiagnosticRequest, validatePinnedAcquisitionPayload,
  validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_PREVIOUS_ACQUISITION, validateWorkPrefixRequest } from './seal-work-prefix-diagnostic.mjs';

export const FULL_CONTINUATION_REQUEST_CONTRACT = 'open-library-full-dump-continuation-request-v1';
export const FULL_CONTINUATION_REQUEST_PURPOSE = 'full-acquisition-after-self-location-correction';
export const FULL_CONTINUATION_REQUEST_BRANCH = 'catalog-acquisition/ol-20260831-continuation';
export const FULL_CONTINUATION_REQUEST_PATH = 'scripts/catalog/requests/ol-20260831-continuation.json';
export const FULL_CONTINUATION_CORRECTION_HEAD = '8c4d8ecf65187f12bb30ed4207d03848fd87d292';
export const FULL_CONTINUATION_PREVIOUS_REVIEWED = WORK_PREFIX_PREVIOUS_ACQUISITION;
export const FULL_CONTINUATION_PREVIOUS_PREFIX = Object.freeze({ runId: '36342443617',
  sourceHead: '99ed067ba7aec9f9bbb63d806cafbafc8a0bb4d1', requestHead: '6a6dc390940db1b15d68a8d850dd08bfbb88bd4a',
  requestSha256: '03c4e1abf4ce3d67452239b76c5d1a0fd18d0bef0c41767c99075f88c1c26bc8',
  artifactId: '10939256706', artifactZipBytes: 14021,
  artifactZipSha256: 'd3b8c99729ea8f10f7458becff6be8f0b061aaaeaf8cdfdd0b127dde76b7e0ae',
  sealedArtifactSha256: '240e8064fcdc61a1a819ca286d76b6662e8a65d4d79a0394979129ffd9fad6cb',
  plaintextSha256: 'c59d7da8805e7aa43526d0ad9b643fbc1b2d467e7fd4a4238bc9aad68038fb55',
  rowSha256: '36052131a5d776e82658e741280683eaf38b18930fcf89717af2a68b9c161752' });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const retainedFields = ['release', 'roster', 'limits', 'sourcePins', 'sourceEvidence', 'previousAcquisition',
  'previousDiagnostic', 'recipientPublicKey', 'recipientFingerprint'];

// Reconstruct only the immutable, original reviewed body for its own validator.
// The continuation itself is never passed through a historical dispatch path.
function retainedReviewedRequest(request) {
  const body = { contract: REVIEWED_REQUEST_CONTRACT, purpose: REVIEWED_REQUEST_PURPOSE,
    sourceHead: FULL_CONTINUATION_PREVIOUS_REVIEWED.sourceHead,
    ...Object.fromEntries(retainedFields.map(field => [field, request[field]])) };
  return { ...body, requestSha256: digest(body) };
}
export function validateFullDumpContinuationRequest(request) {
  requireValue(exactKeys(request, ['contract', 'purpose', 'sourceHead', ...retainedFields,
    'previousReviewedAcquisition', 'previousPrefixDiagnostic', 'correctionHead', 'requestSha256'])
    && request.contract === FULL_CONTINUATION_REQUEST_CONTRACT && request.purpose === FULL_CONTINUATION_REQUEST_PURPOSE
    && request.release === ACQUISITION_RELEASE && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && request.correctionHead === FULL_CONTINUATION_CORRECTION_HEAD
    && digest(request.previousReviewedAcquisition) === digest(FULL_CONTINUATION_PREVIOUS_REVIEWED)
    && digest(request.previousPrefixDiagnostic) === digest(FULL_CONTINUATION_PREVIOUS_PREFIX), 'invalid-full-continuation-request');
  const reviewed = validateReviewedAcquisitionRequest(retainedReviewedRequest(request));
  requireValue(reviewed.requestSha256 === FULL_CONTINUATION_PREVIOUS_REVIEWED.requestSha256
    && request.roster.length === 383, 'full-continuation-retained-request-mismatch');
  const { requestSha256, ...body } = request;
  requireValue(/^[0-9a-f]{64}$/.test(requestSha256) && digest(body) === requestSha256, 'invalid-acquisition-request-hash');
  return request;
}

export function validateFullDumpContinuationPredecessors(request, { reviewedRequest, prefixRequest,
  originalRequest, diagnosticRequest }) {
  validateFullDumpContinuationRequest(request);
  validateReviewedAcquisitionRequest(reviewedRequest);
  validateWorkPrefixRequest(prefixRequest);
  requireValue(reviewedRequest.requestSha256 === FULL_CONTINUATION_PREVIOUS_REVIEWED.requestSha256
    && reviewedRequest.sourceHead === FULL_CONTINUATION_PREVIOUS_REVIEWED.sourceHead
    && prefixRequest.requestSha256 === FULL_CONTINUATION_PREVIOUS_PREFIX.requestSha256
    && prefixRequest.sourceHead === FULL_CONTINUATION_PREVIOUS_PREFIX.sourceHead
    && retainedFields.every(field => digest(request[field]) === digest(reviewedRequest[field]))
    && digest(prefixRequest.roster) === digest(request.roster)
    && prefixRequest.recipientPublicKey === request.recipientPublicKey
    && prefixRequest.recipientFingerprint === request.recipientFingerprint,
  'full-continuation-predecessor-mismatch');
  // Runners also read the two earlier fixed Git objects. Preparation can rely
  // on their immutable identities already covered by the exact reviewed hash.
  if (originalRequest !== undefined || diagnosticRequest !== undefined) {
    validateAcquisitionRequest(originalRequest);
    validateMetadataDiagnosticRequest(diagnosticRequest);
    requireValue(originalRequest.requestSha256 === DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256
      && originalRequest.sourceHead === DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead
      && diagnosticRequest.requestSha256 === REVIEWED_PREVIOUS_DIAGNOSTIC.requestSha256
      && diagnosticRequest.sourceHead === REVIEWED_PREVIOUS_DIAGNOSTIC.sourceHead
      && digest(originalRequest.roster) === digest(request.roster)
      && [originalRequest, diagnosticRequest].every(previous => previous.recipientPublicKey === request.recipientPublicKey
        && previous.recipientFingerprint === request.recipientFingerprint), 'full-continuation-predecessor-mismatch');
  }
  return request;
}
export function validateFullDumpContinuationPayload(result, request) {
  validatePinnedAcquisitionPayload(result, request);
  if (result.status === 'failed' && result.code === 'provider-identity-mismatch')
    requireValue(result.accounting.failureEvidence?.contract === FAILURE_EVIDENCE_CONTRACT,
      'invalid-full-continuation-failure-evidence');
}
export function sealFullDumpContinuation(result, request) {
  validateFullDumpContinuationRequest(request);
  return sealPayload(result, request, validateFullDumpContinuationPayload, MAX_PLAINTEXT_BYTES);
}
export function unsealFullDumpContinuation(envelope, request, privatePem) {
  validateFullDumpContinuationRequest(request);
  return unsealPayload(envelope, request, privatePem, validateFullDumpContinuationPayload, MAX_PLAINTEXT_BYTES, ['failure', 'collected']);
}
