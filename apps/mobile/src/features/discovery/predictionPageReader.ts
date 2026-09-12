import type { DiscoveryMode, Item, ItemType } from '../../domain/contracts';
import {
  createNextPredictionPageRequest,
  type PredictionPage,
  type PredictionPageRequest,
  type PredictionPageResult,
} from './predictionPageOperations';

export interface PredictionReaderScope {
  readonly environment: string;
  readonly actorUserId: string;
  readonly profileId: string;
  readonly sessionId: string;
  readonly itemType: ItemType;
  readonly mode: DiscoveryMode;
  readonly limit: number;
  readonly revision: string;
}

export function predictionReaderScopeKey(scope: PredictionReaderScope): string {
  return JSON.stringify([scope.environment, scope.actorUserId, scope.profileId, scope.sessionId,
    scope.itemType, scope.mode, scope.limit, scope.revision]);
}

export interface PredictionReaderSnapshot {
  readonly viewId: string;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly pages: readonly PredictionPage[];
  readonly items: readonly Item[];
  readonly predictionIds: Readonly<Record<string, string>>;
  readonly message: string | null;
}

const MESSAGE = 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.';

// One controller per captured scope/revision. Leaving it invalidates all work,
// including catalog enrichment. Returning to the same scope creates a new
// controller; a transport retry inside this controller retains its exact request.
export function createPredictionPageReader(options: {
  scope: PredictionReaderScope;
  createRequest: () => PredictionPageRequest;
  createRequestId: () => string;
  load: (request: PredictionPageRequest) => Promise<PredictionPageResult>;
}) {
  const scope = Object.freeze({ ...options.scope });
  let pending: PredictionPageRequest | null = null;
  let snapshot: PredictionReaderSnapshot = initial(options.createRequestId());
  let active = false;
  let generation = 0;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  function firstRequest() {
    const request = options.createRequest();
    if (request.version !== 2 || request.cursor !== null || request.profileId !== scope.profileId ||
      request.sessionId !== scope.sessionId || request.itemType !== scope.itemType ||
      request.discoveryMode !== scope.mode || request.limit !== scope.limit) throw new Error('Prediction reader scope mismatch');
    return request;
  }

  function initial(viewId: string): PredictionReaderSnapshot {
    return Object.freeze({ viewId, status: 'idle', pages: Object.freeze([]), items: Object.freeze([]),
      predictionIds: Object.freeze({}), message: null });
  }

  function publish(next: PredictionReaderSnapshot) {
    snapshot = Object.freeze(next);
    listeners.forEach(listener => listener());
  }

  async function dispatch() {
    if (!active || running) return;
    running = true;
    const token = ++generation;
    try {
      // Capture current context when the focused reader actually starts work,
      // not when a hidden screen observes an interaction revision.
      if (!pending) {
        pending = firstRequest();
        publish(initial(pending.requestId));
      }
      const request = pending;
      publish({ ...snapshot, status: 'loading', message: null });
      const result = await options.load(request);
      if (!active || token !== generation) return;
      if (result.status !== 'success' || result.request !== request || !validSuccessor(result)) {
        publish({ ...snapshot, status: 'error', message: MESSAGE });
        return;
      }
      const page = freezePage(result);
      const pages = Object.freeze([...snapshot.pages, page]);
      const items = Object.freeze(pages.flatMap(entry => entry.ranking.items));
      publish({ ...snapshot, status: 'ready', pages, items, message: null,
        predictionIds: Object.freeze(Object.fromEntries(pages.flatMap(entry =>
          entry.ranking.items.map(item => [item.id, entry.ranking.predictionId])))) });
    } catch {
      if (active && token === generation) publish({ ...snapshot, status: 'error', message: MESSAGE });
    } finally {
      if (token === generation) running = false;
    }
  }

  function validSuccessor(page: PredictionPage): boolean {
    if (!page.continuationSupported || page.request.version !== 2) return false;
    const root = snapshot.pages[0];
    const last = snapshot.pages.at(-1);
    if (!root || !last) return page.pageIndex === 1 && page.sourcePredictionId === page.ranking.predictionId;
    return page.request.cursor === last.nextCursor && last.nextCursor !== null &&
      page.pageIndex === last.pageIndex + 1 && page.pageIndex <= 51 &&
      page.sourcePredictionId === root.sourcePredictionId && page.featureAt === root.featureAt &&
      page.candidateCount === root.candidateCount && page.availability !== 'CATALOG_EMPTY' &&
      snapshot.items.length + page.ranking.items.length <= root.candidateCount &&
      !page.ranking.items.some(item => Object.hasOwn(snapshot.predictionIds, item.id)) &&
      !snapshot.pages.some(entry => entry.ranking.predictionId === page.ranking.predictionId ||
        entry.request.requestId === page.request.requestId ||
        (page.nextCursor !== null && entry.nextCursor === page.nextCursor));
  }

  function deactivate() {
    active = false;
    generation += 1;
    running = false;
    clearTimeout(timer);
    timer = undefined;
  }

  return {
    scope,
    scopeKey: predictionReaderScopeKey(scope),
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    activate(delayMs = 0) {
      if (active) return;
      active = true;
      if (snapshot.status === 'ready' || snapshot.status === 'error') return;
      timer = setTimeout(() => { timer = undefined; void dispatch(); }, delayMs);
    },
    deactivate,
    loadMore() {
      if (!active || snapshot.status !== 'ready' || running) return;
      const last = snapshot.pages.at(-1);
      if (!last?.nextCursor) return;
      try { pending = createNextPredictionPageRequest(last, options.createRequestId()); }
      catch { publish({ ...snapshot, status: 'error', message: MESSAGE }); return; }
      void dispatch();
    },
    retry() {
      if (snapshot.status === 'error') void dispatch();
    },
    refresh() {
      if (!active) return;
      generation += 1;
      running = false;
      clearTimeout(timer);
      pending = null;
      publish(initial(options.createRequestId()));
      void dispatch();
    },
  };
}

function freezePage(page: PredictionPage): PredictionPage {
  return Object.freeze({ ...page, ranking: Object.freeze({ ...page.ranking,
    items: Object.freeze(page.ranking.items.map(item => Object.freeze({ ...item,
      ...(item.tags ? { tags: Object.freeze([...item.tags]) } : {}),
      ...(item.creators ? { creators: Object.freeze([...item.creators]) } : {}) }))),
    predictions: Object.freeze(page.ranking.predictions.map(prediction => Object.freeze({ ...prediction }))),
  }) });
}
