import type { ItemInteractionMap } from './itemInteraction';

export function createLatestRequestGate() {
  let latest = 0;

  return {
    start() {
      latest += 1;
      return latest;
    },
    isLatest(token: number) {
      return token === latest;
    },
  };
}

export function getPredictionRefreshDelay(
  hasLoadedRequest: boolean,
  interactionRefreshDelayMs: number,
): number {
  return hasLoadedRequest ? interactionRefreshDelayMs : 0;
}

export function getInteractionEvidenceKey(
  interactions: ItemInteractionMap,
): string {
  return Object.entries(interactions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, interaction]) =>
      [
        itemId,
        interaction.interest ?? '',
        interaction.saved,
        interaction.consumed,
        interaction.rating ?? '',
        interaction.notInterested,
      ].join(':'),
    )
    .join('|');
}

// Imports/calibration also change authorized Shared common-fit. Invalidate all
// mounted slates in this app session; each hook still fetches its own Profile.
// The counter contains no Profile data and keeps no unbounded cache.
let bootstrapRevision = 0;
const bootstrapListeners = new Set<() => void>();

export function getBootstrapEvidenceRevision() {
  return bootstrapRevision;
}

export function subscribeToBootstrapEvidence(listener: () => void) {
  bootstrapListeners.add(listener);
  return () => { bootstrapListeners.delete(listener); };
}

export function notifyBootstrapEvidenceChanged() {
  bootstrapRevision += 1;
  bootstrapListeners.forEach((listener) => listener());
}
