import { createItemActionOutbox, type ItemActionOutboxSnapshot, type ItemActionStorage } from './itemActionOutbox';
import type { ItemActionScope } from './itemActionCommands';
import { isNativeContextualSkipCommand, sendContextualSkip, type ContextualSkipRpc, type KajoSkipCommand, type KajoSkipReceipt } from './contextualSkipOperations';
import { notifyContextualSkipChanged } from '../discovery/predictionRefresh';
import type { EventActionOrigin } from './eventTracking';

export interface PendingDiscoverySkip { command: KajoSkipCommand }
function isPendingDiscoverySkip(value: unknown, scope: ItemActionScope): value is PendingDiscoverySkip {
  if (!value || typeof value !== 'object' || Object.keys(value).join() !== 'command' || !('command' in value) ||
    !isNativeContextualSkipCommand(value.command)) return false;
  return value.command.origin.surface === 'DISCOVERY' && value.command.actorUserId === scope.actorUserId && value.command.profileId === scope.profileId;
}

// The scope-level provider recovers commands through restart. A caller obtains
// a durable displayed impression before enqueueing and retains it on all retries.
// Dispatch waits for that exact impression; the native writer then validates the
// source and resolves its immutable retry receipt in one transaction.
// Taste uses its own existing single-command controller, never this queue.
export function createDiscoverySkipOutbox(options: {
  namespace: string; scope: ItemActionScope; storage: ItemActionStorage; rpc: ContextualSkipRpc;
  isCurrent: () => boolean; onChange: (snapshot: ItemActionOutboxSnapshot) => void;
  onCommitted: (receipt: KajoSkipReceipt) => void;
  canSendAction?: (origin: EventActionOrigin) => boolean;
}) {
  return createItemActionOutbox<PendingDiscoverySkip, KajoSkipReceipt>({ ...options,
    namespace: JSON.stringify(['discovery-contextual-skip-v1', options.namespace]),
    isPendingAction: isPendingDiscoverySkip,
    async send(command) {
      const origin: EventActionOrigin = { actorUserId: command.actorUserId, profileId: command.profileId,
        itemId: command.itemId, predictionId: command.origin.surface === 'DISCOVERY' ? command.origin.predictionId : null,
        session: { sessionId: command.origin.sessionId },
        occurredAt: new Date(Number(BigInt(command.occurredAt) / 1000n)).toISOString() };
      if (options.canSendAction && (!options.isCurrent() || !options.canSendAction(origin))) {
        return { status: 'error', retryable: true, waitingForExposure: true,
          message: 'Ohitus odottaa alkuperäisen näyttötiedon tallennusta.' };
      }
      // Do not preflight acceptsNewSkip here: an earlier successful write may
      // have lost its reply. Only the writer can distinguish that exact retry
      // from a new command against a source that has since closed.
      return sendContextualSkip(options.rpc, command);
    },
    onCommitted(receipt) { notifyContextualSkipChanged(); options.onCommitted(receipt); } });
}
