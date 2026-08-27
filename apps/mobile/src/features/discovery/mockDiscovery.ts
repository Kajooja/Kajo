import type { DiscoveryMode, Item, ItemId, ItemType } from '../../domain/contracts';

interface MockDiscoveryEntry {
  item: Item;
  scores: Readonly<Record<DiscoveryMode, number>>;
}

export const MOCK_ITEM_IDS = {
  bookLanternArchive: '00000000-0000-4000-8000-000000000001',
  bookOrbitGarden: '00000000-0000-4000-8000-000000000002',
  bookNorthboundSleepers: '00000000-0000-4000-8000-000000000003',
  bookPaperKingdoms: '00000000-0000-4000-8000-000000000004',
  bookSmallWeather: '00000000-0000-4000-8000-000000000005',
  bookGlassAnimal: '00000000-0000-4000-8000-000000000006',
  movieLastLightHouse: '00000000-0000-4000-8000-000000000101',
  movieStaticSummer: '00000000-0000-4000-8000-000000000102',
  movieQuietOrbit: '00000000-0000-4000-8000-000000000103',
  movieRedMuseum: '00000000-0000-4000-8000-000000000104',
  movieAfterRain: '00000000-0000-4000-8000-000000000105',
  movieMirrorRun: '00000000-0000-4000-8000-000000000106',
} as const;

const MOCK_DISCOVERY_ENTRIES: readonly MockDiscoveryEntry[] = [
  {
    item: {
      id: MOCK_ITEM_IDS.bookLanternArchive,
      itemType: 'BOOK',
      title: 'The Lantern Archive',
      description: 'A quiet mystery about a coastal archive, old letters and a light that appears before storms.',
      tags: ['mystery', 'atmospheric', 'slow-burn'],
    },
    scores: { FOR_YOU: 0.97, SURPRISE: 0.66, RISK: 0.34 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookOrbitGarden,
      itemType: 'BOOK',
      title: 'Orbit Garden',
      description: 'Near-future fiction about a botanist building a small living ecosystem above Earth.',
      tags: ['science-fiction', 'hopeful', 'nature'],
    },
    scores: { FOR_YOU: 0.82, SURPRISE: 0.91, RISK: 0.58 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookNorthboundSleepers,
      itemType: 'BOOK',
      title: 'Northbound Sleepers',
      description: 'A nocturnal train journey where six strangers slowly discover why they boarded the same carriage.',
      tags: ['literary', 'character-driven', 'night'],
    },
    scores: { FOR_YOU: 0.88, SURPRISE: 0.73, RISK: 0.62 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookPaperKingdoms,
      itemType: 'BOOK',
      title: 'Paper Kingdoms',
      description: 'An unusual speculative story built from maps, marginal notes and contradictory histories.',
      tags: ['experimental', 'fantasy', 'unusual'],
    },
    scores: { FOR_YOU: 0.55, SURPRISE: 0.86, RISK: 0.96 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookSmallWeather,
      itemType: 'BOOK',
      title: 'Small Weather',
      description: 'A warm contemporary novel about friendship, routine and noticing small changes in ordinary days.',
      tags: ['contemporary', 'warm', 'reflective'],
    },
    scores: { FOR_YOU: 0.93, SURPRISE: 0.52, RISK: 0.28 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookGlassAnimal,
      itemType: 'BOOK',
      title: 'Glass Animal',
      description: 'A tense surreal fable about memory, identity and a city where every reflection behaves differently.',
      tags: ['surreal', 'psychological', 'bold'],
    },
    scores: { FOR_YOU: 0.49, SURPRISE: 0.79, RISK: 0.99 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieLastLightHouse,
      itemType: 'MOVIE',
      title: 'Last Light House',
      description: 'A restrained drama about two siblings restoring an abandoned lighthouse before winter.',
      tags: ['drama', 'atmospheric', 'family'],
    },
    scores: { FOR_YOU: 0.96, SURPRISE: 0.59, RISK: 0.31 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieStaticSummer,
      itemType: 'MOVIE',
      title: 'Static Summer',
      description: 'A playful coming-of-age film about a pirate radio station operating for one impossible summer.',
      tags: ['coming-of-age', 'music', 'playful'],
    },
    scores: { FOR_YOU: 0.84, SURPRISE: 0.94, RISK: 0.54 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieQuietOrbit,
      itemType: 'MOVIE',
      title: 'Quiet Orbit',
      description: 'Minimal science fiction following a repair crew during the final week of an orbital station.',
      tags: ['science-fiction', 'minimal', 'slow-burn'],
    },
    scores: { FOR_YOU: 0.89, SURPRISE: 0.76, RISK: 0.61 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieRedMuseum,
      itemType: 'MOVIE',
      title: 'The Red Museum',
      description: 'A fragmented thriller in which every gallery room tells a different version of the same crime.',
      tags: ['thriller', 'experimental', 'unusual'],
    },
    scores: { FOR_YOU: 0.48, SURPRISE: 0.83, RISK: 0.98 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieAfterRain,
      itemType: 'MOVIE',
      title: 'After Rain',
      description: 'A gentle relationship drama set during one long weekend in a nearly empty city.',
      tags: ['romance', 'quiet', 'warm'],
    },
    scores: { FOR_YOU: 0.92, SURPRISE: 0.55, RISK: 0.27 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieMirrorRun,
      itemType: 'MOVIE',
      title: 'Mirror Run',
      description: 'A kinetic surreal adventure where a courier races through overlapping versions of the same city.',
      tags: ['surreal', 'adventure', 'bold'],
    },
    scores: { FOR_YOU: 0.51, SURPRISE: 0.81, RISK: 1 },
  },
];

export function getRankedMockItems(itemType: ItemType, mode: DiscoveryMode): readonly Item[] {
  return MOCK_DISCOVERY_ENTRIES.filter(({ item }) => item.itemType === itemType)
    .sort((left, right) => {
      const scoreDifference = right.scores[mode] - left.scores[mode];
      return scoreDifference !== 0 ? scoreDifference : left.item.id.localeCompare(right.item.id);
    })
    .map(({ item }) => item);
}

export function getMockItem(itemId: ItemId): Item | undefined {
  return MOCK_DISCOVERY_ENTRIES.find(({ item }) => item.id === itemId)?.item;
}
