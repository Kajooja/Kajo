import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../domain/contracts';
import { DiscoveryModeShell } from './DiscoveryModeShell';
import { BOTTOM_DOCK_HEIGHT, getDockPanelBottomInset } from './shellLayout';

const context = vi.hoisted(() => ({
  profile: { id: 'personal', name: 'Oma Kajo', type: 'PERSONAL', ownerUserId: 'actor' } as Profile,
  recordEvent: vi.fn(), setMode: vi.fn(), replace: vi.fn(),
}));
vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
}));
vi.mock('expo-router', () => ({ usePathname: () => '/discovery/movies',
  useRouter: () => ({ replace: context.replace, push: vi.fn() }) }));
vi.mock('expo-blur', () => ({ BlurTargetView: 'BlurTargetView', BlurView: 'BlurView' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  Alert: { alert: vi.fn() }, Animated: { Value: class { constructor(public value: number) {} } },
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5, absoluteFill: {} },
}));
vi.mock('../auth/AuthSessionProvider', () => ({ useAuthSession: () => ({ status: 'signed-in' }) }));
vi.mock('../branding/KajoBrand', () => ({ KajoMark: 'KajoMark' }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => ({ recordEvent: context.recordEvent }) }));
vi.mock('../profiles/BottomProfileControl', () => ({ BottomProfileControl: 'BottomProfileControl' }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  activeProfile: context.profile, personalProfile: context.profile, status: 'ready',
  selectableProfiles: [context.profile], invitations: [],
}) }));
vi.mock('../lists/ItemListsContext', () => ({ useItemLists: () => ({ lists: [] }) }));
vi.mock('../lists/listRecentUse', () => ({ loadMostUsedListIds: () => [], rememberRecentList: vi.fn() }));
vi.mock('../messages/ProfileMessagesContext', () => ({ useProfileMessages: () => ({ unreadTotal: 0 }) }));
vi.mock('../room/CurtainControl', () => ({ CurtainControl: 'CurtainControl' }));
vi.mock('../room/RoomScreen', () => ({ RoomBackdrop: 'RoomBackdrop', RoomInteractionLayer: 'RoomInteractionLayer' }));
vi.mock('./DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU', setMode: context.setMode }) }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

type Props = { children?: ReactNode; edges?: string[]; accessibilityLabel?: string;
  onPress?: () => void; onModeChange?: (mode: string) => void; style?: Record<string, unknown> | Record<string, unknown>[] };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(tree).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
function flatStyle(style: Props['style']) {
  return Object.assign({}, ...[style].flat());
}
function render() { return DiscoveryModeShell({ children: <ViewFixture /> }); }
function ViewFixture() { return null; }

beforeEach(() => {
  context.profile = { id: 'personal', name: 'Oma Kajo', type: 'PERSONAL', ownerUserId: 'actor' };
  vi.clearAllMocks();
});

describe('compact Discovery shell preserves its controls and safe bounds', () => {
  it('uses one top inset and one bottom inset with the existing compact dock', () => {
    const all = nodes(render());
    const safeAreas = all.filter(node => node.type === 'SafeAreaView');
    expect(safeAreas.map(node => node.props.edges)).toEqual([['top'], ['bottom']]);
    const dock = React.Children.toArray(safeAreas[1]!.props.children)[0] as ReactElement<Props>;
    expect(flatStyle(dock.props.style)).toMatchObject({ minHeight: BOTTOM_DOCK_HEIGHT });
    expect(getDockPanelBottomInset(24)).toBe(24 + BOTTOM_DOCK_HEIGHT + 8);
    expect(all.some(node => node.type === 'BottomProfileControl')).toBe(true);
    expect(all.some(node => node.props.accessibilityLabel === 'Avaa valikko')).toBe(true);
    expect(all.some(node => node.props.accessibilityLabel === 'Avaa postilaatikko')).toBe(true);
  });

  it('keeps the Home target reachable and the curtain authoritative for mode changes', () => {
    const all = nodes(render());
    all.find(node => node.props.accessibilityLabel?.startsWith('Palaa huoneeseen.'))!.props.onPress!();
    expect(context.replace).toHaveBeenCalledExactlyOnceWith('/');
    all.find(node => node.type === 'CurtainControl')!.props.onModeChange!('SURPRISE');
    expect(context.setMode).toHaveBeenCalledExactlyOnceWith('SURPRISE');
    expect(context.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'DISCOVERY_MODE_CHANGED', discoveryMode: 'SURPRISE',
    }));
  });

  it('places the Shared indicator in the curtain label row without another header tier', () => {
    context.profile = { id: 'shared', name: 'Yhteinen Kajo', type: 'SHARED', memberUserIds: ['actor', 'friend'] };
    const all = nodes(render());
    const labelRow = all.find(node => React.Children.toArray(node.props.children).some(child =>
      React.isValidElement<Props>(child) && child.props.accessibilityLabel === 'Ryhmätila: Yhteinen Kajo'))!;
    expect(React.Children.toArray(labelRow.props.children)).toHaveLength(3);
    expect(flatStyle(labelRow.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });
});
