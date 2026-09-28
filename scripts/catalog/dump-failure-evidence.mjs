// Private diagnostic evidence only: a rejected selected row or bounded line
// prefix, never a candidate or full-source proof. No source/filesystem access.
import { digest, inspectRecord, sha256 } from './open-library-descriptions.mjs';

export const LEGACY_FAILURE_EVIDENCE_CONTRACT = 'open-library-selected-row-failure-evidence-v1';
export const FAILURE_EVIDENCE_CONTRACT = 'open-library-selected-row-failure-evidence-v2';
export const FAILURE_EVIDENCE_LIMITS = Object.freeze({ lineBytes: 1049600, records: 1 });
export const IDENTITY_FAILURE_PREDICATES = Object.freeze([
  'record-not-object', 'record-key-mismatch', 'record-type-mismatch', 'record-location-mismatch',
]);
const legacyPredicates = Object.freeze([
  'record-not-object', 'record-key-mismatch', 'record-type-mismatch', 'record-location-present',
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const check = condition => { if (!condition) throw new Error('invalid-dump-failure-evidence'); };
const integer = (value, maximum) => Number.isSafeInteger(value) && value > 0 && value <= maximum;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
  && Number.isFinite(Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z'));
const sourceFields = ['url', 'bytes', 'compression', 'md5', 'sha1', 'sha256'];

// Omit runtime counters/limits and project offline private snapshots to the same
// public identity used by acquisition requests. No Item/source IDs are retained.
export const canonicalDumpSource = source => Object.fromEntries(sourceFields
  .filter(field => Object.hasOwn(source, field)).map(field => [field, source[field]]));
function publicRoster(roster) {
  check(Array.isArray(roster) && integer(roster.length, 385));
  const works = new Set(), editions = new Set();
  return roster.map(row => {
    check(object(row) && typeof row.workId === 'string' && /^OL\d+W$/.test(row.workId)
      && typeof row.editionId === 'string' && /^OL\d+M$/.test(row.editionId)
      && !works.has(row.workId) && !editions.has(row.editionId));
    works.add(row.workId); editions.add(row.editionId);
    return { workId: row.workId, editionId: row.editionId };
  }).sort((a, b) => a.workId.localeCompare(b.workId));
}

export const EDITION_LINE_EVIDENCE_CONTRACT = 'open-library-edition-line-limit-evidence-v1';
export const EDITION_LINE_DIAGNOSTIC_CONTRACT = 'open-library-edition-line-prefix-diagnostic-v1';
export const EDITION_LINE_PREFIX_MAX_BYTES = 4096;
const lineCheck = condition => { if (!condition) throw new Error('invalid-edition-line-diagnostic'); };
const count = value => Number.isSafeInteger(value) && value >= 0;
const diagnosticCodes = Object.freeze({
  diagnosed: ['dump-line-limit'],
  inconclusive: ['edition-line-prefix-exhausted', 'edition-line-row-limit', 'edition-line-decoded-limit'],
  failed: ['edition-line-prefix-overflow', 'edition-line-prefix-truncated', 'edition-line-gzip-invalid',
    'edition-line-stream-failed', 'edition-line-parser-failed', 'edition-line-aborted', 'invalid-dump-encoding',
    'malformed-dump-target-row', 'duplicate-dump-target-record', 'invalid-dump-target-envelope',
    'provider-identity-mismatch', 'malformed-provider-json', 'provider-work-link-mismatch'],
});
const timeValue = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
const same = (a, b) => digest(a) === digest(b);
export const safeEditionLineParserError = error => diagnosticCodes.failed.includes(error?.message)
  ? error.message : 'edition-line-parser-failed';

// Schema ceilings are not an operational allowance. Every caller supplies all
// limits, and the local CLI additionally preserves the consumed request's caps.
export function validateEditionLineContext({ source, roster, limits, fetchedAt } = {}) {
  try {
    const selected = publicRoster(roster), canonical = canonicalDumpSource(source);
    lineCheck(exactKeys(source, Object.keys(canonical)) && source.compression === 'gzip'
      && integer(source.bytes, 64 * 1024 ** 3)
      && (typeof source.sha256 === 'string' && /^[0-9a-f]{64}$/.test(source.sha256)
        || typeof source.md5 === 'string' && /^[0-9a-f]{32}$/.test(source.md5)
          && typeof source.sha1 === 'string' && /^[0-9a-f]{40}$/.test(source.sha1))
      && ['sha256', 'md5', 'sha1'].every(name => source[name] === undefined
        || typeof source[name] === 'string' && new RegExp(`^[0-9a-f]{${name === 'md5' ? 32 : name === 'sha1' ? 40 : 64}}$`).test(source[name]))
      && timestamp(fetchedAt));
    const url = new URL(source.url), match = /\/ol_dump_editions_(\d{4}-\d\d-\d\d)\.txt\.gz$/.exec(url.pathname);
    lineCheck(match && url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash
      && ['archive.org', 'openlibrary.org'].includes(url.hostname));
    const release = match[1], date = new Date(release);
    lineCheck(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === release
      && timeValue(fetchedAt) >= date.getTime()
      && url.pathname === (url.hostname === 'archive.org' ? `/download/ol_dump_${release}/` : '/data/')
        + `ol_dump_editions_${release}.txt.gz`);
    lineCheck(exactKeys(limits, ['compressedBytes', 'maxDecodedBytes', 'maxRows', 'lineBytes', 'prefixBytes', 'timeoutMs'])
      && integer(limits.compressedBytes, source.bytes) && integer(limits.maxDecodedBytes, 512 * 1024 ** 3)
      && integer(limits.maxRows, 200000000) && integer(limits.lineBytes, FAILURE_EVIDENCE_LIMITS.lineBytes)
      && integer(limits.prefixBytes, Math.min(EDITION_LINE_PREFIX_MAX_BYTES, limits.lineBytes))
      && integer(limits.timeoutMs, 6600000));
    return { source: structuredClone(canonical), roster: selected, limits: structuredClone(limits), fetchedAt };
  } catch { throw new Error('invalid-edition-line-diagnostic'); }
}

function fourthTab(bytes) {
  let boundary = -1;
  for (let index = 0; index < 4; index++) { boundary = bytes.indexOf(9, boundary + 1); if (boundary < 0) return -1; }
  return boundary;
}

// Classify only a complete, bounded outer envelope. No JSON, inner key/type,
// Work linkage, language, rights or record identity is validated by this label.
function envelopeSelection(bytes, context) {
  const unknown = reason => ({ status: 'unknown', reason, editionId: null, workId: null });
  if (fourthTab(bytes) < 0) return unknown('header-prefix-incomplete');
  let fields;
  try { fields = new TextDecoder('utf-8', { fatal: true }).decode(bytes).split('\t'); }
  catch { return unknown('invalid-header-encoding'); }
  const [type, key, revision, modifiedAt] = fields;
  if (type !== '/type/edition' || !/^\/books\/OL\d+M$/.test(key) || !/^[1-9]\d*$/.test(revision)
    || !Number.isSafeInteger(Number(revision)) || !timestamp(modifiedAt) || timeValue(modifiedAt) > timeValue(context.fetchedAt))
    return unknown('invalid-edition-envelope');
  const editionId = key.slice('/books/'.length), target = context.roster.find(row => row.editionId === editionId);
  return { status: target ? 'selected' : 'unrelated', reason: 'canonical-edition-envelope', editionId,
    workId: target?.workId ?? null };
}

function editionHeaderPrefix(pending, part, maximum) {
  const head = pending.subarray(0, maximum);
  let bytes = Buffer.concat([head, part.subarray(0, maximum - head.length)]);
  const boundary = fourthTab(bytes);
  if (boundary >= 0) bytes = bytes.subarray(0, boundary + 1);
  return bytes;
}

// The new complete-source framer uses only this bounded outer-header proof.
// Historical diagnostic classification/replay keeps its original semantics.
export function isUnrelatedEditionLine(pending, part, context) {
  const bytes = editionHeaderPrefix(pending, part, Math.min(EDITION_LINE_PREFIX_MAX_BYTES, context.limits.lineBytes));
  if (bytes.some(byte => byte !== 9 && (byte < 32 || byte > 126))
    || envelopeSelection(bytes, context).status !== 'unrelated') return false;
  const modifiedAt = bytes.toString('ascii').split('\t')[3];
  // Date.parse normalizes impossible calendar days and 24:00 into another day.
  // Such headers cannot authorize discard, even though older replay accepts them.
  return new Date(modifiedAt.slice(0, 10)).toISOString().slice(0, 10) === modifiedAt.slice(0, 10)
    && modifiedAt.slice(11, 19) < '24:00:00';
}

export function createEditionLineEvidence({ pending, part, row, lineStartByte, context }) {
  const fixed = validateEditionLineContext(context), maximum = fixed.limits.prefixBytes;
  lineCheck(Buffer.isBuffer(pending) && Buffer.isBuffer(part)
    && pending.length <= fixed.limits.lineBytes && pending.length + part.length > fixed.limits.lineBytes
    && !pending.includes(10) && !part.subarray(0, fixed.limits.lineBytes + 1 - pending.length).includes(10));
  // Never concatenate an oversized row; retain no bytes after the fourth tab.
  const bytes = editionHeaderPrefix(pending, part, maximum);
  const evidence = { contract: EDITION_LINE_EVIDENCE_CONTRACT, code: 'dump-line-limit', sourceKind: 'editions',
    source: fixed.source, rosterSha256: digest(fixed.roster), limitsSha256: digest(fixed.limits), fetchedAt: fixed.fetchedAt,
    row, lineStartByte, observedLineBytesAtLeast: fixed.limits.lineBytes + 1,
    prefixBase64: bytes.toString('base64'), prefixBytes: bytes.length, prefixSha256: sha256(bytes),
    envelopeSelection: envelopeSelection(bytes, fixed), validationScope: 'bounded-outer-envelope-only',
    sizeEvidence: 'scanner-observed-lower-bound', rowComplete: false, rowBytes: null, rowSha256: null };
  return validateEditionLineEvidence(evidence, fixed);
}

export function validateEditionLineEvidence(evidence, context) {
  try {
    const fixed = validateEditionLineContext(context), limits = fixed.limits;
    lineCheck(exactKeys(evidence, ['contract', 'code', 'sourceKind', 'source', 'rosterSha256', 'limitsSha256',
      'fetchedAt', 'row', 'lineStartByte', 'observedLineBytesAtLeast', 'prefixBase64', 'prefixBytes', 'prefixSha256',
      'envelopeSelection', 'validationScope', 'sizeEvidence', 'rowComplete', 'rowBytes', 'rowSha256'])
      && evidence.contract === EDITION_LINE_EVIDENCE_CONTRACT && evidence.code === 'dump-line-limit'
      && evidence.sourceKind === 'editions' && same(evidence.source, fixed.source)
      && evidence.rosterSha256 === digest(fixed.roster) && evidence.limitsSha256 === digest(limits)
      && evidence.fetchedAt === fixed.fetchedAt && integer(evidence.row, limits.maxRows)
      && count(evidence.lineStartByte) && evidence.lineStartByte >= evidence.row - 1
      && (evidence.row !== 1 || evidence.lineStartByte === 0)
      && evidence.observedLineBytesAtLeast === limits.lineBytes + 1
      && evidence.lineStartByte + evidence.observedLineBytesAtLeast <= limits.maxDecodedBytes
      && evidence.validationScope === 'bounded-outer-envelope-only' && evidence.sizeEvidence === 'scanner-observed-lower-bound'
      && evidence.rowComplete === false && evidence.rowBytes === null && evidence.rowSha256 === null
      && integer(evidence.prefixBytes, limits.prefixBytes) && typeof evidence.prefixBase64 === 'string'
      && evidence.prefixBase64.length === 4 * Math.ceil(evidence.prefixBytes / 3)
      && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(evidence.prefixBase64));
    const bytes = Buffer.from(evidence.prefixBase64, 'base64'), boundary = fourthTab(bytes);
    lineCheck(bytes.length === evidence.prefixBytes && bytes.toString('base64') === evidence.prefixBase64
      && sha256(bytes) === evidence.prefixSha256 && !bytes.includes(10)
      && (boundary < 0 ? bytes.length === limits.prefixBytes : bytes.length === boundary + 1)
      && same(evidence.envelopeSelection, envelopeSelection(bytes, fixed)));
    return evidence;
  } catch { throw new Error('invalid-edition-line-diagnostic'); }
}

export function validateEditionLineDiagnostic(result, context) {
  try {
    const fixed = validateEditionLineContext(context), limits = fixed.limits, stats = result?.stats;
    lineCheck(exactKeys(result, ['contract', 'sourceKind', 'source', 'rosterSha256', 'limits', 'fetchedAt', 'completedAt',
      'status', 'code', 'stats', 'prefixComplete', 'prefixSha256', 'failureEvidence', 'fullSourceComplete',
      'publisherChecksumsVerified', 'validationScope', 'provenanceVerified', 'candidates', 'approved', 'databaseWrites',
      'modelAdmissions', 'inspectionSourceRequests']) && result.contract === EDITION_LINE_DIAGNOSTIC_CONTRACT
      && result.sourceKind === 'editions' && same(result.source, fixed.source) && result.rosterSha256 === digest(fixed.roster)
      && same(result.limits, limits) && result.fetchedAt === fixed.fetchedAt && timestamp(result.completedAt)
      && timeValue(result.completedAt) >= timeValue(result.fetchedAt)
      && Object.hasOwn(diagnosticCodes, result.status) && diagnosticCodes[result.status].includes(result.code)
      && result.fullSourceComplete === false && result.publisherChecksumsVerified === false
      && result.validationScope === 'payload-consistency-only' && result.provenanceVerified === false
      && ['candidates', 'approved', 'databaseWrites', 'modelAdmissions', 'inspectionSourceRequests'].every(key => result[key] === 0)
      && exactKeys(stats, ['bytes', 'decodedBytes', 'rows', 'matchedRecords', 'unrelatedRows', 'malformedUnrelatedRows'])
      && Object.values(stats).every(count) && stats.bytes <= limits.compressedBytes && stats.decodedBytes <= limits.maxDecodedBytes
      && stats.rows <= limits.maxRows && stats.rows <= stats.decodedBytes && stats.matchedRecords <= fixed.roster.length
      && (stats.bytes > 0 || stats.decodedBytes === 0)
      && stats.malformedUnrelatedRows <= stats.unrelatedRows && stats.rows >= stats.matchedRecords + stats.unrelatedRows
      && stats.rows <= stats.matchedRecords + stats.unrelatedRows + (result.status === 'failed' ? 1 : 0)
      && typeof result.prefixComplete === 'boolean' && (!result.prefixComplete || stats.bytes === limits.compressedBytes)
      && typeof result.prefixSha256 === 'string' && /^[0-9a-f]{64}$/.test(result.prefixSha256)
      && (stats.bytes !== 0 || result.prefixSha256 === sha256(Buffer.alloc(0))));
    if (result.status === 'diagnosed') {
      const evidence = validateEditionLineEvidence(result.failureEvidence, fixed);
      lineCheck(stats.bytes > 0 && evidence.row === stats.rows + 1
        && evidence.lineStartByte + evidence.observedLineBytesAtLeast <= stats.decodedBytes);
    } else lineCheck(result.failureEvidence === null);
    if (result.code === 'edition-line-row-limit') lineCheck(stats.rows === limits.maxRows);
    if (result.code === 'edition-line-decoded-limit') lineCheck(stats.decodedBytes === limits.maxDecodedBytes);
    if (result.code === 'edition-line-prefix-exhausted') lineCheck(result.prefixComplete);
    return result;
  } catch { throw new Error('invalid-edition-line-diagnostic'); }
}

// Frozen v1 receipt semantics: raw size and JSON parsing preceded the original
// ordered identity guard, which rejected every own location, including self.
// Do not call the live guard here or reinterpret historical failure evidence.
function legacyIdentityFailure(raw, expected, kind) {
  check(Buffer.byteLength(raw) <= 1048576);
  const record = JSON.parse(raw);
  if (!object(record)) return 'record-not-object';
  const key = kind === 'edition' ? `/books/${expected.editionId}` : `/works/${expected.workId}`;
  if (record.key !== key) return 'record-key-mismatch';
  if (record.type?.key !== `/type/${kind}`) return 'record-type-mismatch';
  if (Object.hasOwn(record, 'location')) return 'record-location-present';
  return null;
}

export function createDumpFailureEvidence({ rowBytes, terminated, sourceKind, source, roster, expected,
  row, fetchedAt, predicate, limits }) {
  check(Buffer.isBuffer(rowBytes) && integer(rowBytes.length, Math.min(limits.lineBytes, FAILURE_EVIDENCE_LIMITS.lineBytes)));
  const evidence = { contract: FAILURE_EVIDENCE_CONTRACT, code: 'provider-identity-mismatch', predicate,
    sourceKind, source: canonicalDumpSource(source), rosterSha256: digest(publicRoster(roster)),
    expected: { workId: expected.workId, editionId: expected.editionId }, row, fetchedAt,
    rawBase64: rowBytes.toString('base64'), rawBytes: rowBytes.length, rawSha256: sha256(rowBytes), terminated };
  return validateDumpFailureEvidence(evidence, { roster, source, limits });
}

export function validateDumpFailureEvidence(evidence, { roster, source, limits } = {}) {
  if (evidence === undefined) return null; // Historical receipts remain readable.
  try {
    const legacy = evidence?.contract === LEGACY_FAILURE_EVIDENCE_CONTRACT;
    check(exactKeys(evidence, ['contract', 'code', 'predicate', 'sourceKind', 'source', 'rosterSha256',
      'expected', 'row', 'fetchedAt', 'rawBase64', 'rawBytes', 'rawSha256', 'terminated'])
      && (legacy || evidence.contract === FAILURE_EVIDENCE_CONTRACT) && evidence.code === 'provider-identity-mismatch'
      && (legacy ? legacyPredicates : IDENTITY_FAILURE_PREDICATES).includes(evidence.predicate)
      && ['works', 'editions'].includes(evidence.sourceKind)
      && object(limits) && integer(limits.lineBytes, FAILURE_EVIDENCE_LIMITS.lineBytes)
      && integer(limits.maxRows, 200000000) && integer(evidence.row, limits.maxRows)
      && timestamp(evidence.fetchedAt) && typeof evidence.terminated === 'boolean');
    const canonical = publicRoster(roster);
    check(evidence.rosterSha256 === digest(canonical)
      && exactKeys(evidence.expected, ['workId', 'editionId'])
      && canonical.some(row => row.workId === evidence.expected.workId && row.editionId === evidence.expected.editionId));
    check(object(source) && object(evidence.source)
      && exactKeys(evidence.source, Object.keys(canonicalDumpSource(source)))
      && digest(evidence.source) === digest(canonicalDumpSource(source))
      && typeof source.url === 'string' && integer(source.bytes, 64 * 1024 ** 3)
      && ['gzip', 'none'].includes(source.compression)
      && (typeof source.sha256 === 'string' && /^[0-9a-f]{64}$/.test(source.sha256)
        || typeof source.md5 === 'string' && /^[0-9a-f]{32}$/.test(source.md5)
          && typeof source.sha1 === 'string' && /^[0-9a-f]{40}$/.test(source.sha1)));
    const url = new URL(source.url);
    check(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash
      && ['archive.org', 'openlibrary.org'].includes(url.hostname)
      && new RegExp(`/ol_dump_${evidence.sourceKind}_\\d{4}-\\d\\d-\\d\\d\\.txt${source.compression === 'gzip' ? '\\.gz' : ''}$`).test(url.pathname));
    check(integer(evidence.rawBytes, limits.lineBytes) && /^[0-9a-f]{64}$/.test(evidence.rawSha256)
      && typeof evidence.rawBase64 === 'string' && evidence.rawBase64.length === 4 * Math.ceil(evidence.rawBytes / 3)
      && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(evidence.rawBase64));
    const bytes = Buffer.from(evidence.rawBase64, 'base64');
    check(bytes.length === evidence.rawBytes && bytes.toString('base64') === evidence.rawBase64
      && sha256(bytes) === evidence.rawSha256 && !bytes.includes(10));
    // The scanner excludes LF from row bytes and trims only one trailing CR.
    // The original CR remains above; `terminated` distinguishes LF from EOF.
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes.at(-1) === 13 ? bytes.subarray(0, -1) : bytes);
    const boundaries = []; let start = 0;
    for (let i = 0; i < 4; i++) {
      const next = decoded.indexOf('\t', start); check(next !== -1);
      boundaries.push(next); start = next + 1;
    }
    const kind = evidence.sourceKind === 'works' ? 'work' : 'edition';
    const key = kind === 'work' ? `/works/${evidence.expected.workId}` : `/books/${evidence.expected.editionId}`;
    const revision = decoded.slice(boundaries[1] + 1, boundaries[2]);
    check(decoded.slice(0, boundaries[0]) === `/type/${kind}`
      && decoded.slice(boundaries[0] + 1, boundaries[1]) === key
      && /^[1-9]\d*$/.test(revision) && Number.isSafeInteger(Number(revision))
      && timestamp(decoded.slice(boundaries[2] + 1, boundaries[3])));
    const raw = decoded.slice(boundaries[3] + 1);
    if (legacy) check(legacyIdentityFailure(raw, evidence.expected, kind) === evidence.predicate);
    else {
      let rejection;
      try { inspectRecord(raw, evidence.expected, kind, evidence.fetchedAt); }
      catch (error) { rejection = error; }
      check(rejection?.message === evidence.code && rejection.identityPredicate === evidence.predicate);
    }
    return evidence;
  } catch { throw new Error('invalid-dump-failure-evidence'); }
}
