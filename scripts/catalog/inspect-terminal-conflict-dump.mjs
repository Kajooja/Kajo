// Pure replay only. No file/network/database access, trust receipt or approvals.
import { digest } from './open-library-descriptions.mjs';
import { FRAMED_ACQUISITION_CONTRACT, TERMINAL_ACQUISITION_CONTRACT } from './acquire-open-library-dumps.mjs';
import { validateFramedDumpPayload, inspectFramedDumpPayload } from './inspect-conflict-dump-acquisition.mjs';
import { validateTerminalConflictPolicy, validateTerminalConflictEvidence } from './dump-conflict-policy.mjs';
const check = value => { if (!value) throw new Error('invalid-terminal-acquisition-payload'); };

function framedProjection(result) {
  const projected = structuredClone(result);
  delete projected.terminalDiagnosticPolicy;
  projected.contract = FRAMED_ACQUISITION_CONTRACT;
  if (projected.status === 'failed') {
    projected.accounting.cumulativeStagedBytes -= projected.terminalFailureEvidence?.evidence.rawBytes ?? 0;
    projected.terminalFailureEvidence = null;
    if (projected.code === 'dump-terminal-diagnostic-limit') projected.code = 'dump-conflict-fatal';
  }
  return projected;
}

export function validateTerminalDumpPayload(result, request) {
  validateTerminalConflictPolicy(request.terminalDiagnosticPolicy, request.limits);
  check(result?.contract === TERMINAL_ACQUISITION_CONTRACT
    && digest(result.terminalDiagnosticPolicy) === digest(request.terminalDiagnosticPolicy));
  if (result.status === 'failed') {
    const diagnostic = result.terminalFailureEvidence;
    check(result.code === 'dump-conflict-fatal' ? diagnostic !== null : diagnostic === null);
    if (diagnostic !== null) {
      const kind = result.accounting.activeSource, stats = result.accounting.sources[kind];
      validateTerminalConflictEvidence(diagnostic, { ...request, source: request.sourcePins[kind] });
      const evidence = diagnostic.evidence;
      check(kind === evidence.sourceKind && evidence.fetchedAt === result.retrievedAt && evidence.row === stats.rows
        && stats.rows === stats.matchedRecords + stats.quarantinedRecords + stats.unrelatedRows + 1
        && result.accounting.cumulativeStagedBytes <= request.limits.retainedBytes);
      const sameSource = result.quarantine.conflicts.filter(entry => entry.evidence.sourceKind === kind);
      check(sameSource.every(entry => entry.evidence.row < evidence.row
        && entry.evidence.expected.workId !== evidence.expected.workId));
      const minimum = sameSource.reduce((sum, entry) => sum + entry.evidence.rawBytes + Number(entry.evidence.terminated), 0)
        + evidence.rawBytes + Number(evidence.terminated)
        + (kind === 'editions' ? stats.oversizedUnrelatedBytes + stats.oversizedUnrelatedRows : 0);
      check(stats.decodedBytes >= minimum && (kind !== 'editions' || stats.maxBufferedLineBytes >= evidence.rawBytes));
    }
  }
  // Reuse unchanged v1 source/accounting/quarantine/record validation after
  // removing only the separately replayed terminal allocation. Unknown fields
  // still fail the old closed schema; no old artifact is upgraded or rewritten.
  validateFramedDumpPayload(framedProjection(result), request);
  return result;
}

export function inspectTerminalDumpPayload({ request, result, originalSnapshot, freshSnapshot }) {
  validateTerminalDumpPayload(result, request);
  const inspected = inspectFramedDumpPayload({ request, result: framedProjection(result), originalSnapshot, freshSnapshot });
  inspected.summary.contract = 'kajo-private-terminal-conflict-inspection-v1';
  if (result.status === 'failed') {
    inspected.summary.code = result.code;
    inspected.summary.terminalFailureEvidenceAvailable = result.terminalFailureEvidence !== null;
  }
  return { ...inspected, terminalDiagnostic: structuredClone(result.terminalFailureEvidence ?? null) };
}
