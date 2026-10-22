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
      stopAnimation(callback: (value: number) => void) { callback(this.value); }
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
async function mount(disabled = false, rating: number | null = null) {
  const onRatingChange = vi.fn(); let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<RatingControl rating={rating} disabled={disabled} theme={theme} onRatingChange={onRatingChange} />); });
  await act(async () => { renderer.root.findByType('Pressable' as never).props.onLayout({ nativeEvent: { layout: { width: 200 } } }); });
  const track = () => renderer.root.findByType('Pressable' as never);
  const handle = () => renderer.root.findAllByType('AnimatedView' as never).find(node => node.props.onPanResponderGrant)!;
  return { onRatingChange, renderer, track, handle };
}

describe('rating selection commits only intentional completion', () => {
  it('does not submit the initial neutral value or an untouched handle', async () => {
    const p = await mount();
    await act(async () => { p.handle().props.onPanResponderGrant(null, gesture()); p.handle().props.onPanResponderRelease(null, gesture(0, 0, 0)); });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('emits only the final snapped value after release, including a genuine zero', async () => {
    const p = await mount();
    await act(async () => { p.handle().props.onPanResponderGrant(null, gesture()); p.handle().props.onPanResponderMove(null, gesture(-90)); });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.handle().props.onPanResponderRelease(null, gesture(-90)); });
    expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(0);
    await act(async () => { p.handle().props.onPanResponderRelease(null, gesture(-90)); });
    expect(p.onRatingChange).toHaveBeenCalledOnce();
    await act(async () => { p.renderer.unmount(); });
  });
  it.each(['terminated', 'background', 'layout'])('cancels a drag on %s without manufacturing a rating', async kind => {
    const p = await mount();
    await act(async () => {
      p.handle().props.onPanResponderGrant(null, gesture()); p.handle().props.onPanResponderMove(null, gesture(60));
      if (kind === 'terminated') p.handle().props.onPanResponderTerminate();
      else if (kind === 'layout') p.track().props.onLayout({ nativeEvent: { layout: { width: 240 } } });
      else h.app!('background');
      p.handle().props.onPanResponderRelease(null, gesture(60));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('claims only a deliberate single-finger horizontal drag', async () => {
    const p = await mount();
    const handlers = p.handle().props;
    expect(handlers.onStartShouldSetPanResponder()).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder(null, gesture(3, -120))).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder(null, gesture(40, 35))).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder(null, gesture(40, 0, 2))).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder(null, gesture(2, 1))).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder(null, gesture(40, 3))).toBe(true);
    await act(async () => { p.renderer.unmount(); });
  });
  it.each([
    ['vertical', gesture(3, -120)],
    ['diagonal', gesture(40, -55)],
    ['multiple fingers', gesture(60, 0, 2)],
  ])('never turns a %s movement into a rating', async (_, movement) => {
    const p = await mount();
    await act(async () => {
      p.handle().props.onPanResponderGrant(null, gesture());
      p.handle().props.onPanResponderMove(null, movement);
      p.handle().props.onPanResponderRelease(null, { ...movement, numberActiveTouches: 0 });
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it.each(['vertical turn', 'extra finger'])('keeps cancellation after a horizontal drag encounters %s', async kind => {
    const p = await mount();
    await act(async () => {
      p.handle().props.onPanResponderGrant(null, gesture());
      p.handle().props.onPanResponderMove(null, gesture(35));
      p.handle().props.onPanResponderMove(null, kind === 'vertical turn' ? gesture(35, -80) : gesture(35, 0, 2));
      p.handle().props.onPanResponderMove(null, gesture(80));
      p.handle().props.onPanResponderRelease(null, gesture(80, 0, 0));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it.each([0, 5, 10])('preserves saved %s without a mount write and commits a horizontal selection on release', async rating => {
    const p = await mount(false, rating);
    expect(p.track().props.accessibilityValue.now).toBe(rating);
    expect(p.onRatingChange).not.toHaveBeenCalled();
    const dx = rating === 10 ? -18 : 18;
    await act(async () => {
      p.handle().props.onPanResponderGrant(null, gesture());
      p.handle().props.onPanResponderMove(null, gesture(dx, 1));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.handle().props.onPanResponderRelease(null, gesture(dx, 1, 0)); });
    expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(rating === 10 ? 9 : rating + 1);
    await act(async () => { p.renderer.unmount(); });
  });
  it('does not turn an untouched handle tap or track swipe into a track rating', async () => {
    const p = await mount();
    const touch = (pageX: number, pageY: number, count = 1) => ({ nativeEvent: { pageX, pageY, touches: Array(count).fill({}) } });
    await act(async () => {
      p.track().props.onStartShouldSetResponderCapture(touch(100, 100));
      p.handle().props.onTouchStart();
      p.track().props.onPress({ nativeEvent: { locationX: 10 } });
      p.track().props.onStartShouldSetResponderCapture(touch(100, 100));
      p.track().props.onTouchMove(touch(103, -20));
      p.track().props.onPress({ nativeEvent: { locationX: 103 } });
      p.track().props.onStartShouldSetResponderCapture(touch(100, 100, 2));
      p.track().props.onPress({ nativeEvent: { locationX: 100 } });
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => {
      p.track().props.onStartShouldSetResponderCapture(touch(200, 100));
      p.track().props.onPress({ nativeEvent: { locationX: 200 } });
    });
    expect(p.onRatingChange).toHaveBeenCalledExactlyOnceWith(10);
    await act(async () => { p.renderer.unmount(); });
  });
  it('cancels an added finger even without another move callback', async () => {
    const p = await mount();
    await act(async () => {
      p.handle().props.onPanResponderGrant(null, gesture());
      p.handle().props.onPanResponderMove(null, gesture(35));
      p.handle().props.onPanResponderStart(null, gesture(35, 0, 2));
      p.handle().props.onPanResponderRelease(null, gesture(35, 0, 0));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('keeps the native responder and active drag across a parent rerender while using the latest callback', async () => {
    const p = await mount();
    const handlers = p.handle().props;
    await act(async () => {
      handlers.onPanResponderGrant(null, gesture());
      handlers.onPanResponderMove(null, gesture(30));
    });
    const latestRatingChange = vi.fn();
    await act(async () => {
      p.renderer.update(<RatingControl rating={null} disabled={false} theme={theme} onRatingChange={latestRatingChange} />);
    });
    for (const name of ['onMoveShouldSetPanResponder', 'onPanResponderGrant', 'onPanResponderMove', 'onPanResponderRelease']) {
      expect(p.handle().props[name]).toBe(handlers[name]);
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
    const handlers = p.handle().props;
    await act(async () => {
      handlers.onPanResponderGrant(null, gesture());
      handlers.onPanResponderMove(null, gesture(30));
      p.renderer.update(<RatingControl rating={null} disabled theme={theme} onRatingChange={p.onRatingChange} />);
    });
    expect(p.handle().props.onPanResponderRelease).toBe(handlers.onPanResponderRelease);
    expect(handlers.onMoveShouldSetPanResponder(null, gesture(60))).toBe(false);
    await act(async () => { handlers.onPanResponderRelease(null, gesture(60, 0, 0)); });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
  it('preserves deliberate track taps and accessible adjustment without accepting unknown actions', async () => {
    const p = await mount();
    await act(async () => {
      p.track().props.onPress({ nativeEvent: { locationX: 0 } });
      p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
      p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    });
    expect(p.onRatingChange.mock.calls).toEqual([[0], [6]]);
    await act(async () => { p.renderer.unmount(); });
  });
  it('does not commit disabled track, accessibility, or responder callbacks', async () => {
    const p = await mount(true);
    await act(async () => {
      p.track().props.onPress({ nativeEvent: { locationX: 0 } });
      p.track().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
      p.handle().props.onPanResponderGrant(null, gesture()); p.handle().props.onPanResponderRelease(null, gesture(90));
    });
    expect(p.onRatingChange).not.toHaveBeenCalled();
    await act(async () => { p.renderer.unmount(); });
  });
});
