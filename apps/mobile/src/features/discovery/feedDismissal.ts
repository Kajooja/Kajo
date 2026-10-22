// Only a completed, uninterrupted vertical drag advances or reverses the feed.
// Description scrolling, responder termination and layout are never evidence.
export function createFeedDismissal(commit: () => boolean = () => false, previous: () => boolean = () => false) {
  let dragging = false; let cancelled = false; let committed = false;
  let direction = 0; let furthest = 0;
  return {
    setCommit(next: () => boolean) { commit = next; },
    setPrevious(next: () => boolean) { previous = next; },
    reset() { dragging = false; cancelled = false; committed = false; direction = 0; furthest = 0; },
    begin() { dragging = !committed; cancelled = false; direction = 0; furthest = 0; },
    move(dx: number, dy: number, touches: number) {
      if (!dragging) return;
      if (touches !== 1 || Math.abs(dx) > Math.max(24, Math.abs(dy))) cancelled = true;
      if (!direction && Math.abs(dy) > 12) direction = Math.sign(dy);
      const progress = dy * direction;
      furthest = Math.max(furthest, progress);
      if (furthest - progress > 36) cancelled = true;
    },
    release(dx: number, dy: number) {
      const complete = dragging && !cancelled && Math.abs(dy) >= 96 &&
        Math.abs(dy) > Math.abs(dx) * 1.5 && (!direction || direction === Math.sign(dy));
      dragging = false;
      if (!committed && complete) committed = dy < 0 ? commit() : previous();
      return committed;
    },
    cancel() { dragging = false; cancelled = true; },
    press() { dragging = false; if (!committed) committed = commit(); return committed; },
    previous() { dragging = false; if (!committed) committed = previous(); return committed; },
  };
}
