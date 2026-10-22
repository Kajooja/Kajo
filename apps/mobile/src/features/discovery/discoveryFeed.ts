import type { Item, DiscoveryMode } from '../../domain/contracts';
import type { DeliveredItemOrigin } from './deliveredSlate';
import { createNextPredictionPageRequest, type PredictionPageRequest, type PredictionPageResult } from './predictionPageOperations';
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
}
type FeedAction = { kind: 'skip'; command: KajoSkipCommand } | { kind: 'positive'; receipt: FeedPositiveReceipt };
interface FeedEntry { delivery: FeedDelivery; sourceRequest: DiscoverySkipSourceRequest | null; actions: FeedAction[] }

// History contains actual displayed deliveries and acknowledged actions, never a
// precomputed ranking. Back withdraws those exact receipts before restoring the
// card. A positive choice stays visible until the user advances; it is not a skip.
export function createDiscoveryFeed(options: {
  initial: FeedDelivery; scope: { actorUserId: string; profileId: string; sessionId: string; mode: DiscoveryMode };
  createId: () => string; nowMicros: () => string;
  createRequest: () => PredictionPageRequest;
  createRestoreRequest: () => PredictionPageRequest;
  load: (request: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>;
  recordImpression: (delivery: FeedDelivery) => string | null;
  loadSource: (request: DiscoverySkipSourceRequest, signal: AbortSignal) => Promise<DiscoverySkipSource | DiscoverySkipSourceResult | null>;
  submit: (command: KajoSkipCommand) => boolean;
  undoPositive?: (receipt: FeedPositiveReceipt, undoActionId: string) => boolean;
  onChange: (snapshot: DiscoveryFeedSnapshot) => void;
}) {
  let active = false; let generation = 0; let abort: AbortController | null = null;
  let state: DiscoveryFeedSnapshot = { delivery: options.initial, source: null, loading: false,
    message: null, exhausted: false, waitingActionId: null, recovery: 'retry', positiveCommitted: false, canPrevious: false, navigationPending: false, canCancelPrevious: false };
  let held = false;
  // Keep the outgoing card visible while its acknowledged successor is loaded.
  // It is only a presentation placeholder: no further actions or impressions
  // may use its consumed delivery, including after a failed page request.
  let advancing = false;
  let pending: PredictionPageRequest | null = null;
  let sourceRequest: DiscoverySkipSourceRequest | null = null;
  let readingSource = false; let sourceAgain = false;
  let actions: FeedAction[] = [];
  const history: FeedEntry[] = [];
  let expected: { kind: 'skip'; command: KajoSkipCommand } | { kind: 'positive'; actionId: string } | null = null;
  let undoing: { target: FeedEntry; remaining: FeedAction[]; actionId: string | null;
    restoreRequest: PredictionPageRequest | null; restorePageCount: number; fromHistory: boolean; acknowledgedCount: number } | null = null;
  const snapshot = () => ({ ...state });
  const publish = () => {
    const previousActions = [...(history.at(-1)?.actions ?? []), ...actions];
    state = { ...state, canPrevious: (history.length > 0 || actions.length > 0) && !advancing && !state.loading && !state.waitingActionId && !held &&
      previousActions.every(action => action.kind === 'skip' || action.receipt.undoable),
      navigationPending: undoing !== null || advancing, canCancelPrevious: undoing !== null && !state.loading && !state.waitingActionId };
    if (active) options.onChange(snapshot());
  };
  const current = (token: number) => active && token === generation;
  const invalidateRead = () => { generation++; abort?.abort(); readingSource = false; sourceAgain = false; };
  async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(); abort = controller;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, 15_000);
    })]); } finally { if (deadline) clearTimeout(deadline); if (abort === controller) abort = null; }
  }
  async function readSource() {
    if (!active || advancing || !sourceRequest || state.source || state.waitingActionId || state.positiveCommitted) return;
    if (readingSource) { sourceAgain = true; return; }
    readingSource = true;
    const token = generation; const request = sourceRequest;
    try {
      const result = await bounded(signal => options.loadSource(request, signal));
      if (!current(token) || sourceRequest !== request || state.positiveCommitted || state.waitingActionId) return;
      const error = result && 'status' in result && result.status === 'error' ? result : null;
      const source = result && 'status' in result ? result.status === 'success' ? result.source : null : result;
      state = { ...state, source, recovery: error?.reason === 'SOURCE_UNAVAILABLE' || source?.acceptsNewSkip === false ? 'refresh' : 'retry',
        message: error?.message ?? (source?.acceptsNewSkip ? null : source
          ? 'Kortilla on jo tallennettu valinta. Päivitä kortti ennen jatkamista.'
          : 'Kortin vahvistusta odotetaan. Yritä uudelleen.') }; publish();
    } catch { if (current(token) && sourceRequest === request && !state.positiveCommitted && !state.waitingActionId) { state = { ...state, message: 'Kortin vahvistus viipyy. Yritä uudelleen.' }; publish(); } }
    finally {
      if (current(token)) {
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
    if (!sourceRequest) {
      state = { ...state, message: 'Kortin näyttöä ei voitu vahvistaa. Yritä uudelleen.' }; publish();
    } else void readSource();
  }
  async function loadNext() {
    if (!active || state.loading || state.waitingActionId) return;
    const token = generation;
    pending ??= options.createRequest();
    state = { ...state, loading: true, message: null }; publish();
    try {
      const request = pending;
      const result = await bounded(signal => options.load(request, signal));
      if (!current(token)) return;
      if (result.status === 'error') { state = { ...state, loading: false, message: result.message, recovery: result.recovery }; publish(); return; }
      if (result.request !== request || result.request.profileId !== options.scope.profileId ||
        result.request.sessionId !== options.scope.sessionId) throw new Error('Wrong page origin');
      const item = result.ranking.items[0];
      if (!item && result.nextCursor) {
        pending = createNextPredictionPageRequest(result, options.createId());
        state = { ...state, loading: false }; await loadNext(); return;
      }
      pending = null;
      const delivery = item ? { item, origin: { predictionId: result.ranking.predictionId,
        deliveryRequestId: request.requestId, properties: { predictionSource: 'hosted' as const, deliveryTier: 'RANKED' as const } } } : null;
      advancing = false;
      state = { ...state, delivery, source: null, loading: false, exhausted: !delivery, message: null }; publish();
    } catch { if (current(token)) { state = { ...state, loading: false, message: 'Seuraavaa korttia ei saatu. Yritä uudelleen.', recovery: 'retry' }; publish(); } }
  }
  function refresh() {
    if (!active || state.waitingActionId) return;
    held = false; advancing = true; invalidateRead(); sourceRequest = null; pending = null; actions = []; expected = null;
    state = { delivery: state.delivery, source: null, loading: false, exhausted: false, message: null, waitingActionId: null,
      recovery: 'retry', positiveCommitted: false, canPrevious: false, navigationPending: false, canCancelPrevious: false };
    publish(); void loadNext();
  }
  function remember() {
    if (!state.delivery) return;
    history.push({ delivery: state.delivery, sourceRequest, actions: [...actions] });
    while (history.length > ITEM_INTERACTION_UNDO_LIMIT ||
      history.reduce((count, entry) => count + entry.actions.filter(action => action.kind === 'positive').length, 0) > ITEM_INTERACTION_UNDO_LIMIT)
      history.shift();
  }
  function next() { remember(); refresh(); }
  function skip() {
    const source = state.source;
    if (!active || advancing || held || state.loading || state.waitingActionId || state.positiveCommitted || !source?.acceptsNewSkip) return false;
    const command: KajoSkipCommand = { version: CONTEXTUAL_SKIP_VERSION, kind: 'CONTEXTUAL_SKIP', actionId: options.createId(),
      actorUserId: source.actorUserId, profileId: source.profileId, itemId: source.itemId,
      origin: { ...source.origin }, contextRef: null, reversesActionId: null, occurredAt: options.nowMicros() };
    expected = { kind: 'skip', command };
    state = { ...state, waitingActionId: command.actionId, message: null }; publish();
    if (options.submit(command)) return true;
    expected = null; state = { ...state, waitingActionId: null }; publish(); return false;
  }
  async function restorePrevious() {
    const restoration = undoing;
    if (!restoration || state.loading || state.waitingActionId) return;
    // Old deliveries are immutable. Even after withdrawing the action they may
    // not admit a second skip, so obtain a new real delivery for this same Item.
    invalidateRead();
    const token = generation;
    restoration.restoreRequest ??= options.createRestoreRequest();
    state = { ...state, loading: true, message: null }; publish();
    try {
      const request = restoration.restoreRequest;
      const result = await bounded(signal => options.load(request, signal));
      if (!current(token) || undoing !== restoration) return;
      if (result.status === 'error') {
        if (result.recovery === 'refresh') { restoration.restoreRequest = null; restoration.restorePageCount = 0; }
        state = { ...state, loading: false, message: result.message, recovery: 'retry' }; publish(); return;
      }
      if (result.request !== request || result.request.profileId !== options.scope.profileId ||
        result.request.sessionId !== options.scope.sessionId) throw new Error('Wrong return-page origin');
      restoration.restorePageCount++;
      const item = result.ranking.items.find(candidate => candidate.id === restoration.target.delivery.item.id);
      if (!item) {
        if (result.nextCursor && restoration.restorePageCount < 3) {
          restoration.restoreRequest = createNextPredictionPageRequest(result, options.createId());
          state = { ...state, loading: false }; await restorePrevious(); return;
        }
        // Confirmed absence is distinct from an ambiguous request. A deliberate
        // retry may start a fresh bounded search, without repeating any undo.
        restoration.restoreRequest = null; restoration.restorePageCount = 0;
        state = { ...state, loading: false, message: 'Valinta kumottiin, mutta edellistä teosta ei saatu takaisin syötteeseen. Yritä uudelleen.', recovery: 'retry' };
        publish(); return;
      }
      if (restoration.fromHistory) history.pop();
      undoing = null; actions = []; pending = null; sourceRequest = null;
      const delivery: FeedDelivery = { item, origin: { predictionId: result.ranking.predictionId,
        deliveryRequestId: request.requestId, properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
      state = { ...state, delivery, source: null, positiveCommitted: false,
        exhausted: false, loading: false, waitingActionId: null, message: null, recovery: 'retry' };
      publish(); // The mounted card records its new impression, then reads capability.
    } catch {
      if (current(token)) { state = { ...state, loading: false,
        message: 'Edellisen kortin lataus viipyy. Yritä uudelleen.', recovery: 'retry' }; publish(); }
    }
  }
  function continueUndo(): boolean {
    if (!undoing) return false;
    const action = undoing.remaining.at(-1);
    if (!action) { void restorePrevious(); return true; }
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
    if (!active || state.waitingActionId !== actionId) return;
    if (undoing?.actionId === actionId) {
      const undone = undoing.remaining.pop();
      undoing.acknowledgedCount++;
      // A retry after partially completed undo must never submit a second undo
      // for already acknowledged actions.
      if (undone) {
        actions = actions.filter(action => action !== undone);
        undoing.target.actions = undoing.target.actions.filter(action => action !== undone);
      }
      undoing.actionId = null;
      state = { ...state, waitingActionId: null }; continueUndo(); return;
    }
    const completed = expected;
    expected = null;
    state = { ...state, waitingActionId: null };
    if (completed?.kind === 'skip') { actions.push(completed); next(); }
    else if (completed?.kind === 'positive') {
      actions.push({ kind: 'positive', receipt: { actionId, itemId: state.delivery!.item.id, undoable: true } });
      state = { ...state, positiveCommitted: true, message: null }; publish();
    }
  }
  return {
    snapshot,
    start() { active = true; publish(); },
    displayed(itemId: string, requestId: string) {
      if (active && !advancing && !sourceRequest && state.delivery?.item.id === itemId && state.delivery.origin.deliveryRequestId === requestId)
        present(state.delivery);
    },
    stop() { active = false; invalidateRead(); },
    exposureAcknowledged() { if (!state.source) void readSource(); },
    retry() {
      if (state.waitingActionId || state.loading) return;
      if (undoing) { continueUndo(); return; }
      if (state.recovery === 'refresh') refresh();
      else if (advancing) void loadNext();
      else if (state.delivery) { if (sourceRequest) void readSource(); else present(state.delivery); }
      else void loadNext();
    },
    hold(value: boolean) { held = value; publish(); },
    skip,
    advance() {
      if (!active || advancing || held || state.loading || state.waitingActionId || undoing || !state.delivery) return false;
      if (!state.positiveCommitted) return skip();
      next(); return true;
    },
    previous() {
      if (!active || advancing || held || state.loading || state.waitingActionId) return false;
      if (undoing) return continueUndo();
      const fromHistory = history.length > 0;
      const target = history.at(-1) ?? (state.delivery && actions.length
        ? { delivery: state.delivery, sourceRequest, actions: [] } : null);
      if (!target || [...target.actions, ...actions].some(action => action.kind === 'positive' && !action.receipt.undoable)) return false;
      undoing = { target, remaining: [...target.actions, ...actions], actionId: null,
        restoreRequest: null, restorePageCount: 0, fromHistory, acknowledgedCount: 0 };
      return continueUndo();
    },
    cancelPrevious() {
      if (!active || !undoing || state.loading || state.waitingActionId) return false;
      undoing = null; history.length = 0; refresh(); return true;
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
    acknowledged,
    recoveredAction(itemId: string) {
      // A durable command can finish after this presentation was recreated.
      // Its exact receipt is valid, but there is no local gesture/history to undo.
      if (active && !advancing && !state.waitingActionId && !undoing && state.delivery?.item.id === itemId) refresh();
    },
    positiveReceipt(receipt: FeedPositiveReceipt) {
      if (!active || advancing || receipt.itemId !== state.delivery?.item.id) return;
      if (state.waitingActionId === receipt.actionId) { acknowledged(receipt.actionId); return; }
      if (state.waitingActionId || undoing || actions.some(action => action.kind === 'positive' && action.receipt.actionId === receipt.actionId)) return;
      actions.push({ kind: 'positive', receipt });
      state = { ...state, positiveCommitted: true, message: null }; publish();
    },
    // Called by the List/Shared screen only after confirmed completion. Receipts
    // from the provider retain exact reversible IDs separately.
    positiveCommitted() { if (active && !advancing && !state.waitingActionId) { state = { ...state, positiveCommitted: true, message: null }; publish(); } },
    recoverRejected() {
      expected = null; undoing = null; state = { ...state, waitingActionId: null };
      history.length = 0; refresh();
    },
  };
}
export type DiscoveryFeed = ReturnType<typeof createDiscoveryFeed>;

// ItemActionReceipt deliberately has no kind. An unmatched durable receipt may
// be a resumed rating OR undo; its interaction alone cannot establish a new
// positive choice on this card. Reload the current committed prefix instead.
export function receiveDiscoveryFeedAction(flow: DiscoveryFeed, receipt: ProfileActionReceipt) {
  if (flow.snapshot().waitingActionId === receipt.actionId) {
    flow.acknowledged(receipt.actionId);
    return;
  }
  if (!receipt.itemId) return;
  if (!('kind' in receipt)) {
    flow.recoveredAction(receipt.itemId);
    return;
  }
  if (!receipt.changed || !['SET_LIST_ENTRY', 'ENDORSE_SHARED_ITEM'].includes(receipt.kind)) return;
  flow.positiveReceipt({ actionId: receipt.actionId, itemId: receipt.itemId, undoable: receipt.undoable });
}
