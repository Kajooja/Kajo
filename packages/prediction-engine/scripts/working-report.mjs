// Ephemeral owner diagnostic: supplied native snapshots, no reads or writes to Kajo.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateReportFiles } from './private-report-files.mjs';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_PLANS = 128, MAX_PAIRS = 128;
const SELECTION = 'OWNER_DECLARED_NATIVE_ENROLLMENTS';
const controls = ['OFF', 'STATIC', 'ORDERED'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const embeddedUuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
const clock = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

export class WorkingReportError extends Error {
  constructor(code) { super(`WORKING_REPORT_${code}`); this.code = code; }
}
const reject = code => { throw new WorkingReportError(code); };
const { assertPlatform, readManifest, reportPath, writeReport } = createPrivateReportFiles({
  reject, isReportError: error => error instanceof WorkingReportError, maximumInputBytes: MAX_INPUT_BYTES,
  maximumOutputBytes: MAX_OUTPUT_BYTES,
});
export function assertWorkingReportPlatform(platform = process.platform) { assertPlatform(platform); }

function shape(value, required, optional = []) {
  if (!record(value) || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) reject('MANIFEST_INVALID');
}
function uuid(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) reject('SNAPSHOT_REJECTED');
  return value;
}
function validateManifest(value) {
  shape(value, ['contractVersion', 'selectionBasis', 'evidenceBasis', 'scopeId', 'evaluationAsOf', 'entries']);
  if (value.contractVersion !== 'kajo-personal-working-manifest-v1' || value.selectionBasis !== SELECTION
    || !['ENGINEERING_FIXTURE', 'OWNER_AUTHORIZED_NATIVE_SNAPSHOTS'].includes(value.evidenceBasis)
    || !text(value.scopeId) || value.scopeId.length > 128 || embeddedUuidPattern.test(value.scopeId)
    || !clock(value.evaluationAsOf) || !Array.isArray(value.entries) || value.entries.length > MAX_PLANS) reject('MANIFEST_INVALID');
  let totalPairs = 0;
  for (const entry of value.entries) {
    shape(entry, ['expectedScope', 'planSnapshot', 'outcomeSnapshot']);
    shape(entry.expectedScope, ['actorUserId', 'profileId', 'sessionId', 'sourcePredictionId', 'enrollmentId']);
    shape(entry.planSnapshot, ['actorUserId', 'profile', 'sourceRun', 'sourceCandidates', 'comparisons',
      'enrollment', 'snapshotObservedAt', 'planning', 'references']);
    if (!record(entry.planSnapshot.planning) || !Array.isArray(entry.planSnapshot.planning.pairs)
      || entry.planSnapshot.planning.pairs.length < 1 || entry.planSnapshot.planning.pairs.length > 25) reject('MANIFEST_INVALID');
    totalPairs += entry.planSnapshot.planning.pairs.length;
    if (totalPairs > MAX_PAIRS) reject('MANIFEST_INVALID');
    if (entry.outcomeSnapshot !== null) shape(entry.outcomeSnapshot, ['capture', 'references']);
  }
}

/** Native identity guards run before aliases can hide dependent records. */
function validateNativeBatch(manifest) {
  const claimed = new Set(), nativeAliases = new Map(), aliasIdentities = new Map();
  const inputRecords = new Map(), outcomeRecords = new Map();
  const claim = (kind, ...ids) => {
    const key = JSON.stringify([kind, ...ids]);
    if (claimed.has(key)) reject('SOURCE_REUSE');
    claimed.add(key);
  };
  const alias = (kind, nativeId, value) => {
    const identity = JSON.stringify([kind, uuid(nativeId)]);
    if (!text(value) || !value.startsWith(`${manifest.scopeId}:`) || value.length <= manifest.scopeId.length + 1
      || embeddedUuidPattern.test(value) || (nativeAliases.has(identity) && nativeAliases.get(identity) !== value)
      || (aliasIdentities.has(value) && aliasIdentities.get(value) !== identity)) reject('ALIASES_INVALID');
    nativeAliases.set(identity, value); aliasIdentities.set(value, identity);
  };
  const mappings = (value, kind, idKey, aliasKey, maximum, onRecord) => {
    if (!Array.isArray(value) || value.length > maximum) reject('SNAPSHOT_REJECTED');
    for (const reference of value) {
      if (!record(reference)) reject('SNAPSHOT_REJECTED');
      alias(kind, reference[idKey], reference[aliasKey]);
      onRecord?.(uuid(reference[idKey]));
    }
  };
  const addInput = (id, index) => {
    if (!inputRecords.has(id)) inputRecords.set(id, new Set());
    inputRecords.get(id).add(index);
  };
  const addOutcome = (id, index) => {
    if (outcomeRecords.has(id)) reject('SOURCE_REUSE');
    outcomeRecords.set(id, index);
  };
  manifest.entries.forEach((entry, index) => {
    const expected = entry.expectedScope, snapshot = entry.planSnapshot, enrollment = snapshot.enrollment;
    const source = snapshot.sourceRun, refs = snapshot.references, planning = snapshot.planning;
    if (!record(enrollment) || !record(source) || !record(snapshot.profile) || !record(refs)
      || !record(source.state_snapshot) || !record(source.state_snapshot.workingState)
      || !record(refs.controlRefs) || !record(planning) || refs.scopeId !== manifest.scopeId) reject('SNAPSHOT_REJECTED');
    for (const key of ['actorUserId', 'profileId', 'sessionId', 'sourcePredictionId', 'enrollmentId']) {
      if (uuid(enrollment[key]) !== uuid(expected[key])) reject('SCOPE_MISMATCH');
    }
    if (snapshot.actorUserId !== expected.actorUserId || snapshot.profile.id !== expected.profileId
      || snapshot.profile.ownerUserId !== expected.actorUserId || source.id !== expected.sourcePredictionId
      || source.actor_user_id !== expected.actorUserId || source.profile_id !== expected.profileId
      || source.session_id !== expected.sessionId || source.state_snapshot.workingState.version !== 'native-working-capture-v3'
      || !clock(snapshot.snapshotObservedAt) || snapshot.snapshotObservedAt > manifest.evaluationAsOf) reject('SCOPE_MISMATCH');
    claim('source', expected.sourcePredictionId); claim('enrollment', expected.enrollmentId);
    alias('actor', expected.actorUserId, refs.actorRef); alias('subject', expected.profileId, refs.subjectRef);
    alias('session', expected.sessionId, refs.sessionRef); alias('source', expected.sourcePredictionId, refs.sourcePredictionRef);
    alias('working-capture', source.state_snapshot.workingState.captureId, refs.captureRef);
    alias('enrollment', expected.enrollmentId, planning.id);
    if (!Array.isArray(enrollment.controls) || enrollment.controls.length !== 3
      || !Array.isArray(enrollment.pairs) || enrollment.pairs.length !== planning.pairs.length) reject('SNAPSHOT_REJECTED');
    for (const control of controls) {
      const native = enrollment.controls.find(value => record(value) && value.control === control);
      if (!native) reject('SNAPSHOT_REJECTED');
      claim('control', uuid(native.comparisonId)); alias('control', native.comparisonId, refs.controlRefs[control]);
    }
    enrollment.pairs.forEach((pair, pairIndex) => {
      if (!record(pair) || !record(planning.pairs[pairIndex])) reject('SNAPSHOT_REJECTED');
      claim('pair', uuid(pair.pairId));
      claim('subject-objects', expected.profileId, ...[uuid(pair.leftItemId), uuid(pair.rightItemId)].sort());
      alias('pair', pair.pairId, planning.pairs[pairIndex].pairId);
    });
    mappings(refs.objects, 'object', 'itemId', 'objectRef', 50);
    if (refs.inputObjects !== undefined) mappings(refs.inputObjects, 'object', 'itemId', 'objectRef', 32);
    if (refs.inputRecords !== undefined) mappings(refs.inputRecords, 'event', 'recordId', 'recordRef', 256,
      id => addInput(id, index));
    // Include all raw Events and exact correction targets even for inert captures.
    const rawEvents = source.state_snapshot.workingState.rawEvents;
    if (!Array.isArray(rawEvents) || rawEvents.length > 128) reject('SNAPSHOT_REJECTED');
    for (const event of rawEvents) {
      if (!record(event)) reject('SNAPSHOT_REJECTED');
      addInput(uuid(event.id), index);
      if (event.event_type === 'ITEM_INTERACTION_UNDONE') {
        if (!record(event.properties)) reject('SNAPSHOT_REJECTED');
        addInput(uuid(event.properties.reversedEventId), index);
      }
    }
    if (entry.outcomeSnapshot !== null) {
      const capture = entry.outcomeSnapshot.capture, outcomeRefs = entry.outcomeSnapshot.references;
      if (!record(capture) || !record(outcomeRefs) || outcomeRefs.scopeId !== manifest.scopeId
        || !clock(capture.capturedAt)) reject('SNAPSHOT_REJECTED');
      for (const key of ['actorUserId', 'profileId', 'sessionId', 'sourcePredictionId', 'enrollmentId']) {
        if (uuid(capture[key]) !== expected[key]) reject('SCOPE_MISMATCH');
      }
      claim('outcome-capture', uuid(capture.captureId));
      alias('outcome-capture', capture.captureId, outcomeRefs.captureRef);
      alias('enrollment', expected.enrollmentId, outcomeRefs.enrollmentRef);
      if (!record(outcomeRefs.controls)) reject('SNAPSHOT_REJECTED');
      for (const control of controls) {
        const reference = outcomeRefs.controls[control];
        if (!record(reference)) reject('SNAPSHOT_REJECTED');
        alias('control', reference.comparisonId, reference.controlRef);
      }
      mappings(outcomeRefs.pairs, 'pair', 'pairId', 'pairRef', 25);
      mappings(outcomeRefs.objects, 'object', 'itemId', 'objectRef', 50);
      mappings(outcomeRefs.events, 'event', 'eventId', 'recordRef', 50);
      mappings(outcomeRefs.exposures, 'experience', 'exposureId', 'experienceRef', 50);
      if (!Array.isArray(capture.labels) || capture.labels.length > 50) reject('SNAPSHOT_REJECTED');
      for (const label of capture.labels) {
        if (!record(label)) reject('SNAPSHOT_REJECTED');
        if (label.eventId !== null) addOutcome(uuid(label.eventId), index);
        if (label.exposureId !== null) addOutcome(uuid(label.exposureId), index);
      }
    }
  });
  // A genuine prospective declaration cannot relabel its already-frozen input
  // Event as a new terminal/exposure, even when its Working state was inert.
  for (const id of outcomeRecords.keys()) if (inputRecords.has(id)) reject('SOURCE_REUSE');
}

export async function runWorkingReport(inputPath, outputPath) {
  assertWorkingReportPlatform();
  if (typeof inputPath !== 'string' || !inputPath || typeof outputPath !== 'string' || !outputPath) reject('ARGUMENTS');
  const destination = await reportPath(outputPath), manifest = await readManifest(inputPath);
  validateManifest(manifest); validateNativeBatch(manifest);
  let normalizePlan, normalizeCapture, freezePlan, evaluateBatch;
  try {
    ({ normalizeKajoWorkingEvaluationPlan: normalizePlan } = await import('@kajo/prediction-engine/adapters/kajo-working-evaluation'));
    ({ normalizeKajoWorkingOutcomeCapture: normalizeCapture } = await import('@kajo/prediction-engine/adapters/kajo-working-outcomes'));
    ({ freezeWorkingEvaluationPlan: freezePlan, evaluateWorkingBatch: evaluateBatch } = await import('@kajo/prediction-engine/working-evaluation'));
  } catch { reject('ENGINE_UNAVAILABLE'); }
  let inputs;
  try {
    inputs = manifest.entries.map(entry => {
      const plan = freezePlan(normalizePlan(entry.planSnapshot));
      const capture = entry.outcomeSnapshot === null ? null : normalizeCapture({
        native: { actorUserId: entry.expectedScope.actorUserId, profileId: entry.expectedScope.profileId,
          sessionId: entry.expectedScope.sessionId, sourcePredictionId: entry.expectedScope.sourcePredictionId },
        enrollment: entry.planSnapshot.enrollment, plan, ...entry.outcomeSnapshot,
      });
      return { plan, capture, evaluationAsOf: manifest.evaluationAsOf };
    });
  } catch { reject('SNAPSHOT_REJECTED'); }
  let result;
  try { result = evaluateBatch(inputs); } catch { reject('SOURCE_REUSE'); }
  const actors = new Set(), sessions = new Set(), observedActors = new Set(), observedSessions = new Set();
  for (const report of result.reports) {
    const actor = report.plan.scope.actingIdentityRef, session = JSON.stringify([actor, report.plan.scope.sessionRef]);
    actors.add(actor); sessions.add(session);
    if (report.observed.nativePairUnits) { observedActors.add(actor); observedSessions.add(session); }
  }
  const report = { contractVersion: 'kajo-personal-working-report-v1', selectionBasis: SELECTION,
    evidenceBasis: manifest.evidenceBasis, evaluationAsOf: manifest.evaluationAsOf,
    sourceAuthenticity: 'NOT_ESTABLISHED_BY_FILE', cohortSelectionWasPredeclared: 'NOT_ESTABLISHED',
    cohortWindowPreregistered: 'NOT_ESTABLISHED', commitAvailability: 'UNKNOWN',
    observedEvidencePairUnits: manifest.evidenceBasis === 'ENGINEERING_FIXTURE' ? 0 : result.observedNativePairUnits,
    descriptiveOnly: true, historicalFeatureEligible: false, learnable: false, nativeActivated: false,
    qualityAdmitted: false, independence: 'not-established', uncertainty: 'unavailable',
    actorClusters: { actors: actors.size, actorSessions: sessions.size,
      observedActors: observedActors.size, observedActorSessions: observedSessions.size }, result };
  const serialized = JSON.stringify(report);
  if (embeddedUuidPattern.test(serialized)) reject('SNAPSHOT_REJECTED');
  await writeReport(destination, report);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 4) reject('ARGUMENTS');
    await runWorkingReport(process.argv[2], process.argv[3]);
    process.stdout.write('WORKING_REPORT_CREATED\n');
  } catch (error) {
    process.stderr.write(`${error instanceof WorkingReportError ? error.message : 'WORKING_REPORT_FAILED'}\n`);
    process.exitCode = 1;
  }
}
