import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useSupabaseConnection } from '../../data/SupabaseProvider';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { createDiscoverySkipOutbox } from './contextualSkipOutbox';
import { createContextualSkipRpc, type KajoSkipCommand, type KajoSkipReceipt } from './contextualSkipOperations';
import type { ItemActionOutboxSnapshot } from './itemActionOutbox';
import { useEventTracking } from './EventTrackingContext';

interface DiscoverySkipState extends ItemActionOutboxSnapshot {
  submit: (command: KajoSkipCommand) => boolean;
  reserve?: (actionId: string) => boolean;
  release?: (actionId?: string) => void;
  canCancelReserved?: (actionId: string) => boolean;
  cancelReserved?: (actionId: string) => boolean;
  retry: () => void;
  discardRejected: () => string | null;
  subscribe: (listener: (receipt: KajoSkipReceipt) => void) => () => void;
}
const empty: DiscoverySkipState = { ready: false, pendingCount: 0, message: null, canDiscardAction: false, canDiscardUndo: false,
  submit: () => false, retry: () => {}, discardRejected: () => null, subscribe: () => () => {} };
const Context = createContext<DiscoverySkipState>(empty);

// Scope-level lifecycle: leaving a card or restarting the app must not strand an
// accepted-but-unacknowledged command behind an expired navigation slate. Keep
// the original Event session in every retry, even after a new app session starts.
export function DiscoverySkipProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const profile = useActiveProfile();
  const tracking = useEventTracking();
  const { subscribeToAcknowledgements } = tracking;
  const exposure = useRef(tracking);
  useLayoutEffect(() => { exposure.current = tracking; }, [tracking]);
  const client = connection.status === 'configured' ? connection.client : null;
  const namespace = connection.status === 'configured' ? connection.config.url : '';
  const actorUserId = profile.status === 'ready' ? profile.actorUserId : null;
  const profileId = profile.status === 'ready' ? profile.activeProfile?.id : null;
  const scope = useMemo(() => ({ client, namespace, actorUserId, profileId }), [client, namespace, actorUserId, profileId]);
  const listeners = useRef(new Set<(receipt: KajoSkipReceipt) => void>());
  const [snapshot, setSnapshot] = useState<{ scope: object; value: DiscoverySkipState } | null>(null);
  const subscribe = useCallback((listener: (receipt: KajoSkipReceipt) => void) => {
    listeners.current.add(listener); return () => { listeners.current.delete(listener); };
  }, []);
  useLayoutEffect(() => {
    if (!scope.client || !scope.actorUserId || !scope.profileId) return;
    let active = true;
    const queue = createDiscoverySkipOutbox({ namespace: scope.namespace,
      scope: { actorUserId: scope.actorUserId, profileId: scope.profileId }, storage: Storage,
      rpc: createContextualSkipRpc(scope.client), isCurrent: () => active,
      canSendAction: origin => exposure.current.canSendAction(origin),
      onChange: value => { if (active) setSnapshot({ scope, value: { ...value, ...actions, subscribe } }); },
      onCommitted: receipt => listeners.current.forEach(listener => listener(receipt)),
    });
    const actions = {
      submit(command: KajoSkipCommand) {
        // A prepared successor can be dismissed while earlier exact commands
        // await their replies. enqueue persists each admission before returning;
        // the bounded outbox still sends them in order and owns recovery.
        const pending = queue.snapshot();
        if (!active || !pending.ready || pending.message) return false;
        return queue.enqueue({ command });
      },
      reserve(actionId: string) { return active && queue.reserve(actionId); },
      release(actionId?: string) { if (active) queue.release(actionId); },
      canCancelReserved(actionId: string) { return active && queue.canCancelReserved(actionId); },
      cancelReserved(actionId: string) { return active && queue.cancelReserved(actionId); },
      retry() { if (active) { queue.release(); queue.retry(); } },
      discardRejected() {
        if (!active) return null;
        const actionId = queue.pending()[0]?.command.actionId;
        if (!actionId || !queue.discardRejectedAction()) return null;
        queue.start(); queue.retry(); return actionId;
      },
    };
    queue.start();
    const unsubscribeExposure = subscribeToAcknowledgements(() => queue.resumeAfterExposure());
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') queue.retry(); else queue.release(); });
    return () => { active = false; queue.stop(); subscription.remove(); unsubscribeExposure(); };
  }, [scope, subscribe, subscribeToAcknowledgements]);
  const value = snapshot?.scope === scope ? snapshot.value : { ...empty, subscribe };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useDiscoverySkip = () => useContext(Context);
