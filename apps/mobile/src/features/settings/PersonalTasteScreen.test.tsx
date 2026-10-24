import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoomTheme } from '../../theme/roomTheme';
import { PersonalTasteScreen } from './PersonalTasteScreen';
import { FeedRatingFrame, FeedScreenDock, FeedScreenFrame, FeedScreenHeader, FeedScreenViewport } from '../discovery/FeedScreenFrame';
import type { PersonalTasteSnapshot } from './personalTasteFlow';
import { sendTasteCommand } from './personalTasteOperations';
import { id, profileId, sessionId, sessionResponse, challengeResponse, sequentialResponse } from './personalTasteTestFixtures';

const layout = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock('../discovery/DiscoveryBackdrop', () => ({ DiscoveryBackdrop: 'DiscoveryBackdrop' }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useState: (initial: unknown) => {
    const index = layout.index++;
    if (!(index in layout.values)) layout.values[index] = typeof initial === 'function' ? initial() : initial;
    return [layout.values[index], (value: unknown) => {
      layout.values[index] = typeof value === 'function' ? value(layout.values[index]) : value;
    }];
  },
}));
beforeEach(() => { layout.index = 0; layout.values = []; });
function render(p: React.ComponentProps<typeof PersonalTasteScreen>) {
  layout.index = 0;
  return PersonalTasteScreen(p);
}

vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (v: unknown) => v, hairlineWidth: 0.5 } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../branding/KajoBrand', () => ({ KajoMark: 'KajoMark' }));
vi.mock('../discovery/RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.mock('../discovery/FeedItemCard', () => ({ FeedItemCard: 'FeedItemCard' }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
type Props = { children?: ReactNode; titleAction?: ReactNode; onPress?: () => void; disabled?: boolean };
const frameComponents = new Set<unknown>([FeedScreenFrame, FeedScreenHeader, FeedScreenDock, FeedScreenViewport, FeedRatingFrame]);
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child) ? [child, ...elements(
    frameComponents.has(child.type) ? (child.type as (props: Props) => ReactNode)(child.props)
      : [child.props.children, child.props.titleAction])] : []);
}
function text(node: ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<Props>(child) ? text(child.props.children) : String(child)).join(' ').replace(/\s+/g, ' ').trim();
}
function button(tree: ReactNode, label: string) {
  const found = elements(tree).find(e => e.type === 'Pressable' && text(e.props.children) === label);
  expect(found, `missing ${label}`).toBeDefined(); return found!.props;
}
async function state(data: unknown, challenge = false, sequential = false): Promise<PersonalTasteSnapshot> {
  const response = await sendTasteCommand(async () => ({ data, error: null }), {
    functionName: sequential ? 'taste_session_v2' : challenge ? 'taste_challenge_v1' : 'taste_session_v1',
    request: { operation: 'START', profileId, requestId: id(9), ...(challenge ? { sessionId } : {}) } }, new AbortController().signal);
  expect(response.status).toBe('success');
  if (response.status !== 'success') throw Error('Invalid test fixture');
  return { sequential: response.response.kind === 'sequential' ? response.response.value : null, session: response.response.kind === 'session' ? response.response.value : null,
    challenge: response.response.kind === 'challenge' ? response.response.value : null,
    busy: false, pending: false, legacy: false, dismissed: false, conflict: false, blocked: false, needsStart: false, message: null };
}
function props(snapshot: PersonalTasteSnapshot): React.ComponentProps<typeof PersonalTasteScreen> {
  return { state: snapshot, theme: getRoomTheme('DAWN'), begun: true, draftRating: null, confirmRemoval: false,
    onBegin: vi.fn(), onDraftChange: vi.fn(), onAnswer: vi.fn(), onBooks: vi.fn(), onChallenge: vi.fn(),
    onRetry: vi.fn(), onReload: vi.fn(), onContinue: vi.fn(), onOpenImport: vi.fn(), onAskRemoval: vi.fn(),
    onCancelRemoval: vi.fn(), onRemove: vi.fn() };
}

describe('owned Taste screen interactions', () => {
  it('requires a deliberate rating and submits zero independently of unknown after a drag', async () => {
    const p = props(await state(sessionResponse()));
    expect(button(render(p), 'Tallenna arvio ja jatka').disabled).toBe(true);
    p.draftRating = 0;
    const zero = button(render(p), 'Tallenna arvio ja jatka'); expect(zero.disabled).toBe(false); zero.onPress!();
    expect(p.onAnswer).toHaveBeenLastCalledWith({ kind: 'RATING', value: 0 });
    p.draftRating = 7; const unknown = button(render(p), 'En tunne'); expect(unknown.disabled).toBe(false); unknown.onPress!();
    expect(p.onAnswer).toHaveBeenLastCalledWith({ kind: 'UNKNOWN' });
  });
  it('does not offer old six-rating completion while the retained server session is active', async () => {
    const p = props(await state(sessionResponse(Array.from({ length: 6 }, () => ({ kind: 'RATING', value: 8 })))));
    const copy = text(render(p)); expect(copy).toContain('arvioita 6'); expect(copy).not.toContain('Jatka ennustehaasteeseen');
    expect(copy).not.toContain('Valmis · tallenna');
  });
  it('requires explicit movie-to-book acknowledgement instead of rendering an invented next card', async () => {
    const p = props(await state(sessionResponse([], 'TRANSITION'))); const tree = render(p);
    expect(text(tree)).toContain('Seuraavaksi kirjat'); button(tree, 'Jatka kirjoihin').onPress!(); expect(p.onBooks).toHaveBeenCalledOnce();
    expect(elements(tree).some(e => e.type === 'RatingControl')).toBe(false);
  });
  it('keeps forecast/result copy hidden while first answers are pending and presents honest counts after completion', async () => {
    const active = render(props(await state(challengeResponse(), true)));
    expect(text(active)).toContain('ennuste on lukittu'); expect(text(active)).not.toContain('Kierroksen järjestysvertailu');
    const complete = render(props(await state(challengeResponse([{ kind: 'RATING', value: 0 }, { kind: 'RATING', value: 5 }, { kind: 'UNKNOWN' }]), true)));
    expect(text(complete)).toContain('Arvioit 2 teosta 3 teoksesta'); expect(text(complete)).toContain('Puuttuva ennuste');
    expect(text(complete)).not.toMatch(/\d\s*%/);
  });
  it('disables a new answer during an unacknowledged command and requires confirmation before removal', async () => {
    const p = props(await state(sessionResponse())); p.draftRating = 0; p.state.pending = true;
    expect(button(render(p), 'En tunne').disabled).toBe(true);
    p.state.pending = false; button(render(p), 'Poista makutesti').onPress!(); expect(p.onAskRemoval).toHaveBeenCalledOnce();
    expect(p.onRemove).not.toHaveBeenCalled(); p.confirmRemoval = true;
    button(render(p), 'Vahvista makutestin poisto').onPress!(); expect(p.onRemove).toHaveBeenCalledOnce();
  });
});


describe('continuous Taste presentation', () => {
  it('offers Discovery during a question with honest progress and no quota/challenge/confidence claim', async () => {
    const p = props(await state(sequentialResponse('QUESTION', 10, 4), false, true));
    const tree = render(p); const copy = text(tree);
    const header = elements(tree).find(e => (e.props as { accessibilityRole?: string }).accessibilityRole === 'header');
    expect((header?.props as { accessibilityLabel?: string }).accessibilityLabel).toContain('Tallennettuja vastauksia: 4');
    expect((header?.props as { accessibilityLabel?: string }).accessibilityLabel).toContain('Ennuste on vielä alustava');
    expect(elements(tree).some(e => e.type === 'KajoMark' || e.type === 'ScrollView')).toBe(false);
    expect(copy).not.toContain('Tallenna arvio ja jatka');
    expect(copy).not.toMatch(/24|48|ennustehaasteeseen|\d\s*%/);
    button(tree, 'Jatka selaamaan').onPress!(); expect(p.onContinue).toHaveBeenCalledOnce();
    p.state.pending = true; p.state.message = 'Yhteys katkesi';
    expect(elements(render(p)).filter(e => e.type === 'Pressable' && text(e.props.children) === 'Jatka selaamaan')
      .every(e => e.props.disabled)).toBe(true);
  });
  it('keeps a concurrent server advance explicitly retryable', async () => {
    const p = props(await state(sequentialResponse('NEEDS_NEXT', 3, 1), false, true));
    button(render(p), 'Hae seuraava kysymys').onPress!(); expect(p.onRetry).toHaveBeenCalledOnce();
  });
  it('offers explicit paused continuation and never calls an insufficient stop ready', async () => {
    const paused = props(await state(sequentialResponse('PAUSED', 7, 2), false, true));
    button(render(paused), 'Jatka makutestiä').onPress!(); expect(paused.onBegin).toHaveBeenCalledOnce();
    const stopped = render(props(await state(sequentialResponse('STOPPED', 80, 40), false, true)));
    expect(text(stopped)).toContain('Jatketaan tutustumista selaamalla'); expect(text(stopped)).not.toContain('Makutesti on valmis');
    expect(text(stopped)).not.toContain('Jatka ennustehaasteeseen'); expect(button(stopped, 'Jatka selaamaan').disabled).toBe(false);
  });
});


describe('shared Taste feed boundary', () => {
  it('commits a selected sequential rating directly, keeps zero, and never submits its default', async () => {
    const p = props(await state(sequentialResponse('QUESTION', 2, 0), false, true));
    p.helpScope = id(1);
    const tree = render(p);
    const rating = elements(tree).find(e => e.type === 'RatingControl') as ReactElement<{
      onRatingChange: (rating: number) => void; rating: number | null; disabled: boolean;
    }>;
    expect(rating.props.rating).toBeNull();
    expect(p.onAnswer).not.toHaveBeenCalled();
    rating.props.onRatingChange(0);
    expect(p.onDraftChange).toHaveBeenCalledExactlyOnceWith(0);
    expect(p.onAnswer).toHaveBeenCalledExactlyOnceWith({ kind: 'RATING', value: 0 });
    expect(text(tree)).not.toContain('Tallenna arvio ja jatka');
    p.state.pending = true;
    const pendingRating = elements(render(p)).find(e => e.type === 'RatingControl') as typeof rating;
    pendingRating.props.onRatingChange(9);
    expect(p.onAnswer).toHaveBeenCalledTimes(1);
  });
  it('measures only the bar-to-bar viewport and shares account help across questions', async () => {
    const p = props(await state(sequentialResponse('QUESTION', 10, 4), false, true));
    p.helpScope = id(1);
    const tree = render(p);
    const viewport = elements(tree).find(e => (e.props as { testID?: string }).testID === 'taste-feed-viewport') as ReactElement<{
      onLayout: (event: { nativeEvent: { layout: { height: number } } }) => void;
    }>;
    viewport.props.onLayout({ nativeEvent: { layout: { height: 620 } } });
    const card = elements(render(p)).find(e => e.type === 'FeedItemCard') as ReactElement<{
      helpScope: string; viewportHeight: number; hasInteracted: boolean; helpKind: string; onPrevious?: unknown;
    }>;
    expect(card.props.helpScope).toBe(id(1));
    expect(card.props.viewportHeight).toBe(620);
    expect(card.props.hasInteracted).toBe(true);
    expect(card.props.helpKind).toBe('taste');
    expect(card.props.onPrevious).toBeUndefined();
  });
  it('uses the Discovery safe frame and keeps continuation outside the measured card viewport', async () => {
    const p = props(await state(sequentialResponse('QUESTION', 10, 4), false, true));
    const tree = render(p);
    const all = elements(tree);
    const safeAreas = all.filter(e => e.type === 'SafeAreaView') as ReactElement<{ edges: string[] }>[];
    expect(safeAreas.map(e => e.props.edges)).toEqual([['left', 'right'], ['top'], ['bottom']]);
    expect(tree.type).toBe(FeedScreenFrame);
    const viewport = all.find(e => e.type === FeedScreenViewport)!;
    expect(elements(viewport).some(e => e.type === FeedRatingFrame)).toBe(true);
    expect(elements(viewport).some(e => e.type === 'Pressable' && text(e.props.children) === 'Jatka selaamaan')).toBe(false);
    const dock = all.find(e => e.type === FeedScreenDock)!;
    button(dock, 'Jatka selaamaan').onPress!();
    expect(p.onContinue).toHaveBeenCalledOnce();
    const card = all.find(e => e.type === 'FeedItemCard')!;
    const options = elements(card.props.titleAction).find(e => e.type === 'Pressable')!;
    expect((options.props as { accessibilityLabel: string }).accessibilityLabel).toBe('Makutestin valinnat');
    expect((options.props as { style: unknown }).style).toMatchObject({ width: 44, height: 44 });
  });
  it('keeps removal behind compact options with explicit confirmation', async () => {
    const p = props(await state(sequentialResponse('QUESTION', 10, 4), false, true));
    let tree = render(p);
    expect(text(tree)).not.toContain('Poista makutesti');
    const options = elements(tree).find(e => (e.props as { accessibilityLabel?: string }).accessibilityLabel === 'Makutestin valinnat')!;
    options.props.onPress!(); tree = render(p);
    expect((elements(tree).find(e => e.type === 'FeedItemCard')!.props as { disabled: boolean }).disabled).toBe(true);
    button(tree, 'Poista makutesti').onPress!();
    expect(p.onAskRemoval).toHaveBeenCalledOnce();
    expect(p.onRemove).not.toHaveBeenCalled();
    p.confirmRemoval = true;
    button(render(p), 'Vahvista makutestin poisto').onPress!();
    expect(p.onRemove).toHaveBeenCalledOnce();
  });
  it('uses the same artwork card and neutral adapter, including after a rating draft', async () => {
    const data = { ...sequentialResponse('QUESTION', 2, 0), contextualSkip: {
      version: 'kajo-contextual-skip-v1', policyVersion: 'contextual-skip-cooldown-v1', contextRef: null,
      origin: { surface: 'TASTE', sessionId, questionId: id(300), panelId: id(500), prefixRevision: 2 } } };
    const p = props(await state(data, false, true)); p.draftRating = 8; p.onSkip = vi.fn(() => true);
    p.presentationItem = { ...p.state.sequential!.item!, imageUrl: 'https://example.invalid/cover.jpg' };
    const tree = render(p);
    const card = elements(tree).find(e => e.type === 'FeedItemCard') as ReactElement<{ item: { imageUrl?: string }; disabled: boolean; onSkip: () => boolean }>;
    expect(card.props.item.imageUrl).toBe(p.presentationItem.imageUrl); expect(card.props.onSkip()).toBe(true);
    expect(p.onSkip).toHaveBeenCalledOnce(); expect(p.onAnswer).not.toHaveBeenCalled();
    expect(text(tree)).not.toContain('En tunne'); expect(text(tree)).not.toContain('Ei kiinnosta');
    p.state.pending = true;
    expect((elements(render(p)).find(e => e.type === 'FeedItemCard')!.props as { disabled: boolean }).disabled).toBe(true);
  });
  it('does not relabel missing new capability as legacy unknown or dislike', async () => {
    const p = props(await state(sequentialResponse('QUESTION', 2, 0), false, true)); p.onSkip = vi.fn(() => true);
    const tree = render(p);
    expect(text(tree)).toContain('Ohitus ei ole juuri nyt käytettävissä');
    expect((elements(tree).find(e => e.type === 'FeedItemCard')!.props as { onSkip?: unknown }).onSkip).toBeUndefined();
    expect(text(tree)).not.toContain('En tunne'); expect(text(tree)).not.toContain('Ei kiinnosta');
  });
});
