import type { ItemType } from '../../domain/contracts';

export const ITEM_INTERACTION_LABELS = {
  saved: 'Tallennettu',
  notInterested: 'Ei kiinnosta',
  notInterestedFeedback: 'Ei kiinnosta juuri nyt.',
  undo: 'Kumoa',
  undoFeedback: 'Viimeisin valinta kumottu.',
} as const;

interface ConsumedItemLabels {
  activeAction: string;
  history: string;
  markAction: string;
  markedFeedback: string;
  status: string;
  unmarkedFeedback: string;
}

const CONSUMED_ITEM_LABELS: Readonly<Record<ItemType, ConsumedItemLabels>> = {
  BOOK: {
    activeAction: 'Luettu',
    history: 'Luetut',
    markAction: 'Merkitse luetuksi',
    markedFeedback: 'Merkitty luetuksi.',
    status: 'LUETTU',
    unmarkedFeedback: 'Luettu-merkintä poistettu.',
  },
  MOVIE: {
    activeAction: 'Katsottu',
    history: 'Katsotut',
    markAction: 'Merkitse katsotuksi',
    markedFeedback: 'Merkitty katsotuksi.',
    status: 'KATSOTTU',
    unmarkedFeedback: 'Katsottu-merkintä poistettu.',
  },
};

export function getConsumedItemLabels(itemType: ItemType): ConsumedItemLabels {
  return CONSUMED_ITEM_LABELS[itemType];
}
