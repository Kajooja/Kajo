import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRoomTheme } from '../../theme/roomTheme';
import { ProfileBootstrapGate, ProfileCalibrationScreen, PersonalTasteGate } from './ProfileBootstrapGate';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PersonalTasteScreen } from './PersonalTasteScreen';
import { useTasteItemPresentation } from './useTasteItemPresentation';
import type { Item } from '../../domain/contracts';
import { id, profileId, sequentialResponse } from './personalTasteTestFixtures';
import type { TasteCommand } from './personalTasteOperations';
import type { ProfileBootstrapStatus, ProfileCalibrationRpc } from './profileCalibrationOperations';

vi.mock('../discovery/DiscoveryBackdrop', () => ({ DiscoveryBackdrop: 'DiscoveryBackdrop' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

const hooks = vi.hoisted(() => ({
  frames: new Map<string, {
    states: unknown[];
    memos: { deps: readonly unknown[]; value: unknown }[];
    effects: { deps: readonly unknown[]; cleanup: (() => void) | undefined }[];
    pending: Map<number, { layout: boolean; run: () => void }>;
  }>(),
  owner: 'screen', index: 0, memoIndex: 0, effectIndex: 0,
}));
const context = vi.hoisted(() => ({ profileId: 'personal', segments: ['index'],
  client: { rpc: vi.fn() },
}));
function frame() {
  let current = hooks.frames.get(hooks.owner);
  if (!current) {
    current = { states: [], memos: [], effects: [], pending: new Map() };
    hooks.frames.set(hooks.owner, current);
  }
  return current;
}
vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    const current = frame();
    if (!(index in current.states)) current.states[index] = initial;
    return [current.states[index], (next: unknown) => {
      current.states[index] = typeof next === 'function' ? next(current.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.index++;
    const current = frame();
    if (!(index in current.states)) current.states[index] = { current: initial };
    return current.states[index];
  },
  useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
    const index = hooks.memoIndex++;
    const current = frame();
    if (!current.memos[index] || !deps.every((value, i) => Object.is(value, current.memos[index]?.deps[i]))) {
      current.memos[index] = { deps, value: factory() };
    }
    return current.memos[index]!.value;
  },
  useCallback: (callback: unknown) => callback,
  useLayoutEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => recordEffect(effect, deps, true),
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => recordEffect(effect, deps, false),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Image: 'Image', Pressable: 'Pressable',
  SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useSegments: () => context.segments }));
vi.mock('expo-sqlite/kv-store', () => ({ default: { getItemSync: () => null, setItemSync: vi.fn() } }));
vi.mock('@/data/SupabaseProvider', () => ({ useSupabaseConnection: () => ({ status: 'configured', client: context.client,
  config: { url: 'https://fixture.example.invalid' } }) }));
vi.mock('@/features/branding/KajoBrand', () => ({ KajoMark: 'KajoMark', StartupSplash: 'StartupSplash' }));
vi.mock('@/features/discovery/DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU' }) }));
vi.mock('@/features/discovery/RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.mock('@/features/profiles/ActiveProfileContext', () => {
  const profiles = new Map<string, { id: string; type: 'PERSONAL'; name: string; ownerUserId: string }>();
  return { useActiveProfile: () => {
    let profile = profiles.get(context.profileId);
    if (!profile) {
      profile = { id: context.profileId, type: 'PERSONAL', name: 'Personal', ownerUserId: 'actor' };
      profiles.set(context.profileId, profile);
    }
    return { personalProfile: profile, activeProfile: profile };
  } };
});
vi.mock('@/domain/discovery', async () => await import('../../domain/discovery'));
vi.mock('@/theme/roomTheme', async () => await import('../../theme/roomTheme'));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

const status: ProfileBootstrapStatus = {
  profileId: 'personal', minimumStrongEvidence: 6, initialCandidateCount: 6,
  maximumCandidateCount: 8, strongEvidenceCount: 0, importedStrongCount: 0,
  calibrationRatingCount: 0, nativeStrongCount: 0, needsCalibration: true,
  realMovieCount: 30, realBookCount: 30, calibrationAvailable: true,
  priorVersion: 'cold-start-prior-v1', version: 'cold-start-v1',
};
const rpc = vi.fn<ProfileCalibrationRpc>();
const completed = vi.fn();
const failOpen = vi.fn();
type Props = { children?: ReactNode; onPress?: () => unknown; disabled?: boolean;
  rating?: number | null; onRatingChange?: (rating: number) => void };
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<Props>(child)
    ? text(child.props.children) : String(child)).join(' ').replace(/\s+/g, ' ').trim();
}
function recordEffect(effect: () => void | (() => void), deps: readonly unknown[], layout: boolean) {
  const index = hooks.effectIndex++;
  const current = frame();
  const previous = current.effects[index];
  if (previous && previous.deps.length === deps.length && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
  current.effects[index] = { deps, cleanup: previous?.cleanup };
  current.pending.set(index, { layout, run: () => {
    previous?.cleanup?.();
    const cleanup = effect();
    current.effects[index]!.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
  } });
}
function flushEffects(owner: string, layoutOnly = false) {
  const current = hooks.frames.get(owner)!;
  for (const [index, effect] of [...current.pending]) {
    if (layoutOnly && !effect.layout) continue;
    current.pending.delete(index);
    effect.run();
  }
}
function cleanup(owner: string) {
  hooks.frames.get(owner)?.effects.forEach(effect => effect.cleanup?.());
}
function beginRender(owner: string) {
  hooks.owner = owner;
  hooks.index = hooks.memoIndex = hooks.effectIndex = 0;
}
// Execute the actual screen render/handlers with controlled hooks and RPCs.
// Native layout, gestures and network/device round trips remain separate tests.
function render() {
  beginRender('screen');
  const tree = ProfileCalibrationScreen({ profileId: 'personal', rpc,
    theme: getRoomTheme('DAWN'), status, onOpenImport: vi.fn(),
    onFailOpen: failOpen, onCompleted: completed });
  flushEffects('screen');
  return tree;
}
function button(label: string, tree = render()) {
  const element = elements(tree).find(node => node.type === 'Pressable' && text(node.props.children) === label);
  expect(element, `missing button ${label}`).toBeDefined();
  return element!.props;
}
function ratingControl(tree = render()) {
  return elements(tree).find(node => node.type === 'RatingControl')!.props;
}
function rate(rating: number) { ratingControl().onRatingChange!(rating); }
function candidates(ids: readonly number[]) {
  return ids.map(id => ({ itemId: `item-${id}`, itemType: 'MOVIE', title: `Title ${id}`,
    tags: [], creators: [] }));
}
async function start(ids: readonly number[] = [1, 2, 3, 4, 5, 6]) {
  rpc.mockResolvedValueOnce({ data: candidates(ids), error: null });
  await button('Aloita profilointi').onPress!();
  await settle();
  expect(text(render())).toContain('Title 1');
}
function next() {
  const tree = render();
  const label = elements(tree).some(node => node.type === 'Pressable' && text(node.props.children) === 'Näytä lisää')
    ? 'Näytä lisää' : 'Seuraava';
  button(label, tree).onPress!();
}
async function settle() { await Promise.resolve(); await Promise.resolve(); }
function deferred() {
  let resolve!: (value: { data: unknown; error: null }) => void;
  const promise = new Promise<{ data: unknown; error: null }>(done => { resolve = done; });
  return { promise, resolve };
}
type ScreenElement = ReactElement<React.ComponentProps<typeof ProfileCalibrationScreen>>;
function renderGate() {
  beginRender('gate');
  const tree = ProfileBootstrapGate({ children: React.createElement('View', {}, 'APP') });
  flushEffects('gate');
  return tree;
}
function screenElement(tree = renderGate()): ScreenElement {
  // The outer scope now owns both the new server flow and legacy fallback.
  // Continue exercising the real retained legacy screen with that exact scope.
  expect(React.isValidElement(tree) && tree.type).toBe(PersonalTasteGate);
  return tree as ScreenElement;
}
function renderElement(element: ScreenElement) {
  const owner = `screen:${element.key}`;
  beginRender(owner);
  const tree = ProfileCalibrationScreen(element.props);
  flushEffects(owner);
  return tree;
}
async function startElement(element: ScreenElement) {
  button('Aloita profilointi', renderElement(element)).onPress!();
  await settle();
  return renderElement(element);
}
function statusResponse(profileId: string) { return { data: { ...status, profileId }, error: null }; }

beforeEach(() => {
  for (const owner of hooks.frames.keys()) cleanup(owner);
  hooks.frames.clear();
  hooks.index = hooks.memoIndex = hooks.effectIndex = 0;
  context.profileId = 'personal'; context.segments = ['index'];
  context.client = { rpc: vi.fn() };
  vi.clearAllMocks();
});
describe('logged-in calibration draft and opportunity continuation', () => {
  it('keeps unknown available after an accidental rating drag, discards the draft and advances', async () => {
    await start();
    rate(7);
    expect(ratingControl().rating).toBe(7);
    expect(button('En tunne').disabled).toBe(false);
    button('En tunne').onPress!();
    expect(text(render())).toContain('Title 2');
    button('Edellinen').onPress!();
    expect(ratingControl().rating).toBeNull();
    expect(text(render())).toContain('Arvioi vielä 6');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('retains deliberate zero on Next and submits it without treating it as unknown', async () => {
    await start();
    rate(0); next();
    for (let id = 2; id <= 6; id++) { rate(8); if (id < 6) next(); }
    rpc.mockResolvedValueOnce({ data: { ratingCount: 6, version: 'cold-start-v1' }, error: null });
    await button('Valmis · tallenna 6 arviota').onPress!();
    await settle();
    expect(rpc).toHaveBeenLastCalledWith('commit_profile_calibration_v1', {
      target_profile_id: 'personal', input_responses: [
        { itemId: 'item-1', rating: 0 }, ...[2, 3, 4, 5, 6].map(id => ({ itemId: `item-${id}`, rating: 8 })),
      ],
    });
    expect(completed).toHaveBeenCalledOnce();
  });

  it('removes only the revisited Item draft while preserving other answers', async () => {
    await start();
    rate(0); next(); rate(9); next();
    button('Edellinen').onPress!();
    expect(ratingControl().rating).toBe(9);
    button('En tunne').onPress!();
    button('Edellinen').onPress!();
    expect(ratingControl().rating).toBeNull();
    button('Edellinen').onPress!();
    expect(ratingControl().rating).toBe(0);
    expect(text(render())).toContain('Arvioi vielä 5');
  });

  it('extends after clearing the sixth last-card draft and preserves the presented prefix across reordered responses', async () => {
    await start();
    for (let id = 1; id <= 6; id++) { rate(id); if (id < 6) next(); }
    expect(button('Valmis · tallenna 6 arviota').disabled).toBe(false);
    rpc.mockResolvedValueOnce({ data: candidates([6, 5, 4, 3, 2, 1, 7, 7, 8]), error: null });
    button('En tunne').onPress!();
    await settle();
    expect(rpc).toHaveBeenLastCalledWith('get_profile_calibration_candidates_v1', {
      target_profile_id: 'personal', input_limit: 8,
    });
    expect(text(render())).toContain('Title 7');
    expect(text(render())).not.toContain('Jatka Kajoon');
    button('Edellinen').onPress!();
    expect(text(render())).toContain('Title 6');
    expect(ratingControl().rating).toBeNull();
    button('Edellinen').onPress!();
    expect(text(render())).toContain('Title 5');
    expect(ratingControl().rating).toBe(5);
  });

  it('offers fail-open at the last opportunity after unknown without writing taste evidence', async () => {
    await start([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let id = 1; id < 8; id++) button('En tunne').onPress!();
    rate(0);
    button('En tunne').onPress!();
    expect(text(render())).toContain('Arvioi vielä 6');
    button('Jatka Kajoon').onPress!();
    expect(failOpen).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('can still extend after reaching the terminal with six drafts and then discarding the last one', async () => {
    await start();
    for (let id = 1; id <= 6; id++) { rate(8); next(); }
    rpc.mockResolvedValueOnce({ data: candidates([1, 2, 3, 4, 5, 6, 7, 8]), error: null });
    button('En tunne').onPress!();
    await settle();
    expect(text(render())).toContain('Title 7');
    expect(text(render())).toContain('Arvioi vielä 1');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('preserves drafts/order after extension failure and allows a bounded retry', async () => {
    await start();
    rate(0);
    for (let id = 1; id < 6; id++) next();
    rate(8);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Temporary failure' } });
    button('En tunne').onPress!();
    await settle();
    expect(text(render())).toContain('Temporary failure');
    expect(text(render())).toContain('Title 6');
    expect(ratingControl().rating).toBeNull();
    expect(text(render())).toContain('Arvioi vielä 5');
    rpc.mockResolvedValueOnce({ data: candidates([6, 5, 4, 3, 2, 1, 7]), error: null });
    next();
    await settle();
    expect(text(render())).toContain('Title 7');
    expect(text(render())).not.toContain('Temporary failure');
    for (let step = 0; step < 6; step++) button('Edellinen').onPress!();
    expect(text(render())).toContain('Title 1');
    expect(ratingControl().rating).toBe(0);
  });

  it('treats an expansion without new identities as exhausted and does not repeat or reorder cards', async () => {
    await start();
    for (let id = 1; id < 6; id++) button('En tunne').onPress!();
    rpc.mockResolvedValueOnce({ data: candidates([6, 5, 4, 3, 2, 1, 1]), error: null });
    button('En tunne').onPress!();
    await settle();
    expect(text(render())).toContain('Title 6');
    expect(text(render())).toContain('Jatka Kajoon');
    button('En tunne').onPress!();
    expect(rpc).toHaveBeenCalledTimes(2);
    button('Edellinen').onPress!();
    expect(text(render())).toContain('Title 5');
  });
});

describe('calibration scope handlers with deferred RPCs', () => {
  // This harness executes real handlers and explicitly runs effect cleanup.
  // It checks React keys without claiming a mounted React/native lifecycle.
  it('keys a replacement client scope separately and ignores a completed old candidate load', async () => {
    const pending = deferred();
    context.client.rpc.mockResolvedValueOnce(statusResponse('personal'));
    renderGate(); await settle();
    const old = screenElement();
    context.client.rpc.mockReturnValueOnce(pending.promise);
    button('Aloita profilointi', renderElement(old)).onPress!();
    expect(button('Aloita profilointi', renderElement(old)).disabled).toBe(true);

    context.client = { rpc: vi.fn().mockResolvedValue(statusResponse('personal')) };
    renderGate(); await settle();
    const replacement = screenElement();
    expect(replacement.key).not.toBe(old.key);
    cleanup(`screen:${old.key}`);
    expect(button('Aloita profilointi', renderElement(replacement)).disabled).toBe(false);
    pending.resolve({ data: candidates([1, 2, 3, 4, 5, 6]), error: null });
    await settle();
    expect(text(renderElement(old))).not.toContain('Title 1');
    expect(text(renderElement(replacement))).not.toContain('Title 1');
    expect(button('Aloita profilointi', renderElement(replacement)).disabled).toBe(false);
  });

  it('ignores an old profile commit completion and never sends its drafts to the new Profile', async () => {
    const oldCommit = deferred();
    context.client.rpc.mockImplementation(async (name, args) => {
      if (name === 'get_profile_bootstrap_status_v1') return statusResponse(args.target_profile_id);
      if (name === 'get_profile_calibration_candidates_v1') return { data: candidates([1, 2, 3, 4, 5, 6]), error: null };
      if (args.target_profile_id === 'personal') return oldCommit.promise;
      return { data: { ratingCount: 6, version: 'cold-start-v1' }, error: null };
    });
    renderGate(); await settle();
    const old = screenElement();
    await startElement(old);
    for (let id = 1; id <= 6; id++) {
      ratingControl(renderElement(old)).onRatingChange!(8);
      if (id < 6) button('Seuraava', renderElement(old)).onPress!();
    }
    button('Valmis · tallenna 6 arviota', renderElement(old)).onPress!();
    context.profileId = 'new-personal';
    renderGate(); await settle();
    const replacement = screenElement();
    expect(replacement.key).not.toBe(old.key);
    cleanup(`screen:${old.key}`);
    await startElement(replacement);
    ratingControl(renderElement(replacement)).onRatingChange!(0);
    expect(text(renderElement(replacement))).toContain('Arvioi vielä 5');

    oldCommit.resolve({ data: { ratingCount: 6, version: 'cold-start-v1' }, error: null });
    await settle(); await settle();
    expect(screenElement().key).toBe(replacement.key);
    expect(ratingControl(renderElement(replacement)).rating).toBe(0);
    expect(context.client.rpc.mock.calls.filter(([name]) => name === 'get_profile_bootstrap_status_v1')).toHaveLength(2);

    button('Seuraava', renderElement(replacement)).onPress!();
    for (let id = 2; id <= 6; id++) {
      ratingControl(renderElement(replacement)).onRatingChange!(5);
      if (id < 6) button('Seuraava', renderElement(replacement)).onPress!();
    }
    button('Valmis · tallenna 6 arviota', renderElement(replacement)).onPress!();
    await settle(); await settle();
    expect(context.client.rpc).toHaveBeenLastCalledWith('get_profile_bootstrap_status_v1', {
      target_profile_id: 'new-personal',
    });
    const commitCalls = context.client.rpc.mock.calls.filter(([name]) => name === 'commit_profile_calibration_v1');
    expect(commitCalls).toHaveLength(2);
    expect(commitCalls[1]?.[1]).toEqual({ target_profile_id: 'new-personal', input_responses: [
      { itemId: 'item-1', rating: 0 }, ...[2, 3, 4, 5, 6].map(id => ({ itemId: `item-${id}`, rating: 5 })),
    ] });
  });

  it('ignores a previously started old refresh and a later stale onCompleted callback', async () => {
    const oldRefresh = deferred();
    context.client.rpc.mockResolvedValueOnce(statusResponse('personal'));
    renderGate(); await settle();
    const old = screenElement();
    context.client.rpc.mockReturnValueOnce(oldRefresh.promise);
    old.props.onCompleted();
    context.profileId = 'new-personal';
    context.client.rpc.mockResolvedValueOnce(statusResponse('new-personal'));
    renderGate(); await settle();
    const replacement = screenElement();
    oldRefresh.resolve(statusResponse('personal'));
    await settle();
    expect(screenElement().key).toBe(replacement.key);
    old.props.onCompleted();
    await settle();
    expect(context.client.rpc).toHaveBeenCalledTimes(3);
    expect(screenElement().key).toBe(replacement.key);
  });
});


describe('sequential Taste gate to the same Profile application', () => {
  it('binds displayed answers and waits for PAUSE acknowledgement before releasing the application', async () => {
    let data = sequentialResponse('NEEDS_NEXT', 1);
    const calls: TasteCommand['request'][] = [];
    let releasePause!: () => void;
    const client = { rpc: (_name: string, { request }: { request: TasteCommand['request'] }) => ({ abortSignal: async () => {
      calls.push(request);
      if (request.operation === 'NEXT') data = sequentialResponse('QUESTION', data.revision + 1, data.answered);
      if (request.operation === 'ANSWER') data = sequentialResponse('NEEDS_NEXT', data.revision + 1, data.answered + 1);
      if (request.operation === 'PAUSE') {
        await new Promise<void>(resolve => { releasePause = resolve; });
        data = sequentialResponse('PAUSED', data.revision + 1, data.answered);
      }
      return { data, error: null };
    } }) } as unknown as SupabaseClient;
    const p = { profileId, actorUserId: id(1), namespace: 'https://gate.invalid', client, rpc,
      theme: getRoomTheme('DAWN'), status, onOpenImport: vi.fn(), onFailOpen: failOpen, onCompleted: completed,
      children: React.createElement('View', {}, 'SAME PROFILE APP') };
    function renderPersonal() {
      beginRender('personal'); const tree = PersonalTasteGate(p); flushEffects('personal'); return tree;
    }
    function screen() {
      const tree = renderPersonal(); expect(React.isValidElement(tree) && tree.type).toBe(PersonalTasteScreen);
      return (tree as ReactElement<React.ComponentProps<typeof PersonalTasteScreen>>).props;
    }
    async function drain() { for (let n = 0; n < 40; n++) await Promise.resolve(); }
    renderPersonal(); screen().onBegin(); await drain();
    expect(screen().state.sequential?.questionId).toBe(id(300));
    screen().onAnswer({ kind: 'RATING', value: 5 }); await drain();
    expect(calls.find(c => c.operation === 'ANSWER')).toMatchObject({ profileId, questionId: id(300), expectedRevision: 2, answer: { kind: 'RATING', value: 5 } });
    expect(screen().state.sequential?.answered).toBe(1);
    screen().onContinue(); await drain();
    expect(screen().state.dismissed).toBe(false); expect(failOpen).not.toHaveBeenCalled();
    expect(calls.at(-1)?.operation).toBe('PAUSE');
    releasePause(); await drain();
    expect(text(renderPersonal())).toBe('SAME PROFILE APP');
    expect(calls.every(c => c.profileId === profileId)).toBe(true);
    cleanup('personal');
  });
});


describe('current-question public catalog presentation', () => {
  it('drops late old revision/scope replies and never replaces the frozen question identity or title', async () => {
    const pending: { resolve: (value: unknown) => void; signal: AbortSignal; itemId: string }[] = [];
    const client = { from: () => ({ select: () => ({ in: (_key: string, ids: string[]) => ({
      abortSignal: (signal: AbortSignal) => new Promise(resolve => { pending.push({ resolve, signal, itemId: ids[0]! }); }),
    }) }) }) } as unknown as SupabaseClient;
    const question: Item = { id: id(100), itemType: 'MOVIE', title: 'Frozen question' };
    function Artwork(identity: string) { beginRender('artwork'); const value = useTasteItemPresentation(client, identity, question); flushEffects('artwork'); return value; }
    const row = (image: string) => ({ data: [{ id: question.id, item_type: 'MOVIE', title: 'Updated catalog title',
      description: null, tags: [], creators: ['Creator'], release_year: 2026, image_url: image, original_language: 'fi' }], error: null });
    expect(Artwork('actor:profile:question:1')?.imageUrl).toBeUndefined();
    expect(Artwork('actor:profile:question:2')?.imageUrl).toBeUndefined();
    expect(pending[0]!.signal.aborted).toBe(true);
    pending[1]!.resolve(row('https://example.invalid/new.jpg')); await settle();
    expect(Artwork('actor:profile:question:2')).toMatchObject({ id: question.id, title: 'Frozen question', imageUrl: 'https://example.invalid/new.jpg' });
    pending[0]!.resolve(row('https://example.invalid/old.jpg')); await settle();
    expect(Artwork('actor:profile:question:2')?.imageUrl).toBe('https://example.invalid/new.jpg');
    expect(Artwork('other-actor:profile:question:2')?.imageUrl).toBeUndefined();
    cleanup('artwork'); expect(pending[2]!.signal.aborted).toBe(true);
  });
});
