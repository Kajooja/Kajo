import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, PanResponder, type LayoutChangeEvent } from 'react-native';
import { createDiscoveryCollectionGesture, type DiscoveryCollectionPage, type DiscoveryCollectionState } from './discoveryCollectionGesture';

function createPagerPresentation(scope: string) {
  const value = new Animated.Value(0);
  let animation: Animated.CompositeAnimation | null = null;
  let offset = 0;
  let reduced = false;
  function stop() { animation?.stop(); animation = null; value.stopAnimation(); }
  function move(next: number) { stop(); offset = next; value.setValue(next); }
  return { scope, value, move, stop, readOffset: () => offset,
    setReduced: (next: boolean) => { reduced = next; },
    listen: () => {
      const listener = value.addListener(event => { offset = event.value; });
      return () => value.removeListener(listener);
    },
    snap: (next: number, complete: () => void) => {
      stop();
      if (reduced) { move(next); complete(); return; }
      animation = Animated.timing(value, { toValue: next, duration: 180, useNativeDriver: true });
      animation.start(({ finished }) => { if (finished) complete(); });
    },
  };
}

export function useDiscoveryCollectionPager(scope: string, focused: boolean) {
  const [, setRendered] = useState<DiscoveryCollectionState | null>(null);
  const [width, setWidth] = useState(0);
  const appActive = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const routeFocused = useRef(focused);
  const presentation = useMemo(() => createPagerPresentation(scope), [scope]);
  const control = useMemo(() => createDiscoveryCollectionGesture({
    change: setRendered,
    move: presentation.move,
    readOffset: presentation.readOffset,
    snap: presentation.snap,
  }), [presentation]);
  const state = control.getState();
  useLayoutEffect(() => {
    control.mount();
    return () => { control.clear(); presentation.stop(); };
  }, [control, presentation]);
  useLayoutEffect(() => {
    routeFocused.current = focused;
    control.commit(width, focused && appActive.current);
  }, [control, focused, width]);
  useEffect(() => presentation.listen(), [presentation]);
  useEffect(() => {
    let mounted = true;
    let preferenceRevision = 0;
    function preferenceChanged(value: boolean) {
      presentation.setReduced(value);
      if (value) control.finishMotion();
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && preferenceRevision === 0) preferenceChanged(value);
    }).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceRevision++;
      preferenceChanged(value);
    });
    const lifecycle = AppState.addEventListener('change', value => {
      appActive.current = value === 'active';
      control.commit(width, routeFocused.current && appActive.current);
    });
    return () => { mounted = false; preference.remove(); lifecycle.remove(); };
  }, [control, presentation, width]);
  useEffect(() => {
    if (!focused) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (control.getState().selected !== 'history') return false;
      control.select('discovery');
      return true;
    });
    return () => back.remove();
  }, [control, focused]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_event, motion) => control.begin(motion),
    onMoveShouldSetPanResponderCapture: (_event, motion) => control.capture(motion),
    onPanResponderGrant: control.grant,
    onPanResponderStart: (_event, motion) => control.touches(motion.numberActiveTouches),
    onPanResponderMove: (_event, motion) => { control.move(motion); },
    onPanResponderRelease: (_event, motion) => { control.release(motion); },
    onPanResponderTerminate: control.cancel,
    onPanResponderReject: control.cancel,
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => true,
  }), [control]);
  return { ...state, width, translateX: presentation.value, panHandlers: responder.panHandlers,
    onLayout: (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.width;
      control.commit(next, routeFocused.current && appActive.current);
      setWidth(next);
    },
    select: control.select,
    isActive: control.isActive,
    getLease: control.getLease,
    active: (page: DiscoveryCollectionPage) => focused && state.enabled && state.settled && state.selected === page,
  };
}

export type DiscoveryCollectionPagerState = ReturnType<typeof useDiscoveryCollectionPager>;
