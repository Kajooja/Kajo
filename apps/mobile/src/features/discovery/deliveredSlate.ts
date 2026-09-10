import type { DiscoveryMode, Item } from '../../domain/contracts';

export interface DeliveredSlate {
  readonly id: string;
  readonly scopeKey: string | null;
  readonly sessionId: string | null;
  readonly predictionId: string;
  readonly source: 'hosted' | 'fallback';
  readonly mode: DiscoveryMode;
  readonly items: readonly Item[];
}

// Navigation transport only. Mounted detail retains its own snapshot; neither
// eviction nor another ranking may replace the origin of an already opened slate.
const slates = new Map<string, DeliveredSlate>();
const MAX_SLATES = 8;

export function rememberDeliveredSlate(input: DeliveredSlate): void {
  if (slates.has(input.id)) throw new Error('Delivered slate identity already used');
  const snapshot: DeliveredSlate = Object.freeze({
    ...input,
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
  if (slate.source === 'hosted' && (!scopeKey || !sessionId)) return false;
  return slate.scopeKey === scopeKey && slate.sessionId === sessionId
    && slate.items.some(item => item.id === itemId);
}
