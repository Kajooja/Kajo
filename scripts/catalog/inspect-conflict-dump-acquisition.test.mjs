import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { collectConflictDumpStreams, REVIEWED_ACQUISITION_LIMITS, REVIEWED_SOURCE_EVIDENCE,
  REVIEWED_SOURCE_PINS } from './acquire-open-library-dumps.mjs';
import { CONFLICT_POLICY_CONTRACT } from './dump-conflict-policy.mjs';
import { digest, inspectRecord } from './open-library-descriptions.mjs';
import { TARGET_CONTRACT } from './open-library-dump-descriptions.mjs';
import { CONFLICT_ACQUISITION_RESULT_CONTRACT, inspectConflictDumpPayload,
  validateConflictDumpPayload } from './inspect-conflict-dump-acquisition.mjs';

const roster = [{ workId: 'OL101W', editionId: 'OL201M' }, { workId: 'OL102W', editionId: 'OL202M' }];
const modifiedAt = '2026-08-15T12:00:00.000';
const description = 'A fictional traveller explores a quiet valley and discovers how earlier choices continue to influence the lives of its inhabitants.';
const hash = (bytes, algorithm) => createHash(algorithm).update(bytes).digest('hex');
const clone = value => structuredClone(value);
const uuid = number => `${String(number).padStart(8, '0')}-1111-4111-8111-111111111111`;
const snapshot = () => ({ contract: TARGET_CONTRACT, checkedAt: '2026-09-24T10:00:00Z', targets: roster.map((row, index) => ({
  ...row, itemId: uuid(index + 1), sourceId: uuid(index + 11), displayLanguage: 'eng',
  itemUpdatedAt: '2026-09-23T10:00:00Z', sourceUpdatedAt: '2026-09-23T10:00:00Z',
  descriptionSha256: null, managedDescription: false, identityMatches: true,
})) });
function record(pair, kind, changes = {}) {
  return { key: kind === 'works' ? `/works/${pair.workId}` : `/books/${pair.editionId}`,
    type: { key: kind === 'works' ? '/type/work' : '/type/edition' }, revision: 1,
    last_modified: { value: modifiedAt }, description, ...(kind === 'editions' ? { works: [{ key: `/works/${pair.workId}` }] } : {}), ...changes };
}
function line(pair, kind, changes) {
  const raw = record(pair, kind, changes);
  return [`/type/${kind === 'works' ? 'work' : 'edition'}`, raw.key, 1, modifiedAt, JSON.stringify(raw)].join('\t') + '\n';
}
async function fixture({ conflictKind = 'works', both = false, missing = false, fail = false, rawCr = false, missingSuppressed = false,
  limits: overrides = {}, signal } = {}) {
  const limits = { ...REVIEWED_ACQUISITION_LIMITS, ...overrides }, bodies = {}, sourcePins = {};
  for (const kind of ['works', 'editions']) {
    const conflict = kind === conflictKind || both;
    let text = (missingSuppressed && kind === 'editions' ? '' : line(roster[0], kind, conflict ? { location: kind === 'works' ? '/works/OL999W' : '/books/OL999M' } : {}))
      + (missing && kind === 'editions' ? '' : line(roster[1], kind))
      + (fail && kind === 'editions' ? line(roster[1], kind) : '');
    if (rawCr && kind === 'editions') text = text.replaceAll('{"key"', '{\r"key"');
    bodies[kind] = gzipSync(text);
    sourcePins[kind] = { ...REVIEWED_SOURCE_PINS[kind], bytes: bodies[kind].length,
      md5: hash(bodies[kind], 'md5'), sha1: hash(bodies[kind], 'sha1') };
  }
  const conflictPolicy = { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 1, maxDiagnosticBytes: 10000 };
  const request = { release: '2026-08-31', roster, limits, conflictPolicy, sourcePins,
    sourceEvidence: REVIEWED_SOURCE_EVIDENCE, sourceHead: 'a'.repeat(40), requestSha256: 'b'.repeat(64) };
  const core = await collectConflictDumpStreams({ ...request, signal,
    openSource: async (kind, source, _options, onRequest) => {
      onRequest(); return { status: 200, url: source.url, redirects: [], headers: {}, body: Readable.from([bodies[kind]]) };
    } });
  const result = { contract: CONFLICT_ACQUISITION_RESULT_CONTRACT, ...core, sourceEvidence: request.sourceEvidence,
    approved: 0, databaseWrites: 0, individualProviderRequests: 0, modelAdmissions: 0, rights: 'unreviewed' };
  const originalSnapshot = snapshot(), freshSnapshot = { ...snapshot(), checkedAt: new Date(Date.now() + 1000).toISOString() };
  return { request, result, originalSnapshot, freshSnapshot };
}

test('private inspection replays survivor and suppressed raw records after either conflict source', async () => {
  for (const conflictKind of ['works', 'editions']) {
    const f = await fixture({ conflictKind });
    assert.equal(f.result.status, 'collected');
    assert.equal(validateConflictDumpPayload(f.result, f.request), f.result);
    const inspected = inspectConflictDumpPayload(f);
    assert.equal(inspected.summary.validationScope, 'payload-consistency-only');
    assert.equal(inspected.summary.provenanceVerified, false);
    assert.equal(inspected.summary.fullDumpChecksumsRecomputedLocally, false);
    assert.equal(inspected.summary.coverage.pairedRecordsSuppressed, 1);
    assert.equal(inspected.summary.coverage.quarantinedRows, 1);
    assert.equal(inspected.summary.candidates, 2);
    assert.ok(inspected.candidates.every(row => row.workId === roster[1].workId && !row.reviewEligible && !row.approved
      && row.rights === 'unreviewed' && row.catalogBinding === 'unchanged'));
    assert.equal(inspected.quarantine.conflicts.length, 1);
    inspected.quarantine.conflicts[0].evidence.rawBase64 = 'changed';
    assert.equal(validateConflictDumpPayload(f.result, f.request), f.result);
  }
});

test('two conflicting pair members and missing survivors keep exact partition and counters', async () => {
  const f = await fixture({ both: true, missing: true });
  const inspected = inspectConflictDumpPayload(f);
  assert.equal(inspected.summary.coverage.quarantinedRows, 2);
  assert.equal(inspected.summary.coverage.pairedRecordsSuppressed, 0);
  assert.equal(inspected.summary.coverage.recordsMissing, 1);
  assert.equal(inspected.candidates.length, 1);
  assert.deepEqual(f.result.suppressedRecords[0], { ...roster[0], work: null, edition: null });
});

test('independent replay rejects modified surviving and suppressed raw records, inspections and envelopes', async () => {
  const original = await fixture();
  for (const mutate of [
    f => { f.result.records[0].work.raw = f.result.records[0].work.raw.replace('quiet', 'loud'); },
    f => { f.result.suppressedRecords[0].edition.raw = f.result.suppressedRecords[0].edition.raw.replace('quiet', 'loud'); },
    f => { f.result.suppressedRecords[0].edition.inspectionSha256 = 'e'.repeat(64); },
    f => { f.result.records[0].work.inspection.description.text = 'forged'; },
    f => { f.result.records[0].edition.dump.revision++; },
    f => { f.result.suppressedRecords[0].edition.dump.modifiedAt = '2026-08-16T12:00:00.000'; },
    f => { f.result.records[0].work.dump.row = f.result.quarantine.conflicts[0].evidence.row; },
    f => { f.result.suppressedRecords[0].edition.dump.row = f.result.records[0].edition.dump.row; },
    f => { f.result.suppressedRecords[0].edition.extra = 'not part of contract'; },
  ]) {
    const f = clone(original); mutate(f);
    assert.throws(() => validateConflictDumpPayload(f.result, f.request));
  }
});

test('quarantined identities cannot enter candidates, cross-kind duplicates or another roster partition', async () => {
  const original = await fixture();
  for (const mutate of [
    f => { f.result.records.push(f.result.suppressedRecords[0]); },
    f => { f.result.suppressedRecords = []; },
    f => { [f.result.records, f.result.suppressedRecords] = [f.result.suppressedRecords, f.result.records]; },
    f => { f.result.records[0].workId = roster[0].workId; },
    f => { f.result.suppressedRecords[0].work = f.result.records[0].work; },
    f => { f.result.records[0].edition = null; },
  ]) {
    const f = clone(original); mutate(f);
    assert.throws(() => validateConflictDumpPayload(f.result, f.request));
  }
});

test('original quarantine evidence, policy decisions and immutable ledger totals are independently replayed', async () => {
  const original = await fixture();
  for (const mutate of [
    f => { f.result.quarantine.conflicts[0].evidence.rawSha256 = 'e'.repeat(64); },
    f => { f.result.quarantine.conflicts[0].evidence.fetchedAt = '2026-09-25T10:00:00Z'; },
    f => { f.result.quarantine.conflicts[0].assessment.reason = 'accepted'; },
    f => { f.result.quarantine.conflicts.push(f.result.quarantine.conflicts[0]); },
    f => { f.result.quarantine.conflicts = []; },
    f => { f.result.quarantine.diagnosticBytes++; },
    f => { f.result.quarantine.quarantinedWorkIds = []; },
    f => { f.result.policySha256 = 'e'.repeat(64); },
    f => { f.result.conflictPolicy.maxConflictedPairs = 2; },
  ]) {
    const f = clone(original); mutate(f);
    assert.throws(() => validateConflictDumpPayload(f.result, f.request));
  }
});

test('source manifests, source checksums, counters and every complete byte partition must agree', async () => {
  const original = await fixture();
  for (const mutate of [
    f => { f.result.sourceManifest.sources.works.sha256 = 'e'.repeat(64); },
    f => { f.result.sources.editions.md5 = 'e'.repeat(32); f.result.accounting.sources.editions.md5 = 'e'.repeat(32); },
    f => { f.result.sources.works.complete = false; },
    f => { f.result.sources.works.publisherChecksumsVerified = false; },
    f => { f.result.accounting.sources.works.rows++; },
    f => { f.result.accounting.sources.editions.matchedRecords--; },
    f => { f.result.accounting.sources.works.quarantinedRecords = 0; },
    f => { f.result.accounting.cumulativeStagedBytes++; },
    f => { f.result.accounting.suppressedRecordBytes++; },
    f => { f.result.accounting.validRecordBytes--; },
    f => { f.result.accounting.survivingRecordBytes++; },
    f => { f.result.coverage.recordsMissing++; },
    f => { f.result.coverage.quarantinedMissingRecords++; },
    f => { f.result.coverage.eligibleTexts--; },
    f => { f.result.sources.works.finalUrl = f.result.sources.editions.finalUrl; },
    f => { f.result.sources.works.redirects = [{ from: f.result.sources.works.url, to: 'https://example.test/row', status: 302 }];
      f.result.accounting.requests.works++; },
    f => { f.result.accounting.requests.metadata = 1; },
  ]) {
    const f = clone(original); mutate(f);
    assert.throws(() => validateConflictDumpPayload(f.result, f.request));
  }
});

test('failure retains only replayed diagnostic ledger and truthful partial accounting', async () => {
  const f = await fixture({ fail: true });
  assert.equal(f.result.status, 'failed');
  assert.equal(f.result.code, 'duplicate-dump-target-record');
  const inspected = inspectConflictDumpPayload(f);
  assert.equal(inspected.summary.status, 'consistent-failed-acquisition');
  assert.equal(inspected.summary.terminalFailureEvidenceAvailable, false);
  assert.equal(inspected.candidates.length, 0);
  assert.equal(inspected.quarantine.conflicts.length, 1);
  for (const mutate of [
    changed => { changed.result.records = []; },
    changed => { changed.result.suppressedRecords = []; },
    changed => { changed.result.sourceManifest = {}; },
    changed => { changed.result.terminalFailureEvidence = changed.result.quarantine.conflicts[0].evidence; },
    changed => { changed.result.accounting.sources.editions.sha256 = 'e'.repeat(64); },
    changed => { changed.result.accounting.sources.editions.rows += 2; },
    changed => { changed.result.accounting.sources.editions.bytes = changed.request.sourcePins.editions.bytes + 1; },
    changed => { changed.result.accounting.sources.editions.decodedBytes = changed.request.limits.maxDecodedBytes + 1; },
    changed => { changed.result.accounting.cumulativeStagedBytes = changed.request.limits.retainedBytes + 1; },
    changed => { changed.result.code = 'provider-secret-url'; },
    changed => { changed.result.accounting.activeSource = null; },
    changed => { changed.result.accounting.diagnosticBytes--; },
  ]) {
    const changed = clone(f); mutate(changed);
    assert.throws(() => validateConflictDumpPayload(changed.result, changed.request));
  }
});

test('pre-abort, decoded/row overflow and staging overflow retain honest reason-specific partial counters', async () => {
  const controller = new AbortController(); controller.abort();
  const aborted = await fixture({ signal: controller.signal });
  assert.equal(aborted.result.code, 'acquisition-aborted');
  validateConflictDumpPayload(aborted.result, aborted.request);
  for (const [limits, code] of [[{ maxRows: 1 }, 'dump-row-limit'], [{ maxDecodedBytes: 10 }, 'dump-decoded-byte-limit'],
    [{ retainedBytes: 650 }, 'dump-staging-limit']]) {
    const f = await fixture({ conflictKind: 'editions', limits });
    assert.equal(f.result.status, 'failed'); assert.equal(f.result.code, code);
    validateConflictDumpPayload(f.result, f.request);
    if (f.result.accounting.cumulativeStagedBytes > f.request.limits.retainedBytes) {
      f.result.code = 'acquisition-failed';
      assert.throws(() => validateConflictDumpPayload(f.result, f.request));
    }
  }
});

test('fresh reconciliation reports changed private catalog identity without granting eligibility', async () => {
  const f = await fixture();
  Object.assign(f.freshSnapshot.targets[1], { identityMatches: false, descriptionSha256: 'e'.repeat(64), managedDescription: true,
    itemUpdatedAt: '2026-09-25T10:00:00Z' });
  const inspected = inspectConflictDumpPayload(f);
  assert.equal(inspected.summary.reconciliation.changed, 1);
  assert.ok(inspected.candidates.every(row => row.catalogBinding === 'changed' && !row.reviewEligible));
  assert.ok(inspected.reconciliation[1].changes.includes('nowIneligible'));
  delete f.freshSnapshot;
  assert.ok(inspectConflictDumpPayload(f).candidates.every(row => row.catalogBinding === 'unreconciled'));
  f.freshSnapshot = snapshot();
  assert.throws(() => inspectConflictDumpPayload(f), /snapshot-predates-collection/);
  delete f.freshSnapshot;
  f.originalSnapshot.targets[0].workId = 'OL777W';
  assert.throws(() => inspectConflictDumpPayload(f), /snapshot-roster-mismatch/);
});

test('valid bytes rebound to a different Work link are rejected even when raw and inspection hashes are refreshed', async () => {
  const f = await fixture();
  const entry = f.result.suppressedRecords[0].edition, raw = JSON.parse(entry.raw);
  raw.works = [{ key: '/works/OL888W' }]; entry.raw = JSON.stringify(raw);
  assert.throws(() => inspectRecord(entry.raw, roster[0], 'edition', f.result.retrievedAt), /provider-work-link-mismatch/);
  entry.inspectionSha256 = digest(entry.inspection);
  assert.throws(() => validateConflictDumpPayload(f.result, f.request), /provider-work-link-mismatch/);
});


test('scanner-valid embedded CR JSON whitespace survives exact raw recovery and byte accounting', async () => {
  const f = await fixture({ rawCr: true });
  assert.ok(f.result.suppressedRecords[0].edition.raw.includes('\r'));
  assert.ok(f.result.records[0].edition.raw.includes('\r'));
  const inspected = inspectConflictDumpPayload(f);
  assert.equal(inspected.candidates.length, 2);
  assert.ok(inspected.candidates.find(row => row.kind === 'edition').raw.includes('\r'));
});

test('quarantine ledger preserves source and row chronology, and rejected limit reasons require actual overflow', async () => {
  const f = await fixture({ both: true });
  f.result.quarantine.conflicts.reverse();
  assert.throws(() => validateConflictDumpPayload(f.result, f.request), /ledger-order/);
  const controller = new AbortController(); controller.abort();
  const aborted = await fixture({ signal: controller.signal });
  const outOfOrder = clone(aborted);
  outOfOrder.result.accounting.sources.editions = outOfOrder.result.accounting.sources.works;
  delete outOfOrder.result.accounting.sources.works;
  outOfOrder.result.accounting.sources.editions.expectedBytes = outOfOrder.request.sourcePins.editions.bytes;
  outOfOrder.result.accounting.activeSource = 'editions';
  assert.throws(() => validateConflictDumpPayload(outOfOrder.result, outOfOrder.request), /edition-before-complete-work/);
  for (const code of ['dump-row-limit', 'dump-decoded-byte-limit']) {
    const changed = clone(aborted); changed.result.code = code;
    assert.throws(() => validateConflictDumpPayload(changed.result, changed.request), /limit-reason/);
  }
});

test('empty quarantine and missing excluded counterpart produce distinct complete coverage', async () => {
  const ordinary = await fixture({ conflictKind: 'none' });
  const checked = inspectConflictDumpPayload(ordinary);
  assert.equal(checked.candidates.length, 4);
  assert.equal(checked.quarantine.diagnosticBytes, 0);
  assert.equal(checked.summary.coverage.quarantinedPairs, 0);
  const excluded = await fixture({ missingSuppressed: true });
  const inspected = inspectConflictDumpPayload(excluded);
  assert.equal(inspected.summary.coverage.quarantinedMissingRecords, 1);
  assert.equal(inspected.summary.coverage.recordsMissing, 0);
  assert.equal(inspected.summary.coverage.pairedRecordsSuppressed, 0);
});
