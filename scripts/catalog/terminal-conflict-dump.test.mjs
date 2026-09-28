import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { collectTerminalConflictDumpStreams, collectFramedDumpStreams, collectConflictDumpStreams } from './acquire-open-library-dumps.mjs';
import { TERMINAL_CONFLICT_POLICY } from './dump-conflict-policy.mjs';
import { validateTerminalDumpPayload, inspectTerminalDumpPayload } from './inspect-terminal-conflict-dump.mjs';
import { validateFramedDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { line, oversized, snapshot, streamFixture } from './fixtures/framed-acquisition-fixture.mjs';

function fixture(options) {
  const f = streamFixture(options);
  f.request.terminalDiagnosticPolicy = { contract: TERMINAL_CONFLICT_POLICY, records: 1, maxBytes: f.request.limits.lineBytes };
  const run = f.run;
  f.run = opts => run(opts, collectTerminalConflictDumpStreams);
  return f;
}

for (const [change, predicate, reason] of [
  [{ key: '/books/OL999M' }, 'record-key-mismatch', 'unsupported-identity-conflict'],
  [{ type: { key: '/type/work' } }, 'record-type-mismatch', 'unsupported-identity-conflict'],
  [{ location: '/books/OL202M' }, 'record-location-mismatch', 'selected-target-location'],
  [{ location: 'relative-or-malformed' }, 'record-location-mismatch', 'noncanonical-foreign-location'],
  [{ location: '/books/OL999M', works: [{ key: '/works/OL999W' }] }, 'record-location-mismatch', 'post-identity-metadata-mismatch'],
]) test(`a fatal ${reason}/${predicate} preserves the exact rejected row without accepting it`, async () => {
  const row = line(0, 'editions', change);
  const f = fixture({ works: line(0, 'works') + line(1, 'works'), editions: oversized() + row + line(1, 'editions') });
  const result = await f.run(); validateTerminalDumpPayload(result, f.request);
  assert.equal(result.status, 'failed'); assert.equal(result.code, 'dump-conflict-fatal');
  const d = result.terminalFailureEvidence;
  assert.equal(d.assessment.reason, reason); assert.equal(d.evidence.predicate, predicate);
  assert.equal(Buffer.from(d.evidence.rawBase64, 'base64').toString(), row.slice(0, -1));
  assert.equal(d.evidence.row, 2); assert.equal(result.accounting.sources.works.complete, true);
  assert.equal(result.accounting.sources.editions.complete, false);
  assert.equal(result.records, undefined); assert.equal(result.quarantine.conflicts.length, 0);
  const replay = inspectTerminalDumpPayload({ request: f.request, result, originalSnapshot: snapshot() });
  assert.deepEqual(replay.candidates, []); assert.equal(replay.summary.provenanceVerified, false);
  assert.equal(replay.summary.terminalFailureEvidenceAvailable, true);
  assert.throws(() => validateFramedDumpPayload(result, f.request));
});

test('Work failure stops before Edition and charges terminal bytes once after earlier quarantine', async () => {
  const f = fixture({ works: line(0, 'works', { location: '/works/OL999W' }) + line(1, 'works', { location: '/works/OL101W' }) });
  const result = await f.run(); validateTerminalDumpPayload(result, f.request);
  assert.deepEqual(f.calls, ['works']); assert.equal(result.quarantine.conflicts.length, 1);
  assert.equal(result.accounting.cumulativeStagedBytes, result.accounting.diagnosticBytes + result.terminalFailureEvidence.evidence.rawBytes);
});

test('diagnostic and shared retention ceilings fail closed; invalid policies spend no source request', async () => {
  const options = { works: line(0, 'works', { location: '/works/OL102W' }) };
  const f = fixture(options); f.request.terminalDiagnosticPolicy.maxBytes = 10;
  const result = await f.run(); validateTerminalDumpPayload(result, f.request);
  assert.equal(result.code, 'dump-terminal-diagnostic-limit'); assert.equal(result.terminalFailureEvidence, null);
  assert.equal(result.accounting.cumulativeStagedBytes, 0);
  const small = fixture({ ...options, limits: { retainedBytes: 100 } });
  small.request.terminalDiagnosticPolicy.maxBytes = 100;
  const limited = await small.run(); validateTerminalDumpPayload(limited, small.request);
  assert.equal(limited.code, 'dump-staging-limit'); assert.equal(limited.terminalFailureEvidence, null);
  for (const patch of [{ records: 2 }, { maxBytes: 0 }, { maxBytes: 1025 }, { extra: true }]) {
    const invalid = fixture(options); Object.assign(invalid.request.terminalDiagnosticPolicy, patch);
    await assert.rejects(invalid.run(), /invalid-terminal-conflict-diagnostic/); assert.deepEqual(invalid.calls, []);
  }
});

test('old entrypoints retain old failure shape and cannot opt into the diagnostic through options', async () => {
  for (const collect of [collectFramedDumpStreams, collectConflictDumpStreams]) {
    const f = fixture({ works: line(0, 'works', { location: '/works/OL102W' }) });
    const result = await collect({ ...f.request, openSource: f.openSource });
    assert.equal(result.terminalFailureEvidence, null); assert.equal(result.terminalDiagnosticPolicy, undefined);
    assert.equal(result.code, 'dump-conflict-fatal'); assert.equal(result.accounting.cumulativeStagedBytes, 0);
  }
});

test('transport and malformed-row failures cannot forge a diagnostic', async () => {
  const f = fixture();
  const result = await f.run({ openSource: async () => { throw Object.assign(new Error('dump-conflict-fatal'),
    { assessment: { decision: 'fatal' }, evidence: {} }); } });
  validateTerminalDumpPayload(result, f.request);
  assert.equal(result.code, 'acquisition-transport-failed'); assert.equal(result.terminalFailureEvidence, null);
  const broken = fixture({ works: '/type/work\t/works/OL101W\t1\t2026-08-15T00:00:00\t{\n' });
  const invalid = await broken.run(); validateTerminalDumpPayload(invalid, broken.request);
  assert.equal(invalid.code, 'malformed-provider-json'); assert.equal(invalid.terminalFailureEvidence, null);
});

test('success keeps full verification; abort and checksum failure never return candidates or a diagnosis', async () => {
  const f = fixture(), result = await f.run(); validateTerminalDumpPayload(result, f.request);
  assert.equal(result.status, 'collected'); assert.equal(Object.hasOwn(result, 'terminalFailureEvidence'), false);
  const checksum = fixture(); checksum.request.sourcePins.editions.md5 = '0'.repeat(32);
  const failed = await checksum.run(); validateTerminalDumpPayload(failed, checksum.request);
  assert.equal(failed.code, 'dump-checksum-mismatch'); assert.equal(failed.terminalFailureEvidence, null);
  const stalled = fixture({ limits: { timeoutMs: 30 } });
  const timedOut = await stalled.run({ openSource: async (_kind, source, _options, count) => {
    count(); return { status: 200, url: source.url, redirects: [], body: new Readable({ read() {} }) };
  } });
  validateTerminalDumpPayload(timedOut, stalled.request);
  assert.equal(timedOut.code, 'acquisition-aborted'); assert.equal(timedOut.terminalFailureEvidence, null);
});

test('replay rejects altered source, bytes, predicate, policy reason, limits, timing and accounting', async () => {
  const f = fixture({ works: line(0, 'works'), editions: line(0, 'editions', { location: '/books/OL202M' }) });
  const original = await f.run(); validateTerminalDumpPayload(original, f.request);
  for (const mutate of [
    r => { r.terminalFailureEvidence.evidence.rawBase64 = 'eA=='; },
    r => { r.terminalFailureEvidence.evidence.source.md5 = '0'.repeat(32); },
    r => { r.terminalFailureEvidence.evidence.predicate = 'record-key-mismatch'; },
    r => { r.terminalFailureEvidence.assessment.reason = 'unsupported-identity-conflict'; },
    r => { r.terminalFailureEvidence.evidence.fetchedAt = '2026-09-01T00:00:00Z'; },
    r => { r.terminalFailureEvidence.evidence.row++; },
    r => { r.terminalFailureEvidence.provenanceVerified = true; },
    r => { r.terminalFailureEvidence.approved = 1; },
    r => { r.terminalFailureEvidence = null; },
    r => { r.terminalDiagnosticPolicy.maxBytes--; },
    r => { r.accounting.cumulativeStagedBytes = r.terminalFailureEvidence.evidence.rawBytes - 1; },
    r => { r.accounting.sources.editions.decodedBytes = 0; },
    r => { r.accounting.sources.editions.maxBufferedLineBytes = 0; },
    r => { r.extra = true; },
  ]) {
    const changed = structuredClone(original); mutate(changed);
    assert.throws(() => validateTerminalDumpPayload(changed, f.request));
  }
});
