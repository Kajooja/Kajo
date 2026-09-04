import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
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

export function BottomProfileControl({
  identityName,
  textPrimary,
  textMuted,
  panelColor,
  borderColor,
  onOpen,
}: BottomProfileControlProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profiles = useActiveProfile();
  const rememberedActiveKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [useState, setUseState] = useState(() =>
    loadSharedProfileUse(profiles.actorUserId),
  );

  useEffect(() => {
    rememberedActiveKey.current = null;
    setUseState(loadSharedProfileUse(profiles.actorUserId));
  }, [profiles.actorUserId]);

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

    setUseState(
      rememberSharedProfileUse(
        profiles.actorUserId,
        profiles.activeProfile.id,
      ),
    );
  }, [
    profiles.activeProfile?.id,
    profiles.activeProfile?.type,
    profiles.actorUserId,
  ]);

  const quickProfiles = useMemo(
    () => selectQuickSharedProfiles(profiles.selectableProfiles, useState, 5),
    [profiles.selectableProfiles, useState],
  );

  function openSwitcher() {
    onOpen?.();
    setUseState(loadSharedProfileUse(profiles.actorUserId));
    setOpen(true);
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
        accessibilityLabel={`Avaa ryhmien pikavalinta. Aktiivinen Kajo ${identityName}.`}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={openSwitcher}
        style={({ pressed }) => [
          styles.dockContext,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.dockIdentity, { color: textMuted }]}
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
            accessibilityLabel="Sulje ryhmien pikavalinta"
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
              <Text style={[styles.kicker, { color: textMuted }]}>RYHMÄT</Text>
              {profiles.sharedProfilesStatus === 'loading' ? (
                <ActivityIndicator size="small" color={textMuted} />
              ) : null}
            </View>

            <View style={styles.profileList}>
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
                <Text style={[styles.emptyText, { color: textMuted }]}>
                  Ei vielä aktiivisia ryhmiä.
                </Text>
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
                  <Text style={[styles.retryText, { color: textMuted }]}>
                    Ryhmät eivät päivittyneet. Yritä uudelleen.
                  </Text>
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
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modalLayer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  profileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
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
