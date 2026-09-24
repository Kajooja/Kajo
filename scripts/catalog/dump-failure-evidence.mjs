// Private diagnostic evidence only: one rejected selected row, never a candidate
// or proof of complete source integrity. No source or filesystem access.
import { digest, inspectRecord, sha256 } from './open-library-descriptions.mjs';

export const FAILURE_EVIDENCE_CONTRACT = 'open-library-selected-row-failure-evidence-v1';
export const FAILURE_EVIDENCE_LIMITS = Object.freeze({ lineBytes: 1049600, records: 1 });
export const IDENTITY_FAILURE_PREDICATES = Object.freeze([
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
    check(exactKeys(evidence, ['contract', 'code', 'predicate', 'sourceKind', 'source', 'rosterSha256',
      'expected', 'row', 'fetchedAt', 'rawBase64', 'rawBytes', 'rawSha256', 'terminated'])
      && evidence.contract === FAILURE_EVIDENCE_CONTRACT && evidence.code === 'provider-identity-mismatch'
      && IDENTITY_FAILURE_PREDICATES.includes(evidence.predicate)
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
    let rejection;
    try { inspectRecord(decoded.slice(boundaries[3] + 1), evidence.expected, kind, evidence.fetchedAt); }
    catch (error) { rejection = error; }
    check(rejection?.message === evidence.code && rejection.identityPredicate === evidence.predicate);
    return evidence;
  } catch { throw new Error('invalid-dump-failure-evidence'); }
}
