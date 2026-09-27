import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFLICT_POLICY_CONTRACT, assessDumpConflict, createDumpConflictLedger,
  validateDumpConflictLedger, validateDumpConflictPolicy } from './dump-conflict-policy.mjs';
import { LEGACY_FAILURE_EVIDENCE_CONTRACT, createDumpFailureEvidence,
  validateDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { digest, inspectRecord, providerIdentityFailure, sha256 } from './open-library-descriptions.mjs';

const roster = [{ workId: 'OL101W', editionId: 'OL201M' }, { workId: 'OL102W', editionId: 'OL202M' }];
const at = '2026-09-20T10:00:00.000Z', modified = '2026-08-15T10:00:00.123456';
const limits = { lineBytes: 1049600, maxRows: 1000 };
const sourceFor = sourceKind => ({ url: `https://archive.org/download/ol_dump_2026-08-31/ol_dump_${sourceKind}_2026-08-31.txt.gz`,
  bytes: 1048576, compression: 'gzip', sha256: 'a'.repeat(64) });
const policy = (maxConflictedPairs = 2, maxDiagnosticBytes = 1024 * 1024) => ({
  contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs, maxDiagnosticBytes });
const recordFor = (kind = 'work', expected = roster[0]) => ({
  key: kind === 'work' ? `/works/${expected.workId}` : `/books/${expected.editionId}`,
  type: { key: `/type/${kind}` }, location: kind === 'work' ? '/works/OL901W' : '/books/OL902M',
  revision: 5, last_modified: { value: modified }, description: 'Synthetic text never becomes an approved candidate.',
  ...(kind === 'edition' ? { works: [{ key: `/works/${expected.workId}` }] } : {}),
});
function evidenceFor({ kind = 'work', expected = roster[0], record = recordFor(kind, expected),
  cr = false, terminated = true, outerRevision = '5', outerTime = modified } = {}) {
  const sourceKind = kind === 'work' ? 'works' : 'editions';
  const key = kind === 'work' ? `/works/${expected.workId}` : `/books/${expected.editionId}`;
  const bytes = Buffer.from([`/type/${kind}`, key, outerRevision, outerTime, JSON.stringify(record)].join('\t') + (cr ? '\r' : ''));
  return createDumpFailureEvidence({ rowBytes: bytes, terminated, sourceKind, source: sourceFor(sourceKind),
    roster, expected, row: 1, fetchedAt: at, predicate: providerIdentityFailure(record, expected, kind), limits });
}
const context = evidence => ({ roster, source: sourceFor(evidence.sourceKind), limits });
const assess = evidence => assessDumpConflict(evidence, context(evidence));
const record = (ledger, evidence) => ledger.record(evidence, { source: sourceFor(evidence.sourceKind), limits });

// All records and source identities are synthetic. No private recovered row,
// response, diagnostic hash, real target snapshot or recipient key is a fixture.
test('policy requires explicit positive bounded pair and diagnostic budgets and no extra fields', () => {
  const chosen = policy();
  assert.equal(validateDumpConflictPolicy(chosen, roster), chosen);
  assert.equal(validateDumpConflictPolicy(policy(1, 64 * 1024 * 1024), roster).maxConflictedPairs, 1);
  for (const value of [undefined, null, {}, { ...chosen, contract: 'unknown' }, { ...chosen, extra: true },
    { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 1 }, { contract: CONFLICT_POLICY_CONTRACT, maxDiagnosticBytes: 1 },
    ...[0, -1, 3, 1.5, NaN, Infinity, '1'].map(maxConflictedPairs => ({ ...chosen, maxConflictedPairs })),
    ...[0, -1, 64 * 1024 * 1024 + 1, 1.5, NaN, Infinity, '1'].map(maxDiagnosticBytes => ({ ...chosen, maxDiagnosticBytes }))])
    assert.throws(() => validateDumpConflictPolicy(value, roster), /invalid-dump-conflict-policy/);
  for (const selected of [[], [roster[0], roster[0]], [{ ...roster[0], editionId: 'wrong' }],
    Array.from({ length: 386 }, (_, i) => ({ workId: `OL${i}W`, editionId: `OL${i}M` }))])
    assert.throws(() => validateDumpConflictPolicy(chosen, selected), /invalid-dump-conflict-roster/);
});

test('only exact same-kind foreign canonical locations can exclude the original pair', () => {
  for (const kind of ['work', 'edition']) {
    const evidence = evidenceFor({ kind }), original = JSON.stringify(evidence), assessment = assess(evidence);
    assert.deepEqual(assessment, { ...roster[0], sourceKind: kind === 'work' ? 'works' : 'editions',
      decision: 'quarantine-pair', reason: 'foreign-canonical-location' });
    assert.equal(JSON.stringify(evidence), original);
    // Classification does not relax the existing provider validator.
    assert.throws(() => inspectRecord(JSON.stringify(recordFor(kind)), roster[0], kind, at), /provider-identity-mismatch/);
    assert.ok(!Object.hasOwn(assessment, 'description'));
    assert.ok(!Object.hasOwn(assessment, 'replacementWorkId'));
  }
});

test('null, arbitrary, cross-kind and another selected identity remain fatal', () => {
  for (const kind of ['work', 'edition']) {
    const another = kind === 'work' ? `/works/${roster[1].workId}` : `/books/${roster[1].editionId}`;
    const wrongKind = kind === 'work' ? '/books/OL902M' : '/works/OL901W';
    for (const location of [null, 1, {}, [], '', '/works/OL901W/', '/works/../works/OL901W',
      'https://openlibrary.org/works/OL901W', '/works/OL901W?x=1', '/works/OL901W#x', '/works/%4FL901W', wrongKind, another]) {
      const evidence = evidenceFor({ kind, record: { ...recordFor(kind), location } });
      assert.equal(assess(evidence).decision, 'fatal');
      assert.throws(() => record(createDumpConflictLedger({ policy: policy(), selected: roster }), evidence), /^Error: dump-conflict-fatal$/);
    }
  }
});

test('valid evidence of object, key, type or real redirect failure never becomes quarantine', () => {
  for (const value of [null, [], 'record', { ...recordFor(), key: '/works/OL999W' },
    { ...recordFor(), type: { key: '/type/redirect' } }, { ...recordFor(), type: { key: '/type/edition' } }]) {
    const evidence = evidenceFor({ record: value });
    assert.equal(validateDumpFailureEvidence(evidence, context(evidence)), evidence);
    assert.equal(assess(evidence).decision, 'fatal');
  }
});

test('legacy v1 is replayed unchanged but never eligible for the new exclusion policy', () => {
  const evidence = evidenceFor();
  evidence.contract = LEGACY_FAILURE_EVIDENCE_CONTRACT;
  evidence.predicate = 'record-location-present';
  const original = JSON.stringify(evidence);
  assert.equal(validateDumpFailureEvidence(evidence, context(evidence)), evidence);
  assert.equal(assess(evidence).reason, 'unsupported-evidence-version');
  assert.throws(() => record(createDumpConflictLedger({ policy: policy(), selected: roster }), evidence), /dump-conflict-fatal/);
  assert.equal(JSON.stringify(evidence), original);
});

test('identity evidence cannot hide missing, invalid or mismatched revision and modified metadata', () => {
  for (const patch of [{ revision: null }, { revision: undefined }, { revision: 0 }, { revision: 1.2 },
    { revision: '5' }, { revision: 6 }, { last_modified: null }, { last_modified: undefined },
    { last_modified: 'invalid' }, { last_modified: {} }, { last_modified: { value: 'invalid' } },
    { last_modified: { value: '2026-08-15T10:00:00.123457' } },
    { last_modified: { value: modified + 'Z' } }]) {
    const evidence = evidenceFor({ record: { ...recordFor(), ...patch } });
    assert.equal(validateDumpFailureEvidence(evidence, context(evidence)), evidence);
    assert.equal(assess(evidence).reason, 'post-identity-metadata-mismatch');
  }
});

test('Edition quarantine requires its original exact Work linkage after identity failure', () => {
  for (const works of [undefined, null, [], [{ key: '/works/OL999W' }], [{ key: '/works/OL101W' }, { key: '/works/OL102W' }],
    [{ key: null }], [{ workId: 'OL101W' }]]) {
    const evidence = evidenceFor({ kind: 'edition', record: { ...recordFor('edition'), works } });
    assert.equal(validateDumpFailureEvidence(evidence, context(evidence)), evidence);
    assert.equal(assess(evidence).reason, 'post-identity-metadata-mismatch');
  }
});

test('tampered evidence and framing fail with one fixed error rather than gaining a decision', () => {
  const source = sourceFor('works');
  const original = evidenceFor();
  for (const mutate of [value => { value.rawSha256 = 'f'.repeat(64); }, value => { value.rawBytes++; },
    value => { value.source.bytes++; }, value => { value.rosterSha256 = 'f'.repeat(64); },
    value => { value.expected.editionId = roster[1].editionId; }, value => { value.predicate = 'record-type-mismatch'; },
    value => { value.extra = 'private'; }, value => { value.row = limits.maxRows + 1; },
    value => { const bytes = Buffer.from(value.rawBase64, 'base64'); bytes[0] = 255;
      value.rawBase64 = bytes.toString('base64'); value.rawSha256 = sha256(bytes); },
    value => { const bytes = Buffer.from(value.rawBase64, 'base64').toString('utf8').replace('\t5\t', '\t0\t');
      value.rawBase64 = Buffer.from(bytes).toString('base64'); value.rawSha256 = sha256(bytes); }]) {
    const evidence = structuredClone(original); mutate(evidence);
    assert.throws(() => assessDumpConflict(evidence, { roster, source, limits }), /^Error: invalid-dump-conflict-evidence$/);
  }
  for (const evidence of [undefined, null, {}, 'private'])
    assert.throws(() => assessDumpConflict(evidence, { roster, source, limits }), /^Error: invalid-dump-conflict-evidence$/);
  assert.throws(() => assessDumpConflict(original, { roster: [roster[1]], source, limits }), /invalid-dump-conflict-evidence/);
  const ledger = createDumpConflictLedger({ policy: policy(), selected: roster });
  assert.throws(() => ledger.record(original), /^Error: invalid-dump-conflict-evidence$/);
});

test('CRLF and EOF framing preserve exact evidence without interpreting description eligibility', () => {
  for (const cr of [false, true]) for (const terminated of [false, true]) {
    const evidence = evidenceFor({ cr, terminated, record: { ...recordFor(),
      description: { value: 'Text with a https://example.com link is still rejected for use independently.' } } });
    const ledger = createDumpConflictLedger({ policy: policy(), selected: roster });
    record(ledger, evidence);
    assert.deepEqual(ledger.snapshot().conflicts[0].evidence, evidence);
    assert.equal(ledger.snapshot().diagnosticBytes, evidence.rawBytes);
    assert.equal(ledger.snapshot().conflicts[0].assessment.decision, 'quarantine-pair');
  }
});

test('ledger is branded, immutable and bound to canonical pairs rather than arbitrary caller hooks', () => {
  const selected = [{ ...roster[1], itemId: 'synthetic-private-second' }, { ...roster[0], itemId: 'synthetic-private-first' }];
  const ledger = createDumpConflictLedger({ policy: policy(), selected });
  assert.equal(validateDumpConflictLedger(ledger, roster), ledger);
  assert.equal(Object.isFrozen(ledger), true);
  assert.equal(ledger.snapshot().rosterSha256, digest(roster));
  for (const fake of [undefined, {}, { record() { assert.fail('must not call hooks'); } },
    { ...ledger }, Object.create(ledger), ledger.snapshot()])
    assert.throws(() => validateDumpConflictLedger(fake, roster), /invalid-dump-conflict-ledger/);
  assert.throws(() => validateDumpConflictLedger(ledger, [roster[0]]), /invalid-dump-conflict-ledger/);
  assert.throws(() => { ledger.record = () => {}; }, TypeError);
  assert.throws(() => { ledger.has = () => false; }, TypeError);
});

test('both source conflicts suppress one original pair and duplicate source identities remain fatal', () => {
  const ledger = createDumpConflictLedger({ policy: policy(1), selected: roster });
  const work = evidenceFor(), edition = evidenceFor({ kind: 'edition' });
  record(ledger, work); record(ledger, edition);
  const snapshot = ledger.snapshot();
  assert.deepEqual(snapshot.quarantinedWorkIds, [roster[0].workId]);
  assert.equal(snapshot.conflicts.length, 2);
  assert.equal(snapshot.diagnosticBytes, work.rawBytes + edition.rawBytes);
  assert.equal(ledger.has(roster[0].workId), true);
  assert.equal(ledger.has(roster[1].workId), false);
  for (const evidence of [work, edition, evidenceFor({ record: { ...recordFor(), location: '/works/OL903W' } })])
    assert.throws(() => record(ledger, evidence), /duplicate-selected-dump-record/);
  assert.deepEqual(ledger.snapshot(), snapshot);
});

test('unique-pair and inclusive diagnostic budgets are independent, exact and never silently extended', () => {
  const first = evidenceFor(), second = evidenceFor({ expected: roster[1] });
  const pairLimited = createDumpConflictLedger({ policy: policy(1), selected: roster });
  record(pairLimited, first);
  assert.throws(() => record(pairLimited, second), /dump-conflict-pair-limit/);
  assert.equal(pairLimited.snapshot().conflicts.length, 1);
  const exact = createDumpConflictLedger({ policy: policy(2, first.rawBytes + second.rawBytes), selected: roster });
  record(exact, first); record(exact, second);
  assert.equal(exact.snapshot().diagnosticBytes, first.rawBytes + second.rawBytes);
  const short = createDumpConflictLedger({ policy: policy(2, first.rawBytes + second.rawBytes - 1), selected: roster });
  record(short, first);
  const before = short.snapshot();
  assert.throws(() => record(short, second), /dump-conflict-diagnostic-limit/);
  assert.deepEqual(short.snapshot(), before);
  const tiny = createDumpConflictLedger({ policy: policy(2, first.rawBytes - 1), selected: roster });
  assert.throws(() => record(tiny, first), /dump-conflict-diagnostic-limit/);
  assert.equal(tiny.snapshot().diagnosticBytes, 0);
});

test('mutating input, returned assessment or snapshot cannot change retained policy, evidence, roster or budget', () => {
  const chosen = policy(1), selected = structuredClone(roster), evidence = evidenceFor();
  const originalPolicy = structuredClone(chosen), originalEvidence = structuredClone(evidence);
  const ledger = createDumpConflictLedger({ policy: chosen, selected });
  chosen.maxConflictedPairs = 2; chosen.maxDiagnosticBytes = Number.MAX_SAFE_INTEGER;
  selected[0].workId = 'OL999W'; selected.pop();
  const assessment = record(ledger, evidence);
  assessment.decision = 'accepted'; evidence.rawBase64 = 'changed'; evidence.source.bytes = 1;
  const snapshot = ledger.snapshot();
  snapshot.policy.maxConflictedPairs = 2; snapshot.conflicts[0].assessment.decision = 'accepted';
  snapshot.conflicts[0].evidence.rawBase64 = 'changed'; snapshot.quarantinedWorkIds.length = 0; snapshot.diagnosticBytes = 0;
  const retained = ledger.snapshot();
  assert.deepEqual(retained.policy, originalPolicy);
  assert.equal(retained.policySha256, digest(originalPolicy));
  assert.deepEqual(retained.conflicts[0].evidence, originalEvidence);
  assert.equal(retained.conflicts[0].assessment.decision, 'quarantine-pair');
  assert.deepEqual(retained.quarantinedWorkIds, [roster[0].workId]);
  assert.equal(retained.diagnosticBytes, originalEvidence.rawBytes);
  assert.throws(() => record(ledger, evidenceFor({ expected: roster[1] })), /dump-conflict-pair-limit/);
});
