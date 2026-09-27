// Pure private payload consistency checks. This does not authenticate a sender,
// Git checkout, workflow, activation, or full dump bytes absent from recovery.
import { digest, inspectRecord, sha256 } from './open-library-descriptions.mjs';
import { validateDumpSources, validateDumpTargets } from './open-library-dump-descriptions.mjs';
import { createDumpConflictLedger, validateDumpConflictPolicy } from './dump-conflict-policy.mjs';
import { CONFLICT_ACQUISITION_CONTRACT, REVIEWED_ACQUISITION_LIMITS, safeConflictAcquisitionError, validateAcquisitionRoster, validateAcquisitionSourceUrl } from './acquire-open-library-dumps.mjs';

export const CONFLICT_ACQUISITION_RESULT_CONTRACT = CONFLICT_ACQUISITION_CONTRACT;
const kinds = ['works', 'editions'];
const recordKinds = ['work', 'edition'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const same = (a, b) => digest(a) === digest(b);
const count = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => count(value) && value > 0;
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const timeValue = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
  && Number.isFinite(timeValue(value));
const check = (condition, code = 'invalid-conflict-acquisition-payload') => { if (!condition) throw new Error(code); };
const counters = ['bytes', 'decodedBytes', 'rows', 'matchedRecords', 'unrelatedRows', 'malformedUnrelatedRows', 'quarantinedRecords'];
const checksums = ['sha256', 'md5', 'sha1'];
const zeroFields = ['approved', 'databaseWrites', 'individualProviderRequests', 'modelAdmissions'];

function validateContext(request) {
  check(object(request) && /^\d{4}-\d\d-\d\d$/.test(request.release) && timestamp(`${request.release}T00:00:00Z`)
    && exact(request.sourcePins, kinds) && object(request.sourceEvidence), 'invalid-conflict-payload-context');
  const roster = validateAcquisitionRoster(request.roster);
  check(same(roster, request.roster), 'noncanonical-conflict-roster');
  const limits = request.limits;
  check(exact(limits, Object.keys(REVIEWED_ACQUISITION_LIMITS))
    && Object.entries(limits).every(([key, value]) => count(value) && value >= (key === 'maxRedirects' ? 0 : 1)
      && value <= REVIEWED_ACQUISITION_LIMITS[key]), 'invalid-conflict-payload-limits');
  validateDumpConflictPolicy(request.conflictPolicy, roster);
  for (const kind of kinds) {
    const pin = request.sourcePins[kind];
    check(exact(pin, ['url', 'bytes', 'compression', 'md5', 'sha1', ...(Object.hasOwn(pin, 'sha256') ? ['sha256'] : [])])
      && positive(pin.bytes) && /^[0-9a-f]{32}$/.test(pin.md5) && /^[0-9a-f]{40}$/.test(pin.sha1)
      && (pin.sha256 === undefined || hash(pin.sha256)) && pin.compression === 'gzip', 'invalid-conflict-source-pin');
  }
  validateDumpSources({ contract: 'open-library-description-dump-source-v1', release: request.release,
    retrievedAt: `${request.release}T00:00:00Z`, sources: Object.fromEntries(kinds.map(kind => [kind,
      { url: request.sourcePins[kind].url, bytes: request.sourcePins[kind].bytes, compression: 'gzip',
        sha256: request.sourcePins[kind].sha256 ?? '0'.repeat(64), maxDecodedBytes: limits.maxDecodedBytes, maxRows: limits.maxRows }])) });
  check(kinds.reduce((total, kind) => total + request.sourcePins[kind].bytes, 0) <= limits.totalCompressedBytes,
    'conflict-source-budget-mismatch');
  return roster;
}

function replayQuarantine(result, request, roster) {
  const saved = result.quarantine;
  check(exact(saved, ['policy', 'policySha256', 'rosterSha256', 'conflicts', 'quarantinedWorkIds', 'diagnosticBytes'])
    && Array.isArray(saved.conflicts) && saved.conflicts.length <= roster.length * 2, 'invalid-conflict-quarantine');
  const ledger = createDumpConflictLedger({ policy: request.conflictPolicy, selected: roster });
  const rows = { works: new Set(), editions: new Set() }, selectedKeys = { works: new Set(), editions: new Set() };
  const minimumDecodedBytes = { works: 0, editions: 0 };
  let previousKind = 0, previousRow = 0;
  for (const entry of saved.conflicts) {
    check(exact(entry, ['assessment', 'evidence']) && kinds.includes(entry.evidence?.sourceKind), 'invalid-conflict-quarantine');
    const evidence = entry.evidence, kind = evidence.sourceKind, kindIndex = kinds.indexOf(kind);
    check(kindIndex >= previousKind && (kindIndex > previousKind || evidence.row > previousRow),
      'conflict-ledger-order-mismatch');
    previousKind = kindIndex; previousRow = evidence.row;
    minimumDecodedBytes[kind] += evidence.rawBytes + (evidence.terminated ? 1 : 0);
    check(evidence.fetchedAt === result.retrievedAt && !rows[kind].has(evidence.row), 'conflict-evidence-time-or-row-mismatch');
    const assessment = ledger.record(evidence, { source: request.sourcePins[kind], limits: request.limits });
    check(same(assessment, entry.assessment), 'conflict-assessment-mismatch');
    rows[kind].add(evidence.row); selectedKeys[kind].add(evidence.expected.workId);
  }
  const replay = ledger.snapshot();
  check(same(replay, saved), 'conflict-ledger-replay-mismatch');
  return { ledger: replay, rows, selectedKeys, minimumDecodedBytes };
}

function validateAccounting(result, request, replay, success) {
  const a = result.accounting, limits = request.limits;
  const keys = ['startedAt', 'activeSource', 'metadata', 'sources', 'requests', 'individualProviderRequests', 'databaseWrites',
    'cumulativeStagedBytes', 'diagnosticBytes', success ? 'completedAt' : 'failedAt',
    ...(success ? ['validRecordBytes', 'survivingRecordBytes', 'suppressedRecordBytes'] : [])];
  check(exact(a, keys) && a.startedAt === result.retrievedAt && a[success ? 'completedAt' : 'failedAt'] === result.completedAt
    && a.individualProviderRequests === 0 && a.databaseWrites === 0 && count(a.cumulativeStagedBytes)
    && a.diagnosticBytes === replay.ledger.diagnosticBytes && a.cumulativeStagedBytes >= a.diagnosticBytes
    && same(a.metadata, { bytes: 0, complete: false, skipped: true, reason: 'reviewed-pinned-source-evidence' })
    && exact(a.requests, ['metadata', ...kinds]) && a.requests.metadata === 0
    && kinds.every(kind => count(a.requests[kind]) && a.requests[kind] <= limits.maxRedirects + 1)
    && object(a.sources) && Object.keys(a.sources).every(kind => kinds.includes(kind))
    && [...kinds, null].includes(a.activeSource), 'invalid-conflict-accounting');
  check(a.cumulativeStagedBytes <= limits.retainedBytes
    || !success && result.code === 'dump-staging-limit' && a.cumulativeStagedBytes <= limits.retainedBytes + 1048576,
  'conflict-staging-budget-mismatch');
  check(a.requests.editions === 0 && a.sources.editions === undefined && a.activeSource !== 'editions'
    || a.sources.works?.complete === true, 'conflict-edition-before-complete-work');
  let completeBytes = 0;
  for (const kind of kinds) {
    const source = a.sources[kind], pin = request.sourcePins[kind];
    if (source === undefined) {
      check(!success && a.requests[kind] === 0 && replay.rows[kind].size === 0, 'conflict-source-accounting-missing');
      continue;
    }
    const complete = source.complete === true;
    check(exact(source, [...counters, 'complete', 'expectedBytes', ...(complete ? [...checksums, 'publisherChecksumsVerified'] : [])])
      && typeof source.complete === 'boolean' && counters.every(key => count(source[key]))
      && source.expectedBytes === pin.bytes && source.matchedRecords + source.quarantinedRecords <= request.roster.length
      && source.quarantinedRecords === replay.rows[kind].size && source.malformedUnrelatedRows <= source.unrelatedRows
      && [...replay.rows[kind]].every(row => row <= source.rows)
      && source.decodedBytes >= replay.minimumDecodedBytes[kind]
      && replay.ledger.conflicts.filter(entry => entry.evidence.sourceKind === kind)
        .every(entry => entry.evidence.terminated || entry.evidence.row === source.rows)
      && (a.requests[kind] > 0 || !complete && counters.every(key => source[key] === 0)), 'invalid-conflict-source-accounting');
    const accountedRows = source.matchedRecords + source.quarantinedRecords + source.unrelatedRows;
    if (complete) {
      check(source.publisherChecksumsVerified === true && source.bytes === pin.bytes && source.md5 === pin.md5
        && source.sha1 === pin.sha1 && hash(source.sha256) && (pin.sha256 === undefined || source.sha256 === pin.sha256)
        && source.rows <= limits.maxRows && source.decodedBytes <= limits.maxDecodedBytes && source.rows === accountedRows,
      'invalid-complete-conflict-source');
      completeBytes += source.bytes;
    } else {
      check(!success && kind === a.activeSource && source.rows >= accountedRows && source.rows <= accountedRows + 1
        && (source.rows <= limits.maxRows || result.code === 'dump-row-limit' && source.rows === limits.maxRows + 1)
        && (source.bytes <= pin.bytes || result.code === 'dump-file-size-mismatch')
        && (source.decodedBytes <= limits.maxDecodedBytes || result.code === 'dump-decoded-byte-limit'),
      'invalid-partial-conflict-source');
    }
  }
  check(success ? a.activeSource === null && kinds.every(kind => a.sources[kind]?.complete === true)
    : kinds.includes(a.activeSource) && a.sources[a.activeSource]?.complete === false,
  'invalid-conflict-active-source');
  if (!success) {
    const active = a.sources[a.activeSource];
    check(result.code !== 'dump-row-limit' || active.rows === limits.maxRows + 1, 'conflict-row-limit-reason-mismatch');
    check(result.code !== 'dump-decoded-byte-limit' || active.decodedBytes > limits.maxDecodedBytes,
      'conflict-decoded-limit-reason-mismatch');
    const matched = kinds.reduce((sum, kind) => sum + (a.sources[kind]?.matchedRecords ?? 0), 0);
    const validBytes = a.cumulativeStagedBytes - a.diagnosticBytes;
    check(validBytes >= matched && validBytes <= (matched + (result.code === 'dump-staging-limit' ? 1 : 0)) * 1048576,
      'conflict-partial-byte-accounting-mismatch');
  }
  return completeBytes;
}

function replayRecord(record, pair, kind, result, request, replay) {
  if (record === null) return null;
  const sourceKind = kind === 'work' ? 'works' : 'editions';
  check(exact(record, ['raw', 'inspection', 'inspectionSha256', 'dump']) && typeof record.raw === 'string',
    'invalid-conflict-collected-record');
  const inspection = inspectRecord(record.raw, pair, kind, result.retrievedAt);
  check(same(inspection, record.inspection) && digest(inspection) === record.inspectionSha256
    && inspection.recordSha256 === sha256(record.raw), 'conflict-record-inspection-mismatch');
  const envelope = record.dump;
  check(exact(envelope, ['row', 'revision', 'modifiedAt']) && positive(envelope.row)
    && envelope.row <= result.sources[sourceKind].rows && !replay.rows[sourceKind].has(envelope.row)
    && !replay.selectedKeys[sourceKind].has(pair.workId) && positive(envelope.revision) && timestamp(envelope.modifiedAt)
    && (inspection.sourceRevision === null || inspection.sourceRevision === envelope.revision)
    && (inspection.sourceModifiedAt === null || timeValue(inspection.sourceModifiedAt) === timeValue(envelope.modifiedAt)),
  'conflict-record-envelope-mismatch');
  const outerKey = kind === 'work' ? `/works/${pair.workId}` : `/books/${pair.editionId}`;
  const framed = [`/type/${kind}`, outerKey, envelope.revision, envelope.modifiedAt, record.raw].join('\t');
  check(!record.raw.includes('\n') && Buffer.byteLength(framed) <= request.limits.lineBytes,
    'conflict-record-frame-mismatch');
  replay.minimumDecodedBytes[sourceKind] += Buffer.byteLength(framed);
  replay.rows[sourceKind].add(envelope.row); replay.selectedKeys[sourceKind].add(pair.workId);
  return inspection;
}

function validateCompletePayload(result, request, roster, replay) {
  check(exact(result.sources, kinds) && Array.isArray(result.records) && Array.isArray(result.suppressedRecords),
    'invalid-conflict-success-shape');
  validateDumpSources(result.sourceManifest);
  check(result.sourceManifest.release === request.release && result.sourceManifest.retrievedAt === result.retrievedAt,
    'conflict-manifest-binding-mismatch');
  for (const kind of kinds) {
    const source = result.sources[kind], pin = request.sourcePins[kind], observed = result.accounting.sources[kind];
    check(exact(source, ['url', 'compression', 'maxDecodedBytes', 'maxRows', ...counters, ...checksums,
      'complete', 'finalUrl', 'redirects', 'publisherChecksumsVerified', 'expectedBytes'])
      && source.expectedBytes === pin.bytes && source.url === pin.url && source.compression === pin.compression && source.maxDecodedBytes === request.limits.maxDecodedBytes
      && source.maxRows === request.limits.maxRows && Array.isArray(source.redirects) && source.redirects.length <= request.limits.maxRedirects
      && result.accounting.requests[kind] === source.redirects.length + 1
      && [...counters, ...checksums, 'complete', 'publisherChecksumsVerified'].every(key => source[key] === observed[key])
      && Object.entries(result.sourceManifest.sources[kind]).every(([key, value]) => source[key] === value),
    'conflict-source-binding-mismatch');
    let currentUrl = source.url;
    const visited = new Set([currentUrl]);
    for (const redirect of source.redirects) {
      check(exact(redirect, ['from', 'to', 'status']) && redirect.from === currentUrl
        && [301, 302, 303, 307, 308].includes(redirect.status) && !visited.has(redirect.to),
      'conflict-redirect-chain-mismatch');
      currentUrl = validateAcquisitionSourceUrl(redirect.to, source.url); visited.add(currentUrl);
    }
    check(source.finalUrl === currentUrl, 'conflict-final-url-mismatch');
    validateAcquisitionSourceUrl(source.finalUrl, source.url);
  }
  const excluded = new Set(replay.ledger.quarantinedWorkIds);
  const coverage = { selectedTargets: roster.length, survivingTargets: roster.length - excluded.size,
    validMatchedRecords: 0, quarantinedPairs: excluded.size, quarantinedRows: replay.ledger.conflicts.length,
    pairedRecordsSuppressed: 0, quarantinedMissingRecords: 0, recordsFound: 0, recordsMissing: 0,
    eligibleTexts: 0, targetWithEligibleText: 0, descriptionStatuses: {} };
  const found = { works: 0, editions: 0 };
  let survivingRecordBytes = 0, suppressedRecordBytes = 0;
  for (const [rows, suppressed] of [[result.records, false], [result.suppressedRecords, true]]) {
    const expected = roster.filter(pair => excluded.has(pair.workId) === suppressed);
    check(rows.length === expected.length, 'conflict-record-partition-mismatch');
    for (const [index, pair] of expected.entries()) {
      const row = rows[index];
      check(exact(row, ['workId', 'editionId', 'work', 'edition']) && row.workId === pair.workId && row.editionId === pair.editionId,
        'conflict-record-partition-mismatch');
      let eligible = false;
      for (const kind of recordKinds) {
        const inspection = replayRecord(row[kind], pair, kind, result, request, replay);
        if (inspection) {
          const bytes = Buffer.byteLength(row[kind].raw);
          if (suppressed) { suppressedRecordBytes += bytes; coverage.pairedRecordsSuppressed++; }
          else { survivingRecordBytes += bytes; coverage.recordsFound++; }
          coverage.validMatchedRecords++; found[kind === 'work' ? 'works' : 'editions']++;
        } else if (!suppressed) coverage.recordsMissing++;
        if (!suppressed) {
          const status = inspection?.description.status ?? 'record-missing';
          coverage.descriptionStatuses[status] = (coverage.descriptionStatuses[status] ?? 0) + 1;
          if (status === 'eligible') { coverage.eligibleTexts++; eligible = true; }
        }
      }
      if (eligible) coverage.targetWithEligibleText++;
    }
  }
  coverage.quarantinedMissingRecords = 2 * excluded.size - coverage.quarantinedRows - coverage.pairedRecordsSuppressed;
  const a = result.accounting, validRecordBytes = survivingRecordBytes + suppressedRecordBytes;
  check(coverage.quarantinedMissingRecords >= 0 && same(coverage, result.coverage)
    && kinds.every(kind => found[kind] === result.sources[kind].matchedRecords
      && result.sources[kind].decodedBytes >= replay.minimumDecodedBytes[kind])
    && a.validRecordBytes === validRecordBytes && a.survivingRecordBytes === survivingRecordBytes
    && a.suppressedRecordBytes === suppressedRecordBytes && a.cumulativeStagedBytes === validRecordBytes + a.diagnosticBytes,
  'conflict-coverage-or-byte-mismatch');
  return coverage;
}

// The caller separately validates the frozen operational request. This helper
// deliberately supports smaller synthetic contexts and never authorizes a run.
export function validateConflictDumpPayload(result, request) {
  const roster = validateContext(request), success = result?.status === 'collected';
  const common = ['contract', 'status', 'release', 'retrievedAt', 'completedAt', 'rosterSha256', 'limits', 'sourceEvidence',
    'conflictPolicy', 'policySha256', 'quarantine', 'accounting', ...zeroFields, 'rights'];
  check(exact(result, [...common, ...(success ? ['sources', 'sourceManifest', 'records', 'suppressedRecords', 'coverage']
    : ['code', 'terminalFailureEvidence'])]) && result.contract === CONFLICT_ACQUISITION_RESULT_CONTRACT
    && ['collected', 'failed'].includes(result.status) && result.release === request.release
    && timestamp(result.retrievedAt) && timestamp(result.completedAt) && timeValue(result.retrievedAt) >= Date.parse(request.release)
    && timeValue(result.completedAt) >= timeValue(result.retrievedAt) && result.rosterSha256 === digest(roster)
    && same(result.limits, request.limits) && same(result.sourceEvidence, request.sourceEvidence)
    && same(result.conflictPolicy, request.conflictPolicy) && result.policySha256 === digest(request.conflictPolicy)
    && zeroFields.every(key => result[key] === 0) && result.rights === 'unreviewed', 'invalid-conflict-result-binding');
  check(success || typeof result.code === 'string' && safeConflictAcquisitionError(new Error(result.code)) === result.code
    && result.terminalFailureEvidence === null, 'invalid-conflict-failure-shape');
  const replay = replayQuarantine(result, request, roster);
  validateAccounting(result, request, replay, success);
  if (success) validateCompletePayload(result, request, roster, replay);
  return result;
}

function reconcile(originalSnapshot, freshSnapshot, selected, completedAt) {
  if (freshSnapshot === undefined) return [];
  check(Array.isArray(freshSnapshot?.targets) && freshSnapshot.targets.every(row => typeof row.identityMatches === 'boolean'),
    'invalid-conflict-fresh-snapshot');
  validateDumpTargets({ ...freshSnapshot, targets: freshSnapshot.targets.map(row => ({ ...row, identityMatches: true })) });
  check(timeValue(freshSnapshot.checkedAt) >= timeValue(originalSnapshot.checkedAt)
    && timeValue(freshSnapshot.checkedAt) >= timeValue(completedAt), 'conflict-snapshot-predates-collection');
  const current = new Map(freshSnapshot.targets.map(row => [row.itemId, row]));
  return selected.map(original => {
    const row = current.get(original.itemId), changes = [];
    if (!row) changes.push('missing');
    else {
      const flags = { identityChanged: !row.identityMatches || ['sourceId', 'workId', 'editionId'].some(key => row[key] !== original[key]),
        itemVersionChanged: row.itemUpdatedAt !== original.itemUpdatedAt, sourceVersionChanged: row.sourceUpdatedAt !== original.sourceUpdatedAt,
        descriptionChanged: row.descriptionSha256 !== original.descriptionSha256, managedDescriptionChanged: row.managedDescription !== original.managedDescription,
        displayLanguageChanged: row.displayLanguage !== original.displayLanguage, nowIneligible: row.descriptionSha256 !== null || row.managedDescription };
      for (const [name, changed] of Object.entries(flags)) if (changed) changes.push(name);
    }
    return { itemId: original.itemId, workId: original.workId, editionId: original.editionId,
      status: changes.length ? 'changed' : 'unchanged', changes };
  });
}

export function inspectConflictDumpPayload({ request, result, originalSnapshot, freshSnapshot }) {
  validateConflictDumpPayload(result, request);
  const selected = validateDumpTargets(originalSnapshot);
  check(same(validateAcquisitionRoster(selected.map(({ workId, editionId }) => ({ workId, editionId }))), request.roster),
    'conflict-original-snapshot-roster-mismatch');
  const success = result.status === 'collected';
  const reconciliation = reconcile(originalSnapshot, freshSnapshot, selected, result.completedAt);
  const summary = { contract: 'kajo-private-conflict-acquisition-inspection-v1', validationScope: 'payload-consistency-only',
    provenanceVerified: false, status: success ? 'consistent-unreviewed-collection' : 'consistent-failed-acquisition',
    requestSha256: request.requestSha256 ?? null, sourceHead: request.sourceHead ?? null,
    rosterSha256: result.rosterSha256, policySha256: result.policySha256,
    originalSnapshotSha256: digest(originalSnapshot), freshSnapshotSha256: freshSnapshot === undefined ? null : digest(freshSnapshot),
    rights: 'unreviewed', approved: 0, databaseWrites: 0, modelAdmissions: 0, inspectionSourceRequests: 0,
    fullDumpChecksumsRecomputedLocally: false,
    fullSourceChecksumsScope: 'Collector assertions checked against supplied pins; full dump bytes are absent from recovery.',
    accounting: structuredClone(result.accounting), candidates: 0,
    accountingScope: success ? 'Record, exclusion and retained-byte totals replayed; full-source counters are collector assertions.'
      : 'Partial source and staging counters are bounded collector assertions; discarded records are unavailable for replay.',
    reconciliation: { status: freshSnapshot === undefined ? 'not-performed' : 'reconciled',
      unchanged: reconciliation.filter(row => row.status === 'unchanged').length,
      changed: reconciliation.filter(row => row.status === 'changed').length } };
  const quarantine = structuredClone(result.quarantine), candidates = [];
  if (!success) return { summary: { ...summary, code: result.code, terminalFailureEvidenceAvailable: false },
    candidates, quarantine, reconciliation };
  const targets = new Map(selected.map(row => [row.workId, row])), changes = new Map(reconciliation.map(row => [row.itemId, row]));
  for (const row of result.records) for (const kind of recordKinds) {
    const record = row[kind];
    if (record === null) continue;
    const target = targets.get(row.workId), change = changes.get(target.itemId), raw = JSON.parse(record.raw);
    candidates.push({ itemId: target.itemId, sourceId: target.sourceId, workId: row.workId, editionId: row.editionId,
      kind, catalogBinding: change?.status ?? 'unreconciled', catalogChanges: change?.changes ?? null,
      reviewEligible: false, displayLanguage: target.displayLanguage, raw: record.raw,
      recordSha256: record.inspection.recordSha256, inspectionSha256: record.inspectionSha256,
      dump: structuredClone(record.dump), description: structuredClone(record.inspection.description),
      providerLanguageField: { present: Object.hasOwn(raw, 'languages'), value: raw.languages ?? null },
      textLanguage: null, languageReview: 'unreviewed', rights: 'unreviewed', approved: false });
  }
  return { summary: { ...summary, candidates: candidates.length, coverage: structuredClone(result.coverage),
    sourceManifestSha256: digest(result.sourceManifest), eligibleIsTextShapeOnly: true }, candidates, quarantine, reconciliation };
}
