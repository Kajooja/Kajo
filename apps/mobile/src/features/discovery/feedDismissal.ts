// Movement is deliberate only after one uninterrupted upward drag. Velocity,
// scroll offsets, layout and navigation are not evidence. Shared by both adapters.
export function createFeedDismissal(commit: () => boolean = () => false) {
  let dragging = false; let cancelled = false; let committed = false; let furthest = 0;
  return {
    setCommit(next: () => boolean) { commit = next; },
    reset() { dragging = false; cancelled = false; committed = false; },
    begin() { dragging = !committed; cancelled = false; furthest = 0; },
    move(dx: number, dy: number, touches: number) {
      if (!dragging) return;
      if (touches !== 1 || Math.abs(dx) > Math.max(24, Math.abs(dy))) cancelled = true;
      furthest = Math.min(furthest, dy);
      if (dy - furthest > 36) cancelled = true;
    },
    release(dx: number, dy: number) {
      const complete = dragging && !cancelled && dy <= -96 && Math.abs(dy) > Math.abs(dx) * 1.5;
      dragging = false;
      if (!committed && complete) committed = commit();
      return committed;
    },
    cancel() { dragging = false; cancelled = true; },
    press() { dragging = false; if (!committed) committed = commit(); return committed; },
  };
}
