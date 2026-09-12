import type {
  ArtifactVersion, DomainAdapter, Observation, Provenance, TargetDefinition,
} from '../contracts.js';

/** Structural snapshots preserve app names without importing app/provider code. */
export interface KajoScopeInput {
  readonly profile:
    | { readonly id: string; readonly type: 'PERSONAL'; readonly ownerUserId: string }
    | { readonly id: string; readonly type: 'SHARED'; readonly memberUserIds: readonly string[] };
  readonly user: { readonly id: string };
  readonly sessionId: string;
}

export interface KajoItemInput {
  readonly item: { readonly id: string; readonly itemType: 'BOOK' | 'MOVIE' };
  readonly features: Readonly<Record<string, number | null>>;
  readonly availableAt: number;
  readonly artifact: ArtifactVersion;
}

export interface KajoRatingInput {
  readonly eventId: string;
  readonly revision: number;
  readonly profileId: string;
  readonly actorUserId: string;
  readonly itemId: string;
  readonly rating: number | null;
  readonly occurredAt: number;
  readonly availableAt: number;
  readonly actionId: string | null;
  readonly predictionRunId: string | null;
  readonly exposureVerified: boolean;
}

const target: TargetDefinition = {
  id: 'kajo:post-experience-rating', version: '1', scale: { min: 0, max: 10 },
  conditioning: 'action-outcome', exposure: 'required', objective: 'maximize',
};

type KajoSource = Extract<Provenance, { origin: 'synthetic' }>['source']
  | { readonly kind: 'native'; readonly id: string };

/** No reads or writes: trusted server authorization/receipts remain outside E1. */
export function createKajoAdapter(source: KajoSource = { kind: 'native', id: 'kajo' }): DomainAdapter<KajoScopeInput, KajoItemInput, KajoRatingInput> {
  return {
    version: 'kajo-snapshot-v1', target,
    encodeScope({ profile, user, sessionId }) {
      const permitted = profile.type === 'PERSONAL' ? profile.ownerUserId === user.id : profile.memberUserIds.includes(user.id);
      if (!permitted) throw new Error('Actor is outside the supplied Profile snapshot');
      return { subject: { id: profile.id, kind: profile.type === 'PERSONAL' ? 'individual' : 'group' },
        actingIdentityRef: user.id, sessionRef: sessionId,
        evidence: { sourceIds: [source.id], cohortIds: [], synthetic: source.kind === 'generator' ? 'fixture-only' : 'exclude' } };
    },
    encodeObject({ item, features, availableAt, artifact }) {
      return { id: item.id, features, availableAt, artifact };
    },
    interpretObservation(input): Observation {
      if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > 10)) {
        throw new Error('Kajo rating must be an integer from 0 to 10 or unknown');
      }
      const record = { recordId: input.eventId, revision: input.revision };
      const provenance: Provenance = source.kind === 'generator'
        ? { ...record, origin: 'synthetic', source }
        : { ...record, origin: 'observed', source };
      return { subjectId: input.profileId, actingIdentityRef: input.actorUserId, objectId: input.itemId,
        actionId: input.actionId, predictionId: input.predictionRunId,
        targetId: target.id, targetVersion: target.version,
        measurement: input.rating === null ? { status: 'missing', reason: 'unknown' } : { status: 'observed', value: input.rating },
        raw: { value: input.rating, scale: target.scale }, occurredAt: input.occurredAt, availableAt: input.availableAt,
        exposure: input.exposureVerified ? 'verified' : 'unknown',
        access: { kind: 'subject', subjectId: input.profileId }, provenance };
    },
    enumerateActions: objects => objects.map(object => ({ id: `recommend:${object.id}`, kind: 'recommend', object })),
    defineHardConstraints: (actions, excludedObjectIds) => ({ version: 'authorized-eligible-items-v1',
      allowedActionIds: actions.filter(a => !excludedObjectIds.includes(a.object.id)).map(a => a.id) }),
    calculateReward: observation => observation.measurement.status === 'observed' ? observation.measurement.value : null,
  };
}
