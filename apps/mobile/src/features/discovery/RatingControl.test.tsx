/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingControl } from './RatingControl';
import { getRoomTheme } from '../../theme/roomTheme';

vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
const h = vi.hoisted(() => ({ app: null as ((state: string) => void) | null }));
vi.mock('react-native', () => ({
  View: 'View', Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
  Easing: { out: (value: unknown) => value, cubic: null },
  Animated: {
    View: 'AnimatedView', Text: 'AnimatedText',
    Value: class {
      value: number;
      constructor(value: number) { this.value = value; }
      setValue(value: number) { this.value = value; }
      stopAnimation(callback?: (value: number) => void) { callback?.(this.value); }
      interpolate() { return 0; }
    },
    timing: (value: { setValue: (v: number) => void }, options: { toValue: number }) => ({
      start: () => value.setValue(options.toValue),
    }),
  },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove: vi.fn() }) },
  AppState: { currentState: 'active', addEventListener: (_: string, fn: (s: string) => void) => {
    h.app = fn; return { remove: vi.fn() };
  } },
}));
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { h.app = null; });
const theme = getRoomTheme('DAWN');
const gesture = (dx = 0, dy = 0, numberActiveTouches = 1) => ({ dx, dy, numberActiveTouches });
const touch = (locationX: number) => ({ nativeEvent: { locationX } });
const trackPosition = (rating: number) => 13 + 174 * rating / 10;
async function mount(disabled = false, rating: number | null = null, width = 200) {
  const onRatingChange = vi.fn(); let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<RatingControl rating={rating} disabled={disabled} theme={theme} onRatingChange={onRatingChange} />); });
  const track = () => renderer.root.find(node => node.props.accessibilityRole === 'adjustable');
  await act(async () => { track().props.onLayout({ nativeEvent: { layout: { width } } }); });
  return { onRatingChange, renderer, track };
}

describe('whole-track rating selection', () => {
  it.each([null, 0, 5, 10])('never submits the initial value %s without a completed interaction', async rating => {
    const p = await mount(false, rating);
    expect(p.track().props.accessibilityValue.now).toBe(rating ?? 5);
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it.each([0, 5, 10])('a deliberate tap at %s commits once, including the current handle', async rating => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(trackPosition(rating)), gesture());
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => {
      p.track().props.onPanResponderRelease(null, gesture(0, 0, 0));
      p.track().props.onPanResponderRelease(null, gesture(0, 0, 0));
    });
    expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(rating);
    await act(async () => { p.renderer.unmount(); });
  });
  it.each([[2, 104.4, 8], [8, -139.2, 0], [5, 120, 10]])(
    'a drag starting anywhere on the track at %s commits only its release value', async (start, dx, expected) => {
      const p = await mount(false, 1);
      await act(async () => {
        p.track().props.onPanResponderGrant(touch(trackPosition(start)), gesture());
        p.track().props.onPanResponderMove(null, gesture(dx, 1));
      });
      expect(p.onRatingChange).not.toHaveBeenCalled();
      await act(async () => { p.track().props.onPanResponderRelease(null, gesture(dx, 1, 0)); });
      expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(expected);
      await act(async () => { p.renderer.unmount(); });
    },
  );
  it.each([[0, 30, 1], [200, -30, 9]])('tracks the actual finger position after dragging inward from edge %s', async (x, dx, expected) => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(x), gesture());
      p.track().props.onPanResponderMove(null, gesture(dx));
      p.track().props.onPanResponderRelease(null, gesture(dx, 0, 0));
    });
    expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(expected);
    await act(async () => { p.renderer.unmount(); });
  });
  it('does not cancel horizontal intent while the finger crosses the movement threshold', async () => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(100), gesture());
      p.track().props.onPanResponderMove(null, gesture(5.9, 1.2));
      p.track().props.onPanResponderMove(null, gesture(60, 2));
      p.track().props.onPanResponderRelease(null, gesture(60, 2, 0));
    });
    expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(8);
    await act(async () => { p.renderer.unmount(); });
  });
  it('keeps the entire visual handle transparent to the track touch coordinates', async () => {
    const p = await mount();
    const handle = p.renderer.root.findAllByType('AnimatedView' as never).at(-1)!;
    expect(handle.props.pointerEvents).toBe('none');
    expect(handle.props.onPanResponderGrant).toBeUndefined();
    await act(async () => { p.renderer.unmount(); });
  });
  it('accepts one measured foreground touch and yields responder ownership to feed scrolling', async () => {
    const p = await mount();
    const handlers = p.track().props;
    expect(handlers.onStartShouldSetPanResponder(null, gesture())).toBe(true);
    expect(handlers.onStartShouldSetPanResponder(null, gesture(0, 0, 2))).toBe(false);
    expect(handlers.onPanResponderTerminationRequest()).toBe(true);
    await act(async () => { p.renderer.unmount(); });
  });
  it.each([
    ['vertical', gesture(3, -120)],
    ['diagonal', gesture(40, -55)],
    ['multiple fingers', gesture(60, 0, 2)],
  ])('never turns a %s movement into a rating', async (_, movement) => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(100), gesture());
      p.track().props.onPanResponderMove(null, movement);
      p.track().props.onPanResponderRelease(null, { ...movement, numberActiveTouches: 0 });
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it.each(['vertical turn', 'extra finger'])('keeps cancellation after a horizontal drag encounters %s', async kind => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(100), gesture());
      p.track().props.onPanResponderMove(null, gesture(35));
      p.track().props.onPanResponderMove(null, kind === 'vertical turn' ? gesture(35, -80) : gesture(35, 0, 2));
      p.track().props.onPanResponderMove(null, gesture(80));
      p.track().props.onPanResponderRelease(null, gesture(80, 0, 0));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('cancels an added finger even without another move callback', async () => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(100), gesture());
      p.track().props.onPanResponderMove(null, gesture(35));
      p.track().props.onPanResponderStart(null, gesture(35, 0, 2));
      p.track().props.onPanResponderRelease(null, gesture(35, 0, 0));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it.each(['terminated', 'background', 'layout'])('cancels a drag on %s without manufacturing a rating', async kind => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(100), gesture());
      p.track().props.onPanResponderMove(null, gesture(60));
      if (kind === 'terminated') p.track().props.onPanResponderTerminate();
      else if (kind === 'layout') p.track().props.onLayout({ nativeEvent: { layout: { width: 240 } } });
      else h.app!('background');
      p.track().props.onPanResponderRelease(null, gesture(60, 0, 0));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('keeps the native responder and active drag across a same-width layout and parent rerender', async () => {
    const p = await mount();
    const handlers = p.track().props;
    await act(async () => {
      handlers.onPanResponderGrant(touch(100), gesture());
      handlers.onPanResponderMove(null, gesture(30));
      handlers.onLayout({ nativeEvent: { layout: { width: 200 } } });
    });
    const latestRatingChange = vi.fn();
    await act(async () => {
      p.renderer.update(<RatingControl rating={null} disabled={false} theme={theme} onRatingChange={latestRatingChange} />);
    });
    for (const name of ['onStartShouldSetPanResponder', 'onPanResponderGrant', 'onPanResponderMove', 'onPanResponderRelease']) {
      expect(p.track().props[name]).toBe(handlers[name]);
    }
    await act(async () => {
      handlers.onPanResponderMove(null, gesture(60));
      handlers.onPanResponderRelease(null, gesture(60, 0, 0));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    expect(latestRatingChange).toHaveBeenCalledExactlyOnceWith(8);
    await act(async () => { p.renderer.unmount(); });
  });
  it('the stable responder obeys a newly disabled control during a drag', async () => {
    const p = await mount();
    const handlers = p.track().props;
    await act(async () => {
      handlers.onPanResponderGrant(touch(100), gesture());
      handlers.onPanResponderMove(null, gesture(30));
      p.renderer.update(<RatingControl rating={null} disabled theme={theme} onRatingChange={p.onRatingChange} />);
    });
    expect(p.track().props.onPanResponderRelease).toBe(handlers.onPanResponderRelease);
    expect(handlers.onStartShouldSetPanResponder(null, gesture())).toBe(false);
    await act(async () => { handlers.onPanResponderRelease(null, gesture(60, 0, 0)); });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('preserves accessible adjustment without accepting unknown actions', async () => {
    const p = await mount(false, 0);
    await act(async () => {
      p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
      p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
      p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    });
    expect(p.onRatingChange.mock.calls).toEqual([[0], [1]]);
    await act(async () => { p.renderer.unmount(); });
  });
  it.each([[true, 200], [false, 0]])('ignores touch callbacks when disabled=%s or track width=%s', async (disabled, width) => {
    const p = await mount(disabled, null, width);
    await act(async () => {
      p.track().props.onPanResponderGrant(touch(100), gesture());
      p.track().props.onPanResponderRelease(null, gesture(0, 0, 0));
      if (disabled) p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
});
