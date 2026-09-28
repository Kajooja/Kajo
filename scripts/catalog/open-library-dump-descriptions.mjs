// Offline intake only. No provider/database client, rights approval or pilot replay.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { digest, inspectRecord, requireValue, sha256, UUID } from './open-library-descriptions.mjs';
import { createDumpFailureEvidence, FAILURE_EVIDENCE_LIMITS, createEditionLineEvidence,
  EDITION_LINE_DIAGNOSTIC_CONTRACT, safeEditionLineParserError, validateEditionLineContext,
  validateEditionLineDiagnostic, canonicalDumpSource, isUnrelatedEditionLine } from './dump-failure-evidence.mjs';
import { createDumpConflictLedger, validateDumpConflictLedger } from './dump-conflict-policy.mjs';

export const TARGET_CONTRACT = 'open-library-description-dump-targets-v1';
export const SOURCE_CONTRACT = 'open-library-description-dump-source-v1';
export const INTAKE_CONTRACT = 'open-library-description-dump-intake-v1';
export const CONFLICT_INTAKE_CONTRACT = 'open-library-description-dump-conflict-intake-v1';
export const LIMITS = Object.freeze({ targets: 385, lineBytes: FAILURE_EVIDENCE_LIMITS.lineBytes, stagedRecordBytes: 64 * 1024 * 1024,
  fileBytes: 64 * 1024 ** 3, decodedBytes: 512 * 1024 ** 3, rows: 200000000 });
export const DEFAULT_STAGING_ROOT = fileURLToPath(new URL('../../dist/catalog-enrichment/', import.meta.url));
const HASH = /^[0-9a-f]{64}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const boundedInteger = (value, maximum) => Number.isSafeInteger(value) && value > 0 && value <= maximum;
// Open Library also supplies timestamps without a timezone; they denote UTC.
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
  && Number.isFinite(Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z'));
const timeValue = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
// Only the selected-row inspection below can brand an exception. A transport's
// arbitrary error properties cannot become private diagnostic evidence.
const selectedRowFailures = new WeakMap();
export const readDumpFailureEvidence = error => selectedRowFailures.get(error);

export function validateDumpTargets(snapshot) {
  requireValue(exactKeys(snapshot, ['contract', 'checkedAt', 'targets']) && snapshot.contract === TARGET_CONTRACT
    && timestamp(snapshot.checkedAt) && Array.isArray(snapshot.targets)
    && snapshot.targets.length > 0 && snapshot.targets.length <= LIMITS.targets, 'invalid-dump-target-snapshot');
  const identities = ['itemId', 'sourceId', 'workId', 'editionId'].map(() => new Set());
  const fields = ['itemId', 'sourceId', 'workId', 'editionId', 'displayLanguage', 'itemUpdatedAt',
    'sourceUpdatedAt', 'descriptionSha256', 'managedDescription', 'identityMatches'];
  for (const row of snapshot.targets) {
    requireValue(exactKeys(row, fields) && UUID.test(row.itemId) && UUID.test(row.sourceId)
      && /^OL\d+W$/.test(row.workId) && /^OL\d+M$/.test(row.editionId)
      && (row.displayLanguage === null || /^[a-z]{2,3}$/.test(row.displayLanguage))
      && timestamp(row.itemUpdatedAt) && timestamp(row.sourceUpdatedAt)
      && timeValue(row.itemUpdatedAt) <= timeValue(snapshot.checkedAt)
      && timeValue(row.sourceUpdatedAt) <= timeValue(snapshot.checkedAt)
      && (row.descriptionSha256 === null || HASH.test(row.descriptionSha256))
      && typeof row.managedDescription === 'boolean' && row.identityMatches === true, 'invalid-dump-target-identity');
    ['itemId', 'sourceId', 'workId', 'editionId'].forEach((field, index) => {
      requireValue(!identities[index].has(row[field]), 'duplicate-dump-target-identity');
      identities[index].add(row[field]);
    });
  }
  return snapshot.targets.filter(row => row.descriptionSha256 === null && !row.managedDescription)
    .toSorted((a, b) => a.itemId.localeCompare(b.itemId));
}

export function validateDumpSources(manifest) {
  requireValue(exactKeys(manifest, ['contract', 'release', 'retrievedAt', 'sources'])
    && manifest.contract === SOURCE_CONTRACT && /^\d{4}-\d\d-\d\d$/.test(manifest.release)
    && !Number.isNaN(Date.parse(manifest.release))
    && new Date(manifest.release).toISOString().slice(0, 10) === manifest.release && timestamp(manifest.retrievedAt)
    && timeValue(manifest.retrievedAt) >= Date.parse(manifest.release)
    && exactKeys(manifest.sources, ['works', 'editions']), 'invalid-dump-source-manifest');
  for (const kind of ['works', 'editions']) {
    const source = manifest.sources[kind];
    requireValue(exactKeys(source, ['url', 'sha256', 'bytes', 'compression', 'maxDecodedBytes', 'maxRows'])
      && HASH.test(source.sha256) && boundedInteger(source.bytes, LIMITS.fileBytes)
      && ['gzip', 'none'].includes(source.compression)
      && boundedInteger(source.maxDecodedBytes, LIMITS.decodedBytes)
      && boundedInteger(source.maxRows, LIMITS.rows), 'invalid-dump-source-bounds');
    let url;
    try { url = new URL(source.url); } catch { throw new Error('invalid-dump-source-url'); }
    const filename = `ol_dump_${kind}_${manifest.release}.txt${source.compression === 'gzip' ? '.gz' : ''}`;
    const sourcePath = url.hostname === 'archive.org' ? `/download/ol_dump_${manifest.release}/${filename}`
      : `/data/${filename}`;
    requireValue(url.protocol === 'https:' && ['archive.org', 'openlibrary.org'].includes(url.hostname)
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && url.pathname === sourcePath, 'invalid-dump-source-url');
  }
  return manifest;
}

export function planDumpDescriptions(snapshot, manifest) {
  const selected = validateDumpTargets(snapshot);
  if (manifest !== undefined) validateDumpSources(manifest);
  return { contract: INTAKE_CONTRACT, status: 'planned', targetSnapshotSha256: digest(snapshot),
    sourceManifestSha256: manifest === undefined ? null : digest(manifest),
    catalogTargets: snapshot.targets.length, selectedTargets: selected.length,
    excludedExistingOrManaged: snapshot.targets.length - selected.length,
    expectedRecords: selected.length * 2, limits: LIMITS, providerRequests: 0, databaseWrites: 0, approved: 0 };
}

export function safeDumpError(error) {
  if (error.code === 'EEXIST') return 'dump-output-already-exists';
  if (error.code === 'ENOENT') return 'missing-dump-input';
  return /^(?:invalid|duplicate|missing|unsafe|unexpected|dump|record|provider|malformed)-[a-z-]+$/.test(error.message)
    ? error.message : 'dump-operation-failed';
}

// A newly created direct child is an exclusive, persistent run claim. No resume
// command or automatic replacement of a failed run is implied by this intake.
async function claimOutput(root, output) {
  const stagingRoot = resolve(root);
  const directory = resolve(output);
  requireValue(dirname(directory) === stagingRoot && directory !== stagingRoot, 'unsafe-dump-output');
  const parents = [];
  for (let path = stagingRoot; path !== dirname(path); path = dirname(path)) parents.unshift(path);
  for (const path of parents) {
    try { await mkdir(path, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = await lstat(path);
    requireValue(info.isDirectory() && !info.isSymbolicLink(), 'unsafe-dump-output-parent');
  }
  await mkdir(directory, { mode: 0o700 });
  return directory;
}

export { claimOutput as claimDumpDiagnosticOutput };

async function jsonFile(path, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  return sha256(bytes);
}

// Shared byte-stream parser; callers own source acquisition and trust checks.
// The local intake still supplies a pre-pinned SHA-256. The acquisition runner
// supplies both publisher MD5/SHA-1 and records SHA-256 only after complete EOF.
// One row/envelope/identity parser is used by complete intake and diagnostic
// prefixes. Prefix mode retains only seen public IDs and one rejected row.
function createDumpRowParser({ source, kind, selected, fetchedAt, budget, keyOf, lineBytes,
  retainedBytes, stats, prefix, conflictLedger, lineDiagnostic, editionFraming }) {
  const type = kind === 'works' ? 'work' : 'edition';
  const targets = new Map(selected.map(row => [type === 'work' ? `/works/${row.workId}` : `/books/${row.editionId}`, row]));
  const records = new Map(), seen = new Set();
  let selectedError;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = Buffer.alloc(0);
  let lineStartByte = 0, lineError, lineEvidence;
  let discarding = false, discardedLineBytes = 0;
  function boundLine(part) {
    if (editionFraming && part.length) requireValue(stats.rows < source.maxRows, 'dump-row-limit');
    if (discarding) return;
    if (pending.length + part.length <= lineBytes) return;
    if (editionFraming && isUnrelatedEditionLine(pending, part, editionFraming)) {
      discarding = true;
      discardedLineBytes = pending.length;
      stats.oversizedUnrelatedBytes += pending.length;
      pending = Buffer.alloc(0);
      return;
    }
    const error = new Error('dump-line-limit');
    if (lineDiagnostic) {
      lineEvidence = createEditionLineEvidence({ pending, part, row: stats.rows + 1, lineStartByte, context: lineDiagnostic });
      lineError = error;
    }
    throw error;
  }
  function countRow() {
    if (prefix && stats.rows === source.maxRows) throw prefix.rowLimit;
    stats.rows += 1;
    requireValue(stats.rows <= source.maxRows, 'dump-row-limit');
  }
  function discard(part) {
    discardedLineBytes += part.length;
    stats.oversizedUnrelatedBytes += part.length;
  }
  function line(bytes, terminated) {
    const rowBytes = bytes;
    countRow();
    if (editionFraming) stats.maxBufferedLineBytes = Math.max(stats.maxBufferedLineBytes, bytes.length);
    if (bytes.at(-1) === 13) bytes = bytes.subarray(0, -1);
    requireValue(bytes.length <= lineBytes, 'dump-line-limit');
    let decoded;
    try { decoded = decoder.decode(bytes); }
    catch { throw new Error('invalid-dump-encoding'); }
    const boundaries = [];
    let start = 0;
    for (let index = 0; index < 4; index++) {
      const next = decoded.indexOf('\t', start);
      if (next === -1) break;
      boundaries.push(next);
      start = next + 1;
    }
    const key = boundaries.length ? decoded.slice(boundaries[0] + 1, boundaries[1] ?? decoded.length) : null;
    const target = targets.get(key);
    if (!target) {
      stats.unrelatedRows += 1;
      if (boundaries.length !== 4) stats.malformedUnrelatedRows += 1;
      return;
    }
    requireValue(boundaries.length === 4, 'malformed-dump-target-row');
    requireValue(!seen.has(keyOf(target)), 'duplicate-dump-target-record');
    const recordType = decoded.slice(0, boundaries[0]);
    const revision = decoded.slice(boundaries[1] + 1, boundaries[2]);
    const modifiedAt = decoded.slice(boundaries[2] + 1, boundaries[3]);
    const raw = decoded.slice(boundaries[3] + 1);
    requireValue(recordType === `/type/${type}` && /^[1-9]\d*$/.test(revision)
      && Number.isSafeInteger(Number(revision)) && timestamp(modifiedAt), 'invalid-dump-target-envelope');
    let inspection;
    try { inspection = inspectRecord(raw, target, type, fetchedAt); }
    catch (error) {
      if (error.message === 'provider-identity-mismatch' && error.identityPredicate) {
        const evidence = createDumpFailureEvidence({ rowBytes, terminated, sourceKind: kind, source,
          roster: selected, expected: target, row: stats.rows, fetchedAt, predicate: error.identityPredicate,
          limits: { lineBytes, maxRows: source.maxRows } });
        selectedRowFailures.set(error, evidence);
        if (conflictLedger) {
          // Diagnostics share the cumulative raw-record budget. Neither a
          // quarantined row nor a later suppressed partner refunds that charge.
          requireValue(budget.bytes + evidence.rawBytes <= retainedBytes, 'dump-staging-limit');
          conflictLedger.record(evidence, { source, limits: { lineBytes, maxRows: source.maxRows } });
          budget.bytes += evidence.rawBytes;
          seen.add(keyOf(target));
          stats.quarantinedRecords += 1;
          return;
        }
      }
      selectedError = error;
      throw error;
    }
    requireValue((inspection.sourceRevision === null || inspection.sourceRevision === Number(revision))
      && (inspection.sourceModifiedAt === null || timeValue(inspection.sourceModifiedAt) === timeValue(modifiedAt)),
    'invalid-dump-target-envelope');
    seen.add(keyOf(target));
    if (!prefix) {
      budget.bytes += Buffer.byteLength(raw);
      requireValue(budget.bytes <= retainedBytes, 'dump-staging-limit');
      records.set(keyOf(target), { raw, inspection, inspectionSha256: digest(inspection),
        dump: { row: stats.rows, revision: Number(revision), modifiedAt } });
    }
    stats.matchedRecords += 1;
  }
  function write(chunk) {
    const remaining = source.maxDecodedBytes - stats.decodedBytes;
    const accepted = prefix && chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    stats.decodedBytes += accepted.length;
    requireValue(stats.decodedBytes <= source.maxDecodedBytes, 'dump-decoded-byte-limit');
    let start = 0;
    for (let end = accepted.indexOf(10); end !== -1; end = accepted.indexOf(10, start)) {
      const part = accepted.subarray(start, end);
      boundLine(part);
      if (discarding) {
        discard(part);
        countRow();
        stats.unrelatedRows += 1;
        stats.oversizedUnrelatedRows += 1;
        lineStartByte += discardedLineBytes + 1;
        discarding = false; discardedLineBytes = 0;
      } else {
        line(pending.length ? Buffer.concat([pending, part]) : part, true);
        lineStartByte += pending.length + part.length + 1;
      }
      pending = Buffer.alloc(0);
      start = end + 1;
      if (prefix && stats.rows === source.maxRows) throw prefix.rowLimit;
    }
    const tail = accepted.subarray(start);
    boundLine(tail);
    if (discarding) discard(tail);
    else {
      pending = pending.length ? Buffer.concat([pending, tail]) : Buffer.from(tail);
      if (editionFraming) stats.maxBufferedLineBytes = Math.max(stats.maxBufferedLineBytes, pending.length);
    }
    if (prefix && stats.decodedBytes === source.maxDecodedBytes) throw prefix.decodedLimit;
  }
  return { records, write, finish: () => {
    requireValue(!discarding, 'dump-unterminated-oversized-row');
    if (pending.length) line(pending, false);
  },
    failureEvidence: error => error === selectedError ? readDumpFailureEvidence(error) : undefined,
    lineFailureEvidence: error => error === lineError ? lineEvidence : undefined };
}

export async function scanDumpStream(input, source, kind, selected, fetchedAt, budget,
  { signal, keyOf = row => row.itemId, lineBytes = LIMITS.lineBytes,
    retainedBytes = LIMITS.stagedRecordBytes, observeProgress } = {}) {
  // Historical callers cannot opt in by adding a policy/ledger option. This
  // entry point always preserves the original abort-on-conflict behavior.
  return scanDumpStreamInternal(input, source, kind, selected, fetchedAt, budget,
    { signal, keyOf, lineBytes, retainedBytes, observeProgress });
}

export async function scanDumpConflictStream(input, source, kind, selected, fetchedAt, budget,
  { conflictLedger, signal, keyOf = row => row.itemId, lineBytes = LIMITS.lineBytes,
    retainedBytes = LIMITS.stagedRecordBytes, observeProgress } = {}) {
  validateDumpConflictLedger(conflictLedger, selected);
  requireValue(['works', 'editions'].includes(kind) && boundedInteger(lineBytes, LIMITS.lineBytes)
    && boundedInteger(retainedBytes, LIMITS.stagedRecordBytes)
    && Number.isSafeInteger(budget?.bytes) && budget.bytes >= 0 && budget.bytes <= retainedBytes,
  'invalid-dump-conflict-scan');
  return scanDumpStreamInternal(input, structuredClone(source), kind, structuredClone(selected), fetchedAt, budget,
    { conflictLedger, signal, keyOf, lineBytes, retainedBytes, observeProgress });
}

// Explicit local core only: no historical entrypoint, request or recovery opts
// into this rule. Supply the entire original roster, including quarantined pairs.
export async function scanEditionFramedStream(input, source, selected, fetchedAt, budget,
  { signal, lineBytes, retainedBytes, timeoutMs, conflictLedger, keyOf = row => row.workId, observeProgress } = {}) {
  const canonical = canonicalDumpSource(source);
  requireValue(input instanceof Readable && exactKeys(source, [...Object.keys(canonical), 'maxRows', 'maxDecodedBytes'])
    && boundedInteger(retainedBytes, LIMITS.stagedRecordBytes)
    && Number.isSafeInteger(budget?.bytes) && budget.bytes >= 0 && budget.bytes <= retainedBytes,
  'invalid-edition-framing-scan');
  const editionFraming = validateEditionLineContext({ source: canonical, roster: selected, fetchedAt,
    limits: { compressedBytes: source.bytes, maxDecodedBytes: source.maxDecodedBytes, maxRows: source.maxRows,
      lineBytes, prefixBytes: Math.min(4096, lineBytes), timeoutMs } });
  if (conflictLedger !== undefined) validateDumpConflictLedger(conflictLedger, selected);
  const fixedSource = structuredClone(source), fixedRoster = structuredClone(selected);
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref?.();
  try {
    return await scanDumpStreamInternal(input, fixedSource, 'editions', fixedRoster, fetchedAt, budget,
      { signal: combined, lineBytes, retainedBytes, conflictLedger, keyOf, observeProgress, editionFraming });
  } finally { clearTimeout(timer); }
}

async function scanDumpStreamInternal(input, source, kind, selected, fetchedAt, budget,
  { signal, keyOf, lineBytes, retainedBytes, observeProgress, conflictLedger, editionFraming }) {
  const stats = { bytes: 0, decodedBytes: 0, rows: 0, matchedRecords: 0, unrelatedRows: 0, malformedUnrelatedRows: 0,
    ...(conflictLedger ? { quarantinedRecords: 0, complete: false } : {}),
    ...(editionFraming ? { oversizedUnrelatedRows: 0, oversizedUnrelatedBytes: 0, maxBufferedLineBytes: 0, complete: false } : {}) };
  observeProgress?.(stats);
  requireValue(source.sha256 !== undefined || source.md5 !== undefined && source.sha1 !== undefined,
    'missing-dump-checksum');
  const hashes = Object.fromEntries(['sha256', ...['md5', 'sha1'].filter(name => source[name] !== undefined)]
    .map(name => [name, createHash(name)]));
  const parser = createDumpRowParser({ source, kind, selected, fetchedAt, budget, keyOf, lineBytes,
    retainedBytes, stats, conflictLedger, editionFraming });
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    try {
      stats.bytes += chunk.length;
      requireValue(stats.bytes <= source.bytes, 'dump-file-size-mismatch');
      for (const hash of Object.values(hashes)) hash.update(chunk);
      callback(null, chunk);
    } catch (error) { callback(error); }
  } });
  const sink = new Writable({ write(chunk, _encoding, callback) {
    try { parser.write(chunk); callback(); } catch (error) { callback(error); }
  } });
  const streams = [input, meter];
  if (source.compression === 'gzip') streams.push(createGunzip());
  streams.push(sink);
  // Always consume to EOF, including after every target was found: digest and
  // gzip footer integrity cover the whole file, and a later duplicate must fail.
  await pipeline(...streams, ...(signal ? [{ signal }] : []));
  parser.finish();
  requireValue(stats.bytes === source.bytes, 'dump-file-size-mismatch');
  const checksums = Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name, hash.digest('hex')]));
  for (const [name, value] of Object.entries(checksums))
    requireValue(source[name] === undefined || source[name] === value, 'dump-checksum-mismatch');
  return { records: parser.records, stats: { ...stats, ...checksums, complete: true } };
}

// This separate entry point never returns collected records or complete-file
// integrity. Only its own parser exceptions can diagnose a rejected selected row.
export async function scanDumpFailurePrefix(input, source, selected, fetchedAt,
  { compressedBytes, maxDecodedBytes, maxRows, lineBytes, signal, observeProgress }) {
  const stats = { bytes: 0, decodedBytes: 0, rows: 0, matchedRecords: 0, unrelatedRows: 0, malformedUnrelatedRows: 0 };
  observeProgress?.(stats);
  const prefix = { rowLimit: new Error('work-prefix-row-limit'), decodedLimit: new Error('work-prefix-decoded-limit') };
  const rangeOverflow = new Error('work-prefix-range-overflow');
  const parser = createDumpRowParser({ source: { ...source, maxDecodedBytes, maxRows }, kind: 'works', selected,
    fetchedAt, keyOf: row => row.workId, lineBytes, stats, prefix });
  const hash = createHash('sha256');
  let inputEnded = false, inputError, gzipError, parserError;
  const onEnd = () => { inputEnded = true; };
  const onInputError = error => { if (!gzipError && !parserError) inputError = error; };
  input.on('end', onEnd); input.on('error', onInputError);
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    if (stats.bytes + chunk.length > compressedBytes) return callback(rangeOverflow);
    stats.bytes += chunk.length; hash.update(chunk); callback(null, chunk);
  } });
  const gunzip = createGunzip();
  gunzip.on('error', error => { if (!inputError && !parserError) gzipError = error; });
  const sink = new Writable({ write(chunk, _encoding, callback) {
    try { parser.write(chunk); callback(); }
    catch (error) { parserError = error; callback(error); }
  } });
  let status = 'inconclusive', code = 'work-prefix-range-exhausted', failureEvidence = null;
  try {
    await pipeline(input, meter, gunzip, sink, ...(signal ? [{ signal }] : []));
    // Deliberately do not inspect an unterminated tail from a partial source.
    if (!inputEnded || stats.bytes !== compressedBytes) { status = 'failed'; code = 'work-prefix-truncated'; }
  } catch (error) {
    const evidence = parser.failureEvidence(error);
    if (evidence) { status = 'diagnosed'; code = 'provider-identity-mismatch'; failureEvidence = evidence; }
    else if (error === prefix.rowLimit || error === prefix.decodedLimit) { code = error.message; }
    else if (error === gzipError && !inputError && gzipError.code === 'Z_BUF_ERROR'
      && inputEnded && stats.bytes === compressedBytes) { /* Expected incomplete gzip at the exact range end. */ }
    else {
      status = 'failed';
      if (error === rangeOverflow) code = rangeOverflow.message;
      else if (error === parserError) code = parserError.message;
      else if (error === gzipError && !inputError) code = gzipError.code === 'Z_BUF_ERROR'
        ? 'work-prefix-truncated' : 'work-prefix-gzip-invalid';
      else code = 'work-prefix-stream-failed';
    }
  } finally { input.removeListener('end', onEnd); input.removeListener('error', onInputError); }
  return { status, code, stats, prefixComplete: inputEnded && stats.bytes === compressedBytes,
    prefixSha256: hash.digest('hex'), failureEvidence };
}

// Separate diagnostic entrypoint. It uses the same framer/identity guards but
// retains only one bounded outer envelope, never candidates or a full row.
// The supplied stream is caller-owned acquisition; this function opens nothing.
export async function scanEditionLinePrefix(input, { source, roster, limits, fetchedAt, signal } = {}) {
  const context = validateEditionLineContext({ source, roster, limits, fetchedAt });
  requireValue(input instanceof Readable, 'invalid-edition-line-input');
  ({ source, roster, limits, fetchedAt } = context);
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs); timer.unref?.();
  const stats = { bytes: 0, decodedBytes: 0, rows: 0, matchedRecords: 0, unrelatedRows: 0, malformedUnrelatedRows: 0 };
  const prefix = { rowLimit: new Error('edition-line-row-limit'), decodedLimit: new Error('edition-line-decoded-limit') };
  const overflow = new Error('edition-line-prefix-overflow');
  const parser = createDumpRowParser({ source: { ...source, maxRows: limits.maxRows, maxDecodedBytes: limits.maxDecodedBytes },
    kind: 'editions', selected: roster, fetchedAt, keyOf: row => row.workId, lineBytes: limits.lineBytes,
    stats, prefix, lineDiagnostic: context });
  const hash = createHash('sha256');
  let inputEnded = false, inputError, gzipError, parserError;
  const onEnd = () => { inputEnded = true; };
  const onInputError = error => { if (!gzipError && !parserError) inputError = error; };
  input.on('end', onEnd); input.on('error', onInputError);
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    if (stats.bytes + chunk.length > limits.compressedBytes) return callback(overflow);
    stats.bytes += chunk.length; hash.update(chunk); callback(null, chunk);
  } });
  const gunzip = createGunzip();
  gunzip.on('error', error => { if (!inputError && !parserError) gzipError = error; });
  const sink = new Writable({ write(chunk, _encoding, callback) {
    try { parser.write(chunk); callback(); }
    catch (error) { parserError = error; callback(error); }
  } });
  let status = 'inconclusive', code = 'edition-line-prefix-exhausted', failureEvidence = null;
  try {
    await pipeline(input, meter, gunzip, sink, { signal: combined });
    // Prefix exhaustion cannot validate an unterminated tail or a full source.
    if (!inputEnded || stats.bytes !== limits.compressedBytes) { status = 'failed'; code = 'edition-line-prefix-truncated'; }
  } catch (error) {
    const evidence = parser.lineFailureEvidence(error);
    if (combined.aborted) { status = 'failed'; code = 'edition-line-aborted'; }
    else if (error === parserError && !inputError && !gzipError && evidence) {
      status = 'diagnosed'; code = 'dump-line-limit'; failureEvidence = evidence;
    } else if (error === prefix.rowLimit || error === prefix.decodedLimit) { code = error.message; }
    else if (error === gzipError && !inputError && !parserError && gzipError.code === 'Z_BUF_ERROR'
      && inputEnded && stats.bytes === limits.compressedBytes && limits.compressedBytes < source.bytes) {
      // Expected incomplete gzip only at the exact declared partial-prefix end.
    } else {
      status = 'failed';
      if (error === overflow) code = 'edition-line-prefix-overflow';
      else if (error === parserError && !inputError && !gzipError) code = safeEditionLineParserError(error);
      else if (error === gzipError && !inputError && !parserError) code = gzipError.code === 'Z_BUF_ERROR'
        ? 'edition-line-prefix-truncated' : 'edition-line-gzip-invalid';
      else code = 'edition-line-stream-failed';
    }
  } finally {
    clearTimeout(timer); input.removeListener('end', onEnd); input.removeListener('error', onInputError);
  }
  return validateEditionLineDiagnostic({ contract: EDITION_LINE_DIAGNOSTIC_CONTRACT, sourceKind: 'editions', source,
    rosterSha256: digest(roster), limits, fetchedAt, completedAt: new Date().toISOString(), status, code, stats,
    prefixComplete: inputEnded && !inputError && stats.bytes === limits.compressedBytes, prefixSha256: hash.digest('hex'),
    failureEvidence, fullSourceComplete: false, publisherChecksumsVerified: false, validationScope: 'payload-consistency-only',
    provenanceVerified: false, candidates: 0, approved: 0, databaseWrites: 0, modelAdmissions: 0, inspectionSourceRequests: 0 }, context);
}

async function scanDump(path, source, kind, selected, fetchedAt, budget) {
  const sourceInfo = await lstat(path);
  requireValue(sourceInfo.isFile() && !sourceInfo.isSymbolicLink(), 'unsafe-dump-input');
  requireValue(sourceInfo.size === source.bytes, 'dump-file-size-mismatch');
  return scanDumpStream(createReadStream(path), source, kind, selected, fetchedAt, budget);
}

export async function stageDumpDescriptions({ snapshot, manifest, worksPath, editionsPath,
  outputDirectory, stagingRoot = DEFAULT_STAGING_ROOT }) {
  const plan = planDumpDescriptions(snapshot, manifest);
  requireValue(manifest !== undefined && typeof worksPath === 'string' && typeof editionsPath === 'string'
    && resolve(worksPath) !== resolve(editionsPath), 'invalid-dump-input-paths');
  const selected = validateDumpTargets(snapshot);
  requireValue(selected.length > 0, 'missing-dump-targets');
  const directory = await claimOutput(stagingRoot, outputDirectory);
  const state = { ...plan, status: 'collecting', sources: {}, startedAt: new Date().toISOString() };
  const checkpoint = async () => {
    await jsonFile(join(directory, 'state.next.json'), state);
    await rename(join(directory, 'state.next.json'), join(directory, 'state.json'));
  };
  try {
    await checkpoint();
    await jsonFile(join(directory, 'targets.json'), snapshot);
    await jsonFile(join(directory, 'sources.json'), manifest);
    const budget = { bytes: 0 };
    const works = await scanDump(worksPath, manifest.sources.works, 'works', selected, manifest.retrievedAt, budget);
    state.sources.works = works.stats;
    await checkpoint();
    const editions = await scanDump(editionsPath, manifest.sources.editions, 'editions', selected, manifest.retrievedAt, budget);
    state.sources.editions = editions.stats;
    const records = selected.map(target => ({ itemId: target.itemId,
      work: works.records.get(target.itemId) ?? null, edition: editions.records.get(target.itemId) ?? null }));
    const coverage = { recordsFound: 0, recordsMissing: 0, eligibleTexts: 0, targetWithEligibleText: 0,
      descriptionStatuses: {} };
    const review = records.map(row => {
      const options = {};
      let eligible = false;
      for (const kind of ['edition', 'work']) {
        const record = row[kind];
        if (record) coverage.recordsFound += 1;
        else coverage.recordsMissing += 1;
        const status = record?.inspection.description.status ?? 'record-missing';
        coverage.descriptionStatuses[status] = (coverage.descriptionStatuses[status] ?? 0) + 1;
        if (status === 'eligible') { coverage.eligibleTexts += 1; eligible = true; }
        options[kind] = record ? { ...record.inspection, dump: record.dump,
          inspectionSha256: record.inspectionSha256 } : null;
      }
      if (eligible) coverage.targetWithEligibleText += 1;
      return { itemId: row.itemId, options, decision: { status: 'unreviewed', choice: null,
        textLanguage: null, rights: 'unreviewed', basis: null, attribution: null, permission: null } };
    });
    state.recordsFileSha256 = await jsonFile(join(directory, 'records.json'), { contract: INTAKE_CONTRACT, records });
    state.reviewFileSha256 = await jsonFile(join(directory, 'review.json'), { contract: INTAKE_CONTRACT,
      targetSnapshotSha256: plan.targetSnapshotSha256, sourceManifestSha256: plan.sourceManifestSha256,
      note: 'Technical candidates only; language, fallback choice and source-specific rights require review. This is not an apply packet.',
      candidates: review });
    Object.assign(state, { status: 'staged', coverage, stagedRecordBytes: budget.bytes,
      completedAt: new Date().toISOString() });
    await checkpoint();
    return { ...plan, status: 'staged', coverage, sources: state.sources,
      recordsFileSha256: state.recordsFileSha256, reviewFileSha256: state.reviewFileSha256 };
  } catch (error) {
    state.status = 'failed';
    state.failure = safeDumpError(error);
    await checkpoint();
    throw new Error(state.failure);
  }
}

// Explicit local-only successor. No existing request, acquisition collector or
// default stage call supplies a conflict ledger or changes its result contract.
export async function stageDumpDescriptionsWithConflicts({ snapshot, manifest, policy, worksPath, editionsPath,
  outputDirectory, stagingRoot = DEFAULT_STAGING_ROOT }) {
  // Bind and scan the same immutable local values even if a caller changes its
  // objects while filesystem operations yield. No historical API is changed.
  snapshot = structuredClone(snapshot);
  manifest = structuredClone(manifest);
  policy = structuredClone(policy);
  const originalPlan = planDumpDescriptions(snapshot, manifest);
  requireValue(manifest !== undefined && typeof worksPath === 'string' && typeof editionsPath === 'string'
    && resolve(worksPath) !== resolve(editionsPath), 'invalid-dump-input-paths');
  const selected = validateDumpTargets(snapshot);
  requireValue(selected.length > 0, 'missing-dump-targets');
  const ledger = createDumpConflictLedger({ policy, selected });
  const initialLedger = ledger.snapshot();
  const plan = { ...originalPlan, contract: CONFLICT_INTAKE_CONTRACT,
    policySha256: initialLedger.policySha256, rosterSha256: initialLedger.rosterSha256 };
  const bindings = { contract: CONFLICT_INTAKE_CONTRACT, targetSnapshotSha256: plan.targetSnapshotSha256,
    sourceManifestSha256: plan.sourceManifestSha256, policySha256: plan.policySha256, rosterSha256: plan.rosterSha256 };
  const directory = await claimOutput(stagingRoot, outputDirectory);
  const budget = { bytes: 0 };
  const state = { ...plan, status: 'collecting-with-conflict-policy', sources: {}, activeSource: null,
    startedAt: new Date().toISOString(), cumulativeStagedBytes: 0, diagnosticBytes: 0,
    approved: 0, databaseWrites: 0, providerRequests: 0, modelAdmissions: 0 };
  const checkpoint = async () => {
    state.cumulativeStagedBytes = budget.bytes;
    state.diagnosticBytes = ledger.snapshot().diagnosticBytes;
    await jsonFile(join(directory, 'state.next.json'), state);
    await rename(join(directory, 'state.next.json'), join(directory, 'state.json'));
  };
  const scan = async (path, kind) => {
    state.activeSource = kind;
    const source = manifest.sources[kind], sourceInfo = await lstat(path);
    requireValue(sourceInfo.isFile() && !sourceInfo.isSymbolicLink(), 'unsafe-dump-input');
    requireValue(sourceInfo.size === source.bytes, 'dump-file-size-mismatch');
    const result = await scanDumpConflictStream(createReadStream(path), source, kind, selected,
      manifest.retrievedAt, budget, { conflictLedger: ledger, observeProgress: stats => { state.sources[kind] = stats; } });
    state.sources[kind] = result.stats;
    state.activeSource = null;
    await checkpoint();
    return result;
  };
  try {
    await checkpoint();
    await jsonFile(join(directory, 'targets.json'), snapshot);
    await jsonFile(join(directory, 'sources.json'), manifest);
    await jsonFile(join(directory, 'policy.json'), initialLedger.policy);
    const works = await scan(worksPath, 'works');
    const editions = await scan(editionsPath, 'editions');
    state.activeSource = null;
    // Full EOF/gzip/hash checks for both files precede all candidate artifacts.
    const quarantine = ledger.snapshot(), excluded = new Set(quarantine.quarantinedWorkIds);
    const coverage = { selectedTargets: selected.length, survivingTargets: selected.length - excluded.size,
      validMatchedRecords: works.stats.matchedRecords + editions.stats.matchedRecords,
      quarantinedPairs: excluded.size, quarantinedRows: works.stats.quarantinedRecords + editions.stats.quarantinedRecords,
      pairedRecordsSuppressed: 0, quarantinedMissingRecords: 0, recordsFound: 0, recordsMissing: 0,
      eligibleTexts: 0, targetWithEligibleText: 0, descriptionStatuses: {} };
    const records = [], review = [];
    let validRecordBytes = 0, survivingRecordBytes = 0;
    for (const target of selected) {
      const row = { itemId: target.itemId, workId: target.workId, editionId: target.editionId,
        work: works.records.get(target.itemId) ?? null, edition: editions.records.get(target.itemId) ?? null };
      const found = ['work', 'edition'].filter(kind => row[kind] !== null);
      const bytes = found.reduce((total, kind) => total + Buffer.byteLength(row[kind].raw), 0);
      validRecordBytes += bytes;
      if (excluded.has(target.workId)) {
        coverage.pairedRecordsSuppressed += found.length;
        continue;
      }
      records.push(row);
      survivingRecordBytes += bytes;
      const options = {};
      let eligible = false;
      for (const kind of ['edition', 'work']) {
        const record = row[kind];
        if (record) coverage.recordsFound += 1; else coverage.recordsMissing += 1;
        const status = record?.inspection.description.status ?? 'record-missing';
        coverage.descriptionStatuses[status] = (coverage.descriptionStatuses[status] ?? 0) + 1;
        if (status === 'eligible') { coverage.eligibleTexts += 1; eligible = true; }
        options[kind] = record ? { ...record.inspection, dump: record.dump,
          inspectionSha256: record.inspectionSha256 } : null;
      }
      if (eligible) coverage.targetWithEligibleText += 1;
      review.push({ itemId: row.itemId, options, decision: { status: 'unreviewed', choice: null,
        textLanguage: null, rights: 'unreviewed', basis: null, attribution: null, permission: null } });
    }
    coverage.quarantinedMissingRecords = 2 * coverage.quarantinedPairs - coverage.quarantinedRows - coverage.pairedRecordsSuppressed;
    requireValue(coverage.quarantinedRows === quarantine.conflicts.length && coverage.quarantinedMissingRecords >= 0
      && coverage.validMatchedRecords === coverage.recordsFound + coverage.pairedRecordsSuppressed
      && selected.length * 2 === coverage.recordsFound + coverage.recordsMissing + 2 * coverage.quarantinedPairs
      && budget.bytes === validRecordBytes + quarantine.diagnosticBytes
      && ['works', 'editions'].every(kind => state.sources[kind].complete === true
        && state.sources[kind].rows === state.sources[kind].matchedRecords + state.sources[kind].quarantinedRecords
          + state.sources[kind].unrelatedRows), 'invalid-dump-conflict-accounting');
    const accounting = { cumulativeStagedBytes: budget.bytes, diagnosticBytes: quarantine.diagnosticBytes,
      validRecordBytes, survivingRecordBytes, suppressedRecordBytes: validRecordBytes - survivingRecordBytes };
    state.recordsFileSha256 = await jsonFile(join(directory, 'records.json'), { ...bindings, records });
    state.quarantineFileSha256 = await jsonFile(join(directory, 'quarantine.json'), { ...bindings,
      status: 'excluded-pairs-after-complete-source-verification', ledger: quarantine });
    state.reviewFileSha256 = await jsonFile(join(directory, 'review.json'), { ...bindings,
      note: 'Surviving technical options only. Quarantined pairs cannot be reviewed here. This is not an apply packet.', candidates: review });
    Object.assign(state, { status: 'staged-with-conflict-policy', coverage, accounting, completedAt: new Date().toISOString() });
    state.reportFileSha256 = await jsonFile(join(directory, 'report.json'), { ...bindings, status: state.status,
      sources: state.sources, coverage, accounting, recordsFileSha256: state.recordsFileSha256,
      quarantineFileSha256: state.quarantineFileSha256, reviewFileSha256: state.reviewFileSha256,
      rights: 'unreviewed', approved: 0, databaseWrites: 0, providerRequests: 0, modelAdmissions: 0 });
    await checkpoint();
    // Public CLI output is aggregate-only; exact evidence/bindings remain in the
    // private directory, including when every selected pair is excluded.
    return { contract: CONFLICT_INTAKE_CONTRACT, status: state.status,
      selectedTargets: selected.length, survivingTargets: coverage.survivingTargets,
      quarantinedPairs: coverage.quarantinedPairs, quarantinedRows: coverage.quarantinedRows,
      pairedRecordsSuppressed: coverage.pairedRecordsSuppressed, recordsFound: coverage.recordsFound,
      recordsMissing: coverage.recordsMissing, eligibleTexts: coverage.eligibleTexts,
      targetWithEligibleText: coverage.targetWithEligibleText, fullSourcesVerified: 2,
      approved: 0, databaseWrites: 0, providerRequests: 0, modelAdmissions: 0 };
  } catch (error) {
    state.status = 'failed-with-conflict-policy';
    state.failure = safeDumpError(error);
    await rm(join(directory, 'state.next.json'), { force: true });
    // A later write/checkpoint failure cannot leave candidate-bearing artifacts
    // looking like a completed intake. Keep only bounded diagnostic evidence.
    for (const name of ['records', 'review', 'report']) {
      await rm(join(directory, `${name}.json`), { force: true });
      delete state[`${name}FileSha256`];
    }
    const quarantine = ledger.snapshot();
    if (quarantine.conflicts.length > 0) {
      state.quarantineFileSha256 = await jsonFile(join(directory, 'quarantine.next.json'), { ...bindings,
        status: 'diagnostic-only-incomplete-intake', ledger: quarantine });
      await rename(join(directory, 'quarantine.next.json'), join(directory, 'quarantine.json'));
    } else {
      await rm(join(directory, 'quarantine.json'), { force: true });
      delete state.quarantineFileSha256;
    }
    await checkpoint();
    throw new Error(state.failure);
  }
}
