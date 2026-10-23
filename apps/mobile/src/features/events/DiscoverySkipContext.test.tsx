/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverySkipProvider, useDiscoverySkip } from './DiscoverySkipContext';
import type { ContextualSkipRpc, KajoSkipCommand, KajoSkipReceipt } from './contextualSkipOperations';
import type { createDiscoverySkipOutbox } from './contextualSkipOutbox';

const fixture = vi.hoisted(() => ({
  rows: new Map<string, string>(), rpc: vi.fn(),
  exposureReady: true, canSend: vi.fn(), exposureListeners: new Set<() => void>(),
  queues: [] as ReturnType<typeof createDiscoverySkipOutbox>[],
  connection: { status: 'configured', client: {}, config: { url: 'https://skip.fixture.invalid' } },
  profile: { status: 'ready', actorUserId: 'ab157000-0000-4000-8000-000000000001',
    activeProfile: { id: 'ab157000-0000-4000-8000-000000000002' } },
}));
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('../../data/SupabaseProvider', () => ({ useSupabaseConnection: () => fixture.connection }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => fixture.profile }));
vi.mock('./EventTrackingContext', () => {
  const subscribeToAcknowledgements = (listener: () => void) => {
    fixture.exposureListeners.add(listener); return () => { fixture.exposureListeners.delete(listener); };
  };
  return { useEventTracking: () => ({ canSendAction: fixture.canSend, subscribeToAcknowledgements }) };
});
vi.mock('expo-sqlite/kv-store', () => ({ default: {
  getItemSync: (key: string) => fixture.rows.get(key) ?? null,
  setItemSync: (key: string, value: string) => { fixture.rows.set(key, value); },
} }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('./contextualSkipOperations', async () => ({
  ...await vi.importActual<typeof import('./contextualSkipOperations')>('./contextualSkipOperations'),
  createContextualSkipRpc: () => fixture.rpc,
}));
vi.mock('./contextualSkipOutbox', async () => {
  const actual = await vi.importActual<typeof import('./contextualSkipOutbox')>('./contextualSkipOutbox');
  return { ...actual, createDiscoverySkipOutbox: (...args: Parameters<typeof actual.createDiscoverySkipOutbox>) => {
    const queue = actual.createDiscoverySkipOutbox(...args); fixture.queues.push(queue); return queue;
  } };
});

const id = (n: number) => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function command(n: number): KajoSkipCommand {
  return { version: 'kajo-contextual-skip-v1', kind: 'CONTEXTUAL_SKIP', actionId: id(10 + n),
    actorUserId: fixture.profile.actorUserId, profileId: fixture.profile.activeProfile.id,
    itemId: id(20 + n), occurredAt: String(1792144800000000n + BigInt(n)), contextRef: null, reversesActionId: null,
    origin: { surface: 'DISCOVERY', sessionId: id(3), predictionId: id(30 + n),
      deliveryRequestId: id(40 + n), impressionEventId: id(50 + n) } };
}
function receipt(c: KajoSkipCommand): KajoSkipReceipt {
  return { version: c.version, actionId: c.actionId, actorUserId: c.actorUserId, profileId: c.profileId,
    itemId: c.itemId, acceptedAt: '1792144800000100', policyVersion: 'contextual-skip-cooldown-v1',
    semantic: c.kind, reversesActionId: c.reversesActionId, evidence: 'CANONICAL_DISCOVERY_EVENT' };
}
type Reply = Awaited<ReturnType<ContextualSkipRpc>>;
function successful(c: KajoSkipCommand): Reply { return { data: receipt(c), error: null }; }
function deferred() {
  let resolve!: (reply: Reply) => void;
  const promise = new Promise<Reply>(done => { resolve = done; }); return { promise, resolve };
}
let renderer: ReactTestRenderer | null = null;
let state: ReturnType<typeof useDiscoverySkip>;
function Probe() {
  const current = useDiscoverySkip();
  React.useLayoutEffect(() => { state = current; }, [current]);
  return null;
}
async function mount() {
  await act(async () => { renderer = create(<DiscoverySkipProvider><Probe /></DiscoverySkipProvider>); });
}
async function unmount() {
  await act(async () => { renderer?.unmount(); renderer = null; });
}
function persisted() { return JSON.parse([...fixture.rows.values()][0] ?? '[]') as { command: KajoSkipCommand }[]; }
beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.rows.clear(); fixture.rpc.mockReset(); fixture.queues = [];
  fixture.exposureReady = true; fixture.canSend.mockReset();
  fixture.canSend.mockImplementation(() => fixture.exposureReady); fixture.exposureListeners.clear();
});
afterEach(async () => {
  await unmount(); fixture.queues.forEach(queue => queue.stop()); vi.unstubAllGlobals();
});

describe('background Discovery skip provider', () => {
  it('keeps rapid skips quiet until their exact persisted impressions acknowledge', async () => {
    const c = command(1); fixture.exposureReady = false;
    fixture.rpc.mockImplementation(async (_name: string, args: { command: KajoSkipCommand }) => successful(args.command));
    await mount();
    await act(async () => { expect(state.submit(c)).toBe(true); await fixture.queues[0]!.waitForIdle(); });
    expect(state.pendingCount).toBe(1); expect(state.message).toBeNull();
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.canSend).toHaveBeenCalledWith({ actorUserId: c.actorUserId, profileId: c.profileId,
      itemId: c.itemId, predictionId: c.origin.surface === 'DISCOVERY' ? c.origin.predictionId : null,
      session: { sessionId: c.origin.sessionId }, occurredAt: '2026-10-16T10:00:00.000Z' });
    await act(async () => {
      fixture.exposureReady = true; fixture.exposureListeners.forEach(listener => listener());
      await fixture.queues[0]!.waitForIdle();
    });
    expect(fixture.rpc).toHaveBeenCalledExactlyOnceWith('commit_discovery_contextual_skip_v1', { command: c }, undefined);
    expect(state.pendingCount).toBe(0); expect(state.message).toBeNull();
  });

  it('durably admits three displayed-card commands before the first reply and drains exact FIFO', async () => {
    const first = deferred(); const commands = [command(1), command(2), command(3)];
    fixture.rpc.mockImplementation(async (_name: string, args: { command: KajoSkipCommand }) =>
      args.command.actionId === commands[0]!.actionId ? first.promise : successful(args.command));
    await mount(); const committed = vi.fn(); const unsubscribe = state.subscribe(committed);
    await act(async () => {
      for (const c of commands) expect(state.submit(c)).toBe(true);
      expect(persisted().map(row => row.command)).toEqual(commands);
    });
    expect(state.pendingCount).toBe(3); expect(state.message).toBeNull();
    expect(fixture.rpc).toHaveBeenCalledOnce(); expect(committed).not.toHaveBeenCalled();
    await act(async () => { first.resolve(successful(commands[0]!)); await fixture.queues[0]!.waitForIdle(); });
    expect(fixture.rpc.mock.calls.map(call => call[1])).toEqual(commands.map(c => ({ command: c })));
    expect(committed.mock.calls.map(call => call[0])).toEqual(commands.map(receipt));
    expect(state.pendingCount).toBe(0); expect(persisted()).toEqual([]);
    expect(state.discardRejected()).toBeNull(); unsubscribe();
  });

  it('restarts a lost-reply batch with each original Item, delivery, impression and action identity', async () => {
    const first = deferred(); const commands = [command(1), command(2), command(3)];
    fixture.rpc.mockReturnValueOnce(first.promise);
    await mount();
    await act(async () => { for (const c of commands) expect(state.submit(c)).toBe(true); });
    await act(async () => {
      first.resolve({ data: null, error: { code: '08006', message: 'lost reply' } });
      await fixture.queues[0]!.waitForIdle();
    });
    expect(persisted().map(row => row.command)).toEqual(commands);
    expect(state.message).not.toBeNull(); expect(state.submit(command(4))).toBe(false);
    const staleSubmit = state.submit; await unmount(); expect(staleSubmit(command(4))).toBe(false);
    fixture.rpc.mockImplementation(async (_name: string, args: { command: KajoSkipCommand }) => successful(args.command));
    await mount();
    await act(async () => { await fixture.queues[1]!.waitForIdle(); });
    expect(fixture.rpc.mock.calls.map(call => call[1])).toEqual([commands[0], ...commands].map(c => ({ command: c })));
    expect(state.pendingCount).toBe(0); expect(state.message).toBeNull();
  });

  it('keeps a definitively rejected head and its suffix until explicit recovery', async () => {
    const first = deferred(); const a = command(1), b = command(2);
    fixture.rpc.mockReturnValueOnce(first.promise);
    await mount();
    await act(async () => { expect(state.submit(a)).toBe(true); expect(state.submit(b)).toBe(true); });
    await act(async () => {
      first.resolve({ data: null, error: { code: 'KJ002', message: 'source unavailable' } });
      await fixture.queues[0]!.waitForIdle();
    });
    expect(state.canDiscardAction).toBe(true); expect(state.submit(command(3))).toBe(false);
    expect(persisted().map(row => row.command)).toEqual([a, b]); expect(fixture.rpc).toHaveBeenCalledOnce();
    fixture.rpc.mockImplementation(async (_name: string, args: { command: KajoSkipCommand }) => successful(args.command));
    await act(async () => { expect(state.discardRejected()).toBe(a.actionId); await fixture.queues[0]!.waitForIdle(); });
    expect(fixture.rpc.mock.calls.map(call => call[1])).toEqual([{ command: a }, { command: b }]);
    expect(state.pendingCount).toBe(0);
  });
});
