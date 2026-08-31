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
