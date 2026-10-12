interface NetworkState {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}
interface NetworkSource {
  getState: () => Promise<NetworkState>;
  subscribe: (listener: (state: NetworkState) => void) => { remove: () => void };
}

// Native reachability is advisory. It never acknowledges a backend request or
// changes an action/exposure queue. The focused reader owns all recovery limits.
export function watchPredictionConnectivity(
  reader: { setConnectivity: (reachable: boolean | null) => void },
  network: NetworkSource,
): () => void {
  let stopped = false;
  let revision = 0;
  let subscription: { remove: () => void } | undefined;
  const apply = (state: NetworkState) => {
    if (stopped) return;
    reader.setConnectivity(state.isConnected === false || state.isInternetReachable === false
      ? false : state.isConnected === true && state.isInternetReachable === true ? true : null);
  };
  try {
    subscription = network.subscribe(state => { revision += 1; apply(state); });
    const captured = revision;
    void network.getState().then(state => {
      if (revision === captured) apply(state);
    }).catch(() => { /* Unknown reachability keeps manual recovery available. */ });
  } catch { /* Native subscription failures are not evidence of connectivity. */ }
  return () => { stopped = true; subscription?.remove(); };
}

// Router focus alone remains true when the whole application is backgrounded.
// Stop the transport and native listener there too, then resume the same reader.
export function watchFocusedPredictionReader(
  reader: { activate: (delayMs: number) => void; deactivate: () => void; setConnectivity: (value: boolean | null) => void },
  network: NetworkSource,
  app: { currentState: string | null; addEventListener: (event: 'change', listener: (state: string) => void) => { remove: () => void } },
  delayMs: number,
): () => void {
  let stopped = false;
  let foreground = false;
  let stopNetwork: (() => void) | undefined;
  const changed = (state: string | null) => {
    if (stopped) return;
    const next = state === 'active' || state === null;
    if (next === foreground) return;
    foreground = next;
    if (next) {
      reader.activate(delayMs);
      stopNetwork = watchPredictionConnectivity(reader, network);
    } else {
      stopNetwork?.(); stopNetwork = undefined;
      reader.deactivate();
    }
  };
  const subscription = app.addEventListener('change', changed);
  changed(app.currentState);
  return () => {
    stopped = true;
    subscription.remove();
    stopNetwork?.();
    reader.deactivate();
  };
}
