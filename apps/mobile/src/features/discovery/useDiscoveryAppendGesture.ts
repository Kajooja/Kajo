import { useLayoutEffect, useMemo } from 'react';
import { PanResponder, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { createDiscoveryAppendGesture } from './discoveryAppendGesture';

export function useDiscoveryAppendGesture(viewId: string, pageKey: string, enabled: boolean, onAppend: () => void) {
  const control = useMemo(() => createDiscoveryAppendGesture(viewId), [viewId]);
  useLayoutEffect(() => { control.commit(pageKey, enabled, onAppend); });
  useLayoutEffect(() => control.clear, [control]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: control.begin,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => control.capture(gesture.dx, gesture.dy),
    onPanResponderRelease: (_event, gesture) => control.release(gesture.dx, gesture.dy),
    onPanResponderTerminate: control.terminate,
    onPanResponderTerminationRequest: () => false,
  }), [control]);
  return {
    panHandlers: responder.panHandlers,
    onLayout: (event: LayoutChangeEvent) => control.layout(event.nativeEvent.layout.height),
    onContentSizeChange: (_width: number, height: number) => control.contentSize(height),
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => control.scroll(event.nativeEvent.contentOffset.y),
    append: control.append,
  };
}
