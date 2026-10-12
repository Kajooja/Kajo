import type { SharedDiscoveryStateMap } from './sharedEndorsement';
import type { DiscoveryMode, Item } from '../../domain/contracts';

export interface DeliveredItemOrigin {
  readonly predictionId?: string;
  readonly properties: {
    readonly predictionSource: 'hosted' | 'fallback' | 'shared_overlay' | 'unattributed' | 'collection';
    readonly deliveryTier: 'RANKED' | 'SHARED_PENDING' | 'SHARED_MEMBER_HISTORY' | 'UNATTRIBUTED' | 'COLLECTION';
  };
}

const UNATTRIBUTED: DeliveredItemOrigin = Object.freeze({
  properties: Object.freeze({ predictionSource: 'unattributed', deliveryTier: 'UNATTRIBUTED' }),
});

export function getDeliveredItemOrigin(
  origins: Readonly<Record<string, DeliveredItemOrigin>>, itemId: string,
): DeliveredItemOrigin {
  return Object.hasOwn(origins, itemId) ? origins[itemId]! : UNATTRIBUTED;
}

export function buildDeliveredItemOrigins(
  items: readonly Item[], rankedItems: readonly Item[], prediction: string | Readonly<Record<string, string>>,
  source: 'hosted' | 'fallback', shared: SharedDiscoveryStateMap,
): Readonly<Record<string, DeliveredItemOrigin>> {
  const rankedIds = new Set(rankedItems.map(item => item.id));
  return Object.freeze(Object.fromEntries(items.map(item => {
    const state = shared[item.id];
    const deliveryTier = state?.pendingEndorsement ? 'SHARED_PENDING'
      : state?.memberConsumedUserIds.length ? 'SHARED_MEMBER_HISTORY' : 'RANKED';
    const predictionId = typeof prediction === 'string' ? prediction
      : Object.hasOwn(prediction, item.id) ? prediction[item.id] : undefined;
    const ranked = rankedIds.has(item.id) && Boolean(predictionId);
    return [item.id, Object.freeze({
      ...(ranked && predictionId ? { predictionId } : {}),
      properties: Object.freeze({
        predictionSource: ranked ? source : deliveryTier === 'RANKED' ? 'unattributed' : 'shared_overlay',
        deliveryTier: !ranked && deliveryTier === 'RANKED' ? 'UNATTRIBUTED' : deliveryTier,
      }),
    })];
  })));
}

export interface DeliveredSlate {
  readonly id: string;
  readonly scopeKey: string | null;
  readonly sessionId: string | null;
  readonly predictionId: string | null;
  readonly source: 'hosted' | 'fallback' | 'collection';
  readonly collectionTitle?: string;
  readonly mode: DiscoveryMode;
  readonly items: readonly Item[];
  readonly origins: Readonly<Record<string, DeliveredItemOrigin>>;
}

// Navigation transport only. Mounted detail retains its own snapshot; neither
// eviction nor another ranking may replace the origin of an already opened slate.
const slates = new Map<string, DeliveredSlate>();
const MAX_SLATES = 8;

export function rememberDeliveredSlate(input: DeliveredSlate): void {
  if (slates.has(input.id)) throw new Error('Delivered slate identity already used');
  const snapshot: DeliveredSlate = Object.freeze({
    ...input,
    origins: Object.freeze(Object.fromEntries(input.items.map(item => {
      const origin = getDeliveredItemOrigin(input.origins, item.id);
      return [item.id, Object.freeze({ ...origin, properties: Object.freeze({ ...origin.properties }) })];
    }))),
    items: Object.freeze(input.items.map(item => Object.freeze({ ...item, ...(item.tags ? { tags: Object.freeze([...item.tags]) } : {}),
      ...(item.creators ? { creators: Object.freeze([...item.creators]) } : {}) }))),
  });
  slates.set(input.id, snapshot);
  while (slates.size > MAX_SLATES) slates.delete(slates.keys().next().value!);
}

export function getDeliveredSlate(id: string | undefined): DeliveredSlate | undefined {
  return id ? slates.get(id) : undefined;
}

export function canUseDeliveredSlate(
  slate: DeliveredSlate,
  scopeKey: string | null,
  sessionId: string | null,
  itemId: string,
): boolean {
  if (slate.source !== 'fallback' && (!scopeKey || !sessionId)) return false;
  return slate.scopeKey === scopeKey && slate.sessionId === sessionId
    && slate.items.some(item => item.id === itemId);
}

export function rememberCollectionSlate(input: Omit<DeliveredSlate, 'source' | 'predictionId' | 'origins'>): void {
  rememberDeliveredSlate({ ...input, source: 'collection', predictionId: null,
    origins: Object.fromEntries(input.items.map(item => [item.id, {
      properties: { predictionSource: 'collection', deliveryTier: 'COLLECTION' },
    }])) });
}

export function buildCollectionSequence(selected: Item, items: readonly Item[]): readonly Item[] {
  return [selected, ...items.filter(item => item.id !== selected.id)];
}
