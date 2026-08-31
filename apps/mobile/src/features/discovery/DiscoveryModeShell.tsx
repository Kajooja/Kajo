import { useState, type PropsWithChildren } from 'react';
import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme } from '../../theme/roomTheme';
import { KajoMark } from '../branding/KajoBrand';
import { useEventTracking } from '../events/EventTrackingContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { CurtainControl } from '../room/CurtainControl';
import { getCurtainPositionForMode } from '../room/curtainState';
import { useDiscoveryMode } from './DiscoveryModeContext';
import {
  createSharedSuggestionEventInput,
  resolveSharedSuggestionItem,
} from './sharedSuggestion';

const MODE_LABELS = {
  FOR_YOU: 'SINULLE',
  SURPRISE: 'YLLÄTYS',
  RISK: 'RISKI',
} as const;

interface SuggestionReceipt {
  profileId: string;
  itemId: string;
}

export function DiscoveryModeShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { itemId } = useGlobalSearchParams<{ itemId?: string | string[] }>();
  const { mode, setMode } = useDiscoveryMode();
  const eventTracking = useEventTracking();
  const { activeProfile } = useActiveProfile();
  const theme = getRoomTheme(getAmbientPhase(mode), activeProfile);
  const suggestionItem = resolveSharedSuggestionItem(
    activeProfile,
    pathname,
    itemId,
  );
  const [suggestionReceipt, setSuggestionReceipt] =
    useState<SuggestionReceipt | null>(null);
  const suggestionSent = Boolean(
    suggestionItem &&
      activeProfile?.type === 'SHARED' &&
      suggestionReceipt?.profileId === activeProfile.id &&
      suggestionReceipt.itemId === suggestionItem.id,
  );
  const [position] = useState(
    () => new Animated.Value(getCurtainPositionForMode(mode)),
  );

  function changeMode(nextMode: typeof mode) {
    if (nextMode !== mode) {
      eventTracking.recordEvent({
        eventType: 'DISCOVERY_MODE_CHANGED',
        discoveryMode: nextMode,
        properties: {
          previousDiscoveryMode: mode,
          source: 'GLOBAL_MODE_BAR',
        },
      });
    }

    setMode(nextMode);
  }

  function suggestCurrentItem() {
    if (
      !suggestionItem ||
      activeProfile?.type !== 'SHARED' ||
      eventTracking.status !== 'ready' ||
      suggestionSent
    ) {
      return;
    }

    const eventId = eventTracking.recordEvent(
      createSharedSuggestionEventInput(suggestionItem, mode),
    );

    if (!eventId) {
      return;
    }

    setSuggestionReceipt({
      profileId: activeProfile.id,
      itemId: suggestionItem.id,
    });
  }

  return (
    <View style={[styles.shell, { backgroundColor: theme.base.appBackground }]}>
      <SafeAreaView
        edges={['top']}
        style={[
          styles.safeHeader,
          {
            backgroundColor: theme.base.appBackground,
            borderBottomColor: theme.base.border,
          },
        ]}
      >
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Palaa huoneeseen"
            hitSlop={8}
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}
          >
            <KajoMark />
          </Pressable>
          <View style={styles.control}>
            <View style={styles.labelRow} pointerEvents="none">
              <Text style={[styles.label, { color: theme.base.textMuted }]}>LÖYTÖTILA</Text>
              <Text style={[styles.value, { color: theme.base.textPrimary }]}>
                {MODE_LABELS[mode]}
              </Text>
            </View>
            <CurtainControl
              mode={mode}
              onModeChange={changeMode}
              position={position}
              baseTheme={theme.base}
              ambientTheme={theme.ambient}
            />
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.content}>
        {children}
        {activeProfile?.type === 'SHARED' ? (
          <View
            pointerEvents="none"
            style={[
              styles.profileTint,
              { backgroundColor: theme.base.sceneBackground },
            ]}
          />
        ) : null}
        {suggestionItem && activeProfile?.type === 'SHARED' ? (
          <View
            style={[
              styles.suggestionPanel,
              {
                backgroundColor: theme.base.sceneBackground,
                borderColor: theme.base.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                suggestionSent ? 'Ehdotettu yhteiseen Kajoon' : 'Ehdota yhteiseen Kajoon'
              }
              accessibilityState={{
                disabled: suggestionSent || eventTracking.status !== 'ready',
              }}
              disabled={suggestionSent || eventTracking.status !== 'ready'}
              onPress={suggestCurrentItem}
              style={({ pressed }) => [
                styles.suggestionButton,
                pressed && styles.brandPressed,
                (suggestionSent || eventTracking.status !== 'ready') && styles.disabled,
              ]}
            >
              <Text
                style={[
                  styles.suggestionText,
                  { color: theme.base.textPrimary },
                ]}
              >
                {suggestionSent ? 'EHDOTETTU' : 'EHDOTA YHTEISEEN'}
              </Text>
            </Pressable>
            {eventTracking.persistenceError ? (
              <View style={styles.suggestionErrorRow}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.suggestionErrorText,
                    { color: theme.base.textMuted },
                  ]}
                >
                  Tallennus kesken.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Yritä ehdotuksen tallennusta uudelleen"
                  onPress={eventTracking.retryPersistence}
                  style={({ pressed }) => [pressed && styles.brandPressed]}
                >
                  <Text
                    style={[
                      styles.retryText,
                      { color: theme.base.textPrimary },
                    ]}
                  >
                    Yritä uudelleen
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  safeHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brand: {
    width: 104,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPressed: {
    opacity: 0.72,
  },
  control: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  value: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  profileTint: {
    ...StyleSheet.absoluteFill,
    opacity: 0.06,
  },
  suggestionPanel: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 20,
    maxWidth: 190,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  suggestionButton: {
    minHeight: 30,
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  suggestionErrorRow: {
    gap: 4,
  },
  suggestionErrorText: {
    fontSize: 10,
    lineHeight: 13,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  disabled: {
    opacity: 0.55,
  },
});
