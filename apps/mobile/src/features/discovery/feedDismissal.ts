export const FEED_DRAG_DISTANCE = 96;
const FLING_DISTANCE = 24;
const FLING_VELOCITY = 0.6;
const VERTICAL_DOMINANCE = 1.5;
const REVERSAL_DISTANCE = 36;

export function isFeedFling(dx: number, dy: number, vx: number, vy: number): boolean {
  return [dx, dy, vx, vy].every(Number.isFinite) && Math.abs(dy) >= FLING_DISTANCE &&
    Math.abs(vy) >= FLING_VELOCITY && Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE &&
    Math.abs(vy) > Math.abs(vx) * VERTICAL_DOMINANCE && Math.sign(vy) === Math.sign(dy);
}

// Only a completed, uninterrupted vertical drag or fling changes the card.
// Responder termination, layout and background changes are never evidence.
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
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) { cancelled = true; return; }
      if (touches !== 1 || Math.abs(dx) > Math.max(24, Math.abs(dy))) cancelled = true;
      if (!direction && Math.abs(dy) > 12) direction = Math.sign(dy);
      const progress = dy * direction;
      furthest = Math.max(furthest, progress);
      if (furthest - progress > REVERSAL_DISTANCE) cancelled = true;
    },
    release(dx: number, dy: number, vx = 0, vy = 0) {
      const velocityValid = Number.isFinite(vx) && Number.isFinite(vy);
      // PanResponder velocities are displacement per millisecond. Require real
      // travel as well as speed so a noisy sample cannot turn a tap into a skip.
      const fling = isFeedFling(dx, dy, vx, vy);
      const reversing = velocityValid && Math.abs(vy) >= FLING_VELOCITY && Math.sign(vy) !== Math.sign(dy);
      const complete = dragging && !cancelled && Number.isFinite(dx) && Number.isFinite(dy) &&
        (Math.abs(dy) >= FEED_DRAG_DISTANCE || fling) && !reversing &&
        Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE && (!direction || direction === Math.sign(dy)) &&
        furthest - dy * direction <= REVERSAL_DISTANCE;
      dragging = false;
      if (!committed && complete) committed = dy < 0 ? commit() : previous();
      return committed;
    },
    cancel() { dragging = false; cancelled = true; },
    press() { dragging = false; if (!committed) committed = commit(); return committed; },
    previous() { dragging = false; if (!committed) committed = previous(); return committed; },
  };
}
