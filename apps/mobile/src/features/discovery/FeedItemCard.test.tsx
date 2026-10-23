import React, { type ReactElement, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedItemCard, FEED_HELP } from './FeedItemCard';
import { getRoomTheme } from '../../theme/roomTheme';

const h = vi.hoisted(() => ({ states: [] as unknown[], memos: [] as unknown[], index: 0, memo: 0, refs: [] as { current: unknown }[], ref: 0,
  effects: [] as { deps: readonly unknown[]; cleanup?: () => void }[], effect: 0, pending: [] as (() => void)[],
  storage: new Map<string, string>(), app: null as ((state: string) => void) | null }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useState: (initial: unknown) => { const i = h.index++; if (!(i in h.states)) h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [h.states[i], (v: unknown) => { h.states[i] = typeof v === 'function' ? v(h.states[i]) : v; }]; },
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => { const i = h.ref++; if (!(i in h.refs)) h.refs[i] = { current: initial }; return h.refs[i]; },
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
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
  Animated: { View: 'AnimatedView', Value: class { setValue = vi.fn(); stopAnimation = vi.fn(); },
    timing: () => ({ start: vi.fn() }), spring: () => ({ start: vi.fn() }) },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove: vi.fn() }) },
  AppState: { currentState: 'active', addEventListener: (_: string, fn: (s: string) => void) => { h.app = fn; return { remove: vi.fn() }; } },
}));
vi.mock('./ItemDescription', () => ({ ItemDescription: 'ItemDescription' }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { h.effects.forEach(e => e.cleanup?.()); h.states = []; h.memos = []; h.refs = []; h.effects = []; h.pending = []; h.storage.clear(); });
type Props = { children?: ReactNode; testID?: string; accessibilityLabel?: string; onPress?: () => void;
  onError?: () => void; onLayout?: (event?: { nativeEvent: { layout: { height: number } } }) => void;
  disabled?: boolean; style?: unknown; numberOfLines?: number; accessible?: boolean; expanded?: boolean;
  onExpandedChange?: React.Dispatch<React.SetStateAction<boolean>>;
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
  onStartShouldSetPanResponder?: (event: unknown, gesture: object) => boolean;
  onMoveShouldSetPanResponderCapture?: (event: unknown, gesture: object) => boolean;
  onPanResponderGrant?: () => void; onPanResponderRelease?: (e: unknown, g: object) => void;
  onPanResponderMove?: (e: unknown, g: object) => void; onPanResponderTerminate?: () => void };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(tree).flatMap(child => React.isValidElement<Props>(child) ? [child, ...nodes(child.props.children)] : []);
}
function text(tree: ReactNode): string {
  return React.Children.toArray(tree).map(child => React.isValidElement<Props>(child) ? text(child.props.children) : String(child)).join(' ');
}
function render(props: React.ComponentProps<typeof FeedItemCard>) {
  h.index = h.memo = h.effect = h.ref = 0; const tree = FeedItemCard(props); h.pending.splice(0).forEach(fn => fn()); return tree;
}
const props = () => ({ item: { id: 'movie', itemType: 'MOVIE' as const, title: 'Frozen title', imageUrl: 'https://example.invalid/poster.jpg' },
  theme: getRoomTheme('DAWN'), disabled: false, onSkip: vi.fn(() => true) });

function ViewProbe() { return null; }

describe('shared native feed presentation wiring', () => {
  it('binds the whole card drag to the same neutral action exposed by its dedicated accessible summary', () => {
    const p = props(); const tree = render(p);
    const surface = nodes(tree).find(n => n.props.testID === 'feed-dismiss-surface')!.props;
    surface.onPanResponderGrant!(); surface.onPanResponderMove!(null, { dx: 0, dy: -120, numberActiveTouches: 1 });
    surface.onPanResponderRelease!(null, { dx: 0, dy: -120 });
    nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!.props.onAccessibilityAction!({ nativeEvent: { actionName: 'increment' } });
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
    const disabledSurface = nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!.props;
    disabledSurface.onAccessibilityAction!({ nativeEvent: { actionName: 'increment' } }); expect(p.onSkip).not.toHaveBeenCalled();
  });
  it('keeps a deliberate drag active across a harmless callback refresh', () => {
    const p = props(); const tree = render(p);
    const surface = nodes(tree).find(n => n.props.testID === 'feed-dismiss-surface')!.props;
    surface.onPanResponderGrant!(); surface.onPanResponderMove!(null, { dx: 0, dy: -120, numberActiveTouches: 1 });
    const nextCommit = vi.fn(() => true);
    const rerendered = render({ ...p, onSkip: nextCommit });
    nodes(rerendered).find(n => n.props.testID === 'feed-dismiss-surface')!.props.onPanResponderRelease!(null, { dx: 0, dy: -120 });
    expect(p.onSkip).not.toHaveBeenCalled(); expect(nextCommit).toHaveBeenCalledOnce();
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
    nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!.props.onAccessibilityAction!({ nativeEvent: { actionName: 'showHelp' } });
    expect(text(render(p))).toContain(FEED_HELP);
  });
  it('reverses one completed downward gesture and exposes no visible skip or undo controls', () => {
    const p = { ...props(), onPrevious: vi.fn(() => true) }; const tree = render(p);
    const surface = nodes(tree).find(n => n.props.testID === 'feed-dismiss-surface')!.props;
    expect(surface.onMoveShouldSetPanResponderCapture!(null, { dx: 0, dy: 30, numberActiveTouches: 1 })).toBe(true);
    surface.onPanResponderGrant!(); surface.onPanResponderMove!(null, { dx: 0, dy: 130, numberActiveTouches: 1 });
    surface.onPanResponderRelease!(null, { dx: 0, dy: 130 });
    nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!.props.onAccessibilityAction!({ nativeEvent: { actionName: 'decrement' } });
    expect(p.onPrevious).toHaveBeenCalledOnce(); expect(p.onSkip).not.toHaveBeenCalled();
    expect(nodes(tree).filter(n => n.type === 'Pressable').map(n => text(n.props.children))).toEqual(['Selvä']);
    expect(text(render(p))).not.toContain(FEED_HELP);
  });
  it('dismisses guidance after positive acknowledgement and scopes its receipt to the account', () => {
    const p = { ...props(), helpScope: 'actor-a', hasInteracted: false };
    render(p); p.hasInteracted = true; render(p);
    expect(text(render(p))).not.toContain(FEED_HELP);
    const q = { ...p, helpScope: 'actor-b', hasInteracted: false }; render(q);
    expect(text(render(q))).toContain(FEED_HELP);
    render({ ...q, helpScope: 'actor-a' });
    expect(text(render({ ...q, helpScope: 'actor-a' }))).not.toContain(FEED_HELP);
  });
  it('allows explicit help after a rating acknowledgement and keeps automatic help dismissed', () => {
    const p = { ...props(), helpScope: 'actor-a', hasInteracted: false };
    render(p); p.hasInteracted = true; render(p); let tree = render(p);
    expect(text(tree)).not.toContain(FEED_HELP);
    nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!.props.onAccessibilityAction!({ nativeEvent: { actionName: 'showHelp' } });
    tree = render(p); expect(text(tree)).toContain(FEED_HELP);
    expect(text(render(p))).toContain(FEED_HELP);
    nodes(tree).find(n => n.props.accessibilityLabel === 'Sulje selaamisen ohje')!.props.onPress!();
    expect(text(render(p))).not.toContain(FEED_HELP);
  });
  it('bounds long metadata on a small viewport while retaining its full accessible text', () => {
    const title = 'Very long title '.repeat(30); const creators = ['Long author name '.repeat(30)];
    const tree = render({ ...props(), item: { ...props().item, title, creators }, viewportHeight: 240, children: <ViewProbe /> });
    const surface = nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!;
    expect(surface.props.accessibilityLabel).toContain(title); expect(surface.props.accessibilityLabel).toContain(creators[0]);
    expect(surface.props.style).toContainEqual(expect.objectContaining({ minHeight: 0, overflow: 'hidden' }));
    expect(nodes(tree).find(n => n.props.testID === 'feed-title')!.props.numberOfLines).toBe(2);
    expect(nodes(tree).find(n => n.props.testID === 'feed-creators')!.props.numberOfLines).toBe(1);
    const controls = nodes(tree).find(n => React.Children.toArray(n.props.children).some(child => React.isValidElement(child) && child.type === ViewProbe))!;
    expect(controls.props.style).toMatchObject({ flexShrink: 0 });
  });
  it('does not advertise undo or list gestures inside Taste', () => {
    const tree = render({ ...props(), helpKind: 'taste' });
    expect(text(tree)).toContain(FEED_HELP);
    expect(text(tree)).not.toContain('Alaspäin'); expect(text(tree)).not.toContain('Tähti');
  });
  it('fills the supplied viewport and includes the full description in the outer gesture surface', () => {
    const tree = render({ ...props(), viewportHeight: 620 });
    expect(tree.props.style).toContainEqual({ height: 620 });
    const description = nodes(tree).find(n => n.props.testID === 'feed-description-content')!;
    expect(description.type).toBe('View');
    expect(nodes(tree).some(n => n.type === 'ScrollView')).toBe(false);
    expect(nodes(description.props.children).some(n => n.type === 'ItemDescription')).toBe(true);
    expect(tree.props.testID).toBe('feed-dismiss-surface');
    expect(tree.props.onPanResponderRelease).toBeTypeOf('function');
  });
  it('keeps title and controls separately accessible and preserves taps and horizontal gestures', () => {
    const onTitle = vi.fn(); const onControl = vi.fn();
    const tree = render({ ...props(),
      titleAction: <Pressable accessibilityLabel="Avaa listat" onPress={onTitle}><Text>☆</Text></Pressable>,
      children: <Pressable accessibilityLabel="Kortin toiminto" onPress={onControl}><Text>Valitse</Text></Pressable> });
    expect(tree.props.accessible).toBe(false);
    expect(tree.props.onStartShouldSetPanResponder!(null, { numberActiveTouches: 1 })).toBe(false);
    expect(tree.props.onMoveShouldSetPanResponderCapture!(null, { dx: 60, dy: 8, numberActiveTouches: 1 })).toBe(false);
    const summary = nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!;
    expect(summary.props.accessible).toBe(true);
    expect(nodes(summary.props.children).some(n => n.props.accessibilityLabel === 'Avaa listat')).toBe(false);
    nodes(tree).find(n => n.props.accessibilityLabel === 'Avaa listat')!.props.onPress!();
    nodes(tree).find(n => n.props.accessibilityLabel === 'Kortin toiminto')!.props.onPress!();
    expect(onTitle).toHaveBeenCalledOnce(); expect(onControl).toHaveBeenCalledOnce();
  });
  it('grows the card for expanded text without clipping it into a separate scrolling field or submitting a choice', () => {
    const onDescriptionHeight = vi.fn(); const onDescriptionExpanded = vi.fn();
    const p = { ...props(), viewportHeight: 600, onDescriptionHeight, onDescriptionExpanded };
    let tree = render(p);
    nodes(tree).find(n => n.type === 'ItemDescription')!.props.onExpandedChange!(true);
    tree = render(p);
    expect(nodes(tree).find(n => n.type === 'ItemDescription')!.props.expanded).toBe(true);
    nodes(tree).find(n => n.props.testID === 'feed-description-content')!.props.onLayout!({ nativeEvent: { layout: { height: 720 } } });
    tree = render(p);
    const heightStyle = (tree.props.style as { height?: number }[]).find(style => style && typeof style.height === 'number');
    expect(heightStyle!.height).toBeGreaterThan(1000);
    expect(nodes(tree).find(n => n.props.testID === 'feed-description-content')!.props.style).toMatchObject({ flexShrink: 0 });
    expect(onDescriptionExpanded).toHaveBeenCalledExactlyOnceWith(true);
    expect(onDescriptionHeight).toHaveBeenCalledExactlyOnceWith(720);
    expect(p.onSkip).not.toHaveBeenCalled();
  });
  it('lets accessibility actions read tall content in both directions under reduced motion without changing cards', () => {
    const onReadingOffset = vi.fn(); const onPrevious = vi.fn(() => true);
    const p = { ...props(), viewportHeight: 600, initialExpanded: true, initialDescriptionHeight: 720,
      initialReduceMotion: true, onReadingOffset, onPrevious };
    const tree = render(p);
    const summary = nodes(tree).find(n => n.props.testID === 'feed-accessibility-summary')!.props;
    expect(summary.accessibilityActions).toEqual(expect.arrayContaining([
      { name: 'scrollForward', label: 'Lue kuvausta eteenpäin' },
      { name: 'scrollBackward', label: 'Lue kuvausta taaksepäin' },
    ]));
    summary.onAccessibilityAction!({ nativeEvent: { actionName: 'scrollForward' } });
    expect(onReadingOffset).toHaveBeenLastCalledWith(-390);
    const style = tree.props.style as { height?: number; transform?: { translateY: { setValue: ReturnType<typeof vi.fn> } }[] }[];
    const translation = style.find(entry => entry.transform)?.transform![0]!.translateY;
    expect(translation!.setValue).toHaveBeenLastCalledWith(-390);
    for (let i = 0; i < 10; i++) summary.onAccessibilityAction!({ nativeEvent: { actionName: 'scrollForward' } });
    expect(onReadingOffset).toHaveBeenLastCalledWith(600 - style.find(entry => entry.height)!.height!);
    for (let i = 0; i < 10; i++) summary.onAccessibilityAction!({ nativeEvent: { actionName: 'scrollBackward' } });
    expect(onReadingOffset).toHaveBeenLastCalledWith(0);
    expect(p.onSkip).not.toHaveBeenCalled(); expect(onPrevious).not.toHaveBeenCalled();
  });
});
