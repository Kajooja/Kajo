import type { HardConstraints, PredictionScope, Provenance } from './contracts.js';

export type RankingJson = null | boolean | number | string | readonly RankingJson[]
  | { readonly [key: string]: RankingJson };

/** A frozen ordinal ranking, not an expected rating or the E1 reference estimator. */
export interface FrozenRanking {
  readonly version: 'frozen-ranking-v1';
  readonly predictionId: string;
  readonly scope: PredictionScope;
  /** Empty scope.sessionRef means no session only when this binding is null. */
  readonly sessionBinding: string | null;
  readonly acquisition: {
    readonly version: string; readonly policy: string;
    readonly requestedObjectIds: readonly string[] | null;
    readonly seenObjectIds: readonly string[]; readonly reminderSpent: boolean;
  };
  readonly intent: 'DELIVERY' | 'EVALUATION';
  readonly mode: string;
  readonly itemType: string | null;
  readonly versions: { readonly model: string; readonly baseModel: string; readonly policy: string; readonly genome: string };
  readonly clocks: {
    readonly version: string; readonly evidenceAsOf: number; readonly memoryAsOf: number;
    readonly scenarioAsOf: number; readonly requestAsOf: number; readonly workingAsOf: number | null;
    readonly requiredAfter: number | null; readonly arithmeticClock: string; readonly eligibilityClock: string;
    readonly dataSnapshot: string; readonly commitVisibility: 'UNKNOWN'; readonly historicalReconstruction: 'UNAVAILABLE';
  };
  readonly provenance: {
    readonly record: Provenance; readonly recordedAt: number; readonly snapshotObservedAt: number;
    readonly observation: 'frozen-records'; readonly availability: 'stored-timestamps-only';
  };
  /** Referenced immutable producer artifact; no invented trained/available-at time. */
  readonly scoringArtifact: RankingJson;
  /** Exact bounded producer record, including opaque frozen state/context. */
  readonly inputSnapshot: RankingJson;
  readonly constraints: HardConstraints;
  readonly scoreMeaning: 'ordinal-ranking-score';
  readonly calibration: 'uncalibrated';
  readonly candidates: readonly FrozenRankingCandidate[];
}

export interface FrozenRankingCandidate {
  readonly actionId: string; readonly objectId: string;
  readonly sourceScore: number; readonly sourceRank: number;
  readonly score: number; readonly rank: number;
  readonly eligible: boolean; readonly tier: number; readonly selected: boolean;
  /** Exact retained inputs/provenance, not features rebuilt from current objects. */
  readonly inputs: RankingJson;
}

export class RankingConformanceError extends Error {
  constructor(readonly code: 'invalid-ranking' | 'budget-exceeded' | 'invalid-tolerance') {
    super(code); this.name = 'RankingConformanceError';
  }
}

function check(value: unknown, code: RankingConformanceError['code'] = 'invalid-ranking'): asserts value {
  if (!value) throw new RankingConformanceError(code);
}

/** Validate before recursive comparison or cloning; accepts only bounded JSON. */
export function assertRankingJson(value: unknown): asserts value is RankingJson {
  let nodes = 0, bytes = 0;
  const active = new Set<object>(), encoder = new TextEncoder();
  const visit = (v: unknown, depth: number): void => {
    check(++nodes <= 250_000 && depth <= 40, 'budget-exceeded');
    if (v === null || typeof v === 'boolean') bytes += 5;
    else if (typeof v === 'number') { check(Number.isFinite(v)); bytes += String(v).length; }
    else if (typeof v === 'string') {
      check(v.length <= 8_388_608, 'budget-exceeded'); bytes += encoder.encode(JSON.stringify(v)).length;
    }
    else {
      check(typeof v === 'object' && v !== null && !active.has(v)); active.add(v);
      if (Array.isArray(v)) {
        check(Object.getPrototypeOf(v) === Array.prototype);
        check(v.length <= 2048, 'budget-exceeded');
        check(Reflect.ownKeys(v).length === v.length + 1);
        for (let i = 0; i < v.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(v, i);
          check(descriptor && 'value' in descriptor); visit(descriptor.value, depth + 1);
        }
        bytes += v.length + 2;
      } else {
        check(Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
        const keys = Object.keys(v); check(keys.length <= 4096, 'budget-exceeded');
        check(Reflect.ownKeys(v).length === keys.length);
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(v, key)!;
          check('value' in descriptor); bytes += encoder.encode(JSON.stringify(key)).length + 2; visit(descriptor.value, depth + 1);
        }
        bytes += 2;
      }
      active.delete(v);
    }
    check(bytes <= 8_388_608, 'budget-exceeded');
  };
  visit(value, 0);
}

function validRanking(value: FrozenRanking): void {
  assertRankingJson(value);
  const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1024;
  const clock = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
  const references = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 1000 && v.every(text) && new Set(v).size === v.length;
  check(object(value));
  check(value.version === 'frozen-ranking-v1' && typeof value.predictionId === 'string' && value.predictionId.length > 0
    && value.scoreMeaning === 'ordinal-ranking-score' && value.calibration === 'uncalibrated'
    && Array.isArray(value.candidates) && value.candidates.length <= 1000);
  check(object(value.scope) && object(value.scope.subject) && text(value.scope.subject.id)
    && ['individual', 'group', 'system'].includes(value.scope.subject.kind)
    && (value.scope.actingIdentityRef === null || text(value.scope.actingIdentityRef))
    && (value.sessionBinding === null || text(value.sessionBinding))
    && value.scope.sessionRef === (value.sessionBinding ?? '') && object(value.scope.evidence)
    && references(value.scope.evidence.sourceIds) && references(value.scope.evidence.cohortIds)
    && ['exclude', 'fixture-only'].includes(value.scope.evidence.synthetic));
  check(object(value.acquisition) && text(value.acquisition.version) && text(value.acquisition.policy)
    && (value.acquisition.requestedObjectIds === null || references(value.acquisition.requestedObjectIds))
    && references(value.acquisition.seenObjectIds) && typeof value.acquisition.reminderSpent === 'boolean'
    && ['DELIVERY', 'EVALUATION'].includes(value.intent) && text(value.mode)
    && (value.itemType === null || text(value.itemType)));
  check(object(value.versions) && ['model', 'baseModel', 'policy', 'genome'].every(key => text(value.versions[key as keyof typeof value.versions])));
  check(object(value.clocks) && text(value.clocks.version)
    && clock(value.clocks.evidenceAsOf) && clock(value.clocks.memoryAsOf) && clock(value.clocks.scenarioAsOf)
    && clock(value.clocks.requestAsOf) && (value.clocks.workingAsOf === null || clock(value.clocks.workingAsOf))
    && (value.clocks.requiredAfter === null || clock(value.clocks.requiredAfter))
    && text(value.clocks.arithmeticClock) && text(value.clocks.eligibilityClock) && text(value.clocks.dataSnapshot)
    && value.clocks.commitVisibility === 'UNKNOWN' && value.clocks.historicalReconstruction === 'UNAVAILABLE');
  check(object(value.provenance) && object(value.provenance.record) && object(value.provenance.record.source)
    && value.provenance.record.recordId === value.predictionId && Number.isSafeInteger(value.provenance.record.revision)
    && value.provenance.record.revision >= 1 && text(value.provenance.record.source.id)
    && value.scope.evidence.sourceIds.includes(value.provenance.record.source.id)
    && clock(value.provenance.recordedAt) && clock(value.provenance.snapshotObservedAt)
    && value.provenance.recordedAt <= value.provenance.snapshotObservedAt
    && value.clocks.requestAsOf <= value.provenance.snapshotObservedAt
    && value.provenance.observation === 'frozen-records' && value.provenance.availability === 'stored-timestamps-only');
  if (value.provenance.record.origin === 'synthetic') {
    check(value.provenance.record.source.kind === 'generator' && text(value.provenance.record.source.version)
      && references(value.provenance.record.source.parentRefs) && value.scope.evidence.synthetic === 'fixture-only');
  } else {
    check(value.provenance.record.origin === 'observed' && ['native', 'external'].includes(value.provenance.record.source.kind));
    if (value.provenance.record.source.kind === 'external') check(text(value.provenance.record.source.release)
      && text(value.provenance.record.source.manifestId)
      && ['recorded', 'assumed-at-occurrence'].includes(value.provenance.record.source.availability));
  }
  check(object(value.scoringArtifact) && object(value.inputSnapshot) && object(value.constraints) && text(value.constraints.version)
    && references(value.constraints.allowedActionIds));
  const actions = new Set<string>(), objects = new Set<string>();
  const sourceRanks = new Set<number>();
  for (const [index, candidate] of value.candidates.entries()) {
    check(object(candidate));
    check(typeof candidate.actionId === 'string' && candidate.actionId.length > 0
      && typeof candidate.objectId === 'string' && candidate.objectId.length > 0
      && !actions.has(candidate.actionId) && !objects.has(candidate.objectId));
    actions.add(candidate.actionId); objects.add(candidate.objectId);
    check(Number.isFinite(candidate.score) && Number.isFinite(candidate.sourceScore)
      && candidate.rank === index + 1
      && typeof candidate.sourceRank === 'number' && Number.isInteger(candidate.sourceRank) && candidate.sourceRank >= 1 && candidate.sourceRank <= value.candidates.length
      && typeof candidate.tier === 'number' && Number.isInteger(candidate.tier) && candidate.tier >= 0
      && typeof candidate.eligible === 'boolean' && typeof candidate.selected === 'boolean'
      && (!candidate.selected || (candidate.eligible && value.intent === 'DELIVERY'))
      && Object.hasOwn(candidate, 'inputs'));
    sourceRanks.add(candidate.sourceRank);
  }
  check(sourceRanks.size === value.candidates.length);
  const allowed = value.candidates.filter(candidate => candidate.eligible).map(candidate => candidate.actionId);
  check(allowed.length === value.constraints.allowedActionIds.length
    && allowed.every((id, index) => id === value.constraints.allowedActionIds[index]));
}

export interface RankingConformanceResult {
  readonly conforms: boolean;
  readonly mismatches: readonly { readonly kind: 'contract' | 'candidate' | 'score'; readonly path: string }[];
  readonly comparedCandidates: number;
  readonly maxAbsoluteScoreDifference: number;
}

/** Compare independently produced views of the same retained input pool; never score. */
export function compareFrozenRankings(expected: FrozenRanking, actual: FrozenRanking,
  tolerance: { readonly absoluteTolerance: number }): RankingConformanceResult {
  check(tolerance && Number.isFinite(tolerance.absoluteTolerance) && tolerance.absoluteTolerance >= 0, 'invalid-tolerance');
  validRanking(expected); validRanking(actual);
  const mismatches: { kind: 'contract' | 'candidate' | 'score'; path: string }[] = [];
  let maxAbsoluteScoreDifference = 0;
  const mismatch = (kind: 'contract' | 'candidate' | 'score', path: string): void => {
    if (mismatches.length < 100) mismatches.push({ kind, path });
  };
  const compare = (left: unknown, right: unknown, path: string, kind: 'contract' | 'candidate'): void => {
    if (left === right) return;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object'
      || Array.isArray(left) !== Array.isArray(right)) { mismatch(kind, path); return; }
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of [...keys].sort()) {
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) mismatch(kind, `${path}.${key}`);
      else compare(a[key], b[key], `${path}.${key}`, kind);
    }
  };
  const { candidates: expectedCandidates, ...expectedContract } = expected;
  const { candidates: actualCandidates, ...actualContract } = actual;
  compare(expectedContract, actualContract, '$', 'contract');
  if (expectedCandidates.length !== actualCandidates.length) mismatch('candidate', '$.candidates.length');
  const count = Math.min(expectedCandidates.length, actualCandidates.length);
  for (let i = 0; i < count; i++) {
    const { score: a, sourceScore: sa, ...left } = expectedCandidates[i]!;
    const { score: b, sourceScore: sb, ...right } = actualCandidates[i]!;
    compare(left, right, `$.candidates[${i}]`, 'candidate');
    for (const [name, difference] of [['score', Math.abs(a - b)], ['sourceScore', Math.abs(sa - sb)]] as const) {
      maxAbsoluteScoreDifference = Math.max(maxAbsoluteScoreDifference, difference);
      if (difference > tolerance.absoluteTolerance) mismatch('score', `$.candidates[${i}].${name}`);
    }
  }
  return { conforms: mismatches.length === 0, mismatches, comparedCandidates: count, maxAbsoluteScoreDifference };
}
