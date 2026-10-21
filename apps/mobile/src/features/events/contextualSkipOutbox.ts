import { createItemActionOutbox, type ItemActionOutboxSnapshot, type ItemActionStorage } from './itemActionOutbox';
import type { ItemActionScope } from './itemActionCommands';
import { isNativeContextualSkipCommand, sendContextualSkip, type ContextualSkipRpc, type KajoSkipCommand, type KajoSkipReceipt } from './contextualSkipOperations';
import { notifyContextualSkipChanged } from '../discovery/predictionRefresh';

export interface PendingDiscoverySkip { command: KajoSkipCommand }
function isPendingDiscoverySkip(value: unknown, scope: ItemActionScope): value is PendingDiscoverySkip {
  if (!value || typeof value !== 'object' || Object.keys(value).join() !== 'command' || !('command' in value) ||
    !isNativeContextualSkipCommand(value.command)) return false;
  return value.command.origin.surface === 'DISCOVERY' && value.command.actorUserId === scope.actorUserId && value.command.profileId === scope.profileId;
}

// The scope-level provider recovers commands through restart. A caller obtains
// the acknowledged native source before enqueueing and retains it on all retries.
// Taste uses its own existing single-command controller, never this queue.
export function createDiscoverySkipOutbox(options: {
  namespace: string; scope: ItemActionScope; storage: ItemActionStorage; rpc: ContextualSkipRpc;
  isCurrent: () => boolean; onChange: (snapshot: ItemActionOutboxSnapshot) => void;
  onCommitted: (receipt: KajoSkipReceipt) => void;
}) {
  return createItemActionOutbox<PendingDiscoverySkip, KajoSkipReceipt>({ ...options,
    namespace: JSON.stringify(['discovery-contextual-skip-v1', options.namespace]),
    isPendingAction: isPendingDiscoverySkip, send: command => sendContextualSkip(options.rpc, command),
    onCommitted(receipt) { notifyContextualSkipChanged(); options.onCommitted(receipt); } });
}
