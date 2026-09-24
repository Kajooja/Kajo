// Separate, secretless acquisition of two pinned public catalog streams. No
// database client, pilot provider requests, rights decisions or plaintext logs.
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { LIMITS, SOURCE_CONTRACT, scanDumpStream } from './open-library-dump-descriptions.mjs';

export const ACQUISITION_CONTRACT = 'open-library-dump-acquisition-v1';
export const METADATA_INSPECTION_CONTRACT = 'open-library-dump-metadata-inspection-v1';
export const ACQUISITION_RELEASE = '2026-08-31';
export const ACQUISITION_LIMITS = Object.freeze({ metadataBytes: 2 * 1024 * 1024,
  totalCompressedBytes: 15000000000, retainedBytes: 64 * 1024 * 1024,
  lineBytes: LIMITS.lineBytes, maxDecodedBytes: 128 * 1024 ** 3, maxRows: 100000000,
  timeoutMs: 120 * 60 * 1000, metadataTimeoutMs: 30000, maxRedirects: 4 });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const fail = code => new Error(code);
// Only implementation-owned codes survive into private diagnostic receipts.
// A provider or transport string resembling a code is not an allowed code.
export const ACQUISITION_ERROR_CODES = Object.freeze([
  'acquisition-failed', 'invalid-acquisition-roster', 'duplicate-acquisition-identity',
  'invalid-acquisition-limits', 'invalid-acquisition-release', 'unsafe-acquisition-url',
  'unsafe-acquisition-source-route', 'acquisition-aborted', 'acquisition-transport-failed',
  'acquisition-header-limit', 'acquisition-invalid-response', 'acquisition-redirect-loop',
  'acquisition-redirect-limit', 'acquisition-http-failed', 'acquisition-content-encoding',
  'acquisition-metadata-limit', 'acquisition-metadata-timeout', 'invalid-acquisition-metadata',
  'invalid-acquisition-source-count', 'invalid-acquisition-source-integrity', 'acquisition-compressed-byte-limit',
  'missing-dump-checksum', 'dump-row-limit', 'dump-line-limit', 'invalid-dump-encoding',
  'malformed-dump-target-row', 'duplicate-dump-target-record', 'invalid-dump-target-envelope',
  'dump-staging-limit', 'dump-file-size-mismatch', 'dump-decoded-byte-limit', 'dump-checksum-mismatch',
  'invalid-record-context', 'record-too-large', 'malformed-provider-json', 'provider-identity-mismatch',
  'provider-work-link-mismatch', 'invalid-provider-revision', 'invalid-provider-modified-time',
]);
const knownErrorCodes = new Set(ACQUISITION_ERROR_CODES);

export function validateAcquisitionRoster(roster) {
  requireValue(Array.isArray(roster) && roster.length > 0 && roster.length <= LIMITS.targets,
    'invalid-acquisition-roster');
  const works = new Set(), editions = new Set();
  for (const row of roster) {
    requireValue(exactKeys(row, ['workId', 'editionId']) && typeof row.workId === 'string'
      && typeof row.editionId === 'string' && /^OL[1-9]\d*W$/.test(row.workId)
      && /^OL[1-9]\d*M$/.test(row.editionId), 'invalid-acquisition-roster');
    requireValue(!works.has(row.workId) && !editions.has(row.editionId), 'duplicate-acquisition-identity');
    works.add(row.workId); editions.add(row.editionId);
  }
  return roster.map(row => ({ ...row })).sort((a, b) => a.workId.localeCompare(b.workId));
}

function boundedLimits(overrides = {}) {
  requireValue(object(overrides) && Object.keys(overrides).every(key => Object.hasOwn(ACQUISITION_LIMITS, key)),
    'invalid-acquisition-limits');
  const limits = { ...ACQUISITION_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) requireValue(Number.isSafeInteger(value)
    && value >= (key === 'maxRedirects' ? 0 : 1) && value <= ACQUISITION_LIMITS[key], 'invalid-acquisition-limits');
  return limits;
}

export function validateAcquisitionUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw fail('unsafe-acquisition-url'); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
    && (url.hostname === 'archive.org' || url.hostname.endsWith('.archive.org') || url.hostname === 'openlibrary.org'),
  'unsafe-acquisition-url');
  return url.href;
}

// curl keeps ordinary TLS verification and environment proxy behavior. The
// subprocess receives argv directly, never shell text. Redirects and retries are
// deliberately disabled here; every next URL is checked by openOfficial().
export function curlAcquisitionTransport(url, { signal, timeoutMs, maxBytes }, spawnProcess = spawn) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const body = new PassThrough();
    // A header/transport error can arrive before the caller receives the body.
    body.on('error', () => {});
    const child = spawnProcess('curl', ['--disable', '--silent', '--show-error', '--proto', '=https',
      '--suppress-connect-headers', '--connect-timeout', '15', '--max-time', String(Math.max(1, Math.ceil(timeoutMs / 1000))),
      '--speed-limit', '1024', '--speed-time', '60', '--max-filesize', String(maxBytes),
      '--user-agent', 'Kajo-Catalog-Dump-Collector/1.0 (+https://github.com/Kajooja/Kajo)',
      '--include', '--output', '-', '--url', url], { stdio: ['ignore', 'pipe', 'ignore'] });
    let settled = false, exited = false, headers = Buffer.alloc(0), headerBytes = 0;
    const stop = error => {
      if (!settled) { settled = true; reject(error); }
      body.destroy(error);
      if (!exited) child.kill('SIGTERM');
    };
    const abort = () => stop(fail('acquisition-aborted'));
    signal?.addEventListener('abort', abort, { once: true });
    body.on('close', () => { if (!exited) child.kill('SIGTERM'); });
    body.on('drain', () => child.stdout.resume());
    child.on('error', () => stop(fail('acquisition-transport-failed')));
    child.stdout.on('error', () => stop(fail('acquisition-transport-failed')));
    const writeBody = chunk => { if (chunk.length && !body.write(chunk)) child.stdout.pause(); };
    child.stdout.on('data', chunk => {
      if (settled) { writeBody(chunk); return; }
      headers = Buffer.concat([headers, chunk]);
      for (let boundary = headers.indexOf('\r\n\r\n'); boundary !== -1; boundary = headers.indexOf('\r\n\r\n')) {
        headerBytes += boundary + 4;
        if (headerBytes > 32768) return stop(fail('acquisition-header-limit'));
        const lines = headers.subarray(0, boundary).toString('latin1').split('\r\n');
        headers = headers.subarray(boundary + 4);
        const match = /^HTTP\/(?:1\.[01]|2|3) (\d{3})(?: |$)/.exec(lines.shift());
        if (!match) return stop(fail('acquisition-invalid-response'));
        const status = Number(match[1]);
        if (status >= 100 && status < 200) continue;
        if (settled) return stop(fail('acquisition-invalid-response'));
        const responseHeaders = {};
        for (const line of lines) {
          const colon = line.indexOf(':');
          if (colon <= 0) return stop(fail('acquisition-invalid-response'));
          const key = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
          if (Object.hasOwn(responseHeaders, key)) {
            if (['location', 'content-length', 'content-encoding'].includes(key)) return stop(fail('acquisition-invalid-response'));
            continue;
          }
          responseHeaders[key] = value;
        }
        settled = true;
        resolve({ status, headers: responseHeaders, body });
        writeBody(headers);
        headers = Buffer.alloc(0);
        return;
      }
      if (headerBytes + headers.length > 32768) stop(fail('acquisition-header-limit'));
    });
    child.on('close', code => {
      exited = true;
      signal?.removeEventListener('abort', abort);
      if (code !== 0 || !settled) stop(fail('acquisition-transport-failed'));
      else body.end();
    });
    if (signal?.aborted) abort();
  });
}

async function openOfficial(url, options, transport, limits, onRequest = () => {}) {
  const redirects = [], visited = new Set();
  const original = new URL(validateAcquisitionUrl(url));
  const metadataPath = `/metadata/ol_dump_${ACQUISITION_RELEASE}`;
  const filename = original.pathname.split('/').at(-1);
  const isMetadata = original.pathname === metadataPath;
  for (;;) {
    url = validateAcquisitionUrl(url);
    const current = new URL(url);
    const archiveHost = current.hostname === 'archive.org' || current.hostname.endsWith('.archive.org');
    const archiveFile = new RegExp(`^/(?:download|serve|items|[0-9]+/items)/ol_dump_${ACQUISITION_RELEASE}/${filename.replaceAll('.', '\\.')}$`);
    requireValue(isMetadata ? archiveHost && current.pathname === metadataPath
      : archiveHost && archiveFile.test(current.pathname)
        || current.hostname === 'openlibrary.org' && current.pathname === `/data/${filename}`,
    'unsafe-acquisition-source-route');
    requireValue(!visited.has(url), 'acquisition-redirect-loop');
    visited.add(url);
    options.signal.throwIfAborted();
    onRequest();
    const response = await transport(url, options);
    requireValue(response && response.body && typeof response.body.destroy === 'function', 'acquisition-invalid-response');
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      response.body.destroy();
      requireValue(redirects.length < limits.maxRedirects && typeof response.headers?.location === 'string',
        'acquisition-redirect-limit');
      let next;
      try { next = new URL(response.headers.location, url).href; } catch { throw fail('unsafe-acquisition-url'); }
      redirects.push({ from: url, to: validateAcquisitionUrl(next), status: response.status });
      url = next;
      continue;
    }
    if (response.status !== 200) { response.body.destroy(); throw fail('acquisition-http-failed'); }
    if (response.headers?.['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
      response.body.destroy(); throw fail('acquisition-content-encoding');
    }
    return { ...response, url, redirects };
  }
}

async function readBounded(body, maximum, signal, onBytes = () => {}) {
  const chunks = [];
  let bytes = 0;
  const abort = () => body.destroy(fail('acquisition-aborted'));
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    for await (const chunk of body) {
      bytes += chunk.length;
      onBytes(bytes);
      requireValue(bytes <= maximum, 'acquisition-metadata-limit');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally { signal.removeEventListener('abort', abort); body.destroy(); }
}

export function validateAcquisitionMetadata(document, release, limits = ACQUISITION_LIMITS) {
  requireValue(release === ACQUISITION_RELEASE && object(document) && !Object.hasOwn(document, 'error')
    && document.metadata?.identifier === `ol_dump_${release}` && Array.isArray(document.files),
  'invalid-acquisition-metadata');
  const sources = {};
  for (const kind of ['works', 'editions']) {
    const name = `ol_dump_${kind}_${release}.txt.gz`;
    const entries = document.files.filter(row => object(row) && row.name === name);
    requireValue(entries.length === 1, 'invalid-acquisition-source-count');
    const entry = entries[0];
    requireValue(typeof entry.size === 'string' && /^[1-9]\d*$/.test(entry.size)
      && Number.isSafeInteger(Number(entry.size)) && Number(entry.size) <= limits.totalCompressedBytes
      && typeof entry.md5 === 'string' && /^[0-9a-f]{32}$/.test(entry.md5)
      && typeof entry.sha1 === 'string' && /^[0-9a-f]{40}$/.test(entry.sha1)
      && (entry.sha256 === undefined || /^[0-9a-f]{64}$/.test(entry.sha256)), 'invalid-acquisition-source-integrity');
    sources[kind] = { url: `https://archive.org/download/ol_dump_${release}/${name}`,
      bytes: Number(entry.size), md5: entry.md5, sha1: entry.sha1,
      ...(entry.sha256 === undefined ? {} : { sha256: entry.sha256 }),
      compression: 'gzip', maxDecodedBytes: limits.maxDecodedBytes, maxRows: limits.maxRows };
  }
  requireValue(sources.works.bytes + sources.editions.bytes <= limits.totalCompressedBytes,
    'acquisition-compressed-byte-limit');
  return sources;
}

export function safeAcquisitionError(error) {
  return knownErrorCodes.has(error?.message) ? error.message : 'acquisition-failed';
}

function initialAccounting(retrievedAt) {
  return { startedAt: retrievedAt, activeSource: 'metadata', metadata: { bytes: 0, complete: false },
    sources: {}, retainedRecordBytes: 0, requests: { metadata: 0, works: 0, editions: 0 },
    individualProviderRequests: 0, databaseWrites: 0 };
}

// Shared by full collection and metadata-only inspection. Evidence is captured
// before decoding/validation; it is private input for encryption, never a log.
async function inspectMetadata({ release, signal, transport, limits, accounting }) {
  const metadataUrl = `https://archive.org/metadata/ol_dump_${release}`;
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  const timer = setTimeout(() => controller.abort(), Math.min(limits.metadataTimeoutMs, limits.timeoutMs));
  timer.unref?.();
  let meta, raw;
  try {
    meta = await openOfficial(metadataUrl, { signal: combined,
      timeoutMs: Math.min(limits.metadataTimeoutMs, limits.timeoutMs), maxBytes: limits.metadataBytes }, transport, limits,
    () => accounting.requests.metadata++);
    raw = await readBounded(meta.body, limits.metadataBytes, combined, bytes => { accounting.metadata.bytes = bytes; });
    Object.assign(accounting.metadata, { complete: true, sha256: sha256(raw), rawBase64: raw.toString('base64'),
      url: metadataUrl, finalUrl: meta.url, redirects: meta.redirects });
  } catch (error) {
    if (controller.signal.aborted) throw fail('acquisition-metadata-timeout');
    throw error;
  } finally { clearTimeout(timer); controller.abort(); }
  return { raw, metadata: accounting.metadata, ...inspectAcquisitionMetadataBytes(raw, release, limits) };
}

export function inspectAcquisitionMetadataBytes(raw, release, limits = ACQUISITION_LIMITS) {
  let document;
  try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch { return { validation: { valid: false, code: 'invalid-acquisition-metadata', pinnedSources: null } }; }
  try {
    const pinnedSources = validateAcquisitionMetadata(document, release, limits);
    return { document, validation: { valid: true, code: null, pinnedSources } };
  } catch (error) {
    return { document, validation: { valid: false, code: safeAcquisitionError(error), pinnedSources: null } };
  }
}

export async function inspectOpenLibraryDumpMetadata({ release, signal, transport = curlAcquisitionTransport,
  limits: overrides } = {}) {
  requireValue(release === ACQUISITION_RELEASE, 'invalid-acquisition-release');
  const limits = boundedLimits(overrides), controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const retrievedAt = new Date().toISOString(), accounting = initialAccounting(retrievedAt);
  try {
    const inspected = await inspectMetadata({ release, signal: combined, transport, limits, accounting });
    accounting.activeSource = null;
    accounting.completedAt = new Date().toISOString();
    return { contract: METADATA_INSPECTION_CONTRACT, status: 'inspected', release, retrievedAt,
      completedAt: accounting.completedAt, limits, metadata: inspected.metadata, validation: inspected.validation,
      accounting, dumpRequests: 0, approved: 0, databaseWrites: 0, individualProviderRequests: 0 };
  } catch (error) {
    accounting.failedAt = new Date().toISOString();
    const failure = fail(combined.aborted ? 'acquisition-aborted' : safeAcquisitionError(error));
    failure.accounting = structuredClone(accounting);
    throw failure;
  } finally { controller.abort(); }
}

export async function acquireOpenLibraryDumps({ release, roster, signal, transport = curlAcquisitionTransport,
  limits: overrides } = {}) {
  requireValue(release === ACQUISITION_RELEASE, 'invalid-acquisition-release');
  const selected = validateAcquisitionRoster(roster), limits = boundedLimits(overrides);
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  timer.unref?.();
  const started = Date.now(), retrievedAt = new Date().toISOString();
  const accounting = initialAccounting(retrievedAt);
  const budget = { bytes: 0 };
  try {
    const { raw, document, metadata, validation } = await inspectMetadata({ release,
      signal: combined, transport, limits, accounting });
    requireValue(validation.valid, validation.code);
    // Freeze both exact file identities, publisher hashes and byte bounds before
    // the first large GET. MD5/SHA-1 are compared, never replaced by our own hash.
    const pinned = validation.pinnedSources;
    const sources = {}, collected = {};
    for (const kind of ['works', 'editions']) {
      const source = pinned[kind];
      accounting.activeSource = kind;
      accounting.sources[kind] = { bytes: 0, decodedBytes: 0, rows: 0, matchedRecords: 0,
        unrelatedRows: 0, malformedUnrelatedRows: 0, complete: false, expectedBytes: source.bytes };
      const response = await openOfficial(source.url, { signal: combined, maxBytes: source.bytes,
        timeoutMs: Math.max(1, limits.timeoutMs - (Date.now() - started)) }, transport, limits,
      () => accounting.requests[kind]++);
      const length = response.headers?.['content-length'];
      if (length !== undefined && (!/^\d+$/.test(length) || Number(length) !== source.bytes)) {
        response.body.destroy(); throw fail('dump-file-size-mismatch');
      }
      const scan = await scanDumpStream(response.body, source, kind, selected, retrievedAt, budget,
        { signal: combined, keyOf: row => row.workId, lineBytes: limits.lineBytes, retainedBytes: limits.retainedBytes,
          observeProgress: stats => { accounting.sources[kind] = Object.assign(stats, { complete: false, expectedBytes: source.bytes }); } });
      collected[kind] = scan.records;
      sources[kind] = { ...source, ...scan.stats, finalUrl: response.url, redirects: response.redirects,
        publisherChecksumsVerified: true };
      accounting.sources[kind] = { ...scan.stats, expectedBytes: source.bytes, publisherChecksumsVerified: true };
    }
    const records = selected.map(row => ({ ...row, work: collected.works.get(row.workId) ?? null,
      edition: collected.editions.get(row.workId) ?? null }));
    const coverage = { targets: records.length, found: 0, missing: 0, eligibleTexts: 0, targetsWithEligibleText: 0 };
    for (const row of records) {
      let eligible = false;
      for (const kind of ['work', 'edition']) {
        if (row[kind]) coverage.found++; else coverage.missing++;
        if (row[kind]?.inspection.description.status === 'eligible') { coverage.eligibleTexts++; eligible = true; }
      }
      if (eligible) coverage.targetsWithEligibleText++;
    }
    return { contract: ACQUISITION_CONTRACT, status: 'collected', release, retrievedAt,
      completedAt: new Date().toISOString(), rosterSha256: digest(selected), limits,
      metadata: { url: metadata.url, finalUrl: metadata.finalUrl, redirects: metadata.redirects,
        bytes: raw.length, sha256: sha256(raw), raw: raw.toString('utf8'), document }, sources,
      sourceManifest: { contract: SOURCE_CONTRACT, release, retrievedAt,
        sources: Object.fromEntries(Object.entries(sources).map(([kind, source]) => [kind,
          Object.fromEntries(['url', 'sha256', 'bytes', 'compression', 'maxDecodedBytes', 'maxRows'].map(key => [key, source[key]]))])) },
      retainedRecordBytes: budget.bytes, records, coverage, approved: 0, databaseWrites: 0,
      individualProviderRequests: 0, rights: 'unreviewed',
      note: 'Unreviewed public-identifier collection only. Bind against a fresh private catalog snapshot locally before any review or application.' };
  } catch (error) {
    accounting.retainedRecordBytes = budget.bytes;
    accounting.failedAt = new Date().toISOString();
    const failure = fail(combined.aborted ? 'acquisition-aborted' : safeAcquisitionError(error));
    failure.accounting = structuredClone(accounting);
    throw failure;
  } finally { clearTimeout(timer); controller.abort(); }
}
