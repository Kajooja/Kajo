// Distinct private prefix diagnosis. No success-candidate or full-source contract.
import { ACQUISITION_RELEASE, validateAcquisitionRoster } from './acquire-open-library-dumps.mjs';
import { validateDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { WORK_PREFIX_DIAGNOSTIC_CONTRACT, WORK_PREFIX_ERROR_CODES, WORK_PREFIX_LIMITS,
  WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN } from './inspect-work-dump-prefix.mjs';
import { canonicalJson, digest, requireValue } from './open-library-descriptions.mjs';
import { recipientFingerprint, sealPayload, unsealPayload } from './seal-dump-acquisition.mjs';

export const WORK_PREFIX_REQUEST_CONTRACT = 'open-library-work-prefix-diagnostic-request-v1';
export const WORK_PREFIX_REQUEST_PURPOSE = 'selected-work-row-prefix-diagnosis';
export const WORK_PREFIX_BRANCH = 'catalog-diagnostic/ol-20260831-work-prefix';
export const WORK_PREFIX_REQUEST_PATH = 'scripts/catalog/requests/ol-20260831-work-prefix.json';
export const WORK_PREFIX_MAX_PLAINTEXT_BYTES = 4 * 1024 * 1024;
export const WORK_PREFIX_PREVIOUS_ACQUISITION = Object.freeze({ runId: '36003953876',
  sourceHead: '349c8b5e27b9a0eb88e178f19361e2bea0d7a026', requestHead: '4727b4cb3d82a7bc10d134d1c2b7e9fcdbdf22bb',
  requestSha256: '468464ff42f46a3fe6966b6d25acdb2610c3673780759e3e5c344c3a7e3f0ad2',
  artifactId: '10809706102', artifactZipBytes: 2671,
  artifactZipSha256: '43b9585a698b5b9400c04ca2fabccc4844009b1f5f17f02bb28d6919a7241edc',
  sealedArtifactSha256: '894719c0b4d8fb88ef48394e2f229a9c77d31ed5f7c6d11d59fe63cad7bdad6c' });
const hash = /^[0-9a-f]{64}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const count = (value, maximum = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const kindOf = () => 'work-prefix-diagnostic';

export function validateWorkPrefixRequest(request) {
  requireValue(exactKeys(request, ['contract', 'purpose', 'release', 'sourceHead', 'roster', 'sourcePin', 'range', 'limits',
    'previousAcquisition', 'recipientPublicKey', 'recipientFingerprint', 'requestSha256'])
    && request.contract === WORK_PREFIX_REQUEST_CONTRACT && request.purpose === WORK_PREFIX_REQUEST_PURPOSE
    && request.release === ACQUISITION_RELEASE && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && digest(request.sourcePin) === digest(WORK_PREFIX_SOURCE_PIN) && digest(request.range) === digest(WORK_PREFIX_RANGE)
    && digest(request.limits) === digest(WORK_PREFIX_LIMITS)
    && digest(request.previousAcquisition) === digest(WORK_PREFIX_PREVIOUS_ACQUISITION), 'invalid-work-prefix-request');
  requireValue(canonicalJson(validateAcquisitionRoster(request.roster)) === canonicalJson(request.roster), 'invalid-acquisition-roster-order');
  requireValue(recipientFingerprint(request.recipientPublicKey) === request.recipientFingerprint, 'invalid-acquisition-recipient-fingerprint');
  const { requestSha256, ...body } = request;
  requireValue(hash.test(requestSha256) && digest(body) === requestSha256, 'invalid-acquisition-request-hash');
  return request;
}

function sourceRoute(value) {
  if (typeof value !== 'string' || value.length > 32768) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  const name = 'ol_dump_works_2026-08-31.txt.gz';
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash
    && (url.hostname === 'openlibrary.org' && url.pathname === `/data/${name}`
      || (url.hostname === 'archive.org' || url.hostname.endsWith('.archive.org'))
        && /^\/(?:download|serve|items|[0-9]+\/items)\/ol_dump_2026-08-31\/ol_dump_works_2026-08-31\.txt\.gz$/.test(url.pathname));
}

export function validateWorkPrefixResult(result, request) {
  const check = condition => requireValue(condition, 'invalid-work-prefix-result');
  check(exactKeys(result, ['contract', 'status', 'code', 'release', 'retrievedAt', 'completedAt', 'rosterSha256',
    'sourcePin', 'range', 'limits', 'response', 'accounting', 'failureEvidence', 'fullSourceComplete',
    'publisherChecksumsVerified', 'candidates', 'approved', 'databaseWrites', 'individualProviderRequests'])
    && result.contract === WORK_PREFIX_DIAGNOSTIC_CONTRACT && ['diagnosed', 'inconclusive', 'failed'].includes(result.status)
    && result.release === request.release && result.rosterSha256 === digest(request.roster)
    && digest(result.sourcePin) === digest(request.sourcePin) && digest(result.range) === digest(request.range)
    && digest(result.limits) === digest(request.limits) && timestamp(result.retrievedAt) && timestamp(result.completedAt)
    && Date.parse(result.completedAt) >= Date.parse(result.retrievedAt)
    && result.fullSourceComplete === false && result.publisherChecksumsVerified === false
    && result.candidates === 0 && result.approved === 0 && result.databaseWrites === 0 && result.individualProviderRequests === 0);
  const a = result.accounting, l = request.limits;
  check(exactKeys(a, ['requests', 'receivedBodyBytes', 'compressedBytes', 'decodedBytes', 'rows', 'matchedRecords',
    'unrelatedRows', 'malformedUnrelatedRows', 'prefixComplete', 'prefixSha256', 'failureEvidenceBytes', 'retainedRecordBytes'])
    && exactKeys(a.requests, ['works', 'editions', 'metadata']) && count(a.requests.works, 1 + l.maxRedirects)
    && a.requests.editions === 0 && a.requests.metadata === 0 && count(a.receivedBodyBytes)
    && (a.receivedBodyBytes <= l.compressedBytes || result.status === 'failed' && result.code === 'work-prefix-body-limit')
    && count(a.compressedBytes, l.compressedBytes) && a.compressedBytes <= a.receivedBodyBytes
    && count(a.decodedBytes, l.maxDecodedBytes) && count(a.rows, l.maxRows)
    && count(a.matchedRecords, request.roster.length) && count(a.unrelatedRows, a.rows)
    && count(a.malformedUnrelatedRows, a.unrelatedRows) && a.matchedRecords + a.unrelatedRows <= a.rows
    && typeof a.prefixComplete === 'boolean' && (!a.prefixComplete || a.compressedBytes === l.compressedBytes)
    && (a.prefixSha256 === null || typeof a.prefixSha256 === 'string' && hash.test(a.prefixSha256))
    && count(a.failureEvidenceBytes, l.lineBytes) && a.retainedRecordBytes === 0);
  if (result.response === null) {
    check(result.status === 'failed' && a.compressedBytes === 0 && a.decodedBytes === 0 && a.rows === 0
      && a.prefixSha256 === null && a.prefixComplete === false);
  } else {
    const r = result.response;
    check(exactKeys(r, ['url', 'finalUrl', 'status', 'contentRange', 'contentLength', 'redirects'])
      && r.url === request.sourcePin.url && r.status === 206 && r.contentLength === l.compressedBytes
      && r.contentRange === `bytes ${request.range.start}-${request.range.end}/${request.range.totalBytes}`
      && sourceRoute(r.finalUrl) && Array.isArray(r.redirects) && r.redirects.length <= l.maxRedirects
      && a.requests.works === r.redirects.length + 1 && hash.test(a.prefixSha256));
    let previous = r.url;
    const visited = new Set([previous]);
    for (const redirect of r.redirects) {
      check(exactKeys(redirect, ['from', 'to', 'status']) && redirect.from === previous && sourceRoute(redirect.to)
        && [301, 302, 303, 307, 308].includes(redirect.status) && !visited.has(redirect.to));
      previous = redirect.to; visited.add(previous);
    }
    check(previous === r.finalUrl);
  }
  if (result.status === 'diagnosed') {
    check(result.code === 'provider-identity-mismatch' && result.response !== null && object(result.failureEvidence));
    const evidence = validateDumpFailureEvidence(result.failureEvidence,
      { roster: request.roster, source: request.sourcePin, limits: request.limits });
    check(evidence.sourceKind === 'works' && evidence.terminated === true && evidence.row === a.rows && evidence.fetchedAt === result.retrievedAt
      && evidence.rawBytes === a.failureEvidenceBytes && a.rows === a.matchedRecords + a.unrelatedRows + 1
      && a.compressedBytes > 0 && a.decodedBytes >= evidence.rawBytes + 1);
  } else {
    check(result.failureEvidence === null && a.failureEvidenceBytes === 0);
    if (result.status === 'inconclusive') {
      check(result.response !== null && a.compressedBytes > 0 && ['work-prefix-range-exhausted',
        'work-prefix-decoded-limit', 'work-prefix-row-limit'].includes(result.code));
      if (result.code === 'work-prefix-range-exhausted') check(a.prefixComplete && a.compressedBytes === l.compressedBytes);
      if (result.code === 'work-prefix-row-limit') check(a.rows === l.maxRows);
      if (result.code === 'work-prefix-decoded-limit') check(a.decodedBytes === l.maxDecodedBytes);
    } else {
      check(WORK_PREFIX_ERROR_CODES.includes(result.code));
      // Equality can stop a redirected GET before it starts: no body budget remains.
      if (result.code === 'work-prefix-body-limit') check(a.receivedBodyBytes >= l.compressedBytes);
    }
  }
  return result;
}

export function sealWorkPrefixDiagnostic(result, request) {
  validateWorkPrefixRequest(request);
  return sealPayload(result, request, validateWorkPrefixResult, WORK_PREFIX_MAX_PLAINTEXT_BYTES, kindOf);
}
export function unsealWorkPrefixDiagnostic(envelope, request, privatePem) {
  validateWorkPrefixRequest(request);
  return unsealPayload(envelope, request, privatePem, validateWorkPrefixResult, WORK_PREFIX_MAX_PLAINTEXT_BYTES,
    ['work-prefix-diagnostic'], kindOf);
}
