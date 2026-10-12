// Ephemeral owner audit only: no providers, database access or model admission.
import { resolve } from 'node:path';
import { createPrivateReportFiles } from './private-report-files.mjs';
import { fileURLToPath } from 'node:url';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_PAIRS = 256;
const SELECTION = 'OWNER_DECLARED_NONOVERLAPPING_PAIRS';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class OrdinalReportError extends Error {
  constructor(code) { super(`ORDINAL_REPORT_${code}`); this.code = code; }
}
const reject = code => { throw new OrdinalReportError(code); };

const { assertPlatform, readManifest, reportPath, writeReport } = createPrivateReportFiles({
  reject, isReportError: error => error instanceof OrdinalReportError, maximumInputBytes: MAX_INPUT_BYTES,
});
export function assertOrdinalReportPlatform(platform = process.platform) { assertPlatform(platform); }

function validateManifest(value) {
  const keys = ['contractVersion', 'selectionBasis', 'evaluationAsOf', 'pairs'];
  if (!record(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.contractVersion !== 'kajo-shared-ordinal-manifest-v1' || value.selectionBasis !== SELECTION
    || typeof value.evaluationAsOf !== 'number' || !Number.isFinite(value.evaluationAsOf)
    || value.evaluationAsOf < 0 || value.evaluationAsOf > Number.MAX_SAFE_INTEGER
    || !Array.isArray(value.pairs) || value.pairs.length > MAX_PAIRS) reject('MANIFEST_INVALID');
  const required = ['pairId', 'leftComparison', 'rightComparison', 'anchor', 'references'];
  const pairIds = new Set();
  for (const pair of value.pairs) {
    if (!record(pair) || required.some(key => !Object.hasOwn(pair, key))
      || Object.keys(pair).some(key => !required.includes(key) && key !== 'evaluationAsOf')
      || typeof pair.pairId !== 'string' || pair.pairId.length === 0 || pair.pairId.length > 128
      || (Object.hasOwn(pair, 'evaluationAsOf') && pair.evaluationAsOf !== value.evaluationAsOf)) reject('MANIFEST_INVALID');
    if (pairIds.has(pair.pairId)) reject('PAIRS_OVERLAP');
    pairIds.add(pair.pairId);
  }
}

export async function runOrdinalReport(inputPath, outputPath) {
  assertOrdinalReportPlatform();
  if (typeof inputPath !== 'string' || !inputPath || typeof outputPath !== 'string' || !outputPath) reject('ARGUMENTS');
  const destination = await reportPath(outputPath);
  const manifest = await readManifest(inputPath);
  validateManifest(manifest);
  let normalizeKajoOrdinalPair, evaluateOrdinalBatch;
  try {
    ({ normalizeKajoOrdinalPair } = await import('@kajo/prediction-engine/adapters/kajo-ordinal'));
    ({ evaluateOrdinalBatch } = await import('@kajo/prediction-engine/ordinal'));
  } catch { reject('ENGINE_UNAVAILABLE'); }
  let pairs;
  try { pairs = manifest.pairs.map(pair => normalizeKajoOrdinalPair({ ...pair, evaluationAsOf: manifest.evaluationAsOf })); }
  catch { reject('SNAPSHOT_REJECTED'); }
  // Scoped aliases cannot disguise repeated native object pairs in one Profile.
  const nativePairs = new Set();
  for (const pair of manifest.pairs) {
    const left = pair.leftComparison.capturedOutcome.round;
    const right = pair.rightComparison.capturedOutcome.round;
    const key = JSON.stringify([left.profileId, ...[left.itemId, right.itemId].sort()]);
    if (nativePairs.has(key)) reject('PAIRS_OVERLAP');
    nativePairs.add(key);
  }
  let result;
  try { result = evaluateOrdinalBatch(pairs); }
  catch { reject('PAIRS_OVERLAP'); }
  const report = { contractVersion: 'kajo-shared-ordinal-report-v1', selectionBasis: SELECTION,
    sampleInterpretation: 'CONDITIONAL_ON_PRODUCTION_EXPOSURE', selectionWasProspective: 'NOT_ESTABLISHED',
    evaluationAsOf: manifest.evaluationAsOf, result };
  await writeReport(destination, report);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 4) reject('ARGUMENTS');
    await runOrdinalReport(process.argv[2], process.argv[3]);
    process.stdout.write('ORDINAL_REPORT_CREATED\n');
  } catch (error) {
    process.stderr.write(`${error instanceof OrdinalReportError ? error.message : 'ORDINAL_REPORT_FAILED'}\n`);
    process.exitCode = 1;
  }
}
