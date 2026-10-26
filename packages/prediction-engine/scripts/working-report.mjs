// Ephemeral owner diagnostic: supplied native snapshots, no reads or writes to Kajo.
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
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

function immutable(value) {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}

// The cohort declaration hashes these fixed rules before its enrollment window.
export const WORKING_NATIVE_SOURCE_ADMISSION = immutable({
  version: 'working-native-source-admission-v1', scope: 'RETAINED_OFF_FINAL_RANKING',
  adapter: { scope: 'kajo-snapshot-v1', ranking: 'frozen-ranking-v1' },
  candidateRequest: 'native-candidate-request-v1', predictionInput: 'native-prediction-clocks-v1',
  intent: 'DELIVERY', acquisitions: ['LEGACY_DISCOVERY', 'CATALOG_CHAIN'],
  clocks: { arithmetic: 'TRANSACTION_START', eligibility: 'CURRENT_WALL_TIME',
    snapshot: 'CURRENT_STATEMENT_SNAPSHOTS', commitVisibility: 'UNKNOWN', historicalReconstruction: 'UNAVAILABLE' },
  precision: 'EXACT_STORED_CLOCKS_AND_LOSSLESS_NUMERIC_EXPORT', absoluteScoreTolerance: 1e-12,
  existingOffCheck: 'EXACT', comparedFields: ['objectId', 'score', 'rank', 'eligible', 'tier', 'selected'],
  computation: 'FROZEN_COMPARISON_NO_RESCORE',
});

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
  if (!['kajo-personal-working-manifest-v1', 'kajo-personal-working-manifest-v2'].includes(value.contractVersion)
    || value.selectionBasis !== SELECTION
    || !['ENGINEERING_FIXTURE', 'OWNER_AUTHORIZED_NATIVE_SNAPSHOTS'].includes(value.evidenceBasis)
    || !text(value.scopeId) || value.scopeId.length > 128 || embeddedUuidPattern.test(value.scopeId)
    || !clock(value.evaluationAsOf) || !Array.isArray(value.entries) || value.entries.length > MAX_PLANS) reject('MANIFEST_INVALID');
  let totalPairs = 0;
  for (const entry of value.entries) {
    shape(entry, ['expectedScope', 'planSnapshot', 'outcomeSnapshot']);
    shape(entry.expectedScope, ['actorUserId', 'profileId', 'sessionId', 'sourcePredictionId', 'enrollmentId']);
    shape(entry.planSnapshot, ['actorUserId', 'profile', 'sourceRun', 'sourceCandidates', 'comparisons',
      'enrollment', 'snapshotObservedAt', 'planning', 'references',
      ...(value.contractVersion === 'kajo-personal-working-manifest-v2' ? ['sourceGenome'] : [])]);
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
  const genomes = new Map();
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
    if (manifest.contractVersion === 'kajo-personal-working-manifest-v2') {
      const genome = snapshot.sourceGenome;
      if (!record(genome) || uuid(genome.id) !== uuid(source.genome_id)
        || (genomes.has(genome.id) && !isDeepStrictEqual(genomes.get(genome.id), genome))) reject('SNAPSHOT_REJECTED');
      genomes.set(genome.id, genome);
    }
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

function nativeAdmission(entry, plan, evidenceBasis, normalizeNative, compareRankings) {
  const snapshot = entry.planSnapshot;
  const native = normalizeNative({ scope: { profile: snapshot.profile, user: { id: snapshot.actorUserId },
    sessionId: snapshot.sourceRun.session_id }, sourceRun: snapshot.sourceRun,
  sourceCandidates: snapshot.sourceCandidates, sourceGenome: snapshot.sourceGenome,
  snapshotObservedAt: snapshot.snapshotObservedAt,
  source: evidenceBasis === 'ENGINEERING_FIXTURE'
    ? { kind: 'generator', id: 'working-report-engineering-fixture', version: '2', parentRefs: [] }
    : { kind: 'native', id: 'kajo' } });
  const rules = WORKING_NATIVE_SOURCE_ADMISSION;
  if (native.intent !== rules.intent || native.scope.subject.kind !== 'individual' || native.version !== rules.adapter.ranking
    || native.acquisition.version !== rules.candidateRequest || !rules.acquisitions.includes(native.acquisition.policy)
    || native.clocks.version !== rules.predictionInput || native.clocks.arithmeticClock !== rules.clocks.arithmetic
    || native.clocks.eligibilityClock !== rules.clocks.eligibility || native.clocks.dataSnapshot !== rules.clocks.snapshot
    || native.clocks.commitVisibility !== rules.clocks.commitVisibility
    || native.clocks.historicalReconstruction !== rules.clocks.historicalReconstruction) reject('SNAPSHOT_REJECTED');
  // normalizePlan already validates the exact, complete alias bijection and
  // native OFF score/rank/selection. Compare every retained row, including rows
  // outside the exposed pairs. The OFF control owns only these final fields;
  // source scores, input/provenance and clocks stay bound to the one native source.
  const identities = new Map(snapshot.references.objects.map(ref => [ref.objectRef, ref.itemId]));
  const original = new Map(native.candidates.map(candidate => [candidate.objectId, candidate]));
  const offCandidates = plan.controls.OFF.candidates.map(candidate => {
    const objectId = identities.get(candidate.objectId), source = original.get(objectId);
    if (!source) reject('SNAPSHOT_REJECTED');
    return { ...source, objectId, score: candidate.score, rank: candidate.rank,
      eligible: candidate.eligible, tier: candidate.tier, selected: candidate.selected };
  }).sort((a, b) => a.rank - b.rank);
  const conformance = compareRankings(native, { ...native, candidates: offCandidates },
    { absoluteTolerance: WORKING_NATIVE_SOURCE_ADMISSION.absoluteScoreTolerance });
  if (!conformance.conforms) reject('SNAPSHOT_REJECTED');
  return { sourcePredictionRef: snapshot.references.sourcePredictionRef, enrollmentRef: snapshot.planning.id,
    acquisition: native.acquisition.policy, status: 'PASS', comparedCandidates: conformance.comparedCandidates,
    selectedCandidates: native.candidates.filter(candidate => candidate.selected).length,
    maxAbsoluteScoreDifference: conformance.maxAbsoluteScoreDifference };
}

/** Pure snapshot builder; filesystem authorization remains the owner's duty. */
export async function buildWorkingReport(manifest) {
  validateManifest(manifest); validateNativeBatch(manifest);
  const v2 = manifest.contractVersion === 'kajo-personal-working-manifest-v2';
  let normalizePlan, normalizeCapture, freezePlan, evaluateBatch, normalizeNative, compareRankings;
  try {
    ({ normalizeKajoWorkingEvaluationPlan: normalizePlan } = await import('@kajo/prediction-engine/adapters/kajo-working-evaluation'));
    ({ normalizeKajoWorkingOutcomeCapture: normalizeCapture } = await import('@kajo/prediction-engine/adapters/kajo-working-outcomes'));
    ({ freezeWorkingEvaluationPlan: freezePlan, evaluateWorkingBatch: evaluateBatch } = await import('@kajo/prediction-engine/working-evaluation'));
    if (v2) {
      const { createKajoAdapter } = await import('@kajo/prediction-engine/adapters/kajo');
      if (createKajoAdapter().version !== WORKING_NATIVE_SOURCE_ADMISSION.adapter.scope) reject('ENGINE_UNAVAILABLE');
      ({ normalizeKajoNativePrediction: normalizeNative } = await import('@kajo/prediction-engine/adapters/kajo-native-prediction'));
      ({ compareFrozenRankings: compareRankings } = await import('@kajo/prediction-engine/ranking-conformance'));
    }
  } catch { reject('ENGINE_UNAVAILABLE'); }
  let inputs;
  const nativeSources = [];
  try {
    inputs = manifest.entries.map(entry => {
      let planSnapshot = entry.planSnapshot;
      if (v2) { planSnapshot = { ...planSnapshot }; delete planSnapshot.sourceGenome; }
      const plan = freezePlan(normalizePlan(planSnapshot));
      if (v2) nativeSources.push(nativeAdmission(entry, plan, manifest.evidenceBasis, normalizeNative, compareRankings));
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
  const report = { contractVersion: `kajo-personal-working-report-${v2 ? 'v2' : 'v1'}`, selectionBasis: SELECTION,
    evidenceBasis: manifest.evidenceBasis, evaluationAsOf: manifest.evaluationAsOf,
    sourceAuthenticity: 'NOT_ESTABLISHED_BY_FILE', cohortSelectionWasPredeclared: 'NOT_ESTABLISHED',
    cohortWindowPreregistered: 'NOT_ESTABLISHED', commitAvailability: 'UNKNOWN',
    observedEvidencePairUnits: manifest.evidenceBasis === 'ENGINEERING_FIXTURE' ? 0 : result.observedNativePairUnits,
    descriptiveOnly: true, historicalFeatureEligible: false, learnable: false, nativeActivated: false,
    qualityAdmitted: false, independence: 'not-established', uncertainty: 'unavailable',
    actorClusters: { actors: actors.size, actorSessions: sessions.size,
      observedActors: observedActors.size, observedActorSessions: observedSessions.size }, result };
  if (v2) report.nativeSourceAdmission = { rules: WORKING_NATIVE_SOURCE_ADMISSION, sources: nativeSources };
  const serialized = JSON.stringify(report);
  if (embeddedUuidPattern.test(serialized)) reject('SNAPSHOT_REJECTED');
  return report;
}

export async function runWorkingReport(inputPath, outputPath) {
  assertWorkingReportPlatform();
  if (typeof inputPath !== 'string' || !inputPath || typeof outputPath !== 'string' || !outputPath) reject('ARGUMENTS');
  const destination = await reportPath(outputPath), manifest = await readManifest(inputPath);
  const report = await buildWorkingReport(manifest);
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
