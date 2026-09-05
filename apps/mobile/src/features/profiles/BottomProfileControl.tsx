import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActiveProfile } from './ActiveProfileContext';
import {
  loadSharedProfileUse,
  rememberSharedProfileUse,
} from './sharedProfileRecentUse';
import { selectQuickSharedProfiles } from './sharedProfileQuickAccess';

interface BottomProfileControlProps {
  identityName: string;
  textPrimary: string;
  textMuted: string;
  panelColor: string;
  borderColor: string;
  onOpen?: () => void;
}

interface UsageSnapshot {
  actorUserId: string | null;
  use: ReturnType<typeof loadSharedProfileUse>;
}

export function BottomProfileControl({
  identityName,
  textPrimary,
  textMuted,
  panelColor,
  borderColor,
  onOpen,
}: BottomProfileControlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const profiles = useActiveProfile();
  const rememberedActiveKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot>(() => ({
    actorUserId: profiles.actorUserId,
    use: loadSharedProfileUse(profiles.actorUserId),
  }));

  useEffect(() => {
    if (
      profiles.activeProfile?.type !== 'SHARED' ||
      !profiles.actorUserId
    ) {
      rememberedActiveKey.current = null;
      return;
    }

    const activeKey = `${profiles.actorUserId}:${profiles.activeProfile.id}`;
    if (rememberedActiveKey.current === activeKey) return;
    rememberedActiveKey.current = activeKey;

    rememberSharedProfileUse(
      profiles.actorUserId,
      profiles.activeProfile.id,
    );
  }, [
    profiles.activeProfile?.id,
    profiles.activeProfile?.type,
    profiles.actorUserId,
  ]);

  const currentUsage =
    usageSnapshot.actorUserId === profiles.actorUserId
      ? usageSnapshot.use
      : loadSharedProfileUse(profiles.actorUserId);
  const quickProfiles = useMemo(
    () => selectQuickSharedProfiles(profiles.selectableProfiles, currentUsage, 5),
    [profiles.selectableProfiles, currentUsage],
  );
  const isHome = pathname === '/';

  function openSwitcher() {
    onOpen?.();
    setUsageSnapshot({
      actorUserId: profiles.actorUserId,
      use: loadSharedProfileUse(profiles.actorUserId),
    });
    setOpen(true);
  }

  function handleCenterPress() {
    onOpen?.();
    if (!isHome) {
      setOpen(false);
      router.replace('/');
      return;
    }
    openSwitcher();
  }

  function switchProfile(profileId: string) {
    if (!profiles.selectProfile(profileId)) return;
    setOpen(false);
  }

  function showMore() {
    setOpen(false);
    router.push('/profiles/shared');
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isHome
            ? `Avaa profiilien pikavalinta. Aktiivinen Kajo ${identityName}.`
            : `Palaa aktiivisen Kajon ${identityName} etusivulle.`
        }
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={handleCenterPress}
        style={({ pressed }) => [
          styles.dockContext,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.dockIdentity, { color: textPrimary }]}
        >
          {identityName}
        </Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.modalLayer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sulje profiilien pikavalinta"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />

          <View
            style={[
              styles.panel,
              {
                backgroundColor: panelColor,
                borderColor,
                marginBottom: insets.bottom + 54,
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.kicker, { color: textMuted }]}>PROFIILIT</Text>
              {profiles.sharedProfilesStatus === 'loading' ? (
                <ActivityIndicator size="small" color={textMuted} />
              ) : null}
            </View>

            <View style={styles.profileList}>
              {profiles.personalProfile ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Vaihda omaan Kajoon ${profiles.personalProfile.name}`}
                  onPress={() => switchProfile(profiles.personalProfile!.id)}
                  style={({ pressed }) => [
                    styles.profileRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.profileIdentity}>
                    <Text
                      numberOfLines={1}
                      style={[styles.profileName, { color: textPrimary }]}
                    >
                      {profiles.personalProfile.name}
                    </Text>
                    <Text style={[styles.profileMeta, { color: textMuted }]}>OMA KAJO</Text>
                  </View>
                  {profiles.activeProfile?.id === profiles.personalProfile.id ? (
                    <View
                      accessibilityLabel="Aktiivinen profiili"
                      style={[styles.activeDot, { backgroundColor: textPrimary }]}
                    />
                  ) : null}
                </Pressable>
              ) : null}

              <View style={[styles.groupDivider, { borderTopColor: borderColor }]}>
                <Text style={[styles.groupKicker, { color: textMuted }]}>RYHMÄT</Text>
              </View>

              {quickProfiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Vaihda ryhmään ${profile.name}`}
                  onPress={() => switchProfile(profile.id)}
                  style={({ pressed }) => [
                    styles.profileRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.profileName, { color: textPrimary }]}
                  >
                    {profile.name}
                  </Text>
                  {profiles.activeProfile?.id === profile.id ? (
                    <View
                      accessibilityLabel="Aktiivinen ryhmä"
                      style={[styles.activeDot, { backgroundColor: textPrimary }]}
                    />
                  ) : null}
                </Pressable>
              ))}

              {quickProfiles.length === 0 &&
              profiles.sharedProfilesStatus !== 'loading' ? (
                <Text style={[styles.emptyText, { color: textMuted }]}>Ei vielä aktiivisia ryhmiä.</Text>
              ) : null}

              {profiles.sharedProfilesError ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Yritä päivittää ryhmät uudelleen"
                  onPress={profiles.retrySharedProfiles}
                  style={({ pressed }) => [
                    styles.retryRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.retryText, { color: textMuted }]}>Ryhmät eivät päivittyneet. Yritä uudelleen.</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Näytä kaikki ryhmät"
              onPress={showMore}
              style={({ pressed }) => [
                styles.moreRow,
                { borderTopColor: borderColor },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.moreText, { color: textPrimary }]}>Näytä lisää</Text>
              <Text style={[styles.moreArrow, { color: textMuted }]}>›</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dockContext: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dockIdentity: {
    maxWidth: 190,
    fontFamily: Platform.select({
      android: 'sans-serif-rounded',
      ios: 'Avenir Next',
      default: undefined,
    }),
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.35,
    lineHeight: 17,
  },
  modalLayer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  panel: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingTop: 13,
    overflow: 'hidden',
  },
  header: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  profileList: {
    paddingVertical: 5,
  },
  profileRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
  },
  profileIdentity: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  profileMeta: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  groupDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    paddingTop: 10,
    paddingBottom: 2,
  },
  groupKicker: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 10,
  },
  retryRow: {
    minHeight: 36,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 11,
    lineHeight: 16,
  },
  moreRow: {
    minHeight: 44,
    marginHorizontal: -15,
    paddingHorizontal: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  moreArrow: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },
  pressed: {
    opacity: 0.68,
  },
});
