import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { ItemId } from '../../domain/contracts';
import {
  setItemConsumed,
  setItemInterest,
  toggleItemSaved,
  type ItemInteractionMap,
  type ItemInterest,
} from './itemInteraction';

interface ItemInteractionState {
  interactions: ItemInteractionMap;
  setInterest: (itemId: ItemId, interest: ItemInterest | null) => void;
  toggleSaved: (itemId: ItemId) => void;
  setConsumed: (itemId: ItemId, consumed: boolean) => void;
}

const ItemInteractionContext = createContext<ItemInteractionState | null>(null);

export function ItemInteractionProvider({ children }: PropsWithChildren) {
  const [interactions, setInteractions] = useState<ItemInteractionMap>({});

  const setInterest = useCallback((itemId: ItemId, interest: ItemInterest | null) => {
    setInteractions((current) => setItemInterest(current, itemId, interest));
  }, []);

  const toggleSaved = useCallback((itemId: ItemId) => {
    setInteractions((current) => toggleItemSaved(current, itemId));
  }, []);

  const setConsumed = useCallback((itemId: ItemId, consumed: boolean) => {
    setInteractions((current) => setItemConsumed(current, itemId, consumed));
  }, []);

  const value = useMemo(
    () => ({ interactions, setInterest, toggleSaved, setConsumed }),
    [interactions, setConsumed, setInterest, toggleSaved],
  );

  return <ItemInteractionContext.Provider value={value}>{children}</ItemInteractionContext.Provider>;
}

export function useItemInteractions(): ItemInteractionState {
  const state = useContext(ItemInteractionContext);

  if (!state) {
    throw new Error('useItemInteractions must be used within ItemInteractionProvider');
  }

  return state;
}
