// Distinct one-shot diagnosis; no consumed request is widened or reactivated.
import { validateAcquisitionSourceUrl } from './acquire-open-library-dumps.mjs';
import { validateEditionLineContext, validateEditionLineDiagnostic } from './dump-failure-evidence.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { sealPayload, unsealPayload } from './seal-dump-acquisition.mjs';
import { CONFLICT_REQUEST_CONTRACT, CONFLICT_REQUEST_PURPOSE,
  validateConflictDumpAcquisitionRequest } from './seal-conflict-dump-acquisition.mjs';

export const EDITION_PREFIX_REQUEST_CONTRACT = 'open-library-edition-prefix-request-v1';
export const EDITION_PREFIX_PURPOSE = 'bounded-edition-line-framing-diagnosis';
export const EDITION_PREFIX_RESULT_CONTRACT = 'open-library-edition-prefix-result-v1';
export const EDITION_PREFIX_BRANCH = 'catalog-diagnostic/ol-20260831-edition-prefix';
export const EDITION_PREFIX_REQUEST_PATH = 'scripts/catalog/requests/ol-20260831-edition-prefix.json';
export const EDITION_PREFIX_CORE_HEAD = '12c1dc203a4d4e5a326c6f2a64db4c5fe49b0cb4';
export const EDITION_PREFIX_WORKFLOW = 'catalog-book-edition-prefix-diagnostic.yml';
export const EDITION_PREFIX_ARTIFACT = 'open-library-edition-prefix-20260831.sealed.json';
export const EDITION_PREFIX_ARTIFACT_NAME = 'kajo-book-edition-prefix-sealed';
export const EDITION_PREFIX_MAX_PLAINTEXT = 128 * 1024;
export const EDITION_PREFIX_MAX_REDIRECTS = 4;
// Public Git/run identities only; no new private row or artifact commitment.
export const EDITION_PREVIOUS_CONFLICT = Object.freeze({ runId: '36391833763',
  sourceHead: '24631688fbbbf73b2197768d5df686e26ff361dd', requestHead: '11bada2563374616cc8d014d787039c9235ea071',
  requestSha256: '1a64494fe3707ce82fb5a4d8e58febd70f38af0386cf2fe35e390f410f6c990c' });
// Schema ceilings, never defaults or permission to make a provider request.
export const EDITION_PREFIX_CEILINGS = Object.freeze({ compressedBytes: 1024 ** 3,
  maxDecodedBytes: 8 * 1024 ** 3, maxRows: 10000000, timeoutMs: 1200000 });
export const EDITION_PREFIX_TRANSPORT_ERRORS = Object.freeze(['edition-prefix-failed', 'edition-prefix-range-not-honored',
  'edition-prefix-response-invalid', 'edition-prefix-body-limit', 'edition-prefix-timeout', 'edition-prefix-aborted',
  'acquisition-header-limit', 'acquisition-invalid-response', 'acquisition-transport-failed',
  'acquisition-redirect-loop', 'acquisition-redirect-limit', 'unsafe-acquisition-url', 'unsafe-acquisition-source-route']);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const count = v => Number.isSafeInteger(v) && v >= 0;
const instant = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
const equal = (a, b) => digest(a) === digest(b);
const kind = () => 'edition-prefix-diagnostic';
const redirects = new Set([301, 302, 303, 307, 308]);
export const editionPrefixContext = (request, fetchedAt) => ({ source: request.sourcePins.editions,
  roster: request.roster, limits: request.diagnosticLimits, fetchedAt });

export function validateEditionPrefixRequest(request) {
  requireValue(object(request) && request.contract === EDITION_PREFIX_REQUEST_CONTRACT && request.purpose === EDITION_PREFIX_PURPOSE
    && typeof request.sourceHead === 'string' && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && request.diagnosticSourceHead === EDITION_PREFIX_CORE_HEAD
    && equal(request.previousConflict, EDITION_PREVIOUS_CONFLICT), 'invalid-edition-prefix-request');
  const { contract: _c, purpose: _p, sourceHead: _s, requestSha256, previousConflict: _old,
    diagnosticSourceHead: _core, diagnosticLimits, ...retained } = request;
  const body = { ...retained, contract: CONFLICT_REQUEST_CONTRACT, purpose: CONFLICT_REQUEST_PURPOSE,
    sourceHead: EDITION_PREVIOUS_CONFLICT.sourceHead };
  const previous = validateConflictDumpAcquisitionRequest({ ...body, requestSha256: digest(body) });
  requireValue(previous.requestSha256 === EDITION_PREVIOUS_CONFLICT.requestSha256, 'edition-prefix-predecessor-mismatch');
  validateEditionLineContext(editionPrefixContext(request, request.release + 'T00:00:00.000Z'));
  requireValue(diagnosticLimits.lineBytes === previous.limits.lineBytes
    && diagnosticLimits.compressedBytes < previous.sourcePins.editions.bytes
    && Object.entries(EDITION_PREFIX_CEILINGS).every(([key, value]) => diagnosticLimits[key] <= value)
    && ['maxDecodedBytes', 'maxRows', 'timeoutMs'].every(key => diagnosticLimits[key] <= previous.limits[key]),
  'invalid-edition-prefix-limits');
  const { requestSha256: _hash, ...unsigned } = request;
  requireValue(typeof requestSha256 === 'string' && /^[0-9a-f]{64}$/.test(requestSha256)
    && digest(unsigned) === requestSha256, 'invalid-edition-prefix-request-hash');
  return request;
}

export function validateEditionPrefixPredecessor(request, previous) {
  validateEditionPrefixRequest(request); validateConflictDumpAcquisitionRequest(previous);
  requireValue(previous.sourceHead === EDITION_PREVIOUS_CONFLICT.sourceHead
    && previous.requestSha256 === EDITION_PREVIOUS_CONFLICT.requestSha256, 'edition-prefix-predecessor-mismatch');
  return request;
}

export function constructEditionPrefixRequest({ previousConflict, sourceHead, diagnosticLimits }) {
  validateConflictDumpAcquisitionRequest(previousConflict);
  const { requestSha256: _hash, ...old } = previousConflict;
  const body = { ...structuredClone(old), contract: EDITION_PREFIX_REQUEST_CONTRACT, purpose: EDITION_PREFIX_PURPOSE,
    sourceHead, previousConflict: { ...EDITION_PREVIOUS_CONFLICT }, diagnosticSourceHead: EDITION_PREFIX_CORE_HEAD,
    diagnosticLimits: structuredClone(diagnosticLimits) };
  return validateEditionPrefixPredecessor({ ...body, requestSha256: digest(body) }, previousConflict);
}

export function editionPrefixRange(request) {
  return { start: 0, end: request.diagnosticLimits.compressedBytes - 1, totalBytes: request.sourcePins.editions.bytes };
}
export function validateEditionPrefixHeaders({ status, headers }, request) {
  requireValue(object(headers), 'edition-prefix-response-invalid');
  if (redirects.has(status)) {
    requireValue(typeof headers.location === 'string' && headers.location.length > 0 && headers.location.length <= 32768,
      'acquisition-redirect-limit'); return false;
  }
  requireValue(status !== 200, 'edition-prefix-range-not-honored');
  const range = editionPrefixRange(request);
  requireValue(status === 206 && headers['content-range'] === `bytes 0-${range.end}/${range.totalBytes}`
    && headers['content-length'] === String(request.diagnosticLimits.compressedBytes)
    && (headers['content-encoding'] === undefined || headers['content-encoding'] === 'identity')
    && headers['transfer-encoding'] === undefined
    && (headers['content-type'] === undefined || typeof headers['content-type'] === 'string'
      && headers['content-type'].length <= 256 && !/^multipart\//i.test(headers['content-type'])),
  'edition-prefix-response-invalid');
  return true;
}
export function editionPrefixRoute(url, request) {
  requireValue(typeof url === 'string' && url.length <= 32768, 'unsafe-acquisition-source-route');
  const accepted = validateAcquisitionSourceUrl(url, request.sourcePins.editions.url);
  requireValue(new URL(accepted).search === '', 'unsafe-acquisition-source-route');
  return accepted;
}

export function validateEditionPrefixResult(result, request) {
  validateEditionPrefixRequest(request);
  return validateEditionPrefixPayload(result, request);
}

// Pure payload replay also supports an isolated synthetic encryption context.
// Production seal/unseal and the runner always validate the frozen request.
export function validateEditionPrefixPayload(result, request) {
  validateEditionLineContext(editionPrefixContext(request, result?.retrievedAt));
  const check = value => requireValue(value, 'invalid-edition-prefix-result');
  check(exact(result, ['contract', 'status', 'code', 'requestSha256', 'sourceHead', 'retrievedAt', 'completedAt',
    'transport', 'diagnostic', 'provenanceVerified', 'candidates', 'approved', 'databaseWrites', 'modelAdmissions'])
    && result.contract === EDITION_PREFIX_RESULT_CONTRACT && result.requestSha256 === request.requestSha256
    && result.sourceHead === request.sourceHead && typeof request.sourceHead === 'string' && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && typeof request.requestSha256 === 'string' && /^[0-9a-f]{64}$/.test(request.requestSha256)
    && instant(result.retrievedAt) && instant(result.completedAt)
    && Date.parse(result.completedAt) >= Date.parse(result.retrievedAt) && result.provenanceVerified === false
    && ['candidates', 'approved', 'databaseWrites', 'modelAdmissions'].every(key => result[key] === 0));
  const t = result.transport, cap = request.diagnosticLimits.compressedBytes;
  check(exact(t, ['requests', 'receivedBodyBytes', 'redirects', 'response'])
    && exact(t.requests, ['works', 'editions', 'metadata']) && t.requests.works === 0 && t.requests.metadata === 0
    && count(t.requests.editions) && t.requests.editions <= 1 + EDITION_PREFIX_MAX_REDIRECTS
    && count(t.receivedBodyBytes) && Array.isArray(t.redirects) && t.redirects.length <= EDITION_PREFIX_MAX_REDIRECTS
    && (t.receivedBodyBytes <= cap || result.status === 'failed' && result.code === 'edition-prefix-body-limit')
    && (t.requests.editions > 0 || t.receivedBodyBytes === 0 && t.redirects.length === 0));
  let current = request.sourcePins.editions.url;
  const visited = new Set([current]);
  for (const step of t.redirects) {
    check(exact(step, ['from', 'to', 'status']) && step.from === current && redirects.has(step.status)
      && editionPrefixRoute(step.to, request) === step.to && !visited.has(step.to));
    current = step.to; visited.add(current);
  }
  check(t.requests.editions >= t.redirects.length && t.requests.editions <= t.redirects.length + 1);
  if (t.response !== null) {
    const r = t.response, range = editionPrefixRange(request);
    check(exact(r, ['url', 'finalUrl', 'status', 'contentRange', 'contentLength']) && r.url === request.sourcePins.editions.url
      && r.finalUrl === current && r.status === 206 && r.contentRange === `bytes 0-${range.end}/${range.totalBytes}`
      && r.contentLength === cap && t.requests.editions === t.redirects.length + 1);
  }
  if (result.diagnostic !== null) {
    const d = validateEditionLineDiagnostic(result.diagnostic, editionPrefixContext(request, result.retrievedAt));
    check(t.response !== null && d.stats.bytes <= t.receivedBodyBytes && t.receivedBodyBytes <= cap
      && Date.parse(d.completedAt) <= Date.parse(result.completedAt) && result.status === d.status && result.code === d.code);
  } else check(result.status === 'failed' && EDITION_PREFIX_TRANSPORT_ERRORS.includes(result.code));
  if (result.code === 'edition-prefix-body-limit') check(t.receivedBodyBytes >= cap);
  return result;
}

export function sealEditionPrefixDiagnostic(result, request) {
  return sealPayload(result, request, validateEditionPrefixResult, EDITION_PREFIX_MAX_PLAINTEXT, kind);
}
export function unsealEditionPrefixDiagnostic(envelope, request, privatePem) {
  validateEditionPrefixRequest(request);
  return unsealPayload(envelope, request, privatePem, validateEditionPrefixResult, EDITION_PREFIX_MAX_PLAINTEXT,
    ['edition-prefix-diagnostic'], kind);
}
