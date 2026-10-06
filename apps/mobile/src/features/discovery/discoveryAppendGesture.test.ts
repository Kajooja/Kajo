import { describe, expect, it, vi } from 'vitest';
import { createDiscoveryAppendGesture } from './discoveryAppendGesture';

function grid() {
  const gesture = createDiscoveryAppendGesture();
  const append = vi.fn();
  gesture.commit('page1', true, append);
  gesture.layout(600); gesture.contentSize(2000); gesture.scroll(1400);
  return { gesture, append };
}

describe('downward append at the end of the Discovery grid', () => {
  it('captures a deliberate pull from anywhere in the bottom viewport and coalesces tap and pull', () => {
    const { gesture, append } = grid();
    expect(gesture.begin()).toBe(false);
    expect(gesture.capture(3, 20)).toBe(true);
    gesture.release(4, 80); gesture.append();
    gesture.begin(); gesture.release(0, 80);
    expect(append).toHaveBeenCalledTimes(1);
    // A completed append keeps the grid but advances its receipt identity.
    gesture.commit('page2', true, append);
    gesture.begin(); gesture.release(0, 80);
    expect(append).toHaveBeenCalledTimes(2);
  });

  it('leaves ordinary scrolling and short, upward or sideways drags alone', () => {
    const { gesture, append } = grid();
    gesture.scroll(900); gesture.begin();
    expect(gesture.capture(0, 80)).toBe(false);
    gesture.release(0, 80);
    gesture.scroll(1400);
    for (const [dx, dy] of [[0, -80], [70, 20], [0, 8], [0, 40]]) {
      gesture.begin(); gesture.release(dx!, dy!);
    }
    expect(append).not.toHaveBeenCalled();
  });

  it('requires measured layout and allows a short list to continue', () => {
    const { gesture, append } = grid();
    gesture.layout(0); gesture.begin(); gesture.release(0, 80);
    expect(append).not.toHaveBeenCalled();
    gesture.layout(600); gesture.contentSize(400); gesture.scroll(0);
    gesture.begin(); gesture.release(0, 80);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('does not append while loading, exhausted, unfocused, or after disposal', () => {
    const { gesture, append } = grid();
    gesture.commit('page1', false, append);
    gesture.begin(); expect(gesture.capture(0, 80)).toBe(false);
    gesture.release(0, 80); gesture.append();
    gesture.commit('page1', true, append); gesture.begin(); gesture.clear();
    gesture.release(0, 80); gesture.append();
    expect(append).not.toHaveBeenCalled();
  });

  it('rejects a gesture whose captured page was replaced during the drag', () => {
    const { gesture, append } = grid();
    gesture.begin(); gesture.commit('page2', true, append);
    expect(gesture.capture(0, 80)).toBe(false); gesture.release(0, 80);
    expect(append).not.toHaveBeenCalled();
  });

  it('cancels an interrupted gesture without consuming the next append', () => {
    const { gesture, append } = grid();
    gesture.begin(); gesture.terminate(); gesture.release(0, 80);
    gesture.append(); expect(append).toHaveBeenCalledTimes(1);
  });
});
