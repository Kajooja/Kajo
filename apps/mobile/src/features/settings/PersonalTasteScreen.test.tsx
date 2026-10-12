import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { getRoomTheme } from '../../theme/roomTheme';
import { PersonalTasteScreen } from './PersonalTasteScreen';
import type { PersonalTasteSnapshot } from './personalTasteFlow';
import { sendTasteCommand } from './personalTasteOperations';
import { id, profileId, sessionId, sessionResponse, challengeResponse } from './personalTasteTestFixtures';

vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (v: unknown) => v } }));
vi.mock('../branding/KajoBrand', () => ({ KajoMark: 'KajoMark' }));
vi.mock('../discovery/RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
type Props = { children?: ReactNode; onPress?: () => void; disabled?: boolean };
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<Props>(child) ? text(child.props.children) : String(child)).join(' ').replace(/\s+/g, ' ').trim();
}
function button(tree: ReactNode, label: string) {
  const found = elements(tree).find(e => e.type === 'Pressable' && text(e.props.children) === label);
  expect(found, `missing ${label}`).toBeDefined(); return found!.props;
}
async function state(data: unknown, challenge = false): Promise<PersonalTasteSnapshot> {
  const response = await sendTasteCommand(async () => ({ data, error: null }), {
    functionName: challenge ? 'taste_challenge_v1' : 'taste_session_v1',
    request: { operation: 'START', profileId, requestId: id(9), ...(challenge ? { sessionId } : {}) } }, new AbortController().signal);
  expect(response.status).toBe('success');
  if (response.status !== 'success') throw Error('Invalid test fixture');
  return { session: response.response.kind === 'session' ? response.response.value : null,
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
    expect(button(PersonalTasteScreen(p), 'Tallenna arvio ja jatka').disabled).toBe(true);
    p.draftRating = 0;
    const zero = button(PersonalTasteScreen(p), 'Tallenna arvio ja jatka'); expect(zero.disabled).toBe(false); zero.onPress!();
    expect(p.onAnswer).toHaveBeenLastCalledWith({ kind: 'RATING', value: 0 });
    p.draftRating = 7; const unknown = button(PersonalTasteScreen(p), 'En tunne'); expect(unknown.disabled).toBe(false); unknown.onPress!();
    expect(p.onAnswer).toHaveBeenLastCalledWith({ kind: 'UNKNOWN' });
  });
  it('does not offer old six-rating completion while the retained server session is active', async () => {
    const p = props(await state(sessionResponse(Array.from({ length: 6 }, () => ({ kind: 'RATING', value: 8 })))));
    const copy = text(PersonalTasteScreen(p)); expect(copy).toContain('arvioita 6'); expect(copy).not.toContain('Jatka ennustehaasteeseen');
    expect(copy).not.toContain('Valmis · tallenna');
  });
  it('requires explicit movie-to-book acknowledgement instead of rendering an invented next card', async () => {
    const p = props(await state(sessionResponse([], 'TRANSITION'))); const tree = PersonalTasteScreen(p);
    expect(text(tree)).toContain('Seuraavaksi kirjat'); button(tree, 'Jatka kirjoihin').onPress!(); expect(p.onBooks).toHaveBeenCalledOnce();
    expect(elements(tree).some(e => e.type === 'RatingControl')).toBe(false);
  });
  it('keeps forecast/result copy hidden while first answers are pending and presents honest counts after completion', async () => {
    const active = PersonalTasteScreen(props(await state(challengeResponse(), true)));
    expect(text(active)).toContain('ennuste on lukittu'); expect(text(active)).not.toContain('Kierroksen järjestysvertailu');
    const complete = PersonalTasteScreen(props(await state(challengeResponse([{ kind: 'RATING', value: 0 }, { kind: 'RATING', value: 5 }, { kind: 'UNKNOWN' }]), true)));
    expect(text(complete)).toContain('Arvioit 2 teosta 3 teoksesta'); expect(text(complete)).toContain('Puuttuva ennuste');
    expect(text(complete)).not.toMatch(/\d\s*%/);
  });
  it('disables a new answer during an unacknowledged command and requires confirmation before removal', async () => {
    const p = props(await state(sessionResponse())); p.draftRating = 0; p.state.pending = true;
    expect(button(PersonalTasteScreen(p), 'En tunne').disabled).toBe(true);
    p.state.pending = false; button(PersonalTasteScreen(p), 'Poista makutesti').onPress!(); expect(p.onAskRemoval).toHaveBeenCalledOnce();
    expect(p.onRemove).not.toHaveBeenCalled(); p.confirmRemoval = true;
    button(PersonalTasteScreen(p), 'Vahvista makutestin poisto').onPress!(); expect(p.onRemove).toHaveBeenCalledOnce();
  });
});
