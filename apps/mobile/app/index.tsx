import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KajoMark } from '@/features/branding/KajoBrand';
import { RoomScreen } from '@/features/room/RoomScreen';

export default function IndexScreen() {
  return (
    <View style={styles.root}>
      <RoomScreen />
      <SafeAreaView pointerEvents="none" edges={['top']} style={styles.brandOverlay}>
        <View style={styles.brandRow}>
          <KajoMark />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  brandOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  brandRow: {
    alignItems: 'center',
    paddingTop: 5,
  },
});
