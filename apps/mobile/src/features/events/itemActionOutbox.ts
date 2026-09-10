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
  retry(): void;
  discardRejectedUndo(): boolean;
  discardRejectedAction(): boolean;
  pending(): readonly TEntry[];
  snapshot(): ItemActionOutboxSnapshot;
  waitForIdle(): Promise<void>;
}

const STORAGE_ERROR = 'Valintajonon avaaminen tai tallentaminen epäonnistui. Valintaa ei kuitattu; yritä uudelleen.';
const MAX_PENDING = 256;
const MAX_STORED_BYTES = 1_048_576;

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
  let active = false;
  let ready = true;
  let blocked = false;
  let rejectedEntry: TEntry | null = null;
  let pending: TEntry[] = [];
  let message: string | null = null;
  let attempt = 0;
  let flight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
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
          message = result.retryable && result.waitingForExposure ? null : result.message;
          blocked = !result.retryable;
          rejectedEntry = result.rejectedAction === true || (result.rejectedUndo === true && entry.command.kind === 'UNDO') ? entry : null;
          if (active && result.retryable) {
            const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt++, 5));
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
        attempt = 0;
        if (active && options.isCurrent?.() !== false) options.onCommitted(result.receipt);
        publish();
      }
    })().finally(() => {
      flight = null;
      publish();
      if (pending.length > 0) drain();
    });
  }

  reload();
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
  return {
    snapshot,
    start() { active = true; publish(); drain(); },
    stop() {
      active = false;
      if (timer) clearTimeout(timer);
      timer = null;
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
        if (!existing) write([...current, copy]);
      } catch { ready = false; message = STORAGE_ERROR; publish(); return false; }
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
      reload();
      publish();
      drain();
    },
    discardRejectedUndo() {
      return rejectedEntry?.command.kind === 'UNDO' && discardRejectedAction();
    },
    discardRejectedAction,
    pending() { reload(); return pending; },
    async waitForIdle() { while (flight) await flight; },
  };
}
