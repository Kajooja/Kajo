/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryCollectionPager } from './DiscoveryCollectionPager';
import { useDiscoveryCollectionPager, type DiscoveryCollectionPagerState } from './useDiscoveryCollectionPager';

const fixture = vi.hoisted(() => ({
  pager: null as DiscoveryCollectionPagerState | null,
  animations: [] as { toValue: number; complete: (finished?: boolean) => void; stop: ReturnType<typeof vi.fn> }[],
  app: null as ((state: string) => void) | null,
  back: null as (() => boolean) | null,
  preference: null as ((reduced: boolean) => void) | null,
  rejectPreference: false,
  deferPreference: false, resolvePreference: null as ((value: boolean) => void) | null,
}));
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('react-native', () => ({
  View: 'View', StyleSheet: { create: (styles: unknown) => styles },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  Animated: { View: 'AnimatedView', Value: class {
    value: number; listeners = new Map<string, (event: { value: number }) => void>();
    constructor(value: number) { this.value = value; }
    setValue(value: number) { this.value = value; this.listeners.forEach(listener => listener({ value })); }
    stopAnimation() {}
    addListener(listener: (event: { value: number }) => void) { this.listeners.set('listener', listener); return 'listener'; }
    removeListener(key: string) { this.listeners.delete(key); }
  }, timing: (value: { setValue: (next: number) => void }, options: { toValue: number }) => {
    const animation = { toValue: options.toValue, stop: vi.fn(), complete: (_finished = true) => {} };
    return { stop: animation.stop, start: (done: (result: { finished: boolean }) => void) => {
      animation.complete = (finished = true) => { value.setValue(options.toValue); done({ finished }); };
      fixture.animations.push(animation);
    } };
  } },
  AppState: { currentState: 'active', addEventListener: (_: string, callback: (value: string) => void) => {
    fixture.app = callback; return { remove() {} };
  } },
  BackHandler: { addEventListener: (_: string, callback: () => boolean) => {
    fixture.back = callback; return { remove() {} };
  } },
  AccessibilityInfo: { isReduceMotionEnabled: () => fixture.rejectPreference ? Promise.reject(new Error('unavailable')) :
    fixture.deferPreference ? new Promise<boolean>(resolve => { fixture.resolvePreference = resolve; }) : Promise.resolve(false),
    addEventListener: (_: string, callback: (value: boolean) => void) => { fixture.preference = callback; return { remove() {} }; } },
}));

let renderer: ReactTestRenderer | undefined;
function Harness({ scope = 'actor:profile:session:MOVIE:FOR_YOU', focused = true }: { scope?: string; focused?: boolean }) {
  const pager = useDiscoveryCollectionPager(scope, focused);
  React.useLayoutEffect(() => { fixture.pager = pager; });
  return <DiscoveryCollectionPager pager={pager} discovery={<div>grid</div>} history={<div>history</div>} />;
}
const pager = () => fixture.pager!;
const surface = () => renderer!.root.find(node => typeof node.props.onStartShouldSetPanResponderCapture === 'function');
const pages = () => renderer!.root.findAll(node => node.props.importantForAccessibility !== undefined);
const motion = (dx: number, dy = 0, count = 1) => ({ dx, dy, numberActiveTouches: count, vx: 0, vy: 0 });
async function mount() {
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => { pager().onLayout({ nativeEvent: { layout: { width: 320 } } } as never); });
}
async function finish(index = fixture.animations.length - 1) { await act(async () => { fixture.animations[index]!.complete(); }); }
beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.pager = null; fixture.animations = []; fixture.app = fixture.back = fixture.preference = null;
  fixture.rejectPreference = false;
  fixture.deferPreference = false; fixture.resolvePreference = null;
});
afterEach(async () => { if (renderer) await act(async () => renderer!.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

describe('mounted Discovery collection pager', () => {
  it('keeps both page trees mounted and exposes only the settled selected page', async () => {
    await mount();
    expect(pages().map(page => page.props.pointerEvents)).toEqual(['auto', 'none']);
    await act(async () => { pager().select('history'); });
    expect(pages().map(page => page.props.importantForAccessibility)).toEqual(['no-hide-descendants', 'no-hide-descendants']);
    expect(pager().historyRequested).toBe(true);
    await finish();
    expect(pages().map(page => page.props.pointerEvents)).toEqual(['none', 'auto']);
    expect(renderer!.root.findAllByType('div')).toHaveLength(2);
    expect(pager().selected).toBe('history');
  });

  it('revokes a native activation before React commits capture and follows grant-reset deltas', async () => {
    await mount(); const old = pager(); const lease = old.getLease('discovery');
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, motion(0));
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, motion(-32, 1))).toBe(true);
      expect(old.isActive('discovery', lease)).toBe(false);
      surface().props.onPanResponderGrant();
      surface().props.onPanResponderMove(null, motion(-40, 1));
    });
    expect((pager().translateX as unknown as { value: number }).value).toBe(-72);
    expect(pager().historyRequested).toBe(true);
    expect(pages().every(page => page.props.accessibilityElementsHidden)).toBe(true);
  });

  it('preserves history on Item blur/return, resets a replacement scope and rejects old native responders', async () => {
    await mount(); await act(async () => pager().select('history')); await finish();
    const old = pager(); const oldHandlers = surface().props;
    await act(async () => renderer!.update(<Harness focused={false} />));
    expect(pager().selected).toBe('history'); expect(pager().active('history')).toBe(false);
    await act(async () => renderer!.update(<Harness />));
    expect(pager().selected).toBe('history'); expect(pager().active('history')).toBe(true);
    await act(async () => renderer!.update(<Harness scope="new-profile" />));
    expect(pager().selected).toBe('discovery'); expect(pager().historyRequested).toBe(false);
    await act(async () => {
      old.select('history'); oldHandlers.onStartShouldSetPanResponderCapture(null, motion(0));
      expect(oldHandlers.onMoveShouldSetPanResponderCapture(null, motion(120))).toBe(false);
    });
    expect(pager().selected).toBe('discovery');
  });

  it('handles Android Back within the pair and lets normal Back continue from Find', async () => {
    await mount(); expect(fixture.back!()).toBe(false);
    await act(async () => pager().select('history')); await finish();
    await act(async () => { expect(fixture.back!()).toBe(true); }); await finish();
    expect(pager().selected).toBe('discovery'); expect(fixture.back!()).toBe(false);
  });

  it('cancels backgrounded motion and keeps stale snap completions inert', async () => {
    await mount(); await act(async () => pager().select('history'));
    await act(async () => fixture.app!('background'));
    expect(pager().active('history')).toBe(false);
    await act(async () => fixture.animations[0]!.complete());
    expect(pager().active('history')).toBe(false);
    await act(async () => fixture.app!('active'));
    expect(pager().active('history')).toBe(true);
  });

  it('accepts a new native drag during a pending snap and ignores its obsolete completion', async () => {
    await mount(); await act(async () => pager().select('history'));
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, motion(0));
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, motion(32))).toBe(true);
      surface().props.onPanResponderGrant();
      surface().props.onPanResponderRelease(null, motion(100));
    });
    await finish(0); expect(pager().settled).toBe(false);
    await finish(1); expect(pager().active('discovery')).toBe(true);
  });

  it('stops a running snap when reduced motion changes and tolerates an unavailable initial preference', async () => {
    fixture.rejectPreference = true; await mount();
    await act(async () => pager().select('history'));
    await act(async () => fixture.preference!(true));
    expect(fixture.animations[0]!.stop).toHaveBeenCalled();
    expect(pager().active('history')).toBe(true);
    await act(async () => pager().select('discovery'));
    expect(pager().active('discovery')).toBe(true);
    expect(fixture.animations).toHaveLength(1);
  });

  it('rearms the committed controller during StrictMode effect replay', async () => {
    await act(async () => { renderer = create(<React.StrictMode><Harness /></React.StrictMode>); });
    await act(async () => pager().onLayout({ nativeEvent: { layout: { width: 320 } } } as never));
    expect(pager().active('discovery')).toBe(true);
    await act(async () => pager().select('history')); await finish();
    expect(pager().active('history')).toBe(true);
    await act(async () => {
      surface().props.onStartShouldSetPanResponderCapture(null, motion(0));
      expect(surface().props.onMoveShouldSetPanResponderCapture(null, motion(40))).toBe(true);
    });
    expect(pager().settled).toBe(false);
  });

  it('keeps a newer reduced motion event when an old initial preference resolves', async () => {
    fixture.deferPreference = true; await mount();
    await act(async () => fixture.preference!(true));
    await act(async () => fixture.resolvePreference!(false));
    await act(async () => pager().select('history'));
    expect(pager().active('history')).toBe(true);
    expect(fixture.animations).toHaveLength(0);
  });
});
