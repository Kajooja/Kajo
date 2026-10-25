import { useRef } from 'react';
import { BlurTargetView, BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { withColorAlpha, type RoomTheme } from '../../theme/roomTheme';
import { RoomBackdrop } from '../room/RoomScreen';

// Shared visual layers only. Taste can use the same card background without
// mounting Discovery navigation, impressions or action controllers.
export function DiscoveryBackdrop({ theme, clear = false, cardWash = false }: {
  theme: RoomTheme; clear?: boolean; cardWash?: boolean;
}) {
  const target = useRef<View>(null);
  return <>
    <BlurTargetView ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <RoomBackdrop />
    </BlurTargetView>
    {!clear ? <>
      <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" blurReductionFactor={2}
        intensity={72} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,
        { backgroundColor: withColorAlpha(theme.base.appBackground, 0.4) }]} />
    </> : null}
    {cardWash ? <View pointerEvents="none" style={[StyleSheet.absoluteFill,
      { backgroundColor: theme.ambient.wash, opacity: theme.ambient.washOpacity * 1.35 }]} /> : null}
  </>;
}
