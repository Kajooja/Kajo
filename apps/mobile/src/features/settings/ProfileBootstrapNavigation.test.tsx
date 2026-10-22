/// <reference types="node" />
import React, { createContext, useContext, useEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileBootstrapGate } from './ProfileBootstrapGate';

const fixture = vi.hoisted(() => ({
  client: { rpc: vi.fn() },
  profile: { id: 'personal', type: 'PERSONAL', name: 'Personal', ownerUserId: 'actor' },
  storage: new Map<string, string>(),
}));
// npm hoists the renderer with its React peer. Use that same real React instance
// for the tested components rather than a second workspace-local copy.
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
const RouteContext = createContext({ segments: ['index'], setSegments: (_route: string[]) => {} });
vi.mock('expo-router', () => ({
  useSegments: () => useContext(RouteContext).segments,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Image: 'Image', Pressable: 'Pressable',
  SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('expo-sqlite/kv-store', () => ({ default: {
  getItemSync: (key: string) => fixture.storage.get(key) ?? null,
  setItemSync: (key: string, value: string) => fixture.storage.set(key, value),
} }));
vi.mock('@/data/SupabaseProvider', () => ({ useSupabaseConnection: () => ({
  status: 'configured', client: fixture.client, config: { url: 'https://fixture.example.invalid' },
}) }));
vi.mock('@/features/profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  personalProfile: fixture.profile, activeProfile: fixture.profile,
}) }));
vi.mock('@/features/discovery/DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU' }) }));
vi.mock('@/features/branding/KajoBrand', () => ({ KajoMark: 'KajoMark' }));
vi.mock('@/features/discovery/RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.mock('@/domain/discovery', async () => await import('../../domain/discovery'));
vi.mock('@/theme/roomTheme', async () => await import('../../theme/roomTheme'));
vi.mock('./PersonalTasteScreen', () => ({ PersonalTasteScreen: 'PersonalTasteScreen' }));

let root: ReactTestRenderer;
let mounts: number;
let unmounts: number;
const status = {
  profileId: 'personal', minimumStrongEvidence: 6, initialCandidateCount: 6,
  maximumCandidateCount: 8, strongEvidenceCount: 10, importedStrongCount: 0,
  calibrationRatingCount: 10, nativeStrongCount: 0, needsCalibration: false,
  realMovieCount: 30, realBookCount: 30, calibrationAvailable: true,
  priorVersion: 'cold-start-prior-v1', version: 'cold-start-v1',
};

// Real React reconciliation and local navigation state, with native/router I/O
// substituted. A new navigator mount loses its current route, as on the phone.
function NavigatorProbe() {
  const [route, setRoute] = useState('index');
  const { setSegments } = useContext(RouteContext);
  useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
  return React.createElement('div', { route, navigate: (next: string) => {
    setRoute(next); setSegments(next.split('/'));
  } });
}
function Harness() {
  const [segments, setSegments] = useState(['index']);
  return <RouteContext.Provider value={{ segments, setSegments }}>
    <ProfileBootstrapGate><NavigatorProbe /></ProfileBootstrapGate>
  </RouteContext.Provider>;
}
async function navigate(route: string) {
  await act(async () => { root.root.findByType('div').props.navigate(route); });
}

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mounts = 0; unmounts = 0;
  fixture.storage.clear();
  fixture.storage.set('kajo:personal-taste:v1:https%3A%2F%2Ffixture.example.invalid:actor:personal',
    JSON.stringify({ version: 2, protocol: 'v2', sessionId: null, challengeId: null, pending: null, dismissed: true }));
  fixture.client.rpc.mockReset().mockResolvedValue({ data: status, error: null });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); });

describe('mounted bootstrap navigation continuity', () => {
  it.each([1, 2])('keeps the same navigator across application routes with persisted v%s dismissal', async (version) => {
    if (version === 1) {
      for (const [key, raw] of fixture.storage) {
        const stored = JSON.parse(raw);
        delete stored.protocol;
        fixture.storage.set(key, JSON.stringify({ ...stored, version: 1 }));
      }
    }
    await act(async () => { root = create(<Harness />); });
    const initialMounts = mounts;
    const initialUnmounts = unmounts;
    const stored = [...fixture.storage];
    for (const route of ['discovery/movies', 'discovery/books', 'discovery/[itemId]',
      'lists', 'lists/history', 'settings', 'discovery/movies', 'index']) {
      await navigate(route);
      expect(root.root.findByType('div').props.route).toBe(route);
      expect(mounts).toBe(initialMounts);
      expect(unmounts).toBe(initialUnmounts);
    }
    expect([...fixture.storage]).toEqual(stored);
    expect(fixture.client.rpc.mock.calls.every(([name]) => name === 'get_profile_bootstrap_status_v1')).toBe(true);
  });

  it('preserves navigation while a route status refresh is slow or fails', async () => {
    await act(async () => { root = create(<Harness />); });
    const initialMounts = mounts;
    let resolve!: (value: unknown) => void;
    fixture.client.rpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await navigate('discovery/movies');
    expect(root.root.findByType('div').props.route).toBe('discovery/movies');
    await navigate('discovery/books');
    await act(async () => { resolve({ data: null, error: { message: 'Offline' } }); });
    expect(root.root.findByType('div').props.route).toBe('discovery/books');
    expect(mounts).toBe(initialMounts);
  });
});
