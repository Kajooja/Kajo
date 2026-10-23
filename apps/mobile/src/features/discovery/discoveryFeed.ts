import type { Item, DiscoveryMode } from '../../domain/contracts';
import type { DeliveredItemOrigin } from './deliveredSlate';
import { createNextPredictionPageRequest, type PredictionPage, type PredictionPageRequest, type PredictionPageResult } from './predictionPageOperations';
import { CONTEXTUAL_SKIP_VERSION, type DiscoverySkipSource, type DiscoverySkipSourceRequest, type DiscoverySkipSourceResult, type KajoSkipCommand } from '../events/contextualSkipOperations';
import { ITEM_INTERACTION_UNDO_LIMIT } from './itemInteraction';
import type { ProfileActionReceipt } from '../events/collectionActions';

export interface FeedDelivery { item: Item; origin: DeliveredItemOrigin }
export interface FeedPositiveReceipt { actionId: string; itemId: string; undoable: boolean }
export interface DiscoveryFeedSnapshot {
  delivery: FeedDelivery | null; source: DiscoverySkipSource | null;
  loading: boolean; message: string | null; exhausted: boolean;
  waitingActionId: string | null; recovery: 'retry' | 'refresh';
  positiveCommitted: boolean; canPrevious: boolean; navigationPending: boolean; canCancelPrevious: boolean;
  canSkip: boolean;
  upcoming: readonly FeedDelivery[]; refilling: boolean; refillError: string | null;
}
type FeedAction = { kind: 'skip'; command: KajoSkipCommand } | { kind: 'positive'; receipt: FeedPositiveReceipt };
interface FeedEntry { delivery: FeedDelivery; sourceRequest: DiscoverySkipSourceRequest | null; actions: FeedAction[] }

// Local admission is durable before navigation. Keep each action on its original
// displayed delivery while its server receipt arrives in the background. Undo
// waits for those receipts; prepared cards are never impressions.
export function createDiscoveryFeed(options: {
  initial: FeedDelivery; scope: { actorUserId: string; profileId: string; sessionId: string; mode: DiscoveryMode };
  createId: () => string; nowMicros: () => string;
  createRequest: (replacesChainId: string | null, limit?: number) => PredictionPageRequest;
  createRestoreRequest: (replacesChainId: string | null) => PredictionPageRequest;
  load: (request: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>;
  recordImpression: (delivery: FeedDelivery) => string | null;
  loadSource: (request: DiscoverySkipSourceRequest, signal: AbortSignal) => Promise<DiscoverySkipSource | DiscoverySkipSourceResult | null>;
  submit: (command: KajoSkipCommand) => boolean;
  undoPositive?: (receipt: FeedPositiveReceipt, undoActionId: string) => boolean;
  onChange: (snapshot: DiscoveryFeedSnapshot) => void;
}) {
  let active = false; let sourceGeneration = 0; let rankingEpoch = 0;
  const controllers = { source: null as AbortController | null, page: null as AbortController | null };
  let state: DiscoveryFeedSnapshot = { delivery: options.initial, source: null, loading: false,
    message: null, exhausted: false, waitingActionId: null, recovery: 'retry', positiveCommitted: false,
    canPrevious: false, navigationPending: false, canCancelPrevious: false, canSkip: false, upcoming: [], refilling: false, refillError: null };
  let held = false; let advancing = false; let warmed = false;
  let sourceRequest: DiscoverySkipSourceRequest | null = null;
  let readingSource = false; let sourceAgain = false;
  let actions: FeedAction[] = [];
  const pendingActions = new Map<string, FeedAction>();
  const handledItems = new Set<string>();
  const history: FeedEntry[] = [];
  let expected: { kind: 'positive'; actionId: string } | null = null;
  type UndoState = { target: FeedEntry; remaining: FeedAction[]; actionId: string | null;
    restoreRequest: PredictionPageRequest | null; restorePageCount: number; fromHistory: boolean; acknowledgedCount: number };
  let undoing: UndoState | null = null;
  type ReadTask = { kind: 'buffer'; epoch: number; request: PredictionPageRequest }
    | { kind: 'restore'; epoch: number; request: PredictionPageRequest; restoration: UndoState };
  let pendingRead: ReadTask | null = null;
  let readingPage = false; let readerBlocked = false;
  let chainId: string | null = null;
  let bufferPage: PredictionPage | null = null; let bufferEnded = false; let duplicatePages = 0;
  let upcoming: FeedDelivery[] = [];
  const snapshot = () => ({ ...state, upcoming: [...upcoming] });
  const publish = () => {
    const previousActions = [...(history.at(-1)?.actions ?? []), ...actions];
    state = { ...state, upcoming: [...upcoming], refilling: readingPage,
      loading: readingPage && (advancing || undoing !== null),
      canSkip: Boolean(sourceRequest) && state.source?.acceptsNewSkip !== false && !state.positiveCommitted,
      canPrevious: (history.length > 0 || actions.length > 0) && pendingActions.size === 0 && !advancing && !state.waitingActionId && !held && !undoing &&
        previousActions.every(action => action.kind === 'skip' || action.receipt.undoable),
      navigationPending: undoing !== null || advancing,
      canCancelPrevious: undoing !== null && !readingPage && !state.waitingActionId };
    if (active) options.onChange(snapshot());
  };
  const invalidateSource = () => {
    sourceGeneration++; controllers.source?.abort(); readingSource = false; sourceAgain = false;
    sourceRequest = null; state = { ...state, source: null };
  };
  function invalidateBuffer(keepPrepared = false) {
    rankingEpoch++; readerBlocked = false; if (!keepPrepared) upcoming = []; bufferPage = null; bufferEnded = false; duplicatePages = 0;
    state = { ...state, refillError: null };
    // Do not discard or abort an ambiguous page. A root may already have created
    // a server reader. Resolve its exact receipt before replacing that chain;
    // stale results identify the reader but can never enter the new buffer.
  }
  async function bounded<T>(lane: keyof typeof controllers, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(); controllers[lane] = controller;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, 15_000);
    })]); } finally { if (deadline) clearTimeout(deadline); if (controllers[lane] === controller) controllers[lane] = null; }
  }
  async function readSource() {
    if (!active || advancing || undoing || !sourceRequest || state.source || state.waitingActionId || state.positiveCommitted) return;
    if (readingSource) { sourceAgain = true; return; }
    readingSource = true;
    const token = sourceGeneration; const request = sourceRequest;
    try {
      const result = await bounded('source', signal => options.loadSource(request, signal));
      if (!active || token !== sourceGeneration || sourceRequest !== request || state.positiveCommitted || state.waitingActionId) return;
      const source = result && 'status' in result ? result.status === 'success' ? result.source : null : result;
      // This optional read can race our exposure outbox. It does not authorize
      // the queued intent: the atomic writer validates the exact source after
      // exposure acknowledgement. Normal source waiting must stay silent.
      state = { ...state, source, recovery: source?.acceptsNewSkip === false ? 'refresh' : 'retry',
        ...(source?.acceptsNewSkip === false ? { message: 'Kortilla on jo tallennettu valinta. Päivitä kortti ennen jatkamista.' } : {}) }; publish();
    } catch {
      // A failed optional preflight must not flash retry text over a valid card.
      // A submitted command retains its real failure in the durable outbox.
    } finally {
      if (active && token === sourceGeneration) {
        readingSource = false;
        if (sourceAgain) { sourceAgain = false; void readSource(); }
      }
    }
  }
  function present(delivery: FeedDelivery) {
    const { predictionId, deliveryRequestId } = delivery.origin;
    const impressionEventId = options.recordImpression(delivery);
    sourceRequest = predictionId && deliveryRequestId && impressionEventId ? {
      actorUserId: options.scope.actorUserId, profileId: options.scope.profileId, itemId: delivery.item.id,
      origin: { surface: 'DISCOVERY', sessionId: options.scope.sessionId, predictionId, deliveryRequestId, impressionEventId },
    } : null;
    if (!sourceRequest) { state = { ...state, message: 'Kortin näyttöä ei voitu vahvistaa. Yritä uudelleen.' }; publish(); }
    else { publish(); void readSource(); }
  }
  function deliveryFrom(result: PredictionPage, item: Item): FeedDelivery {
    return { item, origin: { predictionId: result.ranking.predictionId, deliveryRequestId: result.request.requestId,
      properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
  }
  function promoteBuffered() {
    if (!advancing || state.waitingActionId || undoing) return;
    const delivery = upcoming.shift();
    if (!delivery && !bufferEnded) return;
    advancing = false; invalidateSource(); actions = []; expected = null;
    state = { ...state, delivery: delivery ?? null, positiveCommitted: false, exhausted: !delivery,
      waitingActionId: null, message: null, recovery: 'retry' }; publish();
  }
  function taskWanted(): ReadTask | null {
    if (pendingRead) return pendingRead;
    if (undoing) {
      if (undoing.actionId || undoing.remaining.length) return null;
      undoing.restoreRequest ??= options.createRestoreRequest(chainId);
      return { kind: 'restore', epoch: rankingEpoch, request: undoing.restoreRequest, restoration: undoing };
    }
    if ((!warmed && !advancing) || bufferEnded || upcoming.length >= 5) return null;
    const request = bufferPage?.nextCursor
      ? createNextPredictionPageRequest(bufferPage, options.createId()) : options.createRequest(chainId, 5);
    return { kind: 'buffer', epoch: rankingEpoch, request };
  }
  function readerError(message: string) {
    readerBlocked = true;
    state = { ...state, refillError: message,
      ...(advancing || undoing ? { message, recovery: 'retry' as const } : {}) };
  }
  async function fillBuffer() {
    if (!active || readingPage || readerBlocked) return;
    const task = taskWanted();
    if (!task) { promoteBuffered(); return; }
    pendingRead = task; readingPage = true; publish();
    try {
      const result = await bounded('page', signal => options.load(task.request, signal));
      if (!active) return;
      if (result.status === 'error') {
        if (result.recovery === 'refresh') {
          // The server proved this cursor unusable; a new root is now permitted.
          pendingRead = null;
          if (task.epoch !== rankingEpoch) return;
          if (task.kind === 'restore') { task.restoration.restoreRequest = null; task.restoration.restorePageCount = 0; }
          else { bufferPage = null; bufferEnded = false; upcoming = []; }
        }
        readerError(result.message); return;
      }
      if (result.request !== task.request || result.request.profileId !== options.scope.profileId ||
        result.request.sessionId !== options.scope.sessionId) throw new Error('Wrong page origin');
      // Even an old generation's successful response must identify its reader,
      // so the next root can retire it atomically without leaking reader slots.
      chainId = result.chainId ?? chainId;
      pendingRead = null;
      if (task.epoch !== rankingEpoch) return;
      state = { ...state, refillError: null };
      if (task.kind === 'restore') {
        if (undoing !== task.restoration) return;
        const restoration = task.restoration;
        restoration.restorePageCount++;
        const item = result.ranking.items.find(candidate => candidate.id === restoration.target.delivery.item.id);
        if (!item) {
          if (result.nextCursor && restoration.restorePageCount < 3) {
            restoration.restoreRequest = createNextPredictionPageRequest(result, options.createId());
          } else {
            restoration.restoreRequest = null; restoration.restorePageCount = 0;
            readerError('Valinta kumottiin, mutta edellistä teosta ei saatu takaisin syötteeseen. Yritä uudelleen.');
          }
          return;
        }
        if (restoration.fromHistory) history.pop();
        undoing = null; advancing = false; actions = []; invalidateSource();
        // The restoration has a 50-item reader. The next warm root replaces it
        // with the one-at-a-time feed reader; no old restoration sibling is shown.
        bufferPage = null; bufferEnded = false; upcoming = [];
        state = { ...state, delivery: deliveryFrom(result, item), positiveCommitted: false,
          exhausted: false, waitingActionId: null, message: null, recovery: 'retry' };
        return;
      }
      bufferPage = result;
      // A reader's traversal budget is not catalogue exhaustion. Its next root
      // atomically replaces the known chain when the buffer has a free slot.
      bufferEnded = result.nextCursor === null && result.continuationState !== 'READER_LIMIT';
      let added = 0;
      for (const item of result.ranking.items) {
        if (upcoming.length >= 5) break;
        if (item.id !== state.delivery?.item.id && !handledItems.has(item.id) && !upcoming.some(entry => entry.item.id === item.id)) {
          upcoming.push(deliveryFrom(result, item)); added++;
        }
      }
      if (added) duplicatePages = 0;
      else if (!bufferEnded && ++duplicatePages >= 8) {
        readerError('Seuraavia kortteja valmistellaan. Yritä uudelleen.');
      }
      promoteBuffered();
    } catch {
      if (active) readerError('Seuraavaa korttia ei saatu. Yritä uudelleen.');
    } finally {
      readingPage = false;
      if (active) {
        publish();
        if (!readerBlocked) void fillBuffer();
      }
    }
  }
  function refresh() {
    if (!active || state.waitingActionId) return;
    held = false; advancing = true; invalidateSource(); invalidateBuffer(); actions = []; expected = null;
    state = { ...state, exhausted: false, message: null, waitingActionId: null,
      positiveCommitted: false, recovery: 'retry' };
    publish(); void fillBuffer();
  }
  function remember() {
    if (!state.delivery) return;
    history.push({ delivery: state.delivery, sourceRequest, actions: [...actions] });
    while (history.length > ITEM_INTERACTION_UNDO_LIMIT ||
      history.reduce((count, entry) => count + entry.actions.filter(action => action.kind === 'positive').length, 0) > ITEM_INTERACTION_UNDO_LIMIT)
      history.shift();
  }
  function next() {
    remember(); advancing = true; invalidateSource(); actions = []; expected = null;
    state = { ...state, positiveCommitted: false, message: null, exhausted: false };
    promoteBuffered();
    if (advancing && readerBlocked) state = { ...state, message: state.refillError, recovery: 'retry' };
    publish(); void fillBuffer();
  }
  function positiveChanged() {
    invalidateSource(); invalidateBuffer(true);
    state = { ...state, positiveCommitted: true, message: null }; publish();
    void fillBuffer();
  }
  function recoveredAction(itemId: string | null) {
    if (!active) return;
    if (!advancing && !state.waitingActionId && !undoing && state.delivery?.item.id === itemId) {
      refresh(); return;
    }
    // A resumed command can change this Profile's ranking through another Item.
    // Preserve the displayed opportunity and its history, but never reuse unseen
    // deliveries from before that acknowledgement.
    invalidateBuffer();
    if (undoing) { undoing.restoreRequest = null; undoing.restorePageCount = 0; }
    publish(); void fillBuffer();
  }
  function skip() {
    const source = sourceRequest;
    if (!active || advancing || undoing || held || state.waitingActionId || state.positiveCommitted || !source || state.source?.acceptsNewSkip === false) return false;
    const command: KajoSkipCommand = { version: CONTEXTUAL_SKIP_VERSION, kind: 'CONTEXTUAL_SKIP', actionId: options.createId(),
      actorUserId: source.actorUserId, profileId: source.profileId, itemId: source.itemId,
      origin: { ...source.origin }, contextRef: null, reversesActionId: null, occurredAt: options.nowMicros() };
    if (!options.submit(command)) return false;
    const action: FeedAction = { kind: 'skip', command };
    pendingActions.set(command.actionId, action); actions.push(action); handledItems.add(command.itemId);
    next(); return true;
  }
  function continueUndo(): boolean {
    if (!undoing) return false;
    const action = undoing.remaining.at(-1);
    if (!action) { void fillBuffer(); return true; }
    const actionId = options.createId();
    undoing.actionId = actionId;
    state = { ...state, waitingActionId: actionId, message: null }; publish();
    const accepted = action.kind === 'skip'
      ? options.submit({ ...action.command, kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId,
        reversesActionId: action.command.actionId, occurredAt: options.nowMicros() })
      : action.receipt.undoable && options.undoPositive?.(action.receipt, actionId) === true;
    if (accepted) return true;
    undoing.actionId = null;
    if (undoing.acknowledgedCount === 0) undoing = null;
    state = { ...state, waitingActionId: null, message: 'Edellistä valintaa ei voitu kumota. Yritä uudelleen.', recovery: 'retry' }; publish();
    return false;
  }
  function acknowledged(actionId: string) {
    if (!active) return;
    const background = pendingActions.get(actionId);
    if (background) {
      pendingActions.delete(actionId);
      if (background.kind === 'positive') {
        invalidateBuffer(true);
        // A fresh committed prefix can have new eligible candidates after the
        // previous reader ended. There is no active card to preserve here.
        if (!state.delivery && state.exhausted) advancing = true;
      }
      publish(); void fillBuffer(); return;
    }
    if (state.waitingActionId !== actionId) return;
    if (undoing?.actionId === actionId) {
      const undone = undoing.remaining.pop(); undoing.acknowledgedCount++;
      if (undone) {
        actions = actions.filter(action => action !== undone);
        undoing.target.actions = undoing.target.actions.filter(action => action !== undone);
      }
      undoing.actionId = null;
      state = { ...state, waitingActionId: null }; continueUndo(); return;
    }
    const completed = expected; expected = null;
    state = { ...state, waitingActionId: null };
    if (completed?.kind === 'positive') {
      actions.push({ kind: 'positive', receipt: { actionId, itemId: state.delivery!.item.id, undoable: true } });
      handledItems.add(state.delivery!.item.id);
      invalidateBuffer(true); invalidateSource(); next();
    }
  }
  return {
    snapshot,
    start() { active = true; publish(); },
    displayed(itemId: string, requestId: string) {
      if (active && !advancing && !undoing && !sourceRequest && state.delivery?.item.id === itemId && state.delivery.origin.deliveryRequestId === requestId)
        present(state.delivery);
    },
    // Called after the active card mounts. Fetching the next five is never an
    // impression, a skip capability request, or a permission to write to them.
    warm() { if (active) { warmed = true; void fillBuffer(); } },
    stop() { active = false; invalidateSource(); controllers.page?.abort(); },
    exposureAcknowledged() { if (!state.source) void readSource(); },
    retry() {
      if (state.waitingActionId || readingPage) return;
      readerBlocked = false; state = { ...state, refillError: null }; duplicatePages = 0;
      if (undoing) { continueUndo(); return; }
      if (advancing || pendingRead) { void fillBuffer(); return; }
      if (state.recovery === 'refresh') refresh();
      else if (state.delivery) { if (sourceRequest) void readSource(); else present(state.delivery); void fillBuffer(); }
      else { bufferEnded = false; bufferPage = null; advancing = true; void fillBuffer(); }
    },
    retryRefill() { if (active && !readingPage) { readerBlocked = false; duplicatePages = 0; void fillBuffer(); } },
    hold(value: boolean) { held = value; publish(); },
    skip,
    advance() {
      if (!active || advancing || held || state.waitingActionId || undoing || !state.delivery) return false;
      if (!state.positiveCommitted) return skip();
      next(); return true;
    },
    previous() {
      if (!active || advancing || held || state.waitingActionId || pendingActions.size > 0) return false;
      if (undoing) return continueUndo();
      const fromHistory = history.length > 0;
      const target = history.at(-1) ?? (state.delivery && actions.length
        ? { delivery: state.delivery, sourceRequest, actions: [] } : null);
      if (!target || [...target.actions, ...actions].some(action => action.kind === 'positive' && !action.receipt.undoable)) return false;
      invalidateBuffer(); invalidateSource();
      undoing = { target, remaining: [...target.actions, ...actions], actionId: null,
        restoreRequest: null, restorePageCount: 0, fromHistory, acknowledgedCount: 0 };
      return continueUndo();
    },
    cancelPrevious() {
      if (!active || !undoing || readingPage || state.waitingActionId) return false;
      undoing = null; history.length = 0; readerBlocked = false; refresh(); return true;
    },
    expectPositive(actionId: string) {
      if (active && !advancing && !state.waitingActionId && !undoing) {
        expected = { kind: 'positive', actionId }; state = { ...state, waitingActionId: actionId }; publish();
      }
    },
    cancelPositive(actionId: string) {
      if (state.waitingActionId === actionId && expected?.kind === 'positive') {
        expected = null; state = { ...state, waitingActionId: null }; publish();
      }
    },
    positiveQueued(actionId: string) {
      if (!active || advancing || undoing || state.waitingActionId !== actionId || expected?.kind !== 'positive' || !state.delivery) return false;
      const action: FeedAction = { kind: 'positive', receipt: { actionId, itemId: state.delivery.item.id, undoable: true } };
      pendingActions.set(actionId, action); actions.push(action); handledItems.add(state.delivery.item.id);
      expected = null; state = { ...state, waitingActionId: null };
      next(); return true;
    },
    hasPendingAction(actionId: string) { return pendingActions.has(actionId); },
    acknowledged,
    recoveredAction,
    positiveReceipt(receipt: FeedPositiveReceipt) {
      if (!active || advancing || receipt.itemId !== state.delivery?.item.id) return;
      if (state.waitingActionId === receipt.actionId) { acknowledged(receipt.actionId); return; }
      if (state.waitingActionId || undoing || actions.some(action => action.kind === 'positive' && action.receipt.actionId === receipt.actionId)) return;
      actions.push({ kind: 'positive', receipt }); positiveChanged();
    },
    positiveCommitted() {
      if (active && !advancing && !undoing && !state.waitingActionId && !state.positiveCommitted) positiveChanged();
    },
    recoverRejected(kind?: 'skip' | 'positive', actionId?: string) {
      if (kind) {
        const rejected = actionId ? pendingActions.get(actionId) : undefined;
        if (actionId && rejected?.kind === kind) {
          pendingActions.delete(actionId);
          handledItems.delete(rejected.kind === 'skip' ? rejected.command.itemId : rejected.receipt.itemId);
        }
      } else { pendingActions.clear(); handledItems.clear(); }
      expected = null; undoing = null; state = { ...state, waitingActionId: null };
      history.length = 0; readerBlocked = false; refresh();
    },
  };
}
export type DiscoveryFeed = ReturnType<typeof createDiscoveryFeed>;

// ItemActionReceipt deliberately has no kind. An unmatched durable receipt may
// be a resumed rating OR undo; its interaction alone cannot establish a new
// positive choice on this card. Reload the current committed prefix instead.
export function receiveDiscoveryFeedAction(flow: DiscoveryFeed, receipt: ProfileActionReceipt) {
  if (flow.hasPendingAction(receipt.actionId) || flow.snapshot().waitingActionId === receipt.actionId) {
    flow.acknowledged(receipt.actionId);
    return;
  }
  if (!('kind' in receipt)) {
    flow.recoveredAction(receipt.itemId);
    return;
  }
  if (!receipt.changed) return;
  const state = flow.snapshot();
  if (receipt.itemId && receipt.itemId === state.delivery?.item.id && !state.waitingActionId && !state.navigationPending &&
    ['SET_LIST_ENTRY', 'ENDORSE_SHARED_ITEM'].includes(receipt.kind)) {
    flow.positiveReceipt({ actionId: receipt.actionId, itemId: receipt.itemId, undoable: receipt.undoable });
  } else flow.recoveredAction(receipt.itemId);
}
