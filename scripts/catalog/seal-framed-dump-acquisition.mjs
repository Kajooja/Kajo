// Full-collection successor protocol only. No activation, provider run, source
// authentication or rights approval is granted by constructing this request.
import { validateFramedDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { MAX_PLAINTEXT_BYTES, sealPayload, unsealPayload } from './seal-dump-acquisition.mjs';
import { EDITION_PREFIX_REQUEST_CONTRACT, EDITION_PREFIX_PURPOSE,
  validateEditionPrefixRequest } from './seal-edition-prefix-diagnostic.mjs';

export const FRAMED_REQUEST_CONTRACT = 'open-library-framed-dump-acquisition-request-v1';
export const FRAMED_REQUEST_PURPOSE = 'full-acquisition-with-bounded-edition-framing';
export const FRAMED_CORE_SOURCE_HEAD = 'b34aca7451199e3cf78578318d8f5f151ad80c32';
export const FRAMED_COLLECTION_SOURCE_HEAD = 'cfa36d5810c1f5e6f91c4112e4376415f2f4ced1';
export const FRAMED_REQUEST_BRANCH = 'catalog-acquisition/ol-20260831-framed';
export const FRAMED_REQUEST_PATH = 'scripts/catalog/requests/ol-20260831-framed.json';
export const FRAMED_WORKFLOW = 'catalog-book-framed-acquisition.yml';
export const FRAMED_ARTIFACT = 'open-library-framed-20260831.sealed.json';
export const FRAMED_ARTIFACT_NAME = 'kajo-book-framed-sealed';
// Public Git/run lineage only. Private headers, raw identities and artifact or
// custody commitments must not become fields of the public successor request.
export const FRAMED_PREVIOUS_EDITION_DIAGNOSTIC = Object.freeze({ runId: '36435310394',
  sourceHead: '3d12a7f69534fef305b7ca37767626ae584b688e', requestHead: 'be0ec18cdc968b5643e45c57c5ab9919f885e195',
  requestSha256: 'd70b1ca97038a55718dfa9bd238a694237bff12400345fbcfc0b00f92e1a09c6' });
const kind = () => 'framed-acquisition-result';

export function validateFramedDumpAcquisitionRequest(request) {
  requireValue(request && request.contract === FRAMED_REQUEST_CONTRACT && request.purpose === FRAMED_REQUEST_PURPOSE
    && typeof request.sourceHead === 'string' && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && request.framingSourceHead === FRAMED_CORE_SOURCE_HEAD
    && digest(request.previousEditionDiagnostic) === digest(FRAMED_PREVIOUS_EDITION_DIAGNOSTIC),
  'invalid-framed-acquisition-request');
  const { contract: _contract, purpose: _purpose, sourceHead: _source, requestSha256,
    framingSourceHead: _core, previousEditionDiagnostic: _old, ...retained } = request;
  // Reconstruct the original diagnostic request under its original schema,
  // including historical diagnostic limits. They are not new full-run limits.
  const body = { ...retained, contract: EDITION_PREFIX_REQUEST_CONTRACT, purpose: EDITION_PREFIX_PURPOSE,
    sourceHead: FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.sourceHead };
  const previous = validateEditionPrefixRequest({ ...body, requestSha256: digest(body) });
  requireValue(previous.requestSha256 === FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.requestSha256,
    'framed-acquisition-retained-request-mismatch');
  const { requestSha256: _hash, ...unsigned } = request;
  requireValue(typeof requestSha256 === 'string' && /^[0-9a-f]{64}$/.test(requestSha256)
    && digest(unsigned) === requestSha256, 'invalid-framed-acquisition-request-hash');
  return request;
}

export function validateFramedDumpAcquisitionPredecessor(request, previous) {
  validateFramedDumpAcquisitionRequest(request); validateEditionPrefixRequest(previous);
  requireValue(previous.sourceHead === FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.sourceHead
    && previous.requestSha256 === FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.requestSha256,
  'framed-acquisition-predecessor-mismatch');
  return request;
}

export function constructFramedDumpAcquisitionRequest({ previousEditionDiagnostic, sourceHead }) {
  validateEditionPrefixRequest(previousEditionDiagnostic);
  const { requestSha256: _hash, ...old } = previousEditionDiagnostic;
  const body = { ...structuredClone(old), contract: FRAMED_REQUEST_CONTRACT, purpose: FRAMED_REQUEST_PURPOSE,
    sourceHead, framingSourceHead: FRAMED_CORE_SOURCE_HEAD,
    previousEditionDiagnostic: { ...FRAMED_PREVIOUS_EDITION_DIAGNOSTIC } };
  return validateFramedDumpAcquisitionPredecessor({ ...body, requestSha256: digest(body) }, previousEditionDiagnostic);
}

export function validateFramedDumpAcquisitionPayload(result, request) {
  validateFramedDumpAcquisitionRequest(request);
  return validateFramedDumpPayload(result, request);
}

export function sealFramedDumpAcquisition(result, request) {
  validateFramedDumpAcquisitionRequest(request);
  return sealPayload(result, request, validateFramedDumpPayload, MAX_PLAINTEXT_BYTES, kind);
}

export function unsealFramedDumpAcquisition(envelope, request, privatePem) {
  validateFramedDumpAcquisitionRequest(request);
  return unsealPayload(envelope, request, privatePem, validateFramedDumpPayload, MAX_PLAINTEXT_BYTES,
    ['framed-acquisition-result'], kind);
}
