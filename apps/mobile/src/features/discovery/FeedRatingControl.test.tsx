/// <reference types="node" />
import React, { createContext, useContext, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedRatingControl } from './FeedRatingControl';
import { RollingFeedCard } from './RollingFeedCard';
import { RatingControl } from './RatingControl';
import { getItemInteraction, type ItemInteractionMap } from './itemInteraction';
import { getRoomTheme } from '../../theme/roomTheme';

vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
const fixture = vi.hoisted(() => ({ useInteractions: vi.fn(), committed: vi.fn() }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => fixture.useInteractions() }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value }, Easing: { out: (value: unknown) => value, cubic: null },
  Animated: {
    View: 'AnimatedView', Text: 'AnimatedText',
    Value: class {
      value: number;
      constructor(value: number) { this.value = value; }
      setValue(value: number) { this.value = value; }
      stopAnimation() {}
      interpolate() { return this; }
    },
    timing: (value: { setValue: (value: number) => void }, options: { toValue: number }) => ({
      start(done?: () => void) { value.setValue(options.toValue); done?.(); },
    }),
    spring: (value: { setValue: (value: number) => void }, options: { toValue: number }) => ({
      start(done?: () => void) { value.setValue(options.toValue); done?.(); },
    }),
  },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
vi.mock('expo-sqlite/kv-store', () => ({ default: { getItemSync: () => 'seen', setItemSync() {} } }));
vi.mock('./ItemDescription', () => ({ ItemDescription: () => null }));

const InteractionContext = createContext<{ interactions: ItemInteractionMap }>({ interactions: {} });
function useFixtureInteractions() { return useContext(InteractionContext); }
const theme = getRoomTheme('DAWN');
function Feed({ draft }: { draft: number | null }) {
  const [interactions, setInteractions] = useState<ItemInteractionMap>({});
  const [active, setActive] = useState('A');
  return <InteractionContext.Provider value={{ interactions }}>
    <RollingFeedCard opportunity={active} item={{ id: active, itemType: 'MOVIE', title: active }}
      theme={theme} viewportHeight={600} disabled={false} entryDirection="forward" titleAction="★">
      <FeedRatingControl itemId={active} draft={active === 'A' ? draft : null} disabled={false} theme={theme}
        onRatingChange={rating => {
          fixture.committed(active, rating);
          // Durable admission updates the optimistic interaction and promotes
          // the next card within the very same native release/event batch.
          setInteractions(previous => ({ ...previous, [active]: { ...getItemInteraction(previous, active), rating } }));
          setActive('B');
        }} />
    </RollingFeedCard>
  </InteractionContext.Provider>;
}
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks(); fixture.useInteractions.mockImplementation(useFixtureInteractions);
});
afterEach(async () => {
  if (renderer) await act(async () => { renderer!.unmount(); });
  renderer = undefined; vi.unstubAllGlobals();
});

describe('rating continuity during immediate feed advance', () => {
  it.each([null, 10])('retains committed A=7 over frozen draft %s while newly active B remains unrated', async draft => {
    await act(async () => { renderer = create(<Feed draft={draft} />); });
    const track = () => renderer!.root.findByProps({ accessibilityRole: 'adjustable' });
    await act(async () => { track().props.onLayout({ nativeEvent: { layout: { width: 200 } } }); });
    await act(async () => {
      track().props.onPanResponderGrant({ nativeEvent: { locationX: 13 + 174 * 0.7 } },
        { dx: 0, dy: 0, numberActiveTouches: 1 });
      track().props.onPanResponderRelease(null, { dx: 0, dy: 0, numberActiveTouches: 0 });
    });
    expect(fixture.committed).toHaveBeenCalledExactlyOnceWith('A', 7);
    const outgoing = renderer!.root.findByProps({ testID: 'feed-previous-preview' });
    expect(outgoing.props.pointerEvents).toBe('none');
    expect(outgoing.findByType(FeedRatingControl).props).toMatchObject({ itemId: 'A', draft });
    expect(outgoing.findByType(RatingControl).props.rating).toBe(7);
    expect(outgoing.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue).toMatchObject({ now: 7, text: '7 / 10' });
    const active = renderer!.root.findAllByType(FeedRatingControl).find(node => node.props.itemId === 'B')!;
    expect(active.findByType(RatingControl).props.rating).toBeNull();
    expect(active.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue).toMatchObject({ now: 5, text: 'Valitse arvosana, lähtöarvo 5' });
    // Native slider position is recreated correctly too, not only its label.
    const handle = outgoing.findAll(node => node.type as unknown === 'AnimatedView')
      .find(node => node.props.pointerEvents === 'none' && node.props.style?.some((style: { transform?: unknown }) => style.transform));
    expect(handle?.props.style.find((style: { transform?: unknown }) => style.transform).transform[0].translateX.value).toBe(0.7);
  });
});
