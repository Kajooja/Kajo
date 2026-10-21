import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedItemCard, FEED_HELP } from './FeedItemCard';
import { getRoomTheme } from '../../theme/roomTheme';

const h = vi.hoisted(() => ({ states: [] as unknown[], memos: [] as unknown[], index: 0, memo: 0,
  effects: [] as { deps: readonly unknown[]; cleanup?: () => void }[], effect: 0, pending: [] as (() => void)[],
  storage: new Map<string, string>(), app: null as ((state: string) => void) | null }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useState: (initial: unknown) => { const i = h.index++; if (!(i in h.states)) h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [h.states[i], (v: unknown) => { h.states[i] = typeof v === 'function' ? v(h.states[i]) : v; }]; },
  useMemo: (f: () => unknown) => { const i = h.memo++; if (!(i in h.memos)) h.memos[i] = f(); return h.memos[i]; },
  useLayoutEffect: (f: () => void | (() => void), deps: readonly unknown[]) => effect(f, deps),
  useEffect: (f: () => void | (() => void), deps: readonly unknown[]) => effect(f, deps),
}));
function effect(f: () => void | (() => void), deps: readonly unknown[]) {
  const i = h.effect++; const old = h.effects[i];
  if (old && old.deps.length === deps.length && deps.every((v, n) => v === old.deps[n])) return;
  h.pending.push(() => { old?.cleanup?.(); const cleanup = f(); h.effects[i] = { deps, ...(cleanup ? { cleanup } : {}) }; });
}
vi.mock('expo-sqlite/kv-store', () => ({ default: { getItemSync: (key: string) => h.storage.get(key) ?? null,
  setItemSync: (key: string, value: string) => h.storage.set(key, value) } }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
  Animated: { View: 'AnimatedView', Value: class { setValue = vi.fn(); } },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove: vi.fn() }) },
  AppState: { currentState: 'active', addEventListener: (_: string, fn: (s: string) => void) => { h.app = fn; return { remove: vi.fn() }; } },
}));
vi.mock('./ItemDescription', () => ({ ItemDescription: 'ItemDescription' }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { h.effects.forEach(e => e.cleanup?.()); h.states = []; h.memos = []; h.effects = []; h.pending = []; h.storage.clear(); });
type Props = { children?: ReactNode; testID?: string; accessibilityLabel?: string; onPress?: () => void;
  onError?: () => void; onLayout?: () => void; disabled?: boolean;
  onPanResponderGrant?: () => void; onPanResponderRelease?: (e: unknown, g: object) => void;
  onPanResponderMove?: (e: unknown, g: object) => void; onPanResponderTerminate?: () => void };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(tree).flatMap(child => React.isValidElement<Props>(child) ? [child, ...nodes(child.props.children)] : []);
}
function text(tree: ReactNode): string {
  return React.Children.toArray(tree).map(child => React.isValidElement<Props>(child) ? text(child.props.children) : String(child)).join(' ');
}
function render(props: React.ComponentProps<typeof FeedItemCard>) {
  h.index = h.memo = h.effect = 0; const tree = FeedItemCard(props); h.pending.splice(0).forEach(fn => fn()); return tree;
}
const props = () => ({ item: { id: 'movie', itemType: 'MOVIE' as const, title: 'Frozen title', imageUrl: 'https://example.invalid/poster.jpg' },
  theme: getRoomTheme('DAWN'), disabled: false, onSkip: vi.fn(() => true) });

describe('shared native feed presentation wiring', () => {
  it('binds one completed hero drag to the same neutral accessible action without making description scrolling a dismissal', () => {
    const p = props(); const tree = render(p);
    const surface = nodes(tree).find(n => n.props.testID === 'feed-dismiss-surface')!.props;
    surface.onPanResponderGrant!(); surface.onPanResponderMove!(null, { dx: 0, dy: -120, numberActiveTouches: 1 });
    surface.onPanResponderRelease!(null, { dx: 0, dy: -120 });
    nodes(tree).find(n => n.props.accessibilityLabel === 'Ohita')!.props.onPress!();
    expect(p.onSkip).toHaveBeenCalledOnce();
    expect(nodes(tree).find(n => n.type === 'ItemDescription')!.props.onPanResponderRelease).toBeUndefined();
  });
  it.each(['layout', 'background', 'terminated'])('cancels the actual responder after %s and disables pending accessible action', kind => {
    const p = props(); let tree = render(p);
    const surface = nodes(tree).find(n => n.props.testID === 'feed-dismiss-surface')!.props;
    surface.onPanResponderGrant!();
    if (kind === 'layout') surface.onLayout!(); else if (kind === 'background') h.app!('background'); else surface.onPanResponderTerminate!();
    surface.onPanResponderRelease!(null, { dx: 0, dy: -130 }); expect(p.onSkip).not.toHaveBeenCalled();
    p.disabled = true; tree = render(p);
    const button = nodes(tree).find(n => n.props.accessibilityLabel === 'Ohita')!.props;
    expect(button.disabled).toBe(true); button.onPress!(); expect(p.onSkip).not.toHaveBeenCalled();
  });
  it('keeps image failure usable and preserves title/metadata/credit renderer', () => {
    const p = props(); let tree = render(p);
    nodes(tree).find(n => n.type === 'Image')!.props.onError!(); tree = render(p);
    expect(nodes(tree).some(n => n.type === 'Image')).toBe(false); expect(text(tree)).toContain('Frozen title');
    expect(nodes(tree).some(n => n.type === 'ItemDescription')).toBe(true);
  });
  it('records first-use guidance only on acknowledgement and keeps it discoverable', () => {
    const p = props(); let tree = render(p); expect(text(tree)).toContain(FEED_HELP); expect(h.storage.size).toBe(0);
    nodes(tree).find(n => n.type === 'Pressable' && text(n.props.children) === 'Selvä')!.props.onPress!();
    tree = render(p); expect(text(tree)).not.toContain(FEED_HELP); expect(h.storage.size).toBe(1);
    nodes(tree).find(n => n.props.accessibilityLabel === 'Ohittamisen ohje')!.props.onPress!();
    expect(text(render(p))).toContain(FEED_HELP);
  });
});
