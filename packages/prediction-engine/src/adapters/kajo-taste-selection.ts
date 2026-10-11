import type { ArtifactVersion } from '../contracts.js';
import type { TasteCandidate, TastePresentation, TasteSelectionConfig, TasteSelectionInput, TasteStage } from '../taste-selection.js';
import { selectTasteOpportunity } from '../taste-selection.js';

export const kajoTasteStages: readonly TasteStage[] = Object.freeze([
  Object.freeze({ id: 'movies', domains: Object.freeze(['MOVIE']), targetOpportunities: 10 }),
  Object.freeze({ id: 'books', domains: Object.freeze(['BOOK']), targetOpportunities: 10 }),
]);
export interface KajoTasteSelectionSnapshot {
  readonly profile: { readonly id: string; readonly profileType: 'PERSONAL'; readonly ownerUserId: string };
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly asOf: number;
  readonly catalogAsOf: number;
  readonly artifact: ArtifactVersion;
  readonly items: readonly {
    readonly id: string;
    readonly itemType: 'BOOK' | 'MOVIE';
    readonly discoverable: boolean;
    readonly providerKeys: readonly string[];
    readonly availableAt: number;
    readonly tags: readonly (string | null)[];
    readonly recognitionPrior: number | null;
    readonly priorBasis: TasteCandidate['priorBasis'];
  }[];
  readonly presentations: readonly TastePresentation[];
  readonly acknowledgedTransitions: readonly string[];
  readonly existingCompleted: boolean;
  readonly policy?: TasteSelectionInput['policy'];
  readonly config?: Partial<TasteSelectionConfig>;
}
function valid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Kajo Taste selection: ${message}`);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
}
/** Trusted authorized own-Personal snapshot, not an authorization reader or native writer. */
export function normalizeKajoTasteSelection(input: KajoTasteSelectionSnapshot): TasteSelectionInput {
  valid(input && input.profile && id(input.profile.id) && input.profile.profileType === 'PERSONAL'
    && id(input.actorUserId) && input.actorUserId === input.profile.ownerUserId && id(input.sessionId),
  'own PersonalProfile, actor and session required');
  valid(input.artifact && id(input.artifact.id) && id(input.artifact.version)
    && input.artifact.representationVersion === 'native-binary-tags-v1', 'native binary-tag representation required');
  valid(Array.isArray(input.items) && input.items.length <= 256, 'catalog budget exceeded');
  const candidates: TasteCandidate[] = input.items.map(item => {
    valid(item && id(item.id) && ['BOOK', 'MOVIE'].includes(item.itemType) && typeof item.discoverable === 'boolean'
      && Array.isArray(item.providerKeys) && item.providerKeys.length <= 16 && item.providerKeys.every(id), 'invalid canonical Item provenance');
    valid(Array.isArray(item.tags) && item.tags.length <= 64 && item.tags.every((tag: unknown) => tag === null || id(tag)), 'invalid canonical tags');
    const features: Record<string, number | null> = Object.create(null) as Record<string, number | null>;
    for (const tag of item.tags) if (tag !== null) features[tag] = 1;
    return { object: { id: item.id, availableAt: item.availableAt, features, artifact: input.artifact }, domain: item.itemType,
      eligible: item.discoverable && item.providerKeys.some((provider: string) => provider !== 'kajo_mock'),
      recognitionPrior: item.recognitionPrior, priorBasis: item.priorBasis };
  });
  const result: TasteSelectionInput = { scope: { subject: { id: input.profile.id, kind: 'individual' },
    actingIdentityRef: input.actorUserId, sessionRef: input.sessionId,
    evidence: { sourceIds: [input.artifact.id], cohortIds: [], synthetic: 'exclude' } },
  asOf: input.asOf, catalogAsOf: input.catalogAsOf, ratingScale: { min: 0, max: 10 }, candidates,
  stages: kajoTasteStages, presentations: input.presentations, acknowledgedTransitions: input.acknowledgedTransitions,
  existingCompleted: input.existingCompleted,
  ...(input.policy === undefined ? {} : { policy: input.policy }), ...(input.config === undefined ? {} : { config: input.config }) };
  // Reuse core validation rather than maintaining a second ledger/clock policy.
  selectTasteOpportunity(result);
  for (const presentation of result.presentations) for (const response of presentation.responses) {
    if (response.answer.kind === 'RATING') valid(Number.isInteger(response.answer.value), 'canonical Kajo rating must be an integer 0..10');
  }
  const copy = structuredClone(result);
  const freeze = (value: unknown): void => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  };
  freeze(copy); return copy;
}
