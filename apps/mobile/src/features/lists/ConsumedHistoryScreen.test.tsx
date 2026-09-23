import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import type { ItemType } from '../../domain/contracts';
import type { ConsumedItemsResult } from './itemListOperations';
import { ConsumedHistoryScreen } from './ConsumedHistoryScreen';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  memos: [] as { deps: readonly unknown[]; value: unknown }[],
  effects: [] as { deps: readonly unknown[]; cleanup: (() => void) | undefined }[],
  pending: new Map<number, () => void>(),
  stateIndex: 0, memoIndex: 0, effectIndex: 0,
}));
const context = vi.hoisted(() => ({
  scopeKey: 'test:actor:personal' as string | null,
  profileName: 'Personal',
  loadConsumed: vi.fn<(itemType: ItemType | null) => Promise<ConsumedItemsResult>>(),
}));

// Run the real render/effect functions with controlled hook state. Deliberately
// inspect a new-scope render before flushing effects: hiding stale rows only in
// an effect is too late. This does not mount or simulate native views.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const same = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
    Boolean(a && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (next: unknown) => {
        hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next;
      }];
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      const index = hooks.memoIndex++;
      if (!same(hooks.memos[index]?.deps, deps)) hooks.memos[index] = { deps, value: factory() };
      return hooks.memos[index]?.value;
    },
    useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
      const index = hooks.effectIndex++;
      const previous = hooks.effects[index];
      if (same(previous?.deps, deps)) return;
      hooks.effects[index] = { deps, cleanup: previous?.cleanup };
      hooks.pending.set(index, () => {
        previous?.cleanup?.();
        const cleanup = effect();
        hooks.effects[index]!.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      });
    },
  };
});
vi.mock('./ItemListsContext', () => ({ useItemLists: () => context }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  activeProfile: { id: context.scopeKey, type: 'PERSONAL', name: context.profileName },
}) }));
vi.mock('../discovery/DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU' }) }));
vi.mock('expo-router', () => ({ router: { back: vi.fn(), push: vi.fn() } }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

type Props = { children?: ReactNode; onPress?: () => void };
function nodes(value: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(value).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
function text(value: ReactNode): string {
  return React.Children.toArray(value).map(child => React.isValidElement<Props>(child)
    ? text(child.props.children) : String(child)).join(' ');
}
function render(itemType: ItemType = 'BOOK') {
  hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
  return ConsumedHistoryScreen({ itemType });
}
function flushEffects() {
  const effects = [...hooks.pending.values()];
  hooks.pending.clear();
  effects.forEach(effect => effect());
}
function deferred() {
  let resolve!: (value: ConsumedItemsResult) => void;
  const promise = new Promise<ConsumedItemsResult>(done => { resolve = done; });
  return { promise, resolve };
}
function success(title: string, itemType: ItemType = 'BOOK'): ConsumedItemsResult {
  return { status: 'success', items: [{ profileId: 'fixture-profile',
    item: { id: 'fixture-item', itemType, title }, saved: false, consumed: true,
    rating: 8, updatedAt: '2026-09-23T10:00:00Z' }] };
}
async function showPersonalHistory() {
  context.loadConsumed.mockResolvedValueOnce(success('Private personal title'));
  render();
  flushEffects();
  await Promise.resolve();
  expect(text(render())).toContain('Private personal title');
}
function expectLoadingWithout(tree: ReactNode, oldText: string) {
  expect(text(tree)).not.toContain(oldText);
  expect(nodes(tree).some(node => node.type === 'ActivityIndicator')).toBe(true);
}
function enterScope(scope: string | null, name = 'Selected profile') {
  context.scopeKey = scope;
  context.profileName = name;
  // The real provider replaces this callback when its actor/Profile changes.
  context.loadConsumed = vi.fn<(itemType: ItemType | null) => Promise<ConsumedItemsResult>>()
    .mockImplementation(() => new Promise(() => {}));
}

beforeEach(() => {
  hooks.effects.forEach(effect => effect.cleanup?.());
  hooks.states = []; hooks.memos = []; hooks.effects = []; hooks.pending.clear();
  hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
  context.scopeKey = 'test:actor:personal';
  context.profileName = 'Personal';
  context.loadConsumed.mockReset();
  context.loadConsumed.mockImplementation(() => new Promise(() => {}));
  vi.mocked(router.push).mockClear();
});

describe('consumed history read ownership', () => {
  it.each([
    { label: 'SharedProfile', scope: 'test:actor:shared' },
    { label: 'another actor', scope: 'test:other:personal' },
    { label: 'another backend', scope: 'other:actor:personal' },
    { label: 'unavailable scope', scope: null },
  ])('hides prior rows before effects when entering $label', async ({ label, scope }) => {
    await showPersonalHistory();
    enterScope(scope, label);
    const next = render();
    expect(text(next)).toContain(label);
    expectLoadingWithout(next, 'Private personal title');
    expect(text(next)).not.toContain('Arvosana 8/10');
  });

  it('does not resurrect an old A result during a rapid A → B → A return', async () => {
    await showPersonalHistory();
    enterScope('test:actor:shared');
    render(); flushEffects();
    enterScope('test:actor:personal');
    context.loadConsumed.mockResolvedValueOnce(success('Fresh personal title'));
    expectLoadingWithout(render(), 'Private personal title');
    flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Fresh personal title');
  });

  it('ignores a late old-scope response after the new history is ready', async () => {
    const old = deferred();
    context.loadConsumed.mockReturnValueOnce(old.promise);
    render(); flushEffects();
    enterScope('test:actor:shared');
    context.loadConsumed.mockResolvedValueOnce(success('Shared title'));
    render(); flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Shared title');
    old.resolve(success('Late private title'));
    await Promise.resolve();
    const tree = render();
    expect(text(tree)).toContain('Shared title');
    expect(text(tree)).not.toContain('Late private title');
  });

  it('clears an old scope error immediately and retries the current scope', async () => {
    context.loadConsumed.mockResolvedValueOnce({ status: 'error', message: 'Personal read failed' });
    render(); flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Personal read failed');
    enterScope('test:actor:shared');
    context.loadConsumed.mockResolvedValueOnce({ status: 'error', message: 'Shared read failed' });
    expectLoadingWithout(render(), 'Personal read failed');
    flushEffects();
    await Promise.resolve();
    const failed = render();
    expect(text(failed)).toContain('Shared read failed');
    context.loadConsumed.mockResolvedValueOnce(success('Recovered shared title'));
    nodes(failed).find(node => node.type === 'Pressable' && text(node).includes('Yritä uudelleen'))!.props.onPress!();
    expectLoadingWithout(render(), 'Shared read failed');
    flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Recovered shared title');
    expect(context.loadConsumed.mock.calls).toEqual([['BOOK'], ['BOOK']]);
  });

  it('keeps BOOK/MOVIE switching and canonical item navigation working', async () => {
    await showPersonalHistory();
    context.loadConsumed.mockResolvedValueOnce(success('Watched movie', 'MOVIE'));
    expectLoadingWithout(render('MOVIE'), 'Private personal title');
    flushEffects();
    await Promise.resolve();
    const tree = render('MOVIE');
    expect(text(tree)).toContain('Katsotut');
    nodes(tree).find(node => node.type === 'Pressable' && text(node).includes('Watched movie'))!.props.onPress!();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/discovery/[itemId]', params: { itemId: 'fixture-item' } });
    expect(context.loadConsumed.mock.calls).toEqual([['BOOK'], ['MOVIE']]);
  });
});
