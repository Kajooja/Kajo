import { useState, type ComponentProps, type ReactNode } from 'react';
import type { Item } from '../../domain/contracts';
import { FeedItemCard } from './FeedItemCard';

type CardProps = ComponentProps<typeof FeedItemCard>;
type VisualFrame = Pick<CardProps, 'item' | 'children' | 'titleAction'> & { expanded: boolean };

// Retain only the outgoing visual during entry. It has no delivery lifecycle,
// impressions or input handlers; the controller remains the only active card.
export function RollingFeedCard({ opportunity, nextItem, previewControls, previewTitleAction, ...props }: CardProps & {
  opportunity: string; nextItem?: Item; previewControls?: ReactNode; previewTitleAction?: ReactNode;
}) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const visual: VisualFrame = { item: props.item, children: props.children, titleAction: props.titleAction, expanded: false };
  const [frame, setFrame] = useState<{ opportunity: string; current: VisualFrame; previous: VisualFrame | null;
    offset: number; pendingOffset: { value: number; height: number | undefined } | null }>({ opportunity, current: visual, previous: null, offset: 0, pendingOffset: null });
  if (frame.opportunity !== opportunity) {
    setFrame({ opportunity, current: visual, previous: frame.current,
      offset: props.entryDirection === 'backward' ? -64 :
        (frame.pendingOffset?.height === props.viewportHeight ? frame.pendingOffset?.value : undefined) ?? props.viewportHeight ?? 64,
      pendingOffset: null });
  } else if (frame.current.item !== props.item || frame.current.children !== props.children || frame.current.titleAction !== props.titleAction) {
    setFrame({ ...frame, current: { ...visual, expanded: frame.current.expanded } });
  }
  const preview = (item: Item, previous?: VisualFrame) => <FeedItemCard item={item} theme={props.theme} disabled preview
    viewportHeight={props.viewportHeight} initialExpanded={previous?.expanded ?? false}
    titleAction={previous ? previous.titleAction : previewTitleAction}>{previous ? previous.children : previewControls}</FeedItemCard>;
  return <FeedItemCard {...props} key={opportunity} entryOffset={frame.offset}
    initialReduceMotion={reduceMotion} onMotionPreference={setReduceMotion}
    onDescriptionExpanded={expanded => setFrame(current => ({ ...current, current: { ...current.current, expanded } }))}
    onForwardOffset={offset => setFrame(current => ({ ...current, pendingOffset: { value: offset, height: props.viewportHeight } }))}
    previousCard={frame.previous && frame.offset >= 0 ? preview(frame.previous.item, frame.previous) : undefined}
    nextCard={nextItem ? preview(nextItem) : undefined} />;
}
