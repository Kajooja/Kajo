// Explicit offline exclusion only. A rejected record never becomes a candidate,
// and its foreign location is never followed or substituted into the roster.
import { FAILURE_EVIDENCE_CONTRACT, validateDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { digest, inspectRecord, requireValue } from './open-library-descriptions.mjs';

export const CONFLICT_POLICY_CONTRACT = 'open-library-selected-record-conflict-policy-v1';
const MAX_DIAGNOSTIC_BYTES = 64 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const positiveInteger = (value, maximum) => Number.isSafeInteger(value) && value > 0 && value <= maximum;
const brandedLedgers = new WeakSet();
const ledgerRosters = new WeakMap();

function canonicalRoster(selected) {
  requireValue(Array.isArray(selected) && positiveInteger(selected.length, 385), 'invalid-dump-conflict-roster');
  const works = new Set(), editions = new Set();
  return selected.map(row => {
    requireValue(object(row) && typeof row.workId === 'string' && /^OL\d+W$/.test(row.workId)
      && typeof row.editionId === 'string' && /^OL\d+M$/.test(row.editionId)
      && !works.has(row.workId) && !editions.has(row.editionId), 'invalid-dump-conflict-roster');
    works.add(row.workId); editions.add(row.editionId);
    return { workId: row.workId, editionId: row.editionId };
  }).sort((a, b) => a.workId.localeCompare(b.workId));
}

export function validateDumpConflictPolicy(policy, selected) {
  const roster = canonicalRoster(selected);
  requireValue(exactKeys(policy, ['contract', 'maxConflictedPairs', 'maxDiagnosticBytes'])
    && policy.contract === CONFLICT_POLICY_CONTRACT
    && positiveInteger(policy.maxConflictedPairs, roster.length)
    && positiveInteger(policy.maxDiagnosticBytes, MAX_DIAGNOSTIC_BYTES), 'invalid-dump-conflict-policy');
  return policy;
}

export function assessDumpConflict(evidence, { roster, source, limits } = {}) {
  let selected;
  try {
    selected = canonicalRoster(roster);
    requireValue(evidence !== undefined && validateDumpFailureEvidence(evidence, { roster: selected, source, limits }) === evidence,
      'invalid-dump-conflict-evidence');
  } catch { throw new Error('invalid-dump-conflict-evidence'); }
  const base = { workId: evidence.expected.workId, editionId: evidence.expected.editionId, sourceKind: evidence.sourceKind };
  const fatal = reason => ({ ...base, decision: 'fatal', reason });
  if (evidence.contract !== FAILURE_EVIDENCE_CONTRACT) return fatal('unsupported-evidence-version');
  if (evidence.predicate !== 'record-location-mismatch') return fatal('unsupported-identity-conflict');

  // Evidence validation already replayed the original rejection with original
  // bytes. Decode those same bytes, preserving the original LF/CR convention.
  const bytes = Buffer.from(evidence.rawBase64, 'base64');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes.at(-1) === 13 ? bytes.subarray(0, -1) : bytes);
  const fields = []; let start = 0;
  for (let i = 0; i < 4; i++) {
    const boundary = decoded.indexOf('\t', start);
    fields.push(decoded.slice(start, boundary)); start = boundary + 1;
  }
  const record = JSON.parse(decoded.slice(start));
  const kind = evidence.sourceKind === 'works' ? 'work' : 'edition';
  const keyField = kind === 'work' ? 'workId' : 'editionId';
  const prefix = kind === 'work' ? '/works/' : '/books/';
  const key = prefix + evidence.expected[keyField];
  if (!object(record) || record.key !== key || record.type?.key !== `/type/${kind}`)
    return fatal('unsupported-identity-conflict');
  const locationPattern = kind === 'work' ? /^\/works\/OL\d+W$/ : /^\/books\/OL\d+M$/;
  if (typeof record.location !== 'string' || !locationPattern.test(record.location) || record.location === key)
    return fatal('noncanonical-foreign-location');
  if (selected.some(pair => prefix + pair[keyField] === record.location)) return fatal('selected-target-location');

  // Check only post-identity metadata on a minimal projection. Removing location
  // here does NOT validate or accept the original record; the only eligible
  // decision remains exclusion of its entire original Work/Edition pair.
  const metadata = { key: record.key, type: record.type, revision: record.revision,
    last_modified: record.last_modified, ...(kind === 'edition' ? { works: record.works } : {}) };
  let inspected;
  try { inspected = inspectRecord(JSON.stringify(metadata), evidence.expected, kind, evidence.fetchedAt); }
  catch { return fatal('post-identity-metadata-mismatch'); }
  // This narrow policy requires both fields and exact original strings. It does
  // not round microseconds or equate otherwise different timestamp encodings.
  if (inspected.sourceRevision === null || inspected.sourceModifiedAt === null
    || String(inspected.sourceRevision) !== fields[2] || inspected.sourceModifiedAt !== fields[3])
    return fatal('post-identity-metadata-mismatch');
  return { ...base, decision: 'quarantine-pair', reason: 'foreign-canonical-location' };
}

export function createDumpConflictLedger({ policy, selected }) {
  validateDumpConflictPolicy(policy, selected);
  const fixedPolicy = structuredClone(policy), roster = canonicalRoster(selected), rosterSha256 = digest(roster);
  const policySha256 = digest(fixedPolicy), conflicts = [], quarantined = new Set(), seen = new Set();
  let diagnosticBytes = 0;
  const ledger = Object.freeze({
    record(evidence, { source, limits } = {}) {
      const assessment = assessDumpConflict(evidence, { roster, source, limits });
      requireValue(assessment.decision === 'quarantine-pair', 'dump-conflict-fatal');
      const identity = assessment.sourceKind + ':' + (assessment.sourceKind === 'works' ? assessment.workId : assessment.editionId);
      requireValue(!seen.has(identity), 'duplicate-selected-dump-record');
      requireValue(quarantined.has(assessment.workId) || quarantined.size < fixedPolicy.maxConflictedPairs,
        'dump-conflict-pair-limit');
      requireValue(diagnosticBytes + evidence.rawBytes <= fixedPolicy.maxDiagnosticBytes, 'dump-conflict-diagnostic-limit');
      const retained = structuredClone({ assessment, evidence });
      conflicts.push(retained); seen.add(identity); quarantined.add(assessment.workId);
      diagnosticBytes += evidence.rawBytes;
      return structuredClone(assessment);
    },
    has(workId) { return quarantined.has(workId); },
    snapshot() {
      return structuredClone({ policy: fixedPolicy, policySha256, rosterSha256, conflicts,
        quarantinedWorkIds: roster.filter(pair => quarantined.has(pair.workId)).map(pair => pair.workId), diagnosticBytes });
    },
  });
  brandedLedgers.add(ledger); ledgerRosters.set(ledger, rosterSha256);
  return ledger;
}

export function validateDumpConflictLedger(ledger, selected) {
  requireValue(brandedLedgers.has(ledger) && ledgerRosters.get(ledger) === digest(canonicalRoster(selected)),
    'invalid-dump-conflict-ledger');
  return ledger;
}
