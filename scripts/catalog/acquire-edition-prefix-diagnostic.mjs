// One pinned Edition range, no metadata request, retries, candidates or writes.
import { curlAcquisitionTransport } from './acquire-open-library-dumps.mjs';
import { requireValue } from './open-library-descriptions.mjs';
import { scanEditionLinePrefix } from './open-library-dump-descriptions.mjs';
import { EDITION_PREFIX_RESULT_CONTRACT, EDITION_PREFIX_MAX_REDIRECTS, EDITION_PREFIX_TRANSPORT_ERRORS,
  editionPrefixContext, editionPrefixRange, editionPrefixRoute, validateEditionPrefixHeaders,
  validateEditionPrefixRequest, validateEditionPrefixResult } from './seal-edition-prefix-diagnostic.mjs';

export async function acquireEditionPrefixDiagnostic(request, { signal, transport = curlAcquisitionTransport } = {}) {
  request = structuredClone(validateEditionPrefixRequest(request));
  const limits = request.diagnosticLimits, retrievedAt = new Date().toISOString(), started = Date.now();
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs); timer.unref?.();
  const accounting = { requests: { works: 0, editions: 0, metadata: 0 }, receivedBodyBytes: 0, redirects: [], response: null };
  let url = request.sourcePins.editions.url, currentBody, diagnostic = null, exceeded = false;
  let status = 'failed', code = 'edition-prefix-failed';
  const visited = new Set();
  try {
    for (;;) {
      combined.throwIfAborted(); url = editionPrefixRoute(url, request);
      requireValue(!visited.has(url), 'acquisition-redirect-loop'); visited.add(url);
      requireValue(accounting.receivedBodyBytes < limits.compressedBytes, 'edition-prefix-body-limit');
      accounting.requests.editions++;
      const response = await transport(url, { signal: combined, range: editionPrefixRange(request),
        maxBytes: limits.compressedBytes - accounting.receivedBodyBytes,
        timeoutMs: Math.max(1, limits.timeoutMs - (Date.now() - started)),
        acceptHeaders: headers => validateEditionPrefixHeaders(headers, request),
        observeBodyBytes: bytes => {
          requireValue(Number.isSafeInteger(bytes) && bytes >= 0, 'acquisition-invalid-response');
          accounting.receivedBodyBytes += bytes;
          if (accounting.receivedBodyBytes > limits.compressedBytes) {
            exceeded = true; throw new Error('edition-prefix-body-limit');
          }
        } });
      requireValue(response?.body && typeof response.body.destroy === 'function', 'acquisition-invalid-response');
      currentBody = response.body;
      if (!validateEditionPrefixHeaders(response, request)) {
        currentBody.destroy(); currentBody = null;
        requireValue(accounting.redirects.length < EDITION_PREFIX_MAX_REDIRECTS, 'acquisition-redirect-limit');
        let next;
        try { next = new URL(response.headers.location, url).href; } catch { throw new Error('unsafe-acquisition-url'); }
        next = editionPrefixRoute(next, request);
        requireValue(!visited.has(next), 'acquisition-redirect-loop');
        accounting.redirects.push({ from: url, to: next, status: response.status }); url = next; continue;
      }
      accounting.response = { url: request.sourcePins.editions.url, finalUrl: url, status: 206,
        contentRange: response.headers['content-range'], contentLength: limits.compressedBytes };
      diagnostic = await scanEditionLinePrefix(currentBody, { ...editionPrefixContext(request, retrievedAt), signal: combined });
      accounting.receivedBodyBytes = Math.max(accounting.receivedBodyBytes, diagnostic.stats.bytes);
      ({ status, code } = diagnostic); break;
    }
  } catch (error) {
    status = 'failed'; code = EDITION_PREFIX_TRANSPORT_ERRORS.includes(error?.message) ? error.message : 'edition-prefix-failed';
    diagnostic = null;
  } finally {
    if (exceeded || combined.aborted) {
      status = 'failed'; diagnostic = null; code = exceeded ? 'edition-prefix-body-limit'
        : controller.signal.aborted ? 'edition-prefix-timeout' : 'edition-prefix-aborted';
    }
    clearTimeout(timer); currentBody?.destroy(); controller.abort();
  }
  return validateEditionPrefixResult({ contract: EDITION_PREFIX_RESULT_CONTRACT, status, code,
    requestSha256: request.requestSha256, sourceHead: request.sourceHead, retrievedAt, completedAt: new Date().toISOString(),
    transport: accounting, diagnostic, provenanceVerified: false, candidates: 0, approved: 0,
    databaseWrites: 0, modelAdmissions: 0 }, request);
}
