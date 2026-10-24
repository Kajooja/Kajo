import type { ComponentProps } from 'react';
import type { ItemId } from '../../domain/contracts';
import { getItemInteraction } from './itemInteraction';
import { useItemInteractions } from './ItemInteractionContext';
import { RatingControl } from './RatingControl';

// RollingFeedCard retains this element with its original Item during departure.
// Read the locally queued rating by that Item so a same-event card advance does
// not remount the outgoing slider with its pre-choice value.
export function FeedRatingControl({ itemId, draft, ...props }: Omit<ComponentProps<typeof RatingControl>, 'rating'> & {
  itemId: ItemId; draft: number | null;
}) {
  const { interactions } = useItemInteractions();
  return <RatingControl {...props} rating={getItemInteraction(interactions, itemId).rating ?? draft} />;
}
