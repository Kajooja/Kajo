import { describe, expect, it, vi } from 'vitest';
import { createFeedDismissal } from './feedDismissal';

describe('deliberate feed dismissal', () => {
  it('commits one upward dismissal, never the later accessible duplicate', () => {
    const commit = vi.fn(() => true); const gesture = createFeedDismissal(commit);
    gesture.begin(); gesture.move(8, -130, 1); gesture.release(8, -130); gesture.press();
    gesture.begin(); gesture.release(0, -140);
    expect(commit).toHaveBeenCalledOnce();
  });
  it.each(['partial', 'down', 'sideways', 'multitouch', 'reversed', 'terminated', 'layout', 'background'])('does not submit %s movement', kind => {
    const commit = vi.fn(() => true); const gesture = createFeedDismissal(commit);
    gesture.begin(); gesture.move(0, -120, kind === 'multitouch' ? 2 : 1);
    if (kind === 'reversed') gesture.move(0, -60, 1);
    if (['terminated', 'layout', 'background'].includes(kind)) gesture.cancel();
    gesture.release(kind === 'sideways' ? 150 : 0, kind === 'partial' ? -50 : kind === 'down' ? 130 : -130);
    expect(commit).not.toHaveBeenCalled();
  });
  it('commits reverse navigation once and rejects reversed or multitouch backward drags', () => {
    const next = vi.fn(() => true); const previous = vi.fn(() => true);
    const gesture = createFeedDismissal(next, previous);
    gesture.begin(); gesture.move(0, 130, 1); gesture.release(0, 130); gesture.previous();
    expect(previous).toHaveBeenCalledOnce(); expect(next).not.toHaveBeenCalled();
    gesture.reset(); gesture.begin(); gesture.move(0, 130, 1); gesture.move(0, 50, 1); gesture.release(0, 130);
    gesture.reset(); gesture.begin(); gesture.move(0, 130, 2); gesture.release(0, 130);
    expect(previous).toHaveBeenCalledOnce();
  });
  it('does not switch gesture direction midway even if final movement is large', () => {
    const next = vi.fn(() => true); const previous = vi.fn(() => true);
    const gesture = createFeedDismissal(next, previous);
    gesture.begin(); gesture.move(0, -20, 1); gesture.move(0, 130, 1); gesture.release(0, 130);
    expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
  });
  it('navigation or scroll release without an intentional gesture is inert; button needs no gesture', () => {
    const commit = vi.fn(() => true); const gesture = createFeedDismissal(commit);
    gesture.release(0, -800); expect(commit).not.toHaveBeenCalled();
    gesture.press(); expect(commit).toHaveBeenCalledOnce();
  });
  it('permits a new deliberate attempt after local admission failed or rejection was resolved', () => {
    const commit = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const gesture = createFeedDismissal(commit);
    expect(gesture.press()).toBe(false); expect(gesture.press()).toBe(true);
    gesture.reset(); expect(gesture.press()).toBe(true); expect(commit).toHaveBeenCalledTimes(3);
  });
  it.each([-1, 1])('accepts a short fast vertical fling in direction %s only once', direction => {
    const next = vi.fn(() => true); const previous = vi.fn(() => true);
    const gesture = createFeedDismissal(next, previous);
    gesture.begin(); gesture.move(3, direction * 24, 1);
    expect(gesture.release(3, direction * 24, 0.1, direction * 0.6)).toBe(true);
    gesture.release(3, direction * 24, 0.1, direction * 0.6);
    gesture.begin(); gesture.release(3, direction * 30, 0.1, direction);
    expect(direction < 0 ? next : previous).toHaveBeenCalledOnce();
    expect(direction < 0 ? previous : next).not.toHaveBeenCalled();
  });
  it.each([
    { name: 'short slow drag', dx: 0, dy: -50, vx: 0, vy: -0.59 },
    { name: 'fast tap-sized movement', dx: 0, dy: -23, vx: 0, vy: -2 },
    { name: 'diagonal displacement', dx: 20, dy: -30, vx: 0, vy: -2 },
    { name: 'diagonal velocity', dx: 0, dy: -30, vx: 0.8, vy: -1 },
    { name: 'reverse release velocity', dx: 0, dy: -120, vx: 0, vy: 0.8 },
    { name: 'invalid fling velocity', dx: 0, dy: -30, vx: 0, vy: -Infinity },
    { name: 'invalid displacement', dx: 0, dy: -Infinity, vx: 0, vy: -2 },
  ])('rejects $name without issuing either navigation action', ({ dx, dy, vx, vy }) => {
    const next = vi.fn(() => true); const previous = vi.fn(() => true);
    const gesture = createFeedDismissal(next, previous);
    gesture.begin(); gesture.move(dx, dy, 1);
    expect(gesture.release(dx, dy, vx, vy)).toBe(false);
    expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
  });
  it.each(['multitouch', 'reversed', 'terminated', 'layout', 'background'])('does not revive a %s gesture with release velocity', kind => {
    const next = vi.fn(() => true); const previous = vi.fn(() => true);
    const gesture = createFeedDismissal(next, previous);
    gesture.begin(); gesture.move(0, -80, kind === 'multitouch' ? 2 : 1);
    if (kind === 'reversed') gesture.move(0, -30, 1);
    if (['terminated', 'layout', 'background'].includes(kind)) gesture.cancel();
    expect(gesture.release(0, -40, 0, -2)).toBe(false);
    expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
  });
  it('checks reversal at release even when no final move event was delivered', () => {
    const commit = vi.fn(() => true); const gesture = createFeedDismissal(commit);
    gesture.begin(); gesture.move(0, -150, 1);
    expect(gesture.release(0, -100, 0, -1)).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
  it('keeps legacy distance-only callers and permits another fling after admission fails', () => {
    const commit = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const gesture = createFeedDismissal(commit);
    gesture.begin(); gesture.move(0, -30, 1);
    expect(gesture.release(0, -30)).toBe(false); expect(commit).not.toHaveBeenCalled();
    gesture.begin(); gesture.move(0, -30, 1);
    expect(gesture.release(0, -30, 0, -1)).toBe(false);
    gesture.release(0, -30, 0, -1); expect(commit).toHaveBeenCalledOnce();
    gesture.begin(); gesture.move(0, -30, 1);
    expect(gesture.release(0, -30, 0, -1)).toBe(true);
    expect(commit).toHaveBeenCalledTimes(2);
    gesture.reset(); gesture.begin(); gesture.move(0, -100, 1);
    expect(gesture.release(0, -100)).toBe(true);
  });
});
