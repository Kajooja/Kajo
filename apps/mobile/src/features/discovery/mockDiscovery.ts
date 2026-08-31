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
  bookTideSignal: '00000000-0000-4000-8000-000000000007',
  bookEmberAtlas: '00000000-0000-4000-8000-000000000008',
  bookZeroChorus: '00000000-0000-4000-8000-000000000009',
  bookWinterOrchard: '00000000-0000-4000-8000-000000000010',
  bookSignalBelow: '00000000-0000-4000-8000-000000000011',
  bookBorrowedHours: '00000000-0000-4000-8000-000000000012',
  movieLastLightHouse: '00000000-0000-4000-8000-000000000101',
  movieStaticSummer: '00000000-0000-4000-8000-000000000102',
  movieQuietOrbit: '00000000-0000-4000-8000-000000000103',
  movieRedMuseum: '00000000-0000-4000-8000-000000000104',
  movieAfterRain: '00000000-0000-4000-8000-000000000105',
  movieMirrorRun: '00000000-0000-4000-8000-000000000106',
  movieBlueStatic: '00000000-0000-4000-8000-000000000107',
  movieSoftGravity: '00000000-0000-4000-8000-000000000108',
  movieMidnightOrchard: '00000000-0000-4000-8000-000000000109',
  moviePaperPlanets: '00000000-0000-4000-8000-000000000110',
  movieNorthGlass: '00000000-0000-4000-8000-000000000111',
  movieUncommonFrequency: '00000000-0000-4000-8000-000000000112',
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
      id: MOCK_ITEM_IDS.bookTideSignal,
      itemType: 'BOOK',
      title: 'Tide Signal',
      description: 'A coastal suspense novel about a radio operator who starts receiving warnings from tomorrow.',
      tags: ['thriller', 'coastal', 'tense'],
    },
    scores: { FOR_YOU: 0.76, SURPRISE: 0.88, RISK: 0.81 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookEmberAtlas,
      itemType: 'BOOK',
      title: 'Ember Atlas',
      description: 'An adventurous fantasy about cartographers mapping a warm volcanic archipelago that keeps changing shape.',
      tags: ['fantasy', 'adventure', 'warm'],
    },
    scores: { FOR_YOU: 0.79, SURPRISE: 0.84, RISK: 0.72 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookZeroChorus,
      itemType: 'BOOK',
      title: 'Zero Chorus',
      description: 'Experimental science fiction told through the rehearsals of a choir trying to communicate with a silent machine.',
      tags: ['science-fiction', 'experimental', 'music'],
    },
    scores: { FOR_YOU: 0.61, SURPRISE: 0.95, RISK: 0.9 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookWinterOrchard,
      itemType: 'BOOK',
      title: 'Winter Orchard',
      description: 'A reflective family novel about three generations returning to an orchard during its final winter.',
      tags: ['literary', 'family', 'reflective'],
    },
    scores: { FOR_YOU: 0.9, SURPRISE: 0.57, RISK: 0.35 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookSignalBelow,
      itemType: 'BOOK',
      title: 'Signal Below',
      description: 'A psychological horror story about a research team hearing impossible messages beneath polar ice.',
      tags: ['horror', 'psychological', 'dark'],
    },
    scores: { FOR_YOU: 0.43, SURPRISE: 0.7, RISK: 0.97 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.bookBorrowedHours,
      itemType: 'BOOK',
      title: 'Borrowed Hours',
      description: 'A playful contemporary romance in which two strangers repeatedly inherit the same hour of free time.',
      tags: ['romance', 'playful', 'contemporary'],
    },
    scores: { FOR_YOU: 0.86, SURPRISE: 0.77, RISK: 0.46 },
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
  {
    item: {
      id: MOCK_ITEM_IDS.movieBlueStatic,
      itemType: 'MOVIE',
      title: 'Blue Static',
      description: 'A tense technology thriller about a citywide signal that appears only on abandoned television channels.',
      tags: ['thriller', 'technology', 'tense'],
    },
    scores: { FOR_YOU: 0.74, SURPRISE: 0.87, RISK: 0.86 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieSoftGravity,
      itemType: 'MOVIE',
      title: 'Soft Gravity',
      description: 'Hopeful science-fiction romance following two engineers maintaining a drifting research habitat.',
      tags: ['science-fiction', 'romance', 'hopeful'],
    },
    scores: { FOR_YOU: 0.87, SURPRISE: 0.8, RISK: 0.52 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieMidnightOrchard,
      itemType: 'MOVIE',
      title: 'Midnight Orchard',
      description: 'An atmospheric slow-burn horror film set in an orchard where the trees bloom only after midnight.',
      tags: ['horror', 'atmospheric', 'slow-burn'],
    },
    scores: { FOR_YOU: 0.58, SURPRISE: 0.72, RISK: 0.95 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.moviePaperPlanets,
      itemType: 'MOVIE',
      title: 'Paper Planets',
      description: 'An imaginative animated family film about siblings building a universe from discarded maps.',
      tags: ['animation', 'family', 'imaginative'],
    },
    scores: { FOR_YOU: 0.85, SURPRISE: 0.89, RISK: 0.49 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieNorthGlass,
      itemType: 'MOVIE',
      title: 'North Glass',
      description: 'A reflective documentary following winter light, wildlife and isolated communities above the Arctic Circle.',
      tags: ['documentary', 'nature', 'reflective'],
    },
    scores: { FOR_YOU: 0.8, SURPRISE: 0.69, RISK: 0.44 },
  },
  {
    item: {
      id: MOCK_ITEM_IDS.movieUncommonFrequency,
      itemType: 'MOVIE',
      title: 'Uncommon Frequency',
      description: 'A bold experimental music film assembled from one concert heard differently by every person in the room.',
      tags: ['experimental', 'music', 'bold'],
    },
    scores: { FOR_YOU: 0.56, SURPRISE: 0.93, RISK: 0.92 },
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
