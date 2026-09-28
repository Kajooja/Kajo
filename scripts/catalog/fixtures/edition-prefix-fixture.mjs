// Public request reconstruction plus invented gzip bytes. No captured rows/keys.
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { digest } from '../open-library-descriptions.mjs';
import { CONFLICT_POLICY_CONTRACT } from '../dump-conflict-policy.mjs';
import { DIAGNOSTIC_LIMITS, DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_CONTRACT,
  REQUEST_CONTRACT, REQUEST_LIMITS, REVIEWED_PREVIOUS_DIAGNOSTIC } from '../seal-dump-acquisition.mjs';
import { FULL_CONTINUATION_CORRECTION_HEAD, FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_PREVIOUS_REVIEWED,
  FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PURPOSE } from '../seal-full-dump-continuation.mjs';
import { WORK_PREFIX_PREVIOUS_ACQUISITION, WORK_PREFIX_REQUEST_CONTRACT, WORK_PREFIX_REQUEST_PURPOSE } from '../seal-work-prefix-diagnostic.mjs';
import { WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN } from '../inspect-work-dump-prefix.mjs';
import { CONFLICT_REQUEST_CONTRACT, CONFLICT_REQUEST_PURPOSE, CONFLICT_POLICY_SOURCE_HEAD,
  CONFLICT_PREVIOUS_CONTINUATION } from '../seal-conflict-dump-acquisition.mjs';
import { EDITION_PREVIOUS_CONFLICT, constructEditionPrefixRequest, editionPrefixRange } from '../seal-edition-prefix-diagnostic.mjs';

export const rehash = value => { const { requestSha256: _hash, ...body } = value; return { ...body, requestSha256: digest(body) }; };
const reviewedRequest = JSON.parse(await readFile(new URL('./work-prefix-previous-request.json', import.meta.url), 'utf8'));
const recipient = { recipientPublicKey: reviewedRequest.recipientPublicKey, recipientFingerprint: reviewedRequest.recipientFingerprint };
const originalRequest = rehash({ contract: REQUEST_CONTRACT, release: reviewedRequest.release,
  sourceHead: DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead, roster: reviewedRequest.roster, limits: { ...REQUEST_LIMITS }, ...recipient });
const diagnosticRequest = rehash({ contract: DIAGNOSTIC_REQUEST_CONTRACT, purpose: 'metadata-only-failure-diagnosis',
  release: reviewedRequest.release, sourceHead: REVIEWED_PREVIOUS_DIAGNOSTIC.sourceHead, limits: { ...DIAGNOSTIC_LIMITS },
  ...recipient, previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION } });
const prefixRequest = rehash({ contract: WORK_PREFIX_REQUEST_CONTRACT, purpose: WORK_PREFIX_REQUEST_PURPOSE,
  release: reviewedRequest.release, sourceHead: FULL_CONTINUATION_PREVIOUS_PREFIX.sourceHead, roster: reviewedRequest.roster,
  sourcePin: { ...WORK_PREFIX_SOURCE_PIN }, range: { ...WORK_PREFIX_RANGE }, limits: { ...WORK_PREFIX_LIMITS },
  previousAcquisition: { ...WORK_PREFIX_PREVIOUS_ACQUISITION }, ...recipient });
const previousContinuation = rehash({ ...reviewedRequest, contract: FULL_CONTINUATION_REQUEST_CONTRACT,
  purpose: FULL_CONTINUATION_REQUEST_PURPOSE, sourceHead: CONFLICT_PREVIOUS_CONTINUATION.sourceHead,
  previousReviewedAcquisition: { ...FULL_CONTINUATION_PREVIOUS_REVIEWED }, previousPrefixDiagnostic: { ...FULL_CONTINUATION_PREVIOUS_PREFIX },
  correctionHead: FULL_CONTINUATION_CORRECTION_HEAD });
export const previousConflict = rehash({ ...previousContinuation, contract: CONFLICT_REQUEST_CONTRACT,
  purpose: CONFLICT_REQUEST_PURPOSE, sourceHead: EDITION_PREVIOUS_CONFLICT.sourceHead, policySourceHead: CONFLICT_POLICY_SOURCE_HEAD,
  previousContinuation: { ...CONFLICT_PREVIOUS_CONTINUATION },
  conflictPolicy: { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 8, maxDiagnosticBytes: 8 * 1024 ** 2 } });
export const predecessors = { previousConflict, previousContinuation, reviewedRequest, prefixRequest, originalRequest, diagnosticRequest };
export const sourceHead = 'a'.repeat(40), requestHead = 'b'.repeat(40);
export const header = (key = '/books/OL999999999M') => `/type/edition\t${key}\t1\t2026-08-15T10:00:00.000\t`;
export function fixture(raw = header() + 'x'.repeat(previousConflict.limits.lineBytes + 1), limits = {}) {
  const zipped = gzipSync(raw), diagnosticLimits = { compressedBytes: zipped.length, maxDecodedBytes: 4 * 1024 ** 2,
    maxRows: 100, lineBytes: previousConflict.limits.lineBytes, prefixBytes: 128, timeoutMs: 1000, ...limits };
  const request = constructEditionPrefixRequest({ previousConflict, sourceHead, diagnosticLimits });
  return { request, zipped };
}
export function responseHeaders(request) {
  const range = editionPrefixRange(request);
  return { 'content-range': `bytes 0-${range.end}/${range.totalBytes}`, 'content-length': String(request.diagnosticLimits.compressedBytes) };
}
export const transportFor = (request, zipped) => async (_url, options) => ({ status: 206, headers: responseHeaders(request),
  body: Readable.from((function* () { options.observeBodyBytes(zipped.length); yield zipped; })()) });
