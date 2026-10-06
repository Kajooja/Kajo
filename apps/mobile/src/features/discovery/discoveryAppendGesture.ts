// Own only a downward gesture that began at the end of this committed grid.
// Native RefreshControl covers the top; this also works at the bottom on Android.
export function createDiscoveryAppendGesture(viewId = '') {
  let current: { key: string; enabled: boolean; append: () => void } | null = null;
  let requestedKey: string | null = null;
  let startKey: string | null = null;
  let viewport = 0;
  let content = 0;
  let offset = 0;
  const downward = (dx: number, dy: number) => dy > Math.abs(dx) * 2;
  const ready = () => Boolean(current?.enabled && requestedKey !== current.key);

  function append() {
    if (!current || !ready()) return;
    requestedKey = current.key;
    current.append();
  }

  return {
    commit(key: string, enabled: boolean, onAppend: () => void) {
      const identity = `${viewId}:${key}`;
      if (current?.key !== identity) requestedKey = null;
      current = { key: identity, enabled, append: onAppend };
    },
    clear() { current = null; startKey = null; },
    layout(height: number) { viewport = Math.max(0, height); },
    contentSize(height: number) { content = Math.max(0, height); },
    scroll(y: number) { offset = Math.max(0, y); },
    begin() {
      startKey = ready() && viewport > 0 && offset + viewport >= content - 24
        ? current!.key : null;
      return false;
    },
    capture(dx: number, dy: number) {
      return Boolean(ready() && startKey !== null && startKey === current?.key && dy > 12 && downward(dx, dy));
    },
    release(dx: number, dy: number) {
      if (startKey !== null && startKey === current?.key && dy >= 64 && downward(dx, dy)) append();
      startKey = null;
    },
    terminate() { startKey = null; },
    append,
  };
}
