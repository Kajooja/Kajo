import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoomTheme } from '../../theme/roomTheme';
import { DiscoveryEndRefresh } from './DiscoveryEndRefresh';

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useMemo: (factory: () => unknown) => factory(),
  useLayoutEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) lifecycle.cleanups.push(cleanup);
  },
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
}));

type Gesture = { dx: number; dy: number };
type Props = {
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: string;
  accessibilityState?: { disabled: boolean };
  onMoveShouldSetPanResponderCapture?: (event: unknown, gesture: Gesture) => boolean;
  onPanResponderRelease?: (event: unknown, gesture: Gesture) => void;
};
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function render(disabled = false) {
  const onRefresh = vi.fn();
  const nodes = elements(DiscoveryEndRefresh({ theme: getRoomTheme('DAWN'), disabled, onRefresh }));
  return { onRefresh, surface: nodes[0]!.props,
    button: nodes.find(node => node.props.accessibilityRole === 'button')!.props };
}

beforeEach(() => { lifecycle.cleanups = []; });
describe('refreshing from the terminal Discovery notice', () => {
  it('starts the existing refresh from a deliberate downward pull', () => {
    const { surface, onRefresh } = render();
    expect(surface.onMoveShouldSetPanResponderCapture!({}, { dx: 3, dy: 20 })).toBe(true);
    surface.onPanResponderRelease!({}, { dx: 4, dy: 80 });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('leaves upward and sideways scrolling alone and ignores short pulls', () => {
    const { surface, onRefresh } = render();
    for (const gesture of [{ dx: 0, dy: -80 }, { dx: 70, dy: 20 }, { dx: 0, dy: 8 }]) {
      expect(surface.onMoveShouldSetPanResponderCapture!({}, gesture)).toBe(false);
      surface.onPanResponderRelease!({}, gesture);
    }
    surface.onPanResponderRelease!({}, { dx: 0, dy: 40 });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('provides a labelled button for gesture-free refresh at the same location', () => {
    const { button, onRefresh } = render();
    expect(button.accessibilityState).toEqual({ disabled: false });
    button.onPress!();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated pulls and taps before the new request replaces the footer', () => {
    const { surface, button, onRefresh } = render();
    surface.onPanResponderRelease!({}, { dx: 0, dy: 80 });
    button.onPress!();
    surface.onPanResponderRelease!({}, { dx: 0, dy: 80 });
    expect(surface.onMoveShouldSetPanResponderCapture!({}, { dx: 0, dy: 80 })).toBe(false);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh while disabled by loading or reader focus', () => {
    const { surface, button, onRefresh } = render(true);
    expect(button.disabled).toBe(true);
    expect(surface.onMoveShouldSetPanResponderCapture!({}, { dx: 0, dy: 80 })).toBe(false);
    surface.onPanResponderRelease!({}, { dx: 0, dy: 80 });
    button.onPress!();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores old native callbacks after its request or Profile footer unmounts', () => {
    const { surface, button, onRefresh } = render();
    lifecycle.cleanups.forEach(cleanup => cleanup());
    expect(surface.onMoveShouldSetPanResponderCapture!({}, { dx: 0, dy: 80 })).toBe(false);
    surface.onPanResponderRelease!({}, { dx: 0, dy: 80 });
    button.onPress!();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
