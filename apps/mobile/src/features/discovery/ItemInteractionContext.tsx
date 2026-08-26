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
  commitItemInteractionAction,
  EMPTY_ITEM_INTERACTION_STORE,
  undoLastItemInteractionAction,
  type ItemInteractionMap,
  type ItemInteractionStore,
  type ItemInterest,
} from './itemInteraction';

interface ItemInteractionState {
  interactions: ItemInteractionMap;
  setInterest: (itemId: ItemId, interest: ItemInterest | null) => void;
  toggleSaved: (itemId: ItemId) => void;
  setConsumed: (itemId: ItemId, consumed: boolean) => void;
  canUndo: boolean;
  undo: () => void;
}

const ItemInteractionContext = createContext<ItemInteractionState | null>(null);

export function ItemInteractionProvider({ children }: PropsWithChildren) {
  const [store, setStore] = useState<ItemInteractionStore>(EMPTY_ITEM_INTERACTION_STORE);

  const setInterest = useCallback((itemId: ItemId, interest: ItemInterest | null) => {
    setStore((current) =>
      commitItemInteractionAction(current, { type: 'SET_INTEREST', itemId, interest }),
    );
  }, []);

  const toggleSaved = useCallback((itemId: ItemId) => {
    setStore((current) =>
      commitItemInteractionAction(current, { type: 'TOGGLE_SAVED', itemId }),
    );
  }, []);

  const setConsumed = useCallback((itemId: ItemId, consumed: boolean) => {
    setStore((current) =>
      commitItemInteractionAction(current, { type: 'SET_CONSUMED', itemId, consumed }),
    );
  }, []);

  const undo = useCallback(() => {
    setStore(undoLastItemInteractionAction);
  }, []);

  const value = useMemo(
    () => ({
      interactions: store.interactions,
      setInterest,
      toggleSaved,
      setConsumed,
      canUndo: store.undoStack.length > 0,
      undo,
    }),
    [setConsumed, setInterest, store.interactions, store.undoStack.length, toggleSaved, undo],
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
