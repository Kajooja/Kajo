import { describe, expect, it, vi } from 'vitest';
import { watchPredictionConnectivity, watchFocusedPredictionReader } from './predictionConnectivity';

const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: true, isInternetReachable: false };
function harness() {
  let publish!: (state: typeof online | object) => void;
  let resolve!: (state: typeof online | object) => void;
  const reader = { setConnectivity: vi.fn() };
  const remove = vi.fn();
  const getState = vi.fn(() => new Promise<typeof online | object>(done => { resolve = done; }));
  const stop = watchPredictionConnectivity(reader, {
    getState, subscribe: listener => { publish = listener; return { remove }; },
  });
  return { reader, remove, stop, getState, publish, resolve };
}

describe('native reachability subscription ownership', () => {
  it.each(['active', 'background'])('only runs in a focused foreground app, initially %s', initial => {
    const reader = { activate: vi.fn(), deactivate: vi.fn(), setConnectivity: vi.fn() };
    const networkRemove = vi.fn(), appRemove = vi.fn();
    const network = { getState: vi.fn(() => new Promise<typeof online>(() => {})), subscribe: vi.fn(() => ({ remove: networkRemove })) };
    let changed!: (state: string) => void;
    const stop = watchFocusedPredictionReader(reader, network, { currentState: initial,
      addEventListener: (_, listener) => { changed = listener; return { remove: appRemove }; } }, 600);
    expect(reader.activate).toHaveBeenCalledTimes(initial === 'active' ? 1 : 0);
    expect(network.subscribe).toHaveBeenCalledTimes(initial === 'active' ? 1 : 0);
    changed('active'); changed('active');
    expect(reader.activate).toHaveBeenCalledTimes(1);
    expect(reader.activate).toHaveBeenCalledWith(600);
    changed('background');
    expect(reader.deactivate).toHaveBeenCalledOnce();
    expect(networkRemove).toHaveBeenCalledOnce();
    changed('active');
    expect(reader.activate).toHaveBeenCalledTimes(2);
    stop(); changed('active');
    expect(reader.activate).toHaveBeenCalledTimes(2);
    expect(networkRemove).toHaveBeenCalledTimes(2);
    expect(appRemove).toHaveBeenCalledOnce();
  });
  it('does not let an old initial snapshot replace a newer offline notification', async () => {
    const h = harness();
    h.publish(offline); h.resolve(online); await Promise.resolve();
    expect(h.reader.setConnectivity.mock.calls).toEqual([[false]]);
    h.publish(online);
    expect(h.reader.setConnectivity.mock.calls).toEqual([[false], [true]]);
    h.stop();
  });

  it('treats incomplete state as unknown and requires both connectivity indicators', async () => {
    const h = harness();
    h.resolve({}); await Promise.resolve();
    h.publish({ isConnected: true });
    h.publish({ isConnected: false, isInternetReachable: true });
    h.publish(online);
    expect(h.reader.setConnectivity.mock.calls).toEqual([[null], [null], [false], [true]]);
    h.stop();
  });

  it('removes its native listener and ignores callbacks and initial replies after blur/unmount', async () => {
    const h = harness();
    h.stop(); h.publish(online); h.resolve(online); await Promise.resolve();
    expect(h.remove).toHaveBeenCalledOnce();
    expect(h.reader.setConnectivity).not.toHaveBeenCalled();
  });

  it('does not fabricate online state when native setup or initial lookup fails', async () => {
    const reader = { setConnectivity: vi.fn() };
    watchPredictionConnectivity(reader, { getState: vi.fn(), subscribe: () => { throw new Error('unavailable'); } })();
    const remove = vi.fn();
    const stop = watchPredictionConnectivity(reader, { getState: async () => { throw new Error('unknown'); },
      subscribe: () => ({ remove }) });
    await Promise.resolve(); await Promise.resolve();
    expect(reader.setConnectivity).not.toHaveBeenCalled();
    stop(); expect(remove).toHaveBeenCalledOnce();
  });
});
