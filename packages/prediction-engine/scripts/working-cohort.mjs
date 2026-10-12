// Offline owner protocol binding. Hashes and JSON are not native authorization,
// a trusted timestamp, or proof that the supplied census is complete.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createPrivateReportFiles } from './private-report-files.mjs';
import { buildWorkingReport, WorkingReportError } from './working-report.mjs';

const MAX_INPUT_BYTES = 16 * 1024 * 1024, MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000, MAX_UNITS = 128;
const REQUEST = 'kajo-personal-working-cohort-request-v1';
const DECLARATION = 'kajo-personal-working-cohort-declaration-v1';
const INVENTORY = 'kajo-personal-working-cohort-inventory-v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const embeddedUuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const controls = ['OFF', 'STATIC', 'ORDERED'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clock = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
const flags = { historicalFeatureEligible: false, learnable: false, nativeActivated: false, qualityAdmitted: false };
const rules = {
  enrollmentSelection: 'ALL_ROSTER_ENROLLMENTS_HALF_OPEN_WINDOW',
  pairSelection: 'OFF_SELECTED_SAME_TIER_ADJACENT_FINAL_RANK',
  oddTierTail: 'UNPAIRED_RETAINED_IN_FROZEN_POOL',
  captureSelection: 'FIRST_RESERVED_CAPTURE_REVISION_1',
  withdrawal: 'WITHDRAWAL_INVALIDATES_ENTIRE_COHORT',
  support: 'ALL_SUPPORT_STATES_DESCRIPTIVE',
  sourceVersions: { capture: 'native-working-capture-v3', features: 'personal-working-features-v3',
    scorer: 'prediction-candidate-score-working-v1', control: 'personal-working-shadow-v3',
    servingPolicyComponent: 'personal-working-off-v3', resolution: 'personal-latest-terminal-v1' },
};

export class WorkingCohortError extends Error {
  constructor(code) { super(`WORKING_COHORT_${code}`); this.code = code; }
}
const reject = code => { throw new WorkingCohortError(code); };
const { assertPlatform, readManifest, reportPath, writeReport } = createPrivateReportFiles({
  reject, isReportError: error => error instanceof WorkingCohortError,
  maximumInputBytes: MAX_INPUT_BYTES, maximumOutputBytes: MAX_OUTPUT_BYTES,
});
function check(condition, code = 'PROTOCOL_INVALID') { if (!condition) reject(code); }
function shape(value, keys, code = 'PROTOCOL_INVALID') {
  check(record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), code);
}
function uuid(value, code = 'PROTOCOL_INVALID') { check(typeof value === 'string' && uuidPattern.test(value), code); return value; }
function alias(value, scope) {
  check(text(value) && value.startsWith(`${scope}:`) && value.length > scope.length + 1 && !embeddedUuidPattern.test(value));
  return value;
}
function immutable(value) {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

/** A process clock proxy constrains the local request; it is no time certificate. */
export function createWorkingCohortDeclaration(request, now) {
  shape(request, ['contractVersion', 'scopeId', 'cohortRef', 'roster', 'enrollmentWindow', 'horizonMs', 'settlementMs', 'evaluationAsOf']);
  check(request.contractVersion === REQUEST && clock(now) && text(request.scopeId) && request.scopeId.length <= 128
    && !embeddedUuidPattern.test(request.scopeId));
  shape(request.enrollmentWindow, ['startAt', 'endAt']);
  const { startAt, endAt } = request.enrollmentWindow;
  check(clock(startAt) && clock(endAt) && startAt > now && endAt > startAt);
  const duration = (value, min, max) => Number.isSafeInteger(value) && value % 1000 === 0 && value >= min && value <= max;
  check(duration(request.horizonMs, 1000, 90 * DAY) && duration(request.settlementMs, 0, 7 * DAY));
  const lastMaturity = endAt + request.horizonMs + request.settlementMs;
  const retainUntil = request.evaluationAsOf + 7 * DAY;
  check(clock(lastMaturity) && clock(request.evaluationAsOf) && request.evaluationAsOf >= lastMaturity && clock(retainUntil));
  check(Array.isArray(request.roster) && request.roster.length >= 1 && request.roster.length <= MAX_UNITS);
  const actors = new Set(), subjects = new Set(), aliases = new Set([alias(request.cohortRef, request.scopeId)]);
  const roster = request.roster.map(member => {
    shape(member, ['actorUserId', 'profileId', 'actorRef', 'subjectRef']);
    const actorUserId = uuid(member.actorUserId), profileId = uuid(member.profileId);
    const actorRef = alias(member.actorRef, request.scopeId), subjectRef = alias(member.subjectRef, request.scopeId);
    check(!actors.has(actorUserId) && !subjects.has(profileId) && actorRef !== subjectRef
      && !aliases.has(actorRef) && !aliases.has(subjectRef));
    actors.add(actorUserId); subjects.add(profileId); aliases.add(actorRef); aliases.add(subjectRef);
    return { actorUserId, profileId, actorRef, subjectRef };
  }).sort((a, b) => a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0);
  const normalized = { contractVersion: REQUEST, scopeId: request.scopeId, cohortRef: request.cohortRef, roster,
    enrollmentWindow: { startAt, endAt }, horizonMs: request.horizonMs, settlementMs: request.settlementMs,
    evaluationAsOf: request.evaluationAsOf };
  const body = { contractVersion: DECLARATION, createdAt: now,
    clockBasis: 'PROCESS_OBSERVED_TIME_NOT_TRUSTED_CERTIFICATE', request: normalized, rules: structuredClone(rules),
    retainUntil, integrityBasis: 'CANONICAL_SHA256_NOT_AUTHENTICATION',
    predeclarationAuthenticity: 'NOT_ESTABLISHED_BY_FILE', nativeInventoryCompleteness: 'NOT_ESTABLISHED_BY_FILE', ...flags };
  return immutable({ ...body, digest: digest(body) });
}

function validateDeclaration(value) {
  shape(value, ['contractVersion', 'createdAt', 'clockBasis', 'request', 'rules', 'retainUntil', 'integrityBasis',
    'predeclarationAuthenticity', 'nativeInventoryCompleteness', ...Object.keys(flags), 'digest'], 'DECLARATION_INVALID');
  let expected;
  try { expected = createWorkingCohortDeclaration(value.request, value.createdAt); }
  catch { reject('DECLARATION_INVALID'); }
  check(isDeepStrictEqual(expected, value), 'DECLARATION_INVALID');
  return expected;
}
function reserveRosterAliases(entry, request) {
  const refs = entry.planSnapshot.references;
  const array = value => Array.isArray(value) ? value : [];
  const reserved = new Set([request.cohortRef, ...request.roster.flatMap(member => [member.actorRef, member.subjectRef])]);
  const others = [entry.planSnapshot.planning.id, refs.sessionRef, refs.sourcePredictionRef, refs.captureRef,
    ...controls.map(control => refs.controlRefs?.[control]),
    ...array(refs.objects).map(value => value?.objectRef), ...array(refs.inputObjects).map(value => value?.objectRef),
    ...array(refs.inputRecords).map(value => value?.recordRef), ...entry.planSnapshot.planning.pairs.map(value => value?.pairId)];
  if (entry.outcomeSnapshot !== null) {
    const outcome = entry.outcomeSnapshot.references;
    others.push(outcome.captureRef, outcome.enrollmentRef, ...controls.map(control => outcome.controls?.[control]?.controlRef),
      ...array(outcome.pairs).map(value => value?.pairRef), ...array(outcome.objects).map(value => value?.objectRef),
      ...array(outcome.events).map(value => value?.recordRef), ...array(outcome.exposures).map(value => value?.experienceRef));
  }
  check(others.every(value => !reserved.has(value)), 'ROSTER_ALIASES');
}
function validateInventory(declaration, inventory, now) {
  shape(inventory, ['contractVersion', 'declarationDigest', 'inventory', 'manifest'], 'INVENTORY_INVALID');
  check(inventory.contractVersion === INVENTORY && inventory.declarationDigest === declaration.digest, 'DECLARATION_MISMATCH');
  const request = declaration.request;
  check(clock(now) && now >= request.evaluationAsOf, 'EVALUATION_NOT_READY');
  check(now <= declaration.retainUntil, 'EXPIRED');
  check(record(inventory.manifest) && inventory.manifest.scopeId === request.scopeId
    && inventory.manifest.evaluationAsOf === request.evaluationAsOf && Array.isArray(inventory.manifest.entries)
    && inventory.manifest.entries.length <= MAX_UNITS && Array.isArray(inventory.inventory)
    && inventory.inventory.length <= MAX_UNITS, 'INVENTORY_INVALID');
  const members = new Map(request.roster.map(member => [JSON.stringify([member.actorUserId, member.profileId]), member]));
  const summaries = new Map(); let totalPairs = 0;
  for (const summary of inventory.inventory) {
    shape(summary, ['enrollmentId', 'actorUserId', 'profileId', 'declaredAt', 'pairCount', 'firstCaptureStatus'], 'INVENTORY_INVALID');
    uuid(summary.enrollmentId, 'INVENTORY_INVALID'); uuid(summary.actorUserId, 'INVENTORY_INVALID'); uuid(summary.profileId, 'INVENTORY_INVALID');
    check(!summaries.has(summary.enrollmentId) && members.has(JSON.stringify([summary.actorUserId, summary.profileId]))
      && clock(summary.declaredAt) && summary.declaredAt >= request.enrollmentWindow.startAt
      && summary.declaredAt < request.enrollmentWindow.endAt && Number.isInteger(summary.pairCount)
      && summary.pairCount >= 1 && summary.pairCount <= 25
      && ['AVAILABLE', 'NOT_RESERVED', 'WITHDRAWN'].includes(summary.firstCaptureStatus), 'INVENTORY_INVALID');
    check(summary.firstCaptureStatus !== 'WITHDRAWN', 'WITHDRAWN');
    totalPairs += summary.pairCount; check(totalPairs <= MAX_UNITS, 'BUDGET'); summaries.set(summary.enrollmentId, summary);
  }
  check(summaries.size === inventory.manifest.entries.length, 'INVENTORY_MISMATCH');
  const seen = new Set();
  for (const entry of inventory.manifest.entries) {
    check(record(entry) && record(entry.expectedScope) && record(entry.planSnapshot)
      && record(entry.planSnapshot.enrollment) && record(entry.planSnapshot.references)
      && record(entry.planSnapshot.sourceRun) && record(entry.planSnapshot.planning)
      && Array.isArray(entry.planSnapshot.planning.pairs), 'INVENTORY_INVALID');
    const enrollment = entry.planSnapshot.enrollment, id = entry.expectedScope.enrollmentId, summary = summaries.get(id);
    check(summary && !seen.has(id) && enrollment.enrollmentId === id && summary.actorUserId === entry.expectedScope.actorUserId
      && summary.profileId === entry.expectedScope.profileId && summary.declaredAt === enrollment.declaredAt
      && summary.pairCount === entry.planSnapshot.planning.pairs.length && Array.isArray(enrollment.pairs)
      && enrollment.pairs.length === summary.pairCount, 'INVENTORY_MISMATCH');
    seen.add(id);
    const member = members.get(JSON.stringify([summary.actorUserId, summary.profileId]));
    check(entry.planSnapshot.references.actorRef === member.actorRef
      && entry.planSnapshot.references.subjectRef === member.subjectRef, 'ROSTER_ALIASES');
    const start = enrollment.declaredAt, end = start + request.horizonMs;
    check(record(enrollment.horizon) && enrollment.horizon.startAt === start && enrollment.horizon.endAt === end
      && enrollment.matureAt === end + request.settlementMs, 'HORIZON_MISMATCH');
    check(clock(entry.planSnapshot.snapshotObservedAt) && entry.planSnapshot.snapshotObservedAt <= now, 'FUTURE_SNAPSHOT');
    if (summary.firstCaptureStatus === 'NOT_RESERVED') check(entry.outcomeSnapshot === null, 'CAPTURE_STATUS');
    else check(record(entry.outcomeSnapshot) && record(entry.outcomeSnapshot.capture) && record(entry.outcomeSnapshot.references)
      && entry.outcomeSnapshot.capture.revision === 1, 'CAPTURE_STATUS');
    if (entry.outcomeSnapshot !== null) check(clock(entry.outcomeSnapshot.capture.capturedAt)
      && entry.outcomeSnapshot.capture.capturedAt <= now, 'FUTURE_SNAPSHOT');
    reserveRosterAliases(entry, request);
  }
  return summaries;
}
function checkPairPolicy(plan) {
  const groups = new Map();
  for (const candidate of plan.controls.OFF.candidates) if (candidate.eligible && candidate.selected && candidate.tier < 2) {
    if (!groups.has(candidate.tier)) groups.set(candidate.tier, []);
    groups.get(candidate.tier).push(candidate);
  }
  const expected = new Set(); let oddTails = 0;
  for (const candidates of groups.values()) {
    candidates.sort((a, b) => a.rank - b.rank); oddTails += candidates.length % 2;
    for (let i = 0; i + 1 < candidates.length; i += 2) expected.add(JSON.stringify([candidates[i].objectId, candidates[i + 1].objectId]));
  }
  check(expected.size === plan.pairs.length && plan.pairs.every(pair => expected.has(JSON.stringify([pair.leftObjectId, pair.rightObjectId]))), 'PAIR_POLICY');
  return oddTails;
}

/** Binds every supplied inventory row; it cannot enumerate or reauthorize Kajo. */
export async function buildWorkingCohortReport(declarationInput, inventory, now) {
  const declaration = validateDeclaration(declarationInput), summaries = validateInventory(declaration, inventory, now);
  const request = declaration.request;
  const entries = [...inventory.manifest.entries].sort((a, b) => a.expectedScope.enrollmentId < b.expectedScope.enrollmentId ? -1 : 1);
  let base;
  try { base = await buildWorkingReport({ ...inventory.manifest, entries }); }
  catch (error) { if (error instanceof WorkingReportError) reject(error.code); throw error; }
  const rosterCoverage = request.roster.map(member => ({ actorRef: member.actorRef, subjectRef: member.subjectRef,
    enrollmentUnits: 0, plannedPairUnits: 0, comparablePairUnits: 0, unscoredPairUnits: 0 }));
  const supportStrata = Object.fromEntries(['ACTIVE_AT_LEAST_TWO_ITEMS', 'OTHER_AVAILABLE_STATE', 'UNAVAILABLE'].map(key =>
    [key, { enrollmentUnits: 0, plannedPairUnits: 0, comparablePairUnits: 0, unscoredPairUnits: 0 }]));
  let oddTierTailCandidates = 0;
  for (const report of base.result.reports) {
    const plan = report.plan, versions = declaration.rules.sourceVersions;
    // Use the existing native adapter's exact fractional-ms clock parser.
    check(plan.sourceBinding.requestedAt >= request.enrollmentWindow.startAt
      && plan.sourceBinding.requestedAt < request.enrollmentWindow.endAt
      && plan.sourceBinding.requestedAt <= plan.createdAt, 'SOURCE_BEFORE_WINDOW');
    check(plan.versions.capture === versions.capture && plan.versions.features === versions.features
      && plan.versions.scorer === versions.scorer && plan.versions.policy.split('+').includes(versions.servingPolicyComponent)
      && controls.every(control => plan.controls[control].version === versions.control)
      && (report.captureRef === null || report.captureRef.resolutionVersion === versions.resolution), 'SOURCE_VERSION');
    oddTierTailCandidates += checkPairPolicy(plan);
    const coverage = rosterCoverage.find(member => member.subjectRef === plan.scope.subject.id);
    const working = plan.working, stratum = working.status === 'unavailable' ? 'UNAVAILABLE'
      : working.state.status === 'ACTIVE' && working.state.support.distinctItems >= 2 ? 'ACTIVE_AT_LEAST_TWO_ITEMS' : 'OTHER_AVAILABLE_STATE';
    for (const counts of [coverage, supportStrata[stratum]]) {
      counts.enrollmentUnits++; counts.plannedPairUnits += report.plannedPairUnits;
      counts.comparablePairUnits += report.comparablePairUnits; counts.unscoredPairUnits += report.unscoredPairUnits;
    }
  }
  const report = { ...base, contractVersion: 'kajo-personal-working-cohort-report-v1', cohort: {
    cohortRef: request.cohortRef, declarationDigest: declaration.digest, declaredAt: declaration.createdAt, reportObservedAt: now,
    clockBasis: declaration.clockBasis, integrityBasis: declaration.integrityBasis,
    predeclarationAuthenticity: 'NOT_ESTABLISHED_BY_FILE', nativeInventoryCompleteness: 'NOT_ESTABLISHED_BY_FILE',
    currentAuthorization: 'NOT_ESTABLISHED_BY_FILE', withdrawalStatus: 'NOT_ESTABLISHED_BY_FILE',
    enrollmentWindow: { ...request.enrollmentWindow }, horizonMs: request.horizonMs, settlementMs: request.settlementMs,
    evaluationAsOf: request.evaluationAsOf, retainUntil: declaration.retainUntil, rules: structuredClone(declaration.rules),
    suppliedEnrollmentUnits: summaries.size, firstCaptureAvailableUnits: [...summaries.values()].filter(row => row.firstCaptureStatus === 'AVAILABLE').length,
    firstCaptureNotReservedUnits: [...summaries.values()].filter(row => row.firstCaptureStatus === 'NOT_RESERVED').length,
    oddTierTailCandidates, rosterCoverage, supportStrata,
    supportInterpretation: 'DESCRIPTIVE_INPUT_ITEM_SUPPORT_NOT_INDEPENDENT_OUTCOME_N' } };
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  check(Buffer.byteLength(bytes, 'utf8') <= MAX_OUTPUT_BYTES, 'OUTPUT_TOO_LARGE');
  check(!embeddedUuidPattern.test(bytes), 'SNAPSHOT_REJECTED');
  return immutable(report);
}

export async function runWorkingCohortDeclaration(requestPath, outputPath) {
  assertPlatform(); check(typeof requestPath === 'string' && requestPath && typeof outputPath === 'string' && outputPath, 'ARGUMENTS');
  const destination = await reportPath(outputPath), request = await readManifest(requestPath);
  const declaration = createWorkingCohortDeclaration(request, Date.now());
  await writeReport(destination, declaration); return declaration;
}
export async function runWorkingCohortReport(declarationPath, inventoryPath, outputPath) {
  assertPlatform(); check(typeof declarationPath === 'string' && declarationPath && typeof inventoryPath === 'string' && inventoryPath
    && typeof outputPath === 'string' && outputPath, 'ARGUMENTS');
  const destination = await reportPath(outputPath), declaration = await readManifest(declarationPath), inventory = await readManifest(inventoryPath);
  const report = await buildWorkingCohortReport(declaration, inventory, Date.now());
  await writeReport(destination, report); return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [mode, ...paths] = process.argv.slice(2);
    if (mode === 'declare' && paths.length === 2) await runWorkingCohortDeclaration(...paths);
    else if (mode === 'report' && paths.length === 3) await runWorkingCohortReport(...paths);
    else reject('ARGUMENTS');
    process.stdout.write(`WORKING_COHORT_${mode === 'declare' ? 'DECLARED' : 'REPORT_CREATED'}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof WorkingCohortError ? error.message : 'WORKING_COHORT_FAILED'}\n`);
    process.exitCode = 1;
  }
}
