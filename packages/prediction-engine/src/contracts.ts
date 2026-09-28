/** Milliseconds on a declared clock; fixtures use an explicitly synthetic clock. */
export type Instant = number;

export interface Subject {
  readonly id: string;
  readonly kind: 'individual' | 'group' | 'system';
}

export type AccessScope =
  | { readonly kind: 'subject'; readonly subjectId: string }
  | { readonly kind: 'cohort'; readonly cohortId: string };

interface SourceRecord {
  readonly recordId: string;
  readonly revision: number;
}

/** Origin and access scope are independent: a shared simulation stays synthetic. */
export type Provenance = SourceRecord & (
  | { readonly origin: 'observed'; readonly source: { readonly kind: 'native'; readonly id: string } }
  | { readonly origin: 'observed'; readonly source: {
    readonly kind: 'external'; readonly id: string; readonly release: string;
    readonly manifestId: string; readonly availability: 'recorded' | 'assumed-at-occurrence';
  } }
  | { readonly origin: 'synthetic'; readonly source: {
    readonly kind: 'generator'; readonly id: string; readonly version: string;
    readonly parentRefs: readonly string[];
  } }
);

export interface EvidencePolicy {
  readonly sourceIds: readonly string[];
  readonly cohortIds: readonly string[];
  readonly synthetic: 'exclude' | 'fixture-only';
}

/** A trusted caller supplies an already-authorized snapshot, not credentials. */
export interface PredictionScope {
  readonly subject: Subject;
  readonly actingIdentityRef: string | null;
  readonly sessionRef: string;
  readonly evidence: EvidencePolicy;
}

export interface NumericScale { readonly min: number; readonly max: number }

export type Measurement =
  | { readonly status: 'observed'; readonly value: number }
  | { readonly status: 'missing'; readonly reason: 'unknown' | 'unexposed' | 'censored' | 'immature' };

export interface TargetDefinition {
  readonly id: string;
  readonly version: string;
  readonly scale: NumericScale;
  readonly conditioning: 'object-observation' | 'action-outcome';
  readonly exposure: 'required' | 'not-required';
  readonly objective: 'maximize' | 'minimize';
}

export interface Observation {
  readonly subjectId: string;
  readonly actingIdentityRef: string | null;
  readonly objectId: string;
  readonly actionId: string | null;
  readonly predictionId: string | null;
  readonly targetId: string;
  readonly targetVersion: string;
  readonly measurement: Measurement;
  /** Preserve original values/scales even when a later adapter transforms a label. */
  readonly raw: { readonly value: number | null; readonly scale: NumericScale };
  readonly occurredAt: Instant;
  readonly availableAt: Instant;
  readonly exposure: 'verified' | 'unknown' | 'not-exposed';
  readonly access: AccessScope;
  readonly provenance: Provenance;
}

export interface ArtifactVersion {
  readonly id: string;
  readonly version: string;
  readonly representationVersion: string;
  readonly availableAt: Instant;
  readonly trainedThrough: Instant | null;
  readonly sourceRefs: readonly string[];
  readonly use: 'fixture-only' | 'research-only';
}

export interface PredictionObject {
  readonly id: string;
  readonly features: Readonly<Record<string, number | null>>;
  readonly availableAt: Instant;
  readonly artifact: ArtifactVersion;
}

export interface Action {
  readonly id: string;
  readonly kind: string;
  readonly object: PredictionObject;
}

export interface StateHypothesis {
  readonly kind: 'state-hypothesis';
  readonly id: string;
  readonly interpretation: string;
  readonly supportRefs: readonly string[];
  readonly probability: null;
}

export interface State {
  readonly kind: 'state';
  readonly scope: PredictionScope;
  readonly asOf: Instant;
  readonly target: TargetDefinition;
  readonly artifact: ArtifactVersion;
  readonly prefix: readonly Observation[];
  readonly longTermMean: number | null;
  readonly recentMean: number | null;
  readonly hypotheses: readonly StateHypothesis[];
}

export interface HardConstraints {
  readonly version: string;
  readonly allowedActionIds: readonly string[];
}

/** Numeric estimates are uncalibrated; these counts are never probabilities. */
export interface Estimate {
  readonly value: number | null;
  readonly kind: 'numeric-estimate';
  readonly calibration: 'uncalibrated';
  readonly uncertainty: 'unavailable';
  readonly method: 'recalled-mean' | 'prefix-mean' | 'unavailable';
  readonly support: { readonly native: number; readonly external: number; readonly synthetic: number };
}

export interface Horizon { readonly startAt: Instant; readonly endAt: Instant }

export interface OutcomeBranch {
  readonly kind: 'outcome-branch';
  readonly target: TargetDefinition;
  readonly horizon: Horizon;
  readonly estimate: Estimate;
}

export interface ActionBranch {
  readonly kind: 'action-branch';
  readonly action: Action;
  readonly outcome: OutcomeBranch;
  readonly recall: RecallResult;
}

export interface ModelChallenger {
  readonly kind: 'model-challenger';
  readonly id: string;
  readonly model: ArtifactVersion;
}

export interface FrozenPrediction {
  readonly id: string;
  readonly kind: 'frozen-prediction';
  readonly state: State;
  readonly model: ArtifactVersion;
  readonly constraints: HardConstraints;
  readonly branches: readonly ActionBranch[];
}

export type Comparison =
  | { readonly kind: 'unscored'; readonly reason: string }
  | { readonly kind: 'scored'; readonly signedError: number; readonly absoluteError: number;
    readonly evidence: 'native' | 'external' | 'synthetic'; readonly observation: Observation };

export interface Scenario {
  readonly id: string;
  readonly access: AccessScope;
  readonly availableAt: Instant;
  readonly prediction: FrozenPrediction;
  readonly actionId: string;
  readonly outcome: Observation;
}

export interface RetrievalBudget {
  readonly maxScanned: number;
  readonly topK: number;
  readonly maxDistance: number;
}

export interface RecallResult {
  readonly status: 'matched' | 'no-useful-match';
  readonly matches: readonly {
    readonly scenarioId: string; readonly distance: number; readonly outcome: Observation;
  }[];
}

/** Adapter-only source types do not enter the core exports or runtime imports. */
export interface DomainAdapter<ScopeInput, ObjectInput, ObservationInput> {
  readonly version: string;
  readonly target: TargetDefinition;
  encodeScope(input: ScopeInput): PredictionScope;
  encodeObject(input: ObjectInput): PredictionObject;
  interpretObservation(input: ObservationInput): Observation;
  enumerateActions(objects: readonly PredictionObject[]): readonly Action[];
  defineHardConstraints(actions: readonly Action[], excludedObjectIds: readonly string[]): HardConstraints;
  calculateReward(observation: Observation): number | null;
}
