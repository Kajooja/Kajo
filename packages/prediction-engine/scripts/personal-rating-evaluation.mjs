// Private offline protocol files. Hashes bind bytes, not authorization, trusted
// preregistration, complete native history or current source-withdrawal status.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateReportFiles } from './private-report-files.mjs';
import { validatePersonalRatingEvaluationDeclaration, buildPersonalRatingEvaluationReport as buildCoreReport }
  from '../dist/personal-rating-evaluation.js';
import { normalizeKajoPersonalRatingEvaluationInventory } from '../dist/adapters/kajo-personal-rating-evaluation.js';

const MAX_INPUT_BYTES = 16 * 1024 * 1024, MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_CLOCK = 253402300799999999n, RETENTION_MICROS = 7n * 86400n * 1000000n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const EMBEDDED_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const contracts = { request: 'kajo-personal-rating-evaluation-request-v1',
  declaration: 'kajo-personal-rating-evaluation-declaration-v1',
  inventory: 'kajo-personal-rating-evaluation-inventory-v1', report: 'kajo-personal-rating-evaluation-report-v1' };
export class PersonalRatingEvaluationFileError extends Error {
  constructor(code) { super(`PERSONAL_RATING_EVALUATION_${code}`); this.code = code; }
}
const reject = code => { throw new PersonalRatingEvaluationFileError(code); };
const check = (value, code = 'PROTOCOL_INVALID') => { if (!value) reject(code); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function shape(value, keys, code = 'PROTOCOL_INVALID') {
  check(record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), code);
}
function micros(value) {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= MAX_CLOCK, 'CLOCK_INVALID');
  return BigInt(value);
}
function freeze(value) {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const processMicros = () => (BigInt(Date.now()) * 1000n).toString();
const { assertPlatform, readManifest, reportPath, writeReport } = createPrivateReportFiles({
  reject, isReportError: error => error instanceof PersonalRatingEvaluationFileError,
  maximumInputBytes: MAX_INPUT_BYTES, maximumOutputBytes: MAX_OUTPUT_BYTES,
});

/** Create before the active role's capture window; this process clock is not a
 * trusted time certificate. The same roster/cap must not be refilled after erase. */
export function createPersonalRatingEvaluationDeclaration(request, observedAtMicros) {
  shape(request, ['version', 'declaration', 'roster']);
  check(request.version === contracts.request && record(request.declaration)
    && !Object.hasOwn(request.declaration, 'createdAtMicros'));
  micros(observedAtMicros);
  let declaration;
  try { declaration = validatePersonalRatingEvaluationDeclaration({ ...request.declaration, createdAtMicros: observedAtMicros }); }
  catch { reject('DECLARATION_INVALID'); }
  check(!EMBEDDED_UUID.test(JSON.stringify(declaration)), 'ALIASES_REQUIRED');
  check(Array.isArray(request.roster) && request.roster.length <= 128 && request.roster.length === declaration.roster.length);
  const subjects = new Set(), actors = new Set(), profiles = new Set();
  const roster = request.roster.map(row => {
    shape(row, ['actorUserId', 'profileId', 'subjectId']);
    check(UUID.test(row.actorUserId) && UUID.test(row.profileId) && declaration.roster.includes(row.subjectId)
      && !subjects.has(row.subjectId) && !actors.has(row.actorUserId) && !profiles.has(row.profileId), 'ROSTER_INVALID');
    subjects.add(row.subjectId); actors.add(row.actorUserId); profiles.add(row.profileId);
    return { actorUserId: row.actorUserId, profileId: row.profileId, subjectId: row.subjectId };
  }).sort((a, b) => a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0);
  const retainUntil = declaration.checkpointsMicros.reduce((a, value) => micros(value) > a ? micros(value) : a, 0n) + RETENTION_MICROS;
  check(retainUntil <= MAX_CLOCK, 'CLOCK_INVALID');
  const body = { version: contracts.declaration, declaration, roster,
    retainUntilMicros: retainUntil.toString(), clockBasis: 'PROCESS_OBSERVED_TIME_NOT_TRUSTED_CERTIFICATE',
    integrityBasis: 'CANONICAL_SHA256_NOT_AUTHENTICATION', predeclarationAuthenticity: 'NOT_ESTABLISHED_BY_FILE',
    nativeInventoryCompleteness: 'NOT_ESTABLISHED_BY_FILE' };
  return freeze({ ...body, digest: digest(body) });
}

function validateSealedDeclaration(value) {
  shape(value, ['version', 'declaration', 'roster', 'retainUntilMicros', 'clockBasis', 'integrityBasis',
    'predeclarationAuthenticity', 'nativeInventoryCompleteness', 'digest'], 'DECLARATION_INVALID');
  check(record(value.declaration), 'DECLARATION_INVALID');
  const { createdAtMicros, ...declaration } = value.declaration;
  const expected = createPersonalRatingEvaluationDeclaration({ version: contracts.request, declaration, roster: value.roster }, createdAtMicros);
  check(isDeepStrictEqual(value, expected), 'DECLARATION_INVALID');
  return expected;
}

export function buildPersonalRatingEvaluationReport(sealed, input, checkpointMicros, observedAtMicros) {
  const declaration = validateSealedDeclaration(sealed);
  shape(input, ['version', 'declarationDigest', 'opportunities', 'census'], 'INVENTORY_INVALID');
  check(input.version === contracts.inventory && input.declarationDigest === declaration.digest, 'DECLARATION_MISMATCH');
  const now = micros(observedAtMicros), checkpoint = micros(checkpointMicros);
  check(now >= checkpoint, 'EVALUATION_NOT_READY');
  check(now <= micros(declaration.retainUntilMicros), 'EXPIRED');
  const d = declaration.declaration;
  let inventory, result;
  try {
    inventory = normalizeKajoPersonalRatingEvaluationInventory({ origin: d.origin,
      horizonSeconds: d.horizonSeconds, sourceVersions: d.sourceVersions,
      roster: declaration.roster, opportunities: input.opportunities }, input.census);
    check(micros(inventory.observedAtMicros) <= now, 'FUTURE_SNAPSHOT');
    result = buildCoreReport(d, { version: inventory.version, origin: inventory.origin,
      observedAtMicros: inventory.observedAtMicros, observedThroughMicros: inventory.observedThroughMicros, complete: inventory.complete,
      opportunities: inventory.opportunities }, checkpointMicros);
  } catch (error) {
    if (error instanceof PersonalRatingEvaluationFileError) throw error;
    reject('INVENTORY_INVALID');
  }
  const report = { version: contracts.report, declarationDigest: declaration.digest, inventoryDigest: digest(input),
    reportObservedAtMicros: observedAtMicros, retainUntilMicros: declaration.retainUntilMicros,
    integrityBasis: declaration.integrityBasis, clockBasis: declaration.clockBasis,
    predeclarationAuthenticity: 'NOT_ESTABLISHED_BY_FILE', nativeInventoryCompleteness: 'NOT_ESTABLISHED_BY_FILE',
    currentAuthorization: 'NOT_ESTABLISHED_BY_FILE', withdrawalStatus: 'NOT_ESTABLISHED_BY_FILE',
    historicalFeatureEligible: false, learnable: false, nativeActivated: false, qualityAdmitted: false,
    inventoryReconciliation: inventory.reconciliation, result };
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  check(Buffer.byteLength(bytes) <= MAX_OUTPUT_BYTES, 'OUTPUT_TOO_LARGE');
  check(!EMBEDDED_UUID.test(bytes), 'ALIASES_REQUIRED');
  return freeze(report);
}

export async function runPersonalRatingEvaluationDeclaration(requestPath, outputPath) {
  assertPlatform();
  check([requestPath, outputPath].every(path => typeof path === 'string' && path.length > 0), 'ARGUMENTS');
  const destination = await reportPath(outputPath), request = await readManifest(requestPath);
  const declaration = createPersonalRatingEvaluationDeclaration(request, processMicros());
  await writeReport(destination, declaration); return declaration;
}
export async function runPersonalRatingEvaluationReport(declarationPath, inventoryPath, checkpointMicros, outputPath) {
  assertPlatform();
  check([declarationPath, inventoryPath, checkpointMicros, outputPath]
    .every(path => typeof path === 'string' && path.length > 0), 'ARGUMENTS');
  const destination = await reportPath(outputPath), declaration = await readManifest(declarationPath), inventory = await readManifest(inventoryPath);
  const report = buildPersonalRatingEvaluationReport(declaration, inventory, checkpointMicros, processMicros());
  await writeReport(destination, report); return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === 'declare' && args.length === 2) await runPersonalRatingEvaluationDeclaration(...args);
    else if (mode === 'report' && args.length === 4) await runPersonalRatingEvaluationReport(...args);
    else reject('ARGUMENTS');
    process.stdout.write(`PERSONAL_RATING_EVALUATION_${mode === 'declare' ? 'DECLARED' : 'REPORT_CREATED'}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof PersonalRatingEvaluationFileError ? error.message : 'PERSONAL_RATING_EVALUATION_FAILED'}\n`);
    process.exitCode = 1;
  }
}
