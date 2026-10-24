import {
  isPendingItemAction,
  type ItemActionReceipt,
  type ItemActionScope,
  type PendingItemAction,
} from './itemActionCommands';
import type { ItemActionResult } from './itemActionPersistence';

export interface ItemActionStorage {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): void;
}

export interface ItemActionOutboxSnapshot {
  pendingCount: number;
  message: string | null;
  ready: boolean;
  canDiscardUndo: boolean;
  canDiscardAction: boolean;
}

export interface PendingQueuedAction {
  command: ItemActionScope & { actionId: string; kind: string };
}

export interface ItemActionOutbox<TEntry extends PendingQueuedAction = PendingItemAction> {
  start(): void;
  stop(): void;
  enqueue(entry: TEntry): boolean;
  reserve(actionId: string): boolean;
  release(actionId?: string): void;
  canCancelReserved(actionId: string): boolean;
  cancelReserved(actionId: string): boolean;
  retry(): void;
  resumeAfterExposure(): void;
  discardRejectedUndo(): boolean;
  discardRejectedAction(): boolean;
  pending(): readonly TEntry[];
  snapshot(): ItemActionOutboxSnapshot;
  waitForIdle(): Promise<void>;
}

const STORAGE_ERROR = 'Valintajonon avaaminen tai tallentaminen epäonnistui. Valintaa ei kuitattu; yritä uudelleen.';
const MAX_PENDING = 256;
const MAX_STORED_BYTES = 1_048_576;
// A newly started coordinator can replay the same durable queue immediately.
// Its predecessor therefore loses proof that a held command is still unsent.
const reservationOwners = new Map<string, object>();

export function createItemActionOutbox<TEntry extends PendingQueuedAction = PendingItemAction, TReceipt = ItemActionReceipt>(options: {
  namespace: string;
  scope: ItemActionScope;
  storage: ItemActionStorage;
  send: (command: TEntry['command']) => Promise<ItemActionResult<TReceipt>>;
  onChange: (snapshot: ItemActionOutboxSnapshot) => void;
  onCommitted: (receipt: TReceipt) => void;
  isCurrent?: () => boolean;
  isPendingAction?: (value: unknown, scope: ItemActionScope) => value is TEntry;
}): ItemActionOutbox<TEntry> {
  const key = `kajo:item-actions:v1:${encodeURIComponent(options.namespace)}:${options.scope.actorUserId}:${options.scope.profileId}`;
  const reservationOwner = {};
  let active = false;
  let ready = true;
  let blocked = false;
  let rejectedEntry: TEntry | null = null;
  let pending: TEntry[] = [];
  let message: string | null = null;
  let attempt = 0;
  let flight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let waitingForExposure = false;
  let exposureChangedDuringFlight = false;
  // The command itself is already durable. Only its permission to dispatch is
  // held in this coordinator, so a fresh process automatically replays it.
  // A reservation can only precede a new admission; an uncertain write may
  // never be converted back into a cancellable local-only choice.
  const reservations = new Map<string, string | null>();
  const knownActionIds = new Set<string>();
  const isValid = options.isPendingAction ?? (isPendingItemAction as unknown as
    (value: unknown, scope: ItemActionScope) => value is TEntry);

  function read(): TEntry[] {
    const raw = options.storage.getItemSync(key);
    if (raw && raw.length > MAX_STORED_BYTES) throw new Error('Outbox too large');
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_PENDING
      || !parsed.every(entry => isValid(entry, options.scope))
      || new Set(parsed.map(entry => entry.command.actionId)).size !== parsed.length) {
      throw new Error('Invalid persisted action queue');
    }
    parsed.forEach(entry => knownActionIds.add(entry.command.actionId));
    return parsed;
  }

  function write(entries: TEntry[]) {
    const serialized = JSON.stringify(entries);
    if (entries.length > MAX_PENDING || serialized.length > MAX_STORED_BYTES) throw new Error('Outbox full');
    options.storage.setItemSync(key, serialized);
    pending = entries;
  }

  function snapshot(): ItemActionOutboxSnapshot {
    return { pendingCount: pending.length, message, ready,
      canDiscardUndo: blocked && rejectedEntry?.command.kind === 'UNDO',
      canDiscardAction: blocked && rejectedEntry !== null };
  }

  function publish() {
    if (active && options.isCurrent?.() !== false) options.onChange(snapshot());
  }

  function reload() {
    try { pending = read(); ready = true; }
    catch { ready = false; message = STORAGE_ERROR; }
  }

  function drain() {
    if (!active || options.isCurrent?.() === false || !ready || blocked || flight || timer) return;
    flight = (async () => {
      while (active && options.isCurrent?.() !== false && ready && !blocked) {
        reload();
        const entry = pending[0];
        if (!ready || !entry) break;
        if (reservations.has(entry.command.actionId)) break;
        let result: ItemActionResult<TReceipt>;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          result = await Promise.race([
            options.send(entry.command),
            new Promise<ItemActionResult<TReceipt>>(resolve => {
              deadline = setTimeout(() => resolve({ status: 'error', retryable: true,
                message: 'Tallennuksen vahvistus viipyy. Valinta säilyy jonossa ja sitä yritetään uudelleen.' }), 20_000);
            }),
          ]);
        }
        catch { result = { status: 'error', retryable: true, message: 'Valinta odottaa yhteyttä. Yritämme tallennusta uudelleen.' }; }
        finally { if (deadline) clearTimeout(deadline); }
        if (result.status === 'error') {
          // Waiting for our own exposure queue is normal pending work. Publishing
          // it as an error also settles collection waiters before the real receipt.
          waitingForExposure = result.retryable && result.waitingForExposure === true;
          message = waitingForExposure ? null : result.message;
          blocked = !result.retryable;
          rejectedEntry = result.rejectedAction === true || (result.rejectedUndo === true && entry.command.kind === 'UNDO') ? entry : null;
          if (active && result.retryable) {
            // Exposure acknowledgement normally wakes this immediately. Its
            // fallback timer must not increase network-failure backoff.
            const delay = waitingForExposure ? 1_000 : Math.min(30_000, 1_000 * 2 ** Math.min(attempt++, 5));
            timer = setTimeout(() => { timer = null; drain(); }, delay);
          }
          break;
        }
        try {
          // Re-read after await: an enqueue or a new coordinator can have
          // appended while this request was in flight. Never overwrite it.
          const current = read();
          const acknowledged = current.find(row => row.command.actionId === entry.command.actionId);
          if (acknowledged && JSON.stringify(acknowledged) !== JSON.stringify(entry)) throw new Error('Acknowledged payload changed');
          write(current.filter(row => row.command.actionId !== entry.command.actionId));
        } catch { ready = false; message = STORAGE_ERROR; break; }
        message = null;
        waitingForExposure = false;
        attempt = 0;
        if (active && options.isCurrent?.() !== false) options.onCommitted(result.receipt);
        publish();
      }
    })().finally(() => {
      flight = null;
      publish();
      const resume = waitingForExposure && exposureChangedDuringFlight;
      exposureChangedDuringFlight = false;
      if (resume) resumeAfterExposure();
      if (pending.length > 0 && !reservations.has(pending[0]!.command.actionId)) drain();
    });
  }

  reload();
  function resumeAfterExposure() {
    if (!active || options.isCurrent?.() === false) return;
    // The Event can finish while the guarded sender is returning "wait".
    // Remember that notification until the in-flight result is classified.
    if (flight) { exposureChangedDuringFlight = true; return; }
    if (!waitingForExposure) return;
    if (timer) clearTimeout(timer);
    timer = null;
    waitingForExposure = false;
    drain();
  }
  function discardRejectedAction() {
    if (!active || options.isCurrent?.() === false || !blocked || !rejectedEntry) return false;
    try {
      const current = read();
      if (!current[0] || JSON.stringify(current[0]) !== JSON.stringify(rejectedEntry)) return false;
      write(current.slice(1));
    } catch { ready = false; message = STORAGE_ERROR; publish(); return false; }
    // Rehydrate before the remaining queue resumes; this is never an uncertain ack.
    active = false;
    return true;
  }
  function canCancelReserved(actionId: string) {
    if (!active || options.isCurrent?.() === false || !ready || reservationOwners.get(key) !== reservationOwner ||
      !reservations.has(actionId)) return false;
    // This is a render-time hint, not cancellation authority. The mutation
    // re-reads and verifies exact persisted bytes before removing anything.
    return reservations.get(actionId) !== null && pending.some(entry => entry.command.actionId === actionId);
  }
  return {
    snapshot,
    start() {
      // Once another owner could have dispatched, restarting this instance
      // cannot recover its earlier proof of an unsent command.
      if (reservationOwners.get(key) !== reservationOwner) reservations.clear();
      reservationOwners.set(key, reservationOwner); active = true; publish(); drain();
    },
    stop() {
      active = false;
      if (timer) clearTimeout(timer);
      timer = null;
      reservations.clear();
      if (reservationOwners.get(key) === reservationOwner) reservationOwners.delete(key);
      // In-flight acknowledgements may remove their own delivered command;
      // queued work and callbacks stay suspended for this scope.
    },
    enqueue(entry) {
      if (!active || options.isCurrent?.() === false || !ready) return false;
      try {
        const copy: unknown = JSON.parse(JSON.stringify(entry));
        if (!isValid(copy, options.scope)) throw new Error('Invalid action');
        const current = read();
        const existing = current.find(row => row.command.actionId === copy.command.actionId);
        if (existing && JSON.stringify(existing) !== JSON.stringify(copy)) throw new Error('Action ID reused');
        if (!existing) {
          write([...current, copy]);
          knownActionIds.add(copy.command.actionId);
          if (reservations.has(copy.command.actionId)) reservations.set(copy.command.actionId, JSON.stringify(copy));
        }
      } catch { ready = false; message = STORAGE_ERROR; publish(); return false; }
      publish();
      drain();
      return true;
    },
    reserve(actionId) {
      if (!active || options.isCurrent?.() === false || !ready || reservationOwners.get(key) !== reservationOwner ||
        !actionId || actionId.length > 128 ||
        reservations.size >= MAX_PENDING || reservations.has(actionId)) return false;
      try {
        // Include commands recovered/appended by another coordinator before
        // deciding whether this is a genuinely new local admission.
        read();
        if (knownActionIds.has(actionId)) return false;
        reservations.set(actionId, null);
        return true;
      } catch { ready = false; message = STORAGE_ERROR; publish(); return false; }
    },
    release(actionId) {
      if (actionId === undefined) reservations.clear();
      else reservations.delete(actionId);
      drain();
    },
    canCancelReserved,
    cancelReserved(actionId) {
      if (!canCancelReserved(actionId)) return false;
      try {
        const current = read();
        const admitted = current.find(entry => entry.command.actionId === actionId);
        if (!admitted || JSON.stringify(admitted) !== reservations.get(actionId)) return false;
        write(current.filter(entry => entry.command.actionId !== actionId));
      } catch { ready = false; message = STORAGE_ERROR; publish(); return false; }
      reservations.delete(actionId);
      publish();
      drain();
      return true;
    },
    retry() {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = null;
      blocked = false;
      rejectedEntry = null;
      message = null;
      waitingForExposure = false;
      reload();
      publish();
      drain();
    },
    resumeAfterExposure,
    discardRejectedUndo() {
      return rejectedEntry?.command.kind === 'UNDO' && discardRejectedAction();
    },
    discardRejectedAction,
    pending() { reload(); return pending; },
    async waitForIdle() { while (flight) await flight; },
  };
}
