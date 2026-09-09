import {
  isPendingItemAction,
  type ItemActionCommand,
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
}

export interface ItemActionOutbox {
  start(): void;
  stop(): void;
  enqueue(entry: PendingItemAction): boolean;
  retry(): void;
  discardRejectedUndo(): boolean;
  pending(): readonly PendingItemAction[];
  snapshot(): ItemActionOutboxSnapshot;
  waitForIdle(): Promise<void>;
}

const STORAGE_ERROR = 'Valintajonon avaaminen tai tallentaminen epäonnistui. Valintaa ei kuitattu; yritä uudelleen.';
const MAX_PENDING = 256;
const MAX_STORED_BYTES = 1_048_576;

export function createItemActionOutbox(options: {
  namespace: string;
  scope: ItemActionScope;
  storage: ItemActionStorage;
  send: (command: ItemActionCommand) => Promise<ItemActionResult>;
  onChange: (snapshot: ItemActionOutboxSnapshot) => void;
  onCommitted: (receipt: ItemActionReceipt) => void;
  isCurrent?: () => boolean;
}): ItemActionOutbox {
  const key = `kajo:item-actions:v1:${encodeURIComponent(options.namespace)}:${options.scope.actorUserId}:${options.scope.profileId}`;
  let active = false;
  let ready = true;
  let blocked = false;
  let rejectedUndo = false;
  let pending: PendingItemAction[] = [];
  let message: string | null = null;
  let attempt = 0;
  let flight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function read(): PendingItemAction[] {
    const raw = options.storage.getItemSync(key);
    if (raw && raw.length > MAX_STORED_BYTES) throw new Error('Outbox too large');
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_PENDING
      || !parsed.every(entry => isPendingItemAction(entry, options.scope))
      || new Set(parsed.map(entry => entry.command.actionId)).size !== parsed.length) {
      throw new Error('Invalid persisted action queue');
    }
    return parsed;
  }

  function write(entries: PendingItemAction[]) {
    const serialized = JSON.stringify(entries);
    if (entries.length > MAX_PENDING || serialized.length > MAX_STORED_BYTES) throw new Error('Outbox full');
    options.storage.setItemSync(key, serialized);
    pending = entries;
  }

  function snapshot(): ItemActionOutboxSnapshot {
    return { pendingCount: pending.length, message, ready, canDiscardUndo: blocked && rejectedUndo };
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
        let result: ItemActionResult;
        try { result = await options.send(entry.command); }
        catch { result = { status: 'error', retryable: true, message: 'Valinta odottaa yhteyttä. Yritämme tallennusta uudelleen.' }; }
        if (result.status === 'error') {
          message = result.message;
          blocked = !result.retryable;
          rejectedUndo = result.rejectedUndo === true && entry.command.kind === 'UNDO';
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
        if (!isPendingItemAction(copy, options.scope)) throw new Error('Invalid action');
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
      rejectedUndo = false;
      message = null;
      reload();
      publish();
      drain();
    },
    discardRejectedUndo() {
      if (!active || !blocked || !rejectedUndo) return false;
      try {
        const current = read();
        if (current[0]?.command.kind !== 'UNDO') return false;
        write(current.slice(1));
      } catch { ready = false; message = STORAGE_ERROR; publish(); return false; }
      // Caller reloads authoritative state before starting the remaining queue.
      active = false;
      return true;
    },
    pending() { reload(); return pending; },
    async waitForIdle() { while (flight) await flight; },
  };
}
