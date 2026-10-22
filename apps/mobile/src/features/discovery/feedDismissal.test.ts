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
});
