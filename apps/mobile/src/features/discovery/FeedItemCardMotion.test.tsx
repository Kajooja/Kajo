/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedItemCard } from './FeedItemCard';
import { getRoomTheme } from '../../theme/roomTheme';

const fixture = vi.hoisted(() => ({
  reduced: false, deferPreference: false,
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
      start() { fixture.animations.push({ kind: 'timing', ...options }); value.setValue(options.toValue); },
    }),
    spring: (value: { setValue: (v: number) => void }, options: { toValue: number; useNativeDriver: boolean }) => ({
      start() { fixture.animations.push({ kind: 'spring', ...options }); value.setValue(options.toValue); },
    }),
  },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AccessibilityInfo: { isReduceMotionEnabled: () => fixture.deferPreference ? new Promise<boolean>(() => {}) : Promise.resolve(fixture.reduced),
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
  fixture.reduced = false; fixture.deferPreference = false; fixture.animations = []; fixture.values = []; fixture.app = null;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined; vi.unstubAllGlobals();
});

async function mount(props: Partial<React.ComponentProps<typeof FeedItemCard>> = {}) {
  const onSkip = vi.fn(() => true);
  const all = { ...base, onSkip, ...props };
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
    await mount({ entryDirection: 'forward' });
    const style = renderer!.root.findByType('AnimatedView' as never).props.style;
    expect(style.at(-1)).toEqual({ transform: [{ translateY: 0 }] });
    expect(fixture.animations).toEqual([]);
  });

  it('preserves reduced motion for entry, drag and pending acknowledgement', async () => {
    fixture.reduced = true;
    const props = await mount({ entryDirection: 'forward' });
    expect(fixture.values[0]!.value).toBe(0);
    await act(async () => { drag(-120); release(-120); });
    expect(props.onSkip).toHaveBeenCalledOnce(); expect(fixture.values[0]!.value).toBe(0);
    expect(fixture.animations).toEqual([]);
  });
});
