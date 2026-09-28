// A one-shot diagnostic prefix, never a candidate or complete-file acquisition.
import { ACQUISITION_RELEASE, REVIEWED_SOURCE_PINS, curlAcquisitionTransport,
  validateAcquisitionRoster, validateAcquisitionSourceUrl } from './acquire-open-library-dumps.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { scanDumpFailurePrefix } from './open-library-dump-descriptions.mjs';

export const WORK_PREFIX_DIAGNOSTIC_CONTRACT = 'open-library-work-prefix-diagnostic-v1';
export const WORK_PREFIX_SOURCE_PIN = REVIEWED_SOURCE_PINS.works;
export const WORK_PREFIX_RANGE = Object.freeze({ start: 0, end: 104857599, totalBytes: 4058336593 });
export const WORK_PREFIX_LIMITS = Object.freeze({ compressedBytes: 104857600,
  maxDecodedBytes: 1073741824, maxRows: 1000000, lineBytes: 1049600, timeoutMs: 600000, maxRedirects: 4 });
export const WORK_PREFIX_ERROR_CODES = Object.freeze(['work-prefix-failed', 'work-prefix-range-not-honored',
  'work-prefix-range-response-invalid', 'work-prefix-body-limit', 'work-prefix-timeout', 'work-prefix-aborted',
  'work-prefix-truncated', 'work-prefix-gzip-invalid', 'work-prefix-stream-failed', 'work-prefix-range-overflow',
  'acquisition-header-limit', 'acquisition-invalid-response', 'acquisition-transport-failed',
  'acquisition-redirect-loop', 'acquisition-redirect-limit', 'unsafe-acquisition-url', 'unsafe-acquisition-source-route',
  'dump-line-limit', 'invalid-dump-encoding', 'malformed-dump-target-row', 'duplicate-dump-target-record',
  'invalid-dump-target-envelope', 'record-too-large', 'malformed-provider-json', 'invalid-provider-revision',
  'invalid-provider-modified-time', 'invalid-record-context']);
const errors = new Set(WORK_PREFIX_ERROR_CODES);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
export const safeWorkPrefixError = error => errors.has(error?.message) ? error.message : 'work-prefix-failed';

// Used inside curl before it forwards a body tail bundled with these headers.
// Returning false discards a redirect body; no response can widen the range.
export function validateWorkPrefixHeaders({ status, headers }) {
  requireValue(headers && typeof headers === 'object', 'work-prefix-range-response-invalid');
  if (redirectStatuses.has(status)) {
    requireValue(typeof headers.location === 'string' && headers.location.length > 0, 'acquisition-redirect-limit');
    return false;
  }
  requireValue(status !== 200, 'work-prefix-range-not-honored');
  requireValue(status === 206 && headers['content-range'] === 'bytes 0-104857599/4058336593'
    && headers['content-length'] === '104857600'
    && (headers['content-encoding'] === undefined || headers['content-encoding'] === 'identity')
    && headers['transfer-encoding'] === undefined
    && !(typeof headers['content-type'] === 'string' && /^multipart\//i.test(headers['content-type'])),
  'work-prefix-range-response-invalid');
  return true;
}

export async function inspectWorkDumpPrefix({ release, roster, sourcePin, range, limits,
  signal, transport = curlAcquisitionTransport } = {}) {
  requireValue(release === ACQUISITION_RELEASE && digest(sourcePin) === digest(WORK_PREFIX_SOURCE_PIN)
    && digest(range) === digest(WORK_PREFIX_RANGE) && digest(limits) === digest(WORK_PREFIX_LIMITS),
  'invalid-work-prefix-input');
  sourcePin = WORK_PREFIX_SOURCE_PIN; range = WORK_PREFIX_RANGE; limits = WORK_PREFIX_LIMITS;
  const selected = validateAcquisitionRoster(roster), retrievedAt = new Date().toISOString();
  const accounting = { requests: { works: 0, editions: 0, metadata: 0 }, receivedBodyBytes: 0,
    compressedBytes: 0, decodedBytes: 0, rows: 0, matchedRecords: 0, unrelatedRows: 0, malformedUnrelatedRows: 0,
    prefixComplete: false, prefixSha256: null, failureEvidenceBytes: 0, retainedRecordBytes: 0 };
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs); timer.unref?.();
  const started = Date.now(), redirects = [], visited = new Set();
  let compressedCapReached = false;
  let url = sourcePin.url, response = null, currentBody, failureEvidence = null, status = 'failed', code = 'work-prefix-failed';
  try {
    for (;;) {
      combined.throwIfAborted();
      url = validateAcquisitionSourceUrl(url, sourcePin.url);
      requireValue(new URL(url).search === '', 'unsafe-acquisition-source-route');
      requireValue(!visited.has(url), 'acquisition-redirect-loop'); visited.add(url);
      requireValue(accounting.receivedBodyBytes < limits.compressedBytes, 'work-prefix-body-limit');
      accounting.requests.works++;
      const opened = await transport(url, { signal: combined, range,
        maxBytes: limits.compressedBytes,
        timeoutMs: Math.max(1, limits.timeoutMs - (Date.now() - started)),
        acceptHeaders: validateWorkPrefixHeaders,
        observeBodyBytes: bytes => {
          accounting.receivedBodyBytes += bytes;
          if (accounting.receivedBodyBytes > limits.compressedBytes) {
            compressedCapReached = true; throw new Error('work-prefix-body-limit');
          }
        } });
      requireValue(opened?.body && typeof opened.body.destroy === 'function', 'acquisition-invalid-response');
      currentBody = opened.body;
      // Injected fixture transports still pass the same response policy.
      const accepted = validateWorkPrefixHeaders(opened);
      if (!accepted) {
        currentBody.destroy(); currentBody = null;
        requireValue(redirects.length < limits.maxRedirects, 'acquisition-redirect-limit');
        let next;
        try { next = new URL(opened.headers.location, url).href; }
        catch { throw new Error('unsafe-acquisition-url'); }
        next = validateAcquisitionSourceUrl(next, sourcePin.url);
        requireValue(new URL(next).search === '', 'unsafe-acquisition-source-route');
        redirects.push({ from: url, to: next, status: opened.status }); url = next; continue;
      }
      response = { url: sourcePin.url, finalUrl: url, status: 206,
        contentRange: opened.headers['content-range'], contentLength: 104857600, redirects };
      const scanned = await scanDumpFailurePrefix(currentBody, sourcePin, selected, retrievedAt,
        { ...limits, signal: combined });
      ({ status, code, failureEvidence } = scanned);
      Object.assign(accounting, { compressedBytes: scanned.stats.bytes, decodedBytes: scanned.stats.decodedBytes,
        rows: scanned.stats.rows, matchedRecords: scanned.stats.matchedRecords, unrelatedRows: scanned.stats.unrelatedRows,
        malformedUnrelatedRows: scanned.stats.malformedUnrelatedRows, prefixComplete: scanned.prefixComplete,
        prefixSha256: scanned.prefixSha256, failureEvidenceBytes: failureEvidence?.rawBytes ?? 0 });
      // A fixture transport may not implement the optional curl observation
      // hook; accepted compressed bytes remain a strict minimum received count.
      accounting.receivedBodyBytes = Math.max(accounting.receivedBodyBytes, accounting.compressedBytes);
      if (compressedCapReached) { status = 'failed'; code = 'work-prefix-body-limit'; failureEvidence = null; accounting.failureEvidenceBytes = 0; }
      else if (combined.aborted) { status = 'failed'; code = controller.signal.aborted ? 'work-prefix-timeout' : 'work-prefix-aborted'; failureEvidence = null; accounting.failureEvidenceBytes = 0; }
      if (status === 'failed') code = safeWorkPrefixError(new Error(code));
      break;
    }
  } catch (error) {
    status = 'failed';
    code = compressedCapReached ? 'work-prefix-body-limit' : combined.aborted
      ? controller.signal.aborted ? 'work-prefix-timeout' : 'work-prefix-aborted' : safeWorkPrefixError(error);
  } finally { clearTimeout(timer); currentBody?.destroy(); controller.abort(); }
  return { contract: WORK_PREFIX_DIAGNOSTIC_CONTRACT, status, code, release, retrievedAt, completedAt: new Date().toISOString(),
    rosterSha256: digest(selected), sourcePin: { ...sourcePin }, range: { ...range }, limits: { ...limits }, response,
    accounting, failureEvidence, fullSourceComplete: false, publisherChecksumsVerified: false,
    candidates: 0, approved: 0, databaseWrites: 0, individualProviderRequests: 0 };
}
