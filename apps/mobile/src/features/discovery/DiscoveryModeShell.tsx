import { useState, type PropsWithChildren } from 'react';
import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
const MAX_DRAWER_GROUPS = 5;

type ShellOverlay = 'profiles' | 'inbox' | null;

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
  const profiles = useActiveProfile();
  const { activeProfile } = profiles;
  const theme = getRoomTheme(getAmbientPhase(mode), activeProfile);
  const suggestionItem = resolveSharedSuggestionItem(
    activeProfile,
    pathname,
    itemId,
  );
  const [suggestionReceipt, setSuggestionReceipt] =
    useState<SuggestionReceipt | null>(null);
  const [overlay, setOverlay] = useState<ShellOverlay>(null);
  const [respondingInvitationId, setRespondingInvitationId] = useState<
    string | null
  >(null);
  const [invitationActionError, setInvitationActionError] = useState<
    string | null
  >(null);
  const suggestionSent = Boolean(
    suggestionItem &&
      activeProfile?.type === 'SHARED' &&
      suggestionReceipt?.profileId === activeProfile.id &&
      suggestionReceipt.itemId === suggestionItem.id,
  );
  const [position] = useState(
    () => new Animated.Value(getCurtainPositionForMode(mode)),
  );
  const identityName =
    activeProfile?.type === 'SHARED'
      ? activeProfile.name
      : profiles.personalProfile?.name ?? 'OMA KAJO';
  const drawerSharedProfiles = profiles.selectableProfiles
    .filter((profile) => profile.type === 'SHARED')
    .slice(0, MAX_DRAWER_GROUPS);

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

  function toggleOverlay(nextOverlay: Exclude<ShellOverlay, null>) {
    setInvitationActionError(null);
    setOverlay((current) => (current === nextOverlay ? null : nextOverlay));
  }

  function switchProfile(profileId: string) {
    if (profiles.selectProfile(profileId)) {
      setOverlay(null);
      setInvitationActionError(null);
    }
  }

  function openGroups() {
    setOverlay(null);
    router.push('/profiles/shared');
  }

  async function respondToInvitation(invitationId: string, accept: boolean) {
    if (respondingInvitationId) return;

    setRespondingInvitationId(invitationId);
    setInvitationActionError(null);
    const result = await profiles.respondSharedProfileInvitation(
      invitationId,
      accept,
    );
    setRespondingInvitationId(null);

    if (result.status === 'error') {
      setInvitationActionError(result.message);
    }
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
            <View style={styles.brandMark}>
              <KajoMark />
            </View>
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

          {profiles.status === 'ready' ? (
            <View style={styles.accountControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  profiles.invitations.length > 0
                    ? `Avaa kutsut. ${profiles.invitations.length} uutta kutsua.`
                    : 'Avaa kutsut'
                }
                hitSlop={6}
                onPress={() => toggleOverlay('inbox')}
                style={({ pressed }) => [
                  styles.mailButton,
                  pressed && styles.brandPressed,
                ]}
              >
                <Text style={[styles.mailIcon, { color: theme.base.textPrimary }]}>✉</Text>
                {profiles.invitations.length > 0 ? (
                  <View style={styles.notificationDot} />
                ) : null}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Vaihda Kajo-profiilia. Aktiivinen ${identityName}.`}
                hitSlop={6}
                onPress={() => toggleOverlay('profiles')}
                style={({ pressed }) => [
                  styles.identityButton,
                  pressed && styles.brandPressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.identityText, { color: theme.base.textPrimary }]}
                >
                  {identityName}
                </Text>
              </Pressable>
            </View>
          ) : null}
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

        {overlay === 'profiles' ? (
          <View style={styles.overlayLayer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sulje profiilivalikko"
              onPress={() => setOverlay(null)}
              style={styles.overlayBackdrop}
            />
            <View
              style={[
                styles.drawer,
                {
                  backgroundColor: theme.base.sceneBackground,
                  borderRightColor: theme.base.border,
                },
              ]}
            >
              <View style={styles.drawerTop}>
                <Text style={[styles.drawerKicker, { color: theme.base.textMuted }]}>KAJO</Text>
                {profiles.personalProfile ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Vaihda omaan Kajoon ${profiles.personalProfile.name}`}
                    onPress={() => switchProfile(profiles.personalProfile!.id)}
                    style={({ pressed }) => [
                      styles.profileRow,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.profileName, { color: theme.base.textPrimary }]}
                    >
                      {profiles.personalProfile.name}
                    </Text>
                    {activeProfile?.id === profiles.personalProfile.id ? (
                      <View
                        style={[
                          styles.activeProfileDot,
                          { backgroundColor: theme.base.textPrimary },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                ) : null}
              </View>

              <View style={[styles.drawerDivider, { backgroundColor: theme.base.border }]} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Avaa kaikki ryhmät ja ryhmien luonti"
                onPress={openGroups}
                style={({ pressed }) => [
                  styles.groupsHeading,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={[styles.groupsTitle, { color: theme.base.textPrimary }]}>Ryhmät</Text>
                <Text style={[styles.groupsArrow, { color: theme.base.textMuted }]}>›</Text>
              </Pressable>

              <View style={styles.groupList}>
                {drawerSharedProfiles.map((profile) => (
                  <Pressable
                    key={profile.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Vaihda ryhmään ${profile.name}`}
                    onPress={() => switchProfile(profile.id)}
                    style={({ pressed }) => [
                      styles.profileRow,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.groupName, { color: theme.base.textPrimary }]}
                    >
                      {profile.name}
                    </Text>
                    {activeProfile?.id === profile.id ? (
                      <View
                        style={[
                          styles.activeProfileDot,
                          { backgroundColor: theme.base.textPrimary },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                ))}

                {drawerSharedProfiles.length === 0 ? (
                  <Text style={[styles.emptyDrawerText, { color: theme.base.textMuted }]}>Ei vielä aktiivisia ryhmiä.</Text>
                ) : null}

                {profiles.sharedProfilesStatus === 'loading' ? (
                  <ActivityIndicator size="small" color={theme.base.textMuted} />
                ) : null}

                {profiles.sharedProfilesError ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={profiles.retrySharedProfiles}
                    style={({ pressed }) => [pressed && styles.rowPressed]}
                  >
                    <Text style={[styles.drawerError, { color: theme.base.textMuted }]}>Ryhmät eivät päivittyneet. Yritä uudelleen.</Text>
                  </Pressable>
                ) : null}

                {profiles.sharedProfiles.length > drawerSharedProfiles.length ? (
                  <Text style={[styles.moreGroupsText, { color: theme.base.textMuted }]}>Kaikki ryhmät ja odottavat kutsut löytyvät Ryhmät-kohdasta.</Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {overlay === 'inbox' ? (
          <View style={styles.overlayLayer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sulje kutsut"
              onPress={() => setOverlay(null)}
              style={styles.overlayBackdrop}
            />
            <View
              style={[
                styles.inboxPanel,
                {
                  backgroundColor: theme.base.sceneBackground,
                  borderColor: theme.base.border,
                },
              ]}
            >
              <View style={styles.inboxHeader}>
                <Text style={[styles.inboxTitle, { color: theme.base.textPrimary }]}>Kutsut</Text>
                {profiles.invitationsStatus === 'loading' ? (
                  <ActivityIndicator size="small" color={theme.base.textMuted} />
                ) : null}
              </View>

              {profiles.invitationsError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={profiles.retryInvitations}
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <Text style={[styles.inboxError, { color: theme.base.textMuted }]}>{profiles.invitationsError} Yritä uudelleen.</Text>
                </Pressable>
              ) : null}

              {invitationActionError ? (
                <Text style={[styles.inboxError, { color: theme.base.textPrimary }]}>{invitationActionError}</Text>
              ) : null}

              {profiles.invitations.length === 0 &&
              profiles.invitationsStatus !== 'loading' ? (
                <Text style={[styles.emptyInboxText, { color: theme.base.textMuted }]}>Ei uusia kutsuja.</Text>
              ) : null}

              <ScrollView
                contentContainerStyle={styles.invitationList}
                style={styles.invitationScroll}
              >
                {profiles.invitations.map((invitation) => {
                  const responding = respondingInvitationId === invitation.id;
                  const responseLocked = respondingInvitationId !== null;

                  return (
                    <View
                      key={invitation.id}
                      style={[
                        styles.invitationCard,
                        { borderColor: theme.base.border },
                      ]}
                    >
                      <Text style={[styles.invitationText, { color: theme.base.textPrimary }]}>
                        Sinut on kutsuttu ryhmään {invitation.profileName}.
                      </Text>
                      <Text style={[styles.inviterText, { color: theme.base.textMuted }]}>
                        Kutsuja {invitation.inviter.nickname}
                      </Text>

                      <View style={styles.invitationActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={responseLocked}
                          onPress={() => void respondToInvitation(invitation.id, true)}
                          style={({ pressed }) => [
                            styles.acceptButton,
                            { backgroundColor: theme.base.structureLight },
                            pressed && styles.rowPressed,
                            responseLocked && styles.disabled,
                          ]}
                        >
                          {responding ? (
                            <ActivityIndicator
                              size="small"
                              color={theme.base.appBackground}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.acceptButtonText,
                                { color: theme.base.appBackground },
                              ]}
                            >
                              Hyväksy
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          disabled={responseLocked}
                          onPress={() => void respondToInvitation(invitation.id, false)}
                          style={({ pressed }) => [
                            styles.rejectButton,
                            { borderColor: theme.base.border },
                            pressed && styles.rowPressed,
                            responseLocked && styles.disabled,
                          ]}
                        >
                          <Text style={[styles.rejectButtonText, { color: theme.base.textPrimary }]}>Hylkää</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    width: 76,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  brandMark: {
    transform: [{ scale: 0.72 }],
  },
  brandPressed: {
    opacity: 0.72,
  },
  control: {
    flex: 1,
    minWidth: 104,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  value: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  accountControls: {
    maxWidth: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  mailButton: {
    width: 34,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailIcon: {
    fontSize: 19,
    lineHeight: 22,
  },
  notificationDot: {
    position: 'absolute',
    top: 5,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E24A4A',
  },
  identityButton: {
    minWidth: 46,
    maxWidth: 74,
    minHeight: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  identityText: {
    maxWidth: 74,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'right',
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
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 20,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  drawer: {
    width: '78%',
    maxWidth: 310,
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
  },
  drawerTop: {
    gap: 8,
  },
  drawerKicker: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  drawerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
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
    fontSize: 18,
    fontWeight: '600',
  },
  activeProfileDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  groupsHeading: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupsTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  groupsArrow: {
    fontSize: 25,
    lineHeight: 26,
    fontWeight: '300',
  },
  groupList: {
    marginTop: 4,
    gap: 2,
  },
  groupName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyDrawerText: {
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 8,
  },
  drawerError: {
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 6,
  },
  moreGroupsText: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  inboxPanel: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: '88%',
    maxWidth: 360,
    maxHeight: 390,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  inboxHeader: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inboxTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inboxError: {
    fontSize: 11,
    lineHeight: 16,
  },
  emptyInboxText: {
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 6,
  },
  invitationScroll: {
    maxHeight: 315,
  },
  invitationList: {
    gap: 10,
  },
  invitationCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 5,
  },
  invitationText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  inviterText: {
    fontSize: 11,
    lineHeight: 15,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  acceptButton: {
    minHeight: 36,
    minWidth: 88,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  acceptButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rejectButton: {
    minHeight: 36,
    minWidth: 78,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  rejectButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowPressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.55,
  },
});
