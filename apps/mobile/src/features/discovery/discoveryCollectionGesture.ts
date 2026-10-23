export type DiscoveryCollectionPage = 'discovery' | 'history';

export interface DiscoveryCollectionState {
  selected: DiscoveryCollectionPage;
  settled: boolean;
  enabled: boolean;
  historyRequested: boolean;
}

type Motion = { dx: number; dy: number; numberActiveTouches?: number; vx?: number; vy?: number };
interface Presentation {
  change: (state: DiscoveryCollectionState) => void;
  move: (offset: number) => void;
  snap: (offset: number, complete: () => void) => void;
  readOffset?: () => number;
  now?: () => number;
}

// One controller belongs to one actor/Profile/session/domain/mode scope. Native
// responders and animation completions retain that owner, never a later scope.
export function createDiscoveryCollectionGesture(presentation: Presentation) {
  const now = presentation.now ?? Date.now;
  let state: DiscoveryCollectionState = { selected: 'discovery', settled: true, enabled: false, historyRequested: false };
  let alive = true;
  let width = 0;
  let animation = 0;
  let intent: 'pending' | 'blocked' | 'horizontal' = 'blocked';
  let origin: DiscoveryCollectionPage = 'discovery';
  let capturedX = 0;
  let capturedY = 0;
  let granted = false;
  let direction = 0;
  let largestTravel = 0;
  let lastX = 0;
  let lastMovement = 0;
  let dragOffset = 0;
  let activation = 0;

  function publish(next: DiscoveryCollectionState) {
    if (!alive) return;
    if (Object.keys(next).every(key => next[key as keyof typeof next] === state[key as keyof typeof state])) return;
    if (next.enabled !== state.enabled || next.settled !== state.settled || next.selected !== state.selected) activation++;
    state = next;
    presentation.change(state);
  }
  const offset = (page: DiscoveryCollectionPage) => page === 'history' ? -width : 0;
  function stopAtSelection() {
    animation++;
    intent = 'blocked';
    presentation.move(offset(state.selected));
    publish({ ...state, settled: true, historyRequested: state.enabled && state.selected === 'history' });
  }
  function settle(page: DiscoveryCollectionPage) {
    if (!alive) return;
    intent = 'blocked';
    const token = ++animation;
    publish({ ...state, selected: page, settled: false, historyRequested: state.enabled && page === 'history' });
    presentation.snap(offset(page), () => {
      if (!alive || token !== animation) return;
      publish({ ...state, settled: true });
    });
  }
  function cancel() {
    if (intent === 'horizontal') settle(origin);
    else intent = 'blocked';
  }
  function coordinates(motion: Motion) {
    return { x: motion.dx + (granted ? capturedX : 0), y: motion.dy + (granted ? capturedY : 0) };
  }
  function drag(motion: Motion) {
    if (!alive || intent !== 'horizontal') return false;
    const { x, y } = coordinates(motion);
    const travel = x * direction;
    if ((motion.numberActiveTouches ?? 1) > 1 || Math.abs(y) > Math.max(24, Math.abs(x) / 1.5) ||
      travel < 0 || largestTravel - travel > 16) {
      cancel();
      return false;
    }
    if (Math.abs(x - lastX) >= 1) lastMovement = now();
    lastX = x;
    largestTravel = Math.max(largestTravel, travel);
    presentation.move(Math.max(-width, Math.min(0, dragOffset + x)));
    return true;
  }

  return {
    mount() {
      if (alive) return;
      alive = true;
      activation++;
      stopAtSelection();
      presentation.change({ ...state });
    },
    getState: () => state,
    getLease: (page: DiscoveryCollectionPage) => alive && state.enabled && state.settled && state.selected === page ? activation : null,
    isActive: (page: DiscoveryCollectionPage, lease?: number | null) => alive && state.enabled && state.settled && state.selected === page &&
      (lease === undefined || lease !== null && lease === activation),
    commit(nextWidth: number, enabled: boolean) {
      if (!alive) return;
      const resized = nextWidth > 0 && nextWidth !== width;
      if (nextWidth > 0) width = nextWidth;
      const disabled = !enabled && state.enabled;
      publish({ ...state, enabled, historyRequested: enabled && (intent === 'horizontal' ? origin === 'discovery' : state.selected === 'history') });
      if (resized || disabled) stopAtSelection();
    },
    select(page: DiscoveryCollectionPage) {
      if (!alive || !state.enabled || !width) return;
      if (state.selected === page && state.settled) return;
      settle(page);
    },
    begin(motion?: Pick<Motion, 'numberActiveTouches'>) {
      if (intent === 'horizontal') { cancel(); return false; }
      intent = alive && state.enabled && width > 0 && (motion?.numberActiveTouches ?? 1) === 1 ? 'pending' : 'blocked';
      capturedX = capturedY = largestTravel = lastX = 0;
      granted = false;
      return false;
    },
    capture(motion: Motion) {
      if (!alive || intent !== 'pending') return false;
      if ((motion.numberActiveTouches ?? 1) > 1) { intent = 'blocked'; return false; }
      const x = Math.abs(motion.dx), y = Math.abs(motion.dy);
      if (Math.max(x, y) < 12) return false;
      if (x < y * 1.5) { intent = 'blocked'; return false; }
      origin = state.selected;
      direction = origin === 'discovery' ? -1 : 1;
      if (motion.dx * direction <= 0) { intent = 'blocked'; return false; }
      intent = 'horizontal';
      capturedX = motion.dx;
      capturedY = motion.dy;
      largestTravel = motion.dx * direction;
      lastX = motion.dx;
      lastMovement = now();
      dragOffset = presentation.readOffset?.() ?? offset(origin);
      animation++;
      // Revoke commands synchronously, before React commits the preview render.
      publish({ ...state, settled: false, historyRequested: origin === 'discovery' });
      presentation.move(Math.max(-width, Math.min(0, dragOffset + motion.dx)));
      return true;
    },
    grant() { if (intent === 'horizontal') granted = true; },
    touches(count: number) { if (count > 1) { cancel(); intent = 'blocked'; } },
    move: drag,
    release(motion: Motion) {
      if (!drag(motion)) return;
      const { x } = coordinates(motion);
      const travel = x * direction;
      const fast = travel >= 32 && (motion.vx ?? 0) * direction >= 0.6 &&
        Math.abs(motion.vx ?? 0) >= Math.abs(motion.vy ?? 0) * 1.5 && now() - lastMovement <= 100;
      const complete = travel >= Math.min(120, Math.max(72, width * 0.25)) || fast;
      settle(complete ? origin === 'discovery' ? 'history' : 'discovery' : origin);
    },
    cancel,
    finishMotion() { if (alive && intent !== 'horizontal') stopAtSelection(); },
    clear() {
      animation++;
      intent = 'blocked';
      alive = false;
    },
  };
}
