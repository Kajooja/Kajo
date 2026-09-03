import { useState, type PropsWithChildren } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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
import { useAuthSession } from '../auth/AuthSessionProvider';
import { KajoMark } from '../branding/KajoBrand';
import { useEventTracking } from '../events/EventTrackingContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { ITEM_LIST_LABELS } from '../lists/itemListLabels';
import { useItemLists } from '../lists/ItemListsContext';
import { loadMostUsedListIds, rememberRecentList } from '../lists/listRecentUse';
import { selectDrawerQuickLists } from '../lists/listPresentation';
import { useProfileMessages } from '../messages/ProfileMessagesContext';
import { CurtainControl } from '../room/CurtainControl';
import { getCurtainPositionForMode } from '../room/curtainState';
import { useDiscoveryMode } from './DiscoveryModeContext';

const MODE_LABELS = {
  FOR_YOU: 'SINULLE',
  SURPRISE: 'YLLÄTYS',
  RISK: 'RISKI',
} as const;
const MAX_DRAWER_GROUPS = 5;

type ShellOverlay = 'navigation' | 'inbox' | null;

export function DiscoveryModeShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const auth = useAuthSession();
  const { mode, setMode } = useDiscoveryMode();
  const eventTracking = useEventTracking();
  const profiles = useActiveProfile();
  const itemLists = useItemLists();
  const messages = useProfileMessages();
  const { activeProfile } = profiles;
  const theme = getRoomTheme(getAmbientPhase(mode), activeProfile);
  const [overlay, setOverlay] = useState<ShellOverlay>(null);
  const [respondingInvitationId, setRespondingInvitationId] = useState<
    string | null
  >(null);
  const [invitationActionError, setInvitationActionError] = useState<
    string | null
  >(null);
  const [signingOut, setSigningOut] = useState(false);
  const [drawerMostUsedListIds, setDrawerMostUsedListIds] = useState<
    readonly string[]
  >([]);
  const [position] = useState(
    () => new Animated.Value(getCurtainPositionForMode(mode)),
  );
  const identityName =
    activeProfile?.type === 'SHARED'
      ? activeProfile.name
      : profiles.personalProfile?.name ?? 'OMA KAJO';
  const drawerQuickLists = selectDrawerQuickLists(
    itemLists.lists,
    drawerMostUsedListIds,
  );
  const systemSavedList = itemLists.lists.find(
    (list) => list.kind === 'SYSTEM_SAVED',
  );
  const drawerSharedProfiles = profiles.selectableProfiles
    .filter((profile) => profile.type === 'SHARED')
    .slice(0, MAX_DRAWER_GROUPS);
  const inboxUnreadCount = profiles.invitations.length + messages.unreadTotal;
  const inboxBadgeLabel = inboxUnreadCount > 9 ? '9+' : String(inboxUnreadCount);

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

  function goHome() {
    setOverlay(null);
    router.replace('/');
  }

  function toggleOverlay(nextOverlay: Exclude<ShellOverlay, null>) {
    setInvitationActionError(null);
    if (nextOverlay === 'navigation' && overlay !== 'navigation') {
      setDrawerMostUsedListIds(
        activeProfile ? loadMostUsedListIds(activeProfile.id) : [],
      );
    }
    if (nextOverlay === 'inbox' && overlay !== 'inbox') {
      profiles.retryInvitations();
      messages.refresh();
    }
    setOverlay((current) => (current === nextOverlay ? null : nextOverlay));
  }

  function openMessageThread(profileId: string) {
    setOverlay(null);
    router.push(`/messages/${profileId}`);
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

  function openLists() {
    setOverlay(null);
    router.push('/lists');
  }

  function openList(listId: string) {
    const list = itemLists.lists.find((candidate) => candidate.id === listId);
    if (list?.kind === 'CUSTOM') {
      rememberRecentList(list.profileId, list.id);
    }
    setOverlay(null);
    router.push({ pathname: '/lists/[listId]', params: { listId } });
  }

  function openHistory(itemType: 'BOOK' | 'MOVIE') {
    setOverlay(null);
    router.push({ pathname: '/lists/history', params: { itemType } });
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

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    const result = await auth.signOut();

    if (result.status === 'error') {
      setSigningOut(false);
      Alert.alert('Uloskirjautuminen epäonnistui', result.message);
    }
  }

  return (
    <View style={[styles.shell, { backgroundColor: theme.base.appBackground }]}>
      <View
        pointerEvents="none"
        style={[
          styles.shellAmbient,
          {
            backgroundColor: theme.ambient.wash,
            opacity: theme.ambient.washOpacity * 1.2,
          },
        ]}
      />
      <SafeAreaView
        edges={['top']}
        style={[
          styles.safeHeader,
          {
            backgroundColor: theme.surface.appChrome,
            borderBottomColor: theme.base.border,
          },
        ]}
      >
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Palaa huoneeseen. Aktiivinen Kajo ${identityName}.`}
            hitSlop={8}
            onPress={goHome}
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

        {overlay === 'navigation' ? (
          <View style={styles.overlayLayer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sulje valikko"
              onPress={() => setOverlay(null)}
              style={styles.overlayBackdrop}
            />
            <View
              style={[
                styles.drawer,
                {
                  backgroundColor: theme.surface.panel,
                  borderRightColor: theme.base.border,
                },
              ]}
            >
              <ScrollView
                contentContainerStyle={styles.drawerContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.drawerSection}>
                  <Text
                    style={[
                      styles.sectionHeading,
                      { color: theme.base.textPrimary },
                    ]}
                  >
                    Profiili
                  </Text>
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
                        style={[
                          styles.profileName,
                          { color: theme.base.textPrimary },
                        ]}
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

                <View style={styles.drawerSection}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Avaa aktiivisen Kajon listat"
                    onPress={openLists}
                    style={({ pressed }) => [
                      styles.sectionActionHeading,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sectionHeading,
                        { color: theme.base.textPrimary },
                      ]}
                    >
                      {ITEM_LIST_LABELS.lists}
                    </Text>
                    <Text
                      style={[
                        styles.sectionArrow,
                        { color: theme.base.textMuted },
                      ]}
                    >
                      ›
                    </Text>
                  </Pressable>

                  <View style={styles.drawerListLinks}>
                    {systemSavedList ? (
                      <DrawerListLink
                        label={ITEM_LIST_LABELS.saved}
                        meta={`${systemSavedList.itemCount}`}
                        textColor={theme.base.textPrimary}
                        mutedColor={theme.base.textMuted}
                        onPress={() => openList(systemSavedList.id)}
                      />
                    ) : null}
                    {drawerQuickLists.map((list) => (
                      <DrawerListLink
                        key={list.id}
                        label={list.name}
                        meta={`${list.itemCount}`}
                        textColor={theme.base.textPrimary}
                        mutedColor={theme.base.textMuted}
                        onPress={() => openList(list.id)}
                      />
                    ))}
                    <DrawerListLink
                      label="Luetut"
                      textColor={theme.base.textPrimary}
                      mutedColor={theme.base.textMuted}
                      onPress={() => openHistory('BOOK')}
                    />
                    <DrawerListLink
                      label="Katsotut"
                      textColor={theme.base.textPrimary}
                      mutedColor={theme.base.textMuted}
                      onPress={() => openHistory('MOVIE')}
                    />
                  </View>
                </View>

                <View style={styles.drawerSection}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Avaa kaikki ryhmät ja ryhmien luonti"
                    onPress={openGroups}
                    style={({ pressed }) => [
                      styles.sectionActionHeading,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sectionHeading,
                        { color: theme.base.textPrimary },
                      ]}
                    >
                      Ryhmät
                    </Text>
                    <Text
                      style={[
                        styles.sectionArrow,
                        { color: theme.base.textMuted },
                      ]}
                    >
                      ›
                    </Text>
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
                          style={[
                            styles.groupName,
                            { color: theme.base.textPrimary },
                          ]}
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
                      <Text
                        style={[
                          styles.emptyDrawerText,
                          { color: theme.base.textMuted },
                        ]}
                      >
                        Ei vielä aktiivisia ryhmiä.
                      </Text>
                    ) : null}

                    {profiles.sharedProfilesStatus === 'loading' ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.base.textMuted}
                      />
                    ) : null}

                    {profiles.sharedProfilesError ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={profiles.retrySharedProfiles}
                        style={({ pressed }) => [pressed && styles.rowPressed]}
                      >
                        <Text
                          style={[
                            styles.drawerError,
                            { color: theme.base.textMuted },
                          ]}
                        >
                          Ryhmät eivät päivittyneet. Yritä uudelleen.
                        </Text>
                      </Pressable>
                    ) : null}

                    {profiles.sharedProfiles.length >
                    drawerSharedProfiles.length ? (
                      <Text
                        style={[
                          styles.moreGroupsText,
                          { color: theme.base.textMuted },
                        ]}
                      >
                        Kaikki ryhmät löytyvät Ryhmät-kohdasta.
                      </Text>
                    ) : null}
                  </View>
                </View>

                {auth.status === 'signed-in' ? (
                  <View
                    style={[
                      styles.signOutSection,
                      { borderTopColor: theme.base.border },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Kirjaudu ulos Kajosta"
                      disabled={signingOut}
                      onPress={() => void handleSignOut()}
                      style={({ pressed }) => [
                        styles.signOutButton,
                        pressed && styles.rowPressed,
                        signingOut && styles.disabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.signOutText,
                          { color: theme.base.textMuted },
                        ]}
                      >
                        {signingOut ? 'Kirjaudutaan…' : 'Kirjaudu ulos'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {overlay === 'inbox' ? (
          <View style={styles.overlayLayer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sulje postilaatikko"
              onPress={() => setOverlay(null)}
              style={styles.overlayBackdrop}
            />
            <View
              style={[
                styles.inboxPanel,
                {
                  backgroundColor: theme.surface.panel,
                  borderColor: theme.base.border,
                },
              ]}
            >
              <View style={styles.inboxHeader}>
                <View>
                  <Text
                    style={[
                      styles.inboxKicker,
                      { color: theme.base.textMuted },
                    ]}
                  >
                    POSTILAATIKKO
                  </Text>
                  <Text
                    style={[
                      styles.inboxTitle,
                      { color: theme.base.textPrimary },
                    ]}
                  >
                    Kutsut ja viestit
                  </Text>
                </View>
                {profiles.invitationsStatus === 'loading' || messages.status === 'loading' ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.base.textMuted}
                  />
                ) : null}
              </View>

              {profiles.invitationsError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={profiles.retryInvitations}
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <Text
                    style={[
                      styles.inboxError,
                      { color: theme.base.textMuted },
                    ]}
                  >
                    {profiles.invitationsError} Yritä uudelleen.
                  </Text>
                </Pressable>
              ) : null}

              {invitationActionError ? (
                <Text
                  style={[
                    styles.inboxError,
                    { color: theme.base.textPrimary },
                  ]}
                >
                  {invitationActionError}
                </Text>
              ) : null}

              {messages.error ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={messages.refresh}
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <Text style={[styles.inboxError, { color: theme.base.textMuted }]}>
                    {messages.error} Yritä uudelleen.
                  </Text>
                </Pressable>
              ) : null}

              {profiles.invitations.length === 0 && messages.threads.length === 0 &&
              profiles.invitationsStatus !== 'loading' && messages.status !== 'loading' ? (
                <Text
                  style={[
                    styles.emptyInboxText,
                    { color: theme.base.textMuted },
                  ]}
                >
                  Ei uusia kutsuja tai viestejä.
                </Text>
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
                      <Text
                        style={[
                          styles.invitationText,
                          { color: theme.base.textPrimary },
                        ]}
                      >
                        Sinut on kutsuttu ryhmään {invitation.profileName}.
                      </Text>
                      <Text
                        style={[
                          styles.inviterText,
                          { color: theme.base.textMuted },
                        ]}
                      >
                        Kutsuja {invitation.inviter.nickname}
                      </Text>

                      <View style={styles.invitationActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={responseLocked}
                          onPress={() =>
                            void respondToInvitation(invitation.id, true)
                          }
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
                          onPress={() =>
                            void respondToInvitation(invitation.id, false)
                          }
                          style={({ pressed }) => [
                            styles.rejectButton,
                            { borderColor: theme.base.border },
                            pressed && styles.rowPressed,
                            responseLocked && styles.disabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.rejectButtonText,
                              { color: theme.base.textPrimary },
                            ]}
                          >
                            Hylkää
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {messages.threads.map((thread) => (
                  <Pressable
                    key={thread.profileId}
                    accessibilityHint="Avaa viestiketju"
                    accessibilityRole="button"
                    onPress={() => openMessageThread(thread.profileId)}
                    style={({ pressed }) => [
                      styles.threadCard,
                      { borderColor: theme.base.border },
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.threadHeader}>
                      <Text
                        numberOfLines={1}
                        style={[styles.threadName, { color: theme.base.textPrimary }]}
                      >
                        {thread.profileName}
                      </Text>
                      {thread.unreadCount > 0 ? (
                        <View style={styles.threadBadge}>
                          <Text style={styles.threadBadgeText}>
                            {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={2}
                      style={[styles.threadPreview, { color: theme.base.textMuted }]}
                    >
                      {thread.latestMessage
                        ? `${thread.latestMessage.actorNickname}: ${thread.latestMessage.body}`
                        : 'Aloita keskustelu'}
                    </Text>
                    {thread.latestMessage?.itemTitle || thread.latestMessage?.listName ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.threadContext, { color: theme.ambient.curtainHighlight }]}
                      >
                        {[thread.latestMessage.listName, thread.latestMessage.itemTitle]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>

      {profiles.status === 'ready' ? (
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.safeDock,
            {
              backgroundColor: theme.surface.appChrome,
              borderTopColor: theme.base.border,
            },
          ]}
        >
          <View style={styles.bottomDock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Avaa valikko"
              accessibilityState={{ expanded: overlay === 'navigation' }}
              hitSlop={8}
              onPress={() => toggleOverlay('navigation')}
              style={({ pressed }) => [
                styles.dockButton,
                pressed && styles.brandPressed,
              ]}
            >
              <View style={styles.menuGlyph}>
                <View
                  style={[
                    styles.menuLine,
                    { backgroundColor: theme.base.textPrimary },
                  ]}
                />
                <View
                  style={[
                    styles.menuLine,
                    { backgroundColor: theme.base.textPrimary },
                  ]}
                />
                <View
                  style={[
                    styles.menuLine,
                    { backgroundColor: theme.base.textPrimary },
                  ]}
                />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Palaa huoneeseen. Aktiivinen Kajo ${identityName}.`}
              hitSlop={8}
              onPress={goHome}
              style={({ pressed }) => [
                styles.dockContext,
                pressed && styles.brandPressed,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.dockIdentity, { color: theme.base.textMuted }]}
              >
                {identityName}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                inboxUnreadCount > 0
                  ? `Avaa postilaatikko. ${inboxUnreadCount} uutta kutsua tai viestiä.`
                  : 'Avaa postilaatikko'
              }
              accessibilityState={{ expanded: overlay === 'inbox' }}
              hitSlop={8}
              onPress={() => toggleOverlay('inbox')}
              style={({ pressed }) => [
                styles.dockButton,
                pressed && styles.brandPressed,
              ]}
            >
              <Text
                style={[styles.mailIcon, { color: theme.base.textPrimary }]}
              >
                ✉
              </Text>
              {inboxUnreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {inboxBadgeLabel}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

interface DrawerListLinkProps {
  label: string;
  meta?: string;
  textColor: string;
  mutedColor: string;
  onPress: () => void;
}

function DrawerListLink({
  label,
  meta,
  textColor,
  mutedColor,
  onPress,
}: DrawerListLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Avaa lista ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.drawerListRow, pressed && styles.rowPressed]}
    >
      <Text numberOfLines={1} style={[styles.drawerListName, { color: textColor }]}>
        {label}
      </Text>
      {meta ? (
        <Text style={[styles.drawerListMeta, { color: mutedColor }]}>{meta}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  shellAmbient: {
    ...StyleSheet.absoluteFill,
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
  content: {
    flex: 1,
    position: 'relative',
  },
  profileTint: {
    ...StyleSheet.absoluteFill,
    opacity: 0.06,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    elevation: 20,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  drawer: {
    width: '78%',
    maxWidth: 310,
    height: '100%',
    borderRightWidth: 1,
  },
  drawerContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
  },
  drawerSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionActionHeading: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionArrow: {
    fontSize: 25,
    lineHeight: 26,
    fontWeight: '300',
  },
  drawerListLinks: {
    gap: 1,
    paddingLeft: 2,
  },
  drawerListRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  drawerListName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  drawerListMeta: {
    fontSize: 10,
    fontWeight: '600',
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
    fontWeight: '500',
  },
  activeProfileDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
  signOutSection: {
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  signOutButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inboxPanel: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    width: '88%',
    maxWidth: 360,
    maxHeight: 390,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  inboxHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inboxKicker: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginBottom: 2,
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
  threadCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 4,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threadName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  threadPreview: {
    fontSize: 11,
    lineHeight: 16,
  },
  threadContext: {
    fontSize: 10,
    fontWeight: '700',
  },
  threadBadge: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#5f9f72',
  },
  threadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
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
  safeDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomDock: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dockButton: {
    width: 46,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  menuGlyph: {
    width: 19,
    gap: 4,
  },
  menuLine: {
    width: 19,
    height: 1.5,
    borderRadius: 1,
  },
  mailIcon: {
    fontSize: 20,
    lineHeight: 23,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E24A4A',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  rowPressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.55,
  },
});
