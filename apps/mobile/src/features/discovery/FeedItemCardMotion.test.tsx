/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedItemCard } from './FeedItemCard';
import { RollingFeedCard } from './RollingFeedCard';
import { ItemDescription } from './ItemDescription';
import { getRoomTheme } from '../../theme/roomTheme';

const fixture = vi.hoisted(() => ({
  reduced: false, deferPreference: false, deferAnimation: false,
  resolvePreference: null as ((value: boolean) => void) | null,
  animations: [] as { kind: string; toValue: number; useNativeDriver: boolean }[],
  values: [] as { value: number; initial: number }[],
  app: null as (() => void) | null,
}));
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      value: number; initial: number;
      constructor(value: number) { this.value = value; this.initial = value; fixture.values.push(this); }
      setValue(value: number) { this.value = value; }
      stopAnimation() {}
    },
    timing: (value: { setValue: (v: number) => void }, options: { toValue: number; useNativeDriver: boolean }) => ({
      start(done?: () => void) { fixture.animations.push({ kind: 'timing', ...options });
        if (!fixture.deferAnimation) { value.setValue(options.toValue); done?.(); } },
    }),
    spring: (value: { setValue: (v: number) => void }, options: { toValue: number; useNativeDriver: boolean }) => ({
      start(done?: () => void) { fixture.animations.push({ kind: 'spring', ...options });
        if (!fixture.deferAnimation) { value.setValue(options.toValue); done?.(); } },
    }),
  },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AccessibilityInfo: { isReduceMotionEnabled: () => fixture.deferPreference ? new Promise<boolean>(resolve => { fixture.resolvePreference = resolve; }) : Promise.resolve(fixture.reduced),
    addEventListener: () => ({ remove() {} }) },
  AppState: { currentState: 'active', addEventListener: (_: string, callback: () => void) => {
    fixture.app = callback; return { remove() {} };
  } },
}));
vi.mock('expo-sqlite/kv-store', () => ({ default: { getItemSync: () => 'seen', setItemSync() {} } }));
vi.mock('./ItemDescription', () => ({ ItemDescription: () => null }));

let renderer: ReactTestRenderer | undefined;
const base = { item: { id: 'one', itemType: 'MOVIE' as const, title: 'One' },
  theme: getRoomTheme('DAWN'), viewportHeight: 600, disabled: false };
const surface = () => renderer!.root.findByProps({ testID: 'feed-dismiss-surface' });
const drag = (dy: number) => {
  surface().props.onPanResponderGrant();
  surface().props.onPanResponderMove(null, { dx: 0, dy, numberActiveTouches: 1 });
};
const release = (dy: number) => surface().props.onPanResponderRelease(null, { dx: 0, dy });

beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.reduced = false; fixture.deferPreference = false; fixture.resolvePreference = null;
  fixture.deferAnimation = false; fixture.animations = []; fixture.values = []; fixture.app = null;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks();
});

async function mount(props: Partial<React.ComponentProps<typeof FeedItemCard>> = {}) {
  const onSkip = vi.fn(() => true);
  const all = { ...base, onSkip, initialReduceMotion: fixture.reduced, ...props };
  await act(async () => { renderer = create(<FeedItemCard {...all} />); });
  return all;
}

describe('mounted feed card motion', () => {
  it('keeps an accepted swipe offset during acknowledgement and uses the latest harmless callback refresh', async () => {
    const props = await mount(); const latest = vi.fn(() => true);
    const responderMove = surface().props.onPanResponderMove;
    await act(async () => { drag(-120); });
    await act(async () => { renderer!.update(<FeedItemCard {...props} onSkip={latest} />); });
    expect(surface().props.onPanResponderMove).toBe(responderMove);
    await act(async () => { release(-120); });
    expect(latest).toHaveBeenCalledOnce(); expect(props.onSkip).not.toHaveBeenCalled();
    expect(fixture.values[0]!.value).toBe(-120);
    expect(fixture.animations.at(-1)).toMatchObject({ kind: 'timing', toValue: -120, useNativeDriver: true });
    await act(async () => { renderer!.update(<FeedItemCard {...props} onSkip={latest} disabled />); });
    expect(fixture.values[0]!.value).toBe(-120);
    await act(async () => { fixture.app!(); });
    expect(fixture.values[0]!.value).toBe(0); expect(latest).toHaveBeenCalledOnce();
  });

  it('springs a reversed gesture back without submitting a command', async () => {
    const props = await mount();
    await act(async () => {
      drag(-140); surface().props.onPanResponderMove(null, { dx: 0, dy: -30, numberActiveTouches: 1 }); release(-30);
    });
    expect(props.onSkip).not.toHaveBeenCalled();
    expect(fixture.animations.at(-1)).toMatchObject({ kind: 'spring', toValue: 0, useNativeDriver: true });
    expect(fixture.values[0]!.value).toBe(0);
  });

  it('cancels a drag when competing work disables the card', async () => {
    const props = await mount();
    await act(async () => { drag(-120); });
    await act(async () => { renderer!.update(<FeedItemCard {...props} disabled />); });
    await act(async () => { release(-120); });
    expect(props.onSkip).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(0);
    await act(async () => {
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(false);
      drag(-120); release(-120);
    });
    expect(props.onSkip).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(0);
  });

  it.each([['forward', 64], ['backward', -64]] as const)('enters from %s using native animation without issuing actions', async (entryDirection, offset) => {
    const props = await mount({ entryDirection });
    expect(fixture.values[0]!.initial).toBe(offset);
    expect(fixture.animations).toEqual([expect.objectContaining({ kind: 'timing', toValue: 0, useNativeDriver: true })]);
    await act(async () => { surface().props.onLayout(); });
    expect(fixture.animations).toHaveLength(1); expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('does not shift the card before the motion preference is known', async () => {
    fixture.deferPreference = true;
    await mount({ entryDirection: 'forward', initialReduceMotion: null });
    const style = renderer!.root.findByType('AnimatedView' as never).props.style;
    expect(style.at(-1).transform[0].translateY.value).toBe(0);
    expect(fixture.animations).toEqual([]);
    await act(async () => { fixture.resolvePreference!(false); });
    expect(fixture.values[0]!.value).toBe(0); expect(fixture.animations).toEqual([]);
  });

  it('preserves reduced motion for entry, drag and pending acknowledgement', async () => {
    fixture.reduced = true;
    const props = await mount({ entryDirection: 'forward' });
    expect(fixture.values[0]!.value).toBe(0);
    await act(async () => { drag(-120); release(-120); });
    expect(props.onSkip).toHaveBeenCalledOnce(); expect(fixture.values[0]!.value).toBe(0);
    expect(fixture.animations).toEqual([]);
  });

  it('moves an inert next-card preview with the drag and reports the exact continuation offset', async () => {
    const onForwardOffset = vi.fn();
    await mount({ nextCard: 'Next poster', onForwardOffset });
    const preview = renderer!.root.findByProps({ testID: 'feed-next-preview' });
    expect(preview.props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants' });
    expect(preview.props.style).toContainEqual({ top: 600, height: 600 });
    expect(preview.parent!.type).toBe('AnimatedView');
    await act(async () => { drag(-210); });
    expect(fixture.values[0]!.value).toBe(-210);
    await act(async () => { release(-210); });
    expect(fixture.values[0]!.value).toBe(-210);
    expect(onForwardOffset).toHaveBeenCalledExactlyOnceWith(390);
  });

  it('promotes the prepared card from its visible offset with the outgoing card filling the space above', async () => {
    const onSkip = vi.fn(() => true);
    const next = { ...base.item, id: 'two', title: 'Two' };
    await act(async () => { renderer = create(<RollingFeedCard {...base} opportunity="one" nextItem={next} onSkip={onSkip} />); });
    const activeSurface = () => renderer!.root.findAllByProps({ testID: 'feed-dismiss-surface' })
      .find(node => typeof node.props.onPanResponderGrant === 'function')!;
    await act(async () => {
      activeSurface().props.onPanResponderGrant();
      activeSurface().props.onPanResponderMove(null, { dx: 0, dy: -210, numberActiveTouches: 1 });
      activeSurface().props.onPanResponderRelease(null, { dx: 0, dy: -210 });
    });
    const valueCount = fixture.values.length;
    await act(async () => { renderer!.update(<RollingFeedCard {...base} item={next} opportunity="two" onSkip={onSkip} />); });
    expect(fixture.values[valueCount]!.initial).toBe(390);
    expect(fixture.values[valueCount]!.value).toBe(0);
    const previous = renderer!.root.findByProps({ testID: 'feed-previous-preview' });
    expect(previous.props.style).toContainEqual({ top: -600, height: 600 });
    expect(previous.props.pointerEvents).toBe('none');
    expect(onSkip).toHaveBeenCalledOnce();
    expect(renderer!.root.findAllByProps({ testID: 'feed-dismiss-surface' })
      .filter(node => typeof node.props.onPanResponderGrant === 'function')).toHaveLength(1);
  });

  it('automatically rolls a fresh post-rating card up through the whole viewport', async () => {
    await act(async () => { renderer = create(<RollingFeedCard {...base} opportunity="one" titleAction="★">Rating 8</RollingFeedCard>); });
    const count = fixture.values.length;
    await act(async () => { renderer!.update(<RollingFeedCard {...base} item={{ ...base.item, id: 'two' }} opportunity="two" entryDirection="forward" />); });
    expect(fixture.values[count]!.initial).toBe(600);
    expect(fixture.animations.at(-1)).toMatchObject({ kind: 'timing', toValue: 0, useNativeDriver: true });
    const outgoing = renderer!.root.findByProps({ testID: 'feed-previous-preview' }).findByType(FeedItemCard);
    expect(outgoing.props.children).toBe('Rating 8'); expect(outgoing.props.titleAction).toBe('★');
  });

  it('lets a native fling interrupt an unfinished entry without waiting for its animation callback', async () => {
    fixture.deferAnimation = true;
    const props = await mount({ entryDirection: 'forward', entryOffset: 390 });
    expect(fixture.values[0]!.value).toBe(390);
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(true);
      surface().props.onPanResponderGrant();
      expect(fixture.values[0]!.value).toBe(-32);
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: -0.9 });
    });
    expect(props.onSkip).toHaveBeenCalledOnce();
  });

  it('lets a fresh native fling interrupt a pending snap-back without submitting the cancelled drag', async () => {
    const props = await mount(); fixture.deferAnimation = true;
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -20, numberActiveTouches: 1 })).toBe(true);
      surface().props.onPanResponderGrant();
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: 0 });
    });
    expect(props.onSkip).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(-20);
    expect(fixture.animations.at(-1)).toMatchObject({ kind: 'spring', toValue: 0, useNativeDriver: true });
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(true);
      surface().props.onPanResponderGrant();
      expect(fixture.values[0]!.value).toBe(-32);
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: -0.9 });
    });
    expect(props.onSkip).toHaveBeenCalledOnce();
  });

  it('discards a pending swipe offset from an old viewport size', async () => {
    await act(async () => { renderer = create(<RollingFeedCard {...base} opportunity="one" onSkip={() => true} />); });
    await act(async () => { drag(-210); release(-210); });
    const count = fixture.values.length;
    await act(async () => { renderer!.update(<RollingFeedCard {...base} viewportHeight={420}
      item={{ ...base.item, id: 'two' }} opportunity="two" />); });
    expect(fixture.values[count]!.initial).toBe(420);
  });

  it('retains native capture travel when grant resets dx/dy, so a one-move short fling advances', async () => {
    const props = await mount();
    await act(async () => {
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 1, dy: -32, numberActiveTouches: 1 })).toBe(true);
      surface().props.onPanResponderGrant();
      expect(fixture.values[0]!.value).toBe(-32);
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: -0.9 });
    });
    expect(props.onSkip).toHaveBeenCalledOnce(); expect(fixture.values[0]!.value).toBe(-32);
  });

  it('reads expanded content with the whole card, then dismisses only after travelling past its bottom', async () => {
    const props = await mount({ initialExpanded: true, initialDescriptionHeight: 500, nextCard: 'Next' });
    expect(surface().props.style).toContainEqual({ height: 932 });
    expect(renderer!.root.findByProps({ testID: 'feed-next-preview' }).props.style).toContainEqual({ top: 932, height: 600 });
    await act(async () => { drag(-120); release(-120); });
    expect(props.onSkip).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(-120);
    await act(async () => { drag(-300); release(-300); });
    expect(props.onSkip).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(-332);
    await act(async () => { drag(-110); release(-110); });
    expect(props.onSkip).toHaveBeenCalledOnce(); expect(fixture.values[0]!.value).toBe(-442);
  });

  it('allows a deliberate short upward fling from the middle of expanded content', async () => {
    const props = await mount({ initialExpanded: true, initialDescriptionHeight: 500 });
    await act(async () => { drag(-120); release(-120); });
    await act(async () => {
      drag(-32); surface().props.onPanResponderRelease(null, { dx: 0, dy: -32, vx: 0, vy: -0.9 });
    });
    expect(props.onSkip).toHaveBeenCalledOnce();
  });

  it('reads back up through expanded content without undoing on a downward fling', async () => {
    const onPrevious = vi.fn(() => true);
    await mount({ initialExpanded: true, initialDescriptionHeight: 500, onPrevious });
    await act(async () => { drag(-220); release(-220); });
    await act(async () => {
      drag(40); surface().props.onPanResponderRelease(null, { dx: 0, dy: 40, vx: 0, vy: 1 });
    });
    expect(onPrevious).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(-180);
  });

  it('allows reading back toward the top even without previous-card navigation', async () => {
    await mount({ initialExpanded: true, initialDescriptionHeight: 500 });
    await act(async () => { drag(-120); release(-120); });
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 20, numberActiveTouches: 1 })).toBe(true);
  });

  it('keeps direct reading usable under reduced motion and clamps it after collapse', async () => {
    fixture.reduced = true;
    await mount({ initialExpanded: true, initialDescriptionHeight: 500 });
    await act(async () => { drag(-200); release(-200); });
    expect(fixture.values[0]!.value).toBe(-200); expect(fixture.animations).toEqual([]);
    await act(async () => { renderer!.root.findByProps({ testID: 'feed-description-content' }).props.onLayout({ nativeEvent: { layout: { height: 40 } } }); });
    expect(fixture.values[0]!.value).toBe(0); expect(surface().props.style).toContainEqual({ height: 600 });
  });

  it('does not mistake a short move followed by a pause for a fling', async () => {
    let now = 1000; vi.spyOn(Date, 'now').mockImplementation(() => now);
    const props = await mount();
    await act(async () => { drag(-32); }); now = 1250;
    await act(async () => { surface().props.onPanResponderRelease(null, { dx: 0, dy: -32, vx: 0, vy: -1 }); });
    expect(props.onSkip).not.toHaveBeenCalled(); expect(fixture.values[0]!.value).toBe(0);
  });

  it('keeps horizontal slider intent outside the parent responder', async () => {
    await mount();
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 60, dy: 8, numberActiveTouches: 1 })).toBe(false);
    expect(surface().props.accessible).toBe(false);
    expect(renderer!.root.findByProps({ testID: 'feed-accessibility-summary' }).props.accessible).toBe(true);
  });

  it('keeps a slider-started gesture out of feed navigation after it turns vertical', async () => {
    await mount();
    surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 30, dy: 2, numberActiveTouches: 1 })).toBe(false);
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 30, dy: -140, numberActiveTouches: 1 })).toBe(false);
  });

  it('resets horizontal intent for a fresh drag when a child owns the start responder', async () => {
    const props = await mount();
    expect(surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 })).toBe(false);
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 30, dy: 2, numberActiveTouches: 1 })).toBe(false);
    // A child Pressable claims start, so the parent's start bubble callback never runs.
    expect(surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 })).toBe(false);
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(true);
    await act(async () => {
      surface().props.onPanResponderGrant();
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: -0.9 });
    });
    expect(props.onSkip).toHaveBeenCalledOnce();
  });

  it('lets a natural thumb arc become a vertical drag after small initial sideways movement', async () => {
    await mount();
    surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 8, dy: 3, numberActiveTouches: 1 })).toBe(false);
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 8, dy: -32, numberActiveTouches: 1 })).toBe(true);
  });

  it('does not admit a two-finger gesture after one finger is lifted before capture', async () => {
    await mount();
    surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 2 });
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -140, numberActiveTouches: 1 })).toBe(false);
    surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(true);
  });

  it('retains the outgoing expanded extent and reading position when a rating promotes a fresh card', async () => {
    await act(async () => { renderer = create(<RollingFeedCard {...base} opportunity="one" onSkip={() => true} />); });
    await act(async () => { renderer!.root.findByProps({ testID: 'feed-description-content' }).props.onLayout({ nativeEvent: { layout: { height: 500 } } }); });
    await act(async () => { drag(-120); release(-120); });
    const count = fixture.values.length;
    await act(async () => { renderer!.update(<RollingFeedCard {...base} item={{ ...base.item, id: 'two' }} opportunity="two" entryDirection="forward" />); });
    expect(fixture.values[count]!.initial).toBe(812);
    const previous = renderer!.root.findByProps({ testID: 'feed-previous-preview' });
    expect(previous.props.style).toContainEqual({ top: -932, height: 932 });
    expect(previous.findByType(FeedItemCard).props.initialDescriptionHeight).toBe(500);
  });

  it('keeps a historical return preview mounted when its fresh delivery becomes actionable, without replaying entry', async () => {
    const onSkip = vi.fn(() => true); const onPrevious = vi.fn(() => true);
    const previous = { ...base.item, id: 'previous', title: 'Previous' };
    await act(async () => {
      renderer = create(<RollingFeedCard {...base} opportunity="current-page" onSkip={onSkip} onPrevious={onPrevious} />);
    });
    const beforeEntry = fixture.animations.length;
    await act(async () => {
      renderer!.update(<RollingFeedCard {...base} item={previous} opportunity="restore-previous" entryDirection="backward"
        disabled onSkip={onSkip} onPrevious={onPrevious} />);
    });
    const restoredCard = renderer!.root.findByType(FeedItemCard);
    const translation = surface().props.style.at(-1).transform[0].translateY;
    expect(translation).toMatchObject({ initial: -64, value: 0 });
    expect(fixture.animations.slice(beforeEntry)).toEqual([
      expect.objectContaining({ kind: 'timing', toValue: 0, useNativeDriver: true }),
    ]);
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(false);
    await act(async () => {
      const summary = renderer!.root.findByProps({ testID: 'feed-accessibility-summary' });
      summary.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
      summary.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
      renderer!.root.findByType(ItemDescription).props.onExpandedChange(true);
    });
    await act(async () => {
      renderer!.root.findByProps({ testID: 'feed-description-content' }).props.onLayout({ nativeEvent: { layout: { height: 500 } } });
    });
    expect(onSkip).not.toHaveBeenCalled(); expect(onPrevious).not.toHaveBeenCalled();
    const valueCount = fixture.values.length; const animationCount = fixture.animations.length;
    const fresh = { ...previous, creators: ['Fresh metadata'] };
    await act(async () => {
      renderer!.update(<RollingFeedCard {...base} item={fresh} opportunity="restore-previous" entryDirection="backward"
        onSkip={onSkip} onPrevious={onPrevious} />);
    });
    expect(renderer!.root.findByType(FeedItemCard)).toBe(restoredCard);
    expect(surface().props.style.at(-1).transform[0].translateY).toBe(translation);
    expect(translation.value).toBe(0);
    expect(fixture.values).toHaveLength(valueCount); expect(fixture.animations).toHaveLength(animationCount);
    expect(renderer!.root.findByType(ItemDescription).props.expanded).toBe(true);
    expect(surface().props.style).toContainEqual({ height: 932 });
    expect(restoredCard.props.item).toBe(fresh);
    expect(renderer!.root.findByProps({ testID: 'feed-accessibility-summary' }).props.accessibilityState.disabled).toBe(false);
    await act(async () => {
      renderer!.root.findByProps({ testID: 'feed-accessibility-summary' }).props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(onSkip).toHaveBeenCalledOnce(); expect(onPrevious).not.toHaveBeenCalled();
  });

  it('continues native flings through Undo and the next card entry without allowing another Undo or duplicate forward', async () => {
    const onSkip = vi.fn(() => true); const freshSkip = vi.fn(() => true); const onPrevious = vi.fn(() => true);
    const nextSkip = vi.fn(() => true);
    const previous = { ...base.item, id: 'previous', title: 'Previous' };
    await act(async () => {
      renderer = create(<RollingFeedCard {...base} opportunity="current-page" onSkip={onSkip} onPrevious={onPrevious} />);
    });
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 32, numberActiveTouches: 1 })).toBe(true);
      surface().props.onPanResponderGrant();
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: 0.9 });
    });
    expect(onPrevious).toHaveBeenCalledOnce(); expect(onSkip).not.toHaveBeenCalled();
    await act(async () => {
      renderer!.update(<RollingFeedCard {...base} item={previous} opportunity="restore-previous" entryDirection="backward"
        disabled onSkip={onSkip} onPrevious={onPrevious} />);
    });
    const restoredCard = renderer!.root.findByType(FeedItemCard);
    const translation = surface().props.style.at(-1).transform[0].translateY;
    expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(false);
    await act(async () => {
      renderer!.update(<RollingFeedCard {...base} item={{ ...previous, creators: ['Fresh metadata'] }}
        opportunity="restore-previous" entryDirection="backward" onSkip={freshSkip} />);
    });
    expect(renderer!.root.findByType(FeedItemCard)).toBe(restoredCard);
    expect(surface().props.style.at(-1).transform[0].translateY).toBe(translation);
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 32, numberActiveTouches: 1 })).toBe(false);
      renderer!.root.findByProps({ testID: 'feed-accessibility-summary' }).props
        .onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
      surface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(true);
      surface().props.onPanResponderGrant();
      expect(translation.value).toBe(-32);
      // Native PanResponder resets displacement on grant; the captured movement still counts toward the fling.
      surface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: -0.9 });
    });
    expect(freshSkip).toHaveBeenCalledOnce(); expect(onSkip).not.toHaveBeenCalled();
    expect(onPrevious).toHaveBeenCalledOnce();
    // The next card must remain usable even if native animation completion is delayed.
    fixture.deferAnimation = true;
    const next = { ...base.item, id: 'next', title: 'Next' };
    await act(async () => {
      renderer!.update(<RollingFeedCard {...base} item={next} opportunity="next-fresh-page"
        entryDirection="forward" onSkip={nextSkip} />);
    });
    const activeSurface = () => renderer!.root.findAllByProps({ testID: 'feed-dismiss-surface' })
      .find(node => typeof node.props.onPanResponderGrant === 'function')!;
    const nextTranslation = activeSurface().props.style.at(-1).transform[0].translateY;
    expect(nextTranslation).toMatchObject({ initial: 568, value: 568 });
    expect(fixture.animations.at(-1)).toMatchObject({ kind: 'timing', toValue: 0, useNativeDriver: true });
    await act(async () => {
      activeSurface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(activeSurface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(true);
      activeSurface().props.onPanResponderGrant();
      expect(nextTranslation.value).toBe(-32);
      activeSurface().props.onPanResponderRelease(null, { dx: 0, dy: 0, vx: 0, vy: -0.9 });
    });
    expect(nextSkip).toHaveBeenCalledOnce();
    await act(async () => {
      activeSurface().props.onStartShouldSetPanResponderCapture(null, { numberActiveTouches: 1 });
      expect(activeSurface().props.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -32, numberActiveTouches: 1 })).toBe(false);
      activeSurface().props.onPanResponderGrant();
      activeSurface().props.onPanResponderRelease(null, { dx: 0, dy: -120, vx: 0, vy: -0.9 });
    });
    expect(nextSkip).toHaveBeenCalledOnce(); expect(nextTranslation.value).toBe(-32);
  });
});
