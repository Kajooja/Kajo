import { describe, expect, it, vi } from 'vitest';
import { createDiscoveryCollectionGesture } from './discoveryCollectionGesture';

function pager() {
  let position = 0;
  let time = 1000;
  const completions: { offset: number; complete: () => void }[] = [];
  const change = vi.fn();
  const move = vi.fn((offset: number) => { position = offset; });
  const snap = vi.fn((offset: number, complete: () => void) => { completions.push({ offset, complete }); });
  const control = createDiscoveryCollectionGesture({ change, move, snap,
    readOffset: () => position, now: () => time });
  control.commit(400, true);
  return { control, change, move, snap,
    position: () => position,
    setPosition: (offset: number) => { position = offset; },
    advance: (milliseconds: number) => { time += milliseconds; },
    finish: (index = completions.length - 1) => {
      const completion = completions[index]!;
      position = completion.offset;
      completion.complete();
    },
  };
}

const motion = (dx: number, dy = 0, extra = {}) => ({ dx, dy, numberActiveTouches: 1, ...extra });

describe('Discovery and canonical history page gestures', () => {
  it('follows one finger left into history and right back, with both pages inert until each snap settles', () => {
    const p = pager();
    expect(p.control.isActive('discovery')).toBe(true);
    expect(p.control.begin(motion(0))).toBe(false);
    expect(p.control.capture(motion(-20, 2))).toBe(true);
    expect(p.position()).toBe(-20);
    expect(p.control.getState().historyRequested).toBe(true);
    expect(p.control.isActive('discovery')).toBe(false);
    expect(p.control.isActive('history')).toBe(false);
    p.control.grant();
    p.control.move(motion(-100, 3));
    expect(p.position()).toBe(-120);
    p.control.release(motion(-100, 3, { numberActiveTouches: 0 }));
    expect(p.control.getState()).toMatchObject({ selected: 'history', settled: false, historyRequested: true });
    p.finish();
    expect(p.control.isActive('history')).toBe(true);

    p.control.begin(motion(0));
    expect(p.control.capture(motion(24, 1))).toBe(true);
    p.control.grant();
    p.control.move(motion(96, 0));
    expect(p.position()).toBe(-280);
    p.control.release(motion(96, 0, { numberActiveTouches: 0 }));
    expect(p.control.getState()).toMatchObject({ selected: 'discovery', settled: false, historyRequested: false });
    p.finish();
    expect(p.control.isActive('discovery')).toBe(true);
  });

  it('preserves capture displacement across native grant reset without counting it twice', () => {
    const p = pager();
    p.control.begin();
    expect(p.control.capture(motion(-32, 3))).toBe(true);
    expect(p.position()).toBe(-32);
    p.control.grant();
    p.control.move(motion(0, 0));
    expect(p.position()).toBe(-32);
    p.control.move(motion(-10, 0));
    expect(p.position()).toBe(-42);
    p.control.release(motion(-10, 0, { vx: -0.8, vy: 0, numberActiveTouches: 0 }));
    expect(p.control.getState().selected).toBe('history');
    p.finish();
    expect(p.position()).toBe(-400);
  });

  it('bounds both outer edges and never captures ordinary vertical or ambiguous grid scrolling', () => {
    const p = pager();
    for (const first of [motion(30), motion(3, -20), motion(-16, 12), motion(0, 80)]) {
      p.control.begin();
      expect(p.control.capture(first)).toBe(false);
      expect(p.control.capture(motion(-200))).toBe(false);
      p.control.release(motion(-200));
    }
    expect(p.snap).not.toHaveBeenCalled();
    expect(p.control.isActive('discovery')).toBe(true);
    p.control.select('history'); p.finish();
    p.control.begin();
    expect(p.control.capture(motion(-100))).toBe(false);
    p.control.release(motion(-200));
    expect(p.control.isActive('history')).toBe(true);
    p.control.begin();
    expect(p.control.capture(motion(30))).toBe(true);
    p.control.grant(); p.control.move(motion(600));
    expect(p.position()).toBe(0);
  });

  it('allows undecided subthreshold motion to become a deliberate horizontal drag', () => {
    const p = pager();
    p.control.begin();
    expect(p.control.capture(motion(-7, 4))).toBe(false);
    expect(p.control.capture(motion(-20, 5))).toBe(true);
    p.control.release(motion(-120, 5));
    p.finish();
    expect(p.control.isActive('history')).toBe(true);
  });

  it.each(['short', 'reversed', 'vertical', 'multitouch'] as const)('cancels a %s captured drag without selecting history', reason => {
    const p = pager();
    p.control.begin(); p.control.capture(motion(-24)); p.control.grant();
    if (reason === 'reversed') {
      p.control.move(motion(-120)); p.control.move(motion(-80));
    } else if (reason === 'vertical') p.control.move(motion(-20, 60));
    else if (reason === 'multitouch') p.control.move(motion(-120, 0, { numberActiveTouches: 2 }));
    p.control.release(motion(reason === 'short' ? 0 : -200, 0, { vx: -2, numberActiveTouches: 0 }));
    expect(p.control.getState().selected).toBe('discovery');
    p.finish();
    expect(p.control.isActive('discovery')).toBe(true);
  });

  it.each(['second-start-capture', 'responder-start'] as const)('recovers after multitouch arrives through %s', path => {
    const p = pager();
    p.control.begin(); p.control.capture(motion(-24)); p.control.grant();
    if (path === 'second-start-capture') p.control.begin({ numberActiveTouches: 2 });
    else p.control.touches(2);
    p.control.release(motion(-200, 0, { numberActiveTouches: 0 }));
    expect(p.control.getState().selected).toBe('discovery');
    p.finish();
    expect(p.control.isActive('discovery')).toBe(true);
    p.control.begin();
    expect(p.control.capture(motion(-120))).toBe(true);
    p.control.release(motion(-120)); p.finish();
    expect(p.control.isActive('history')).toBe(true);
  });

  it('rejects a gesture that starts with several touches, and termination or grant rejection leaves no release action', () => {
    const p = pager();
    p.control.begin({ numberActiveTouches: 2 });
    expect(p.control.capture(motion(-200))).toBe(false);
    p.control.release(motion(-200));
    expect(p.snap).not.toHaveBeenCalled();
    for (let index = 0; index < 2; index++) {
      p.control.begin(); p.control.capture(motion(-32));
      if (index === 0) p.control.grant();
      p.control.cancel();
      p.control.release(motion(-300, 0, { vx: -3 }));
      p.finish();
      expect(p.control.isActive('discovery')).toBe(true);
    }
  });

  it.each([
    { travel: -32, speed: -0.6, vertical: 0, delay: 0, selected: 'history' },
    { travel: -31, speed: -2, vertical: 0, delay: 0, selected: 'discovery' },
    { travel: -40, speed: -2, vertical: 0, delay: 101, selected: 'discovery' },
    { travel: -40, speed: 2, vertical: 0, delay: 0, selected: 'discovery' },
    { travel: -40, speed: -1, vertical: 1, delay: 0, selected: 'discovery' },
  ])('requires sufficient travel, fresh matching horizontal speed for flick $travel/$speed/$delay', ({ travel, speed, vertical, delay, selected }) => {
    const p = pager();
    p.control.begin(); p.control.capture(motion(travel)); p.control.grant();
    p.advance(delay);
    p.control.release(motion(0, 0, { vx: speed, vy: vertical, numberActiveTouches: 0 }));
    expect(p.control.getState().selected).toBe(selected);
  });

  it('resizes and backgrounds cancel a captured gesture and invalidate an outstanding snap completion', () => {
    const p = pager();
    p.control.begin(); p.control.capture(motion(-40)); p.control.grant();
    p.control.commit(600, true);
    expect(p.position()).toBe(0);
    p.control.release(motion(-300));
    expect(p.control.isActive('discovery')).toBe(true);
    expect(p.snap).not.toHaveBeenCalled();
    p.control.select('history');
    p.control.commit(600, false);
    expect(p.control.isActive('history')).toBe(false);
    expect(p.control.getState()).toMatchObject({ selected: 'history', settled: true, historyRequested: false });
    p.finish();
    expect(p.control.isActive('history')).toBe(false);
    p.control.commit(600, true);
    expect(p.control.isActive('history')).toBe(true);
  });

  it('disposal rejects old responders, header actions and animation completions while a fresh scope starts at Find', () => {
    const p = pager();
    p.control.select('history');
    p.control.clear();
    const count = p.change.mock.calls.length;
    p.finish(); p.control.begin();
    expect(p.control.capture(motion(120))).toBe(false);
    p.control.release(motion(120)); p.control.select('discovery'); p.control.commit(400, true);
    expect(p.change).toHaveBeenCalledTimes(count);
    expect(p.control.isActive('history')).toBe(false);
    const replacement = pager();
    expect(replacement.control.isActive('discovery')).toBe(true);
    expect(replacement.control.getState().historyRequested).toBe(false);
  });

  it('lets a new drag interrupt a pending snap and ignores its late completion', () => {
    const p = pager();
    p.control.select('history');
    p.setPosition(-160);
    p.control.begin();
    expect(p.control.capture(motion(24))).toBe(true);
    expect(p.position()).toBe(-136);
    p.control.grant(); p.control.move(motion(20));
    expect(p.position()).toBe(-116);
    p.finish(0);
    expect(p.control.getState()).toMatchObject({ selected: 'history', settled: false });
    expect(p.control.isActive('history')).toBe(false);
    p.control.release(motion(100));
    expect(p.control.getState().selected).toBe('discovery');
    p.finish(0);
    expect(p.control.getState().settled).toBe(false);
    p.finish(1);
    expect(p.control.isActive('discovery')).toBe(true);
  });

  it('admits another drag after short cancellation before its snap callback, and repeated tabs obey only the newest completion', () => {
    const p = pager();
    p.control.begin(); p.control.capture(motion(-20)); p.control.grant(); p.control.release(motion(0));
    p.control.begin();
    expect(p.control.capture(motion(-40))).toBe(true);
    p.control.grant(); p.control.release(motion(0, 0, { vx: -1 }));
    expect(p.control.getState().selected).toBe('history');
    p.finish(0);
    expect(p.control.getState().settled).toBe(false);
    p.control.select('discovery'); p.control.select('history');
    p.finish(2);
    expect(p.control.getState()).toMatchObject({ selected: 'history', settled: false });
    p.finish(3);
    expect(p.control.isActive('history')).toBe(true);
  });

  it('reduced motion can finish a snap without removing direct finger movement', () => {
    const p = pager();
    p.control.select('history'); p.control.finishMotion();
    expect(p.position()).toBe(-400);
    expect(p.control.isActive('history')).toBe(true);
    p.control.begin(); p.control.capture(motion(40));
    p.control.finishMotion();
    expect(p.position()).toBe(-360);
    expect(p.control.getState().settled).toBe(false);
    p.control.cancel(); p.finish();
    expect(p.control.isActive('history')).toBe(true);
  });
});
