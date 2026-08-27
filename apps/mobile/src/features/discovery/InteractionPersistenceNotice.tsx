import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RoomTheme } from '../../theme/roomTheme';
import { useItemInteractions } from './ItemInteractionContext';

interface InteractionPersistenceNoticeProps {
  theme: RoomTheme;
}

export function InteractionPersistenceNotice({
  theme,
}: InteractionPersistenceNoticeProps) {
  const { persistenceError, retryPersistence } = useItemInteractions();

  if (!persistenceError) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderColor: theme.base.border }]}
    >
      <Text style={[styles.message, { color: theme.base.textPrimary }]}>
        {persistenceError}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retryPersistence}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
      >
        <Text style={[styles.retryText, { color: theme.ambient.curtainHighlight }]}>
          Yritä uudelleen
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  message: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  retry: {
    minHeight: 30,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
