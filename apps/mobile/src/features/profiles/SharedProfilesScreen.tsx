import { useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useActiveProfile } from './ActiveProfileContext';
import {
  MAXIMUM_SHARED_PROFILE_NAME_LENGTH,
  MAXIMUM_SHARED_PROFILE_NICKNAME_LENGTH,
} from './sharedProfileOperations';

export function SharedProfilesScreen() {
  const profiles = useActiveProfile();
  const { mode } = useDiscoveryMode();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const [newProfileName, setNewProfileName] = useState('');
  const [creating, setCreating] = useState(false);
  const [invitingToProfileId, setInvitingToProfileId] = useState<string | null>(null);
  const [memberNickname, setMemberNickname] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [leavingProfileId, setLeavingProfileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const personalProfile = profiles.personalProfile;
  const personalProfileId = personalProfile?.id ?? null;

  function openProfile(profileId: string) {
    if (!profiles.selectProfile(profileId)) {
      setActionError('Tätä Kajoa ei voi avata vielä.');
      return;
    }

    setActionError(null);
    router.replace('/');
  }

  async function handleCreate() {
    if (creating) return;

    setCreating(true);
    setActionError(null);
    setActionNotice(null);
    const result = await profiles.createSharedProfile(newProfileName);
    setCreating(false);

    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }

    setNewProfileName('');
    setInvitingToProfileId(result.creation.profileId);
    setMemberNickname('');
  }

  async function handleInviteMember(profileId: string) {
    if (sendingInvite) return;

    setSendingInvite(true);
    setActionError(null);
    setActionNotice(null);
    const result = await profiles.inviteSharedProfileMember(
      profileId,
      memberNickname,
    );
    setSendingInvite(false);

    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }

    if (result.invitation.alreadyMember) {
      setActionNotice('Tämä käyttäjä kuuluu jo tähän ryhmään.');
      setMemberNickname('');
      setInvitingToProfileId(null);
      return;
    }

    setActionNotice(
      result.invitation.invitationCreated
        ? `Kutsu lähetetty käyttäjälle ${result.invitation.user.nickname}.`
        : `Kutsu käyttäjälle ${result.invitation.user.nickname} odottaa jo hyväksyntää.`,
    );
    setMemberNickname('');
    setInvitingToProfileId(null);
  }

  function confirmLeave(profileId: string, profileName: string) {
    if (leavingProfileId) return;

    Alert.alert(
      'Poistu ryhmästä',
      `Oletko varma, että haluat poistua ryhmästä ${profileName}?`,
      [
        { text: 'Peruuta', style: 'cancel' },
        {
          text: 'Poistu',
          style: 'destructive',
          onPress: () => void handleLeave(profileId, profileName),
        },
      ],
    );
  }

  async function handleLeave(profileId: string, profileName: string) {
    if (leavingProfileId) return;

    setLeavingProfileId(profileId);
    setActionError(null);
    setActionNotice(null);
    const result = await profiles.leaveSharedProfile(profileId);
    setLeavingProfileId(null);

    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }

    if (invitingToProfileId === profileId) {
      setInvitingToProfileId(null);
      setMemberNickname('');
    }

    setActionNotice(`Poistuit ryhmästä ${profileName}.`);
  }

  const canUseSharedProfiles =
    profiles.sharedProfilesStatus !== 'disabled' && profiles.status === 'ready';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.kicker}>YHTEINEN KAJO</Text>
          <Text style={styles.title}>Yhteiset Kajot</Text>
          <Text style={styles.intro}>
            Yhteinen Kajo on oma paikka kahdelle tai useammalle. Sen löydöt ja
            valinnat kuuluvat yhteiseen profiiliin.
          </Text>
        </View>

        {personalProfile && personalProfileId ? (
          <View style={[styles.card, styles.personalCard]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleGroup}>
                <Text style={styles.cardKicker}>OMA KAJO</Text>
                <Text style={styles.cardTitle}>{personalProfile.name}</Text>
              </View>
              {profiles.activeProfile?.id === personalProfileId ? (
                <Text style={styles.activeBadge}>AKTIIVINEN</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Avaa oma Kajo"
              onPress={() => openProfile(personalProfileId)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {profiles.activeProfile?.id === personalProfileId
                  ? 'Palaa omaan huoneeseen'
                  : 'Avaa oma Kajo'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yhteiset profiilit</Text>
          {profiles.sharedProfilesStatus === 'loading' ? (
            <ActivityIndicator size="small" color={theme.base.textMuted} />
          ) : null}
        </View>

        {profiles.sharedProfilesError ? (
          <View style={styles.notice}>
            <Text style={styles.errorText}>{profiles.sharedProfilesError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={profiles.retrySharedProfiles}
              style={({ pressed }) => [
                styles.textButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.textButtonText}>Yritä uudelleen</Text>
            </Pressable>
          </View>
        ) : null}

        {profiles.sharedProfiles.length === 0 &&
        profiles.sharedProfilesStatus !== 'loading' ? (
          <Text style={styles.emptyText}>Ei vielä yhteisiä Kajoja.</Text>
        ) : null}

        {profiles.sharedProfiles.map((membership) => {
          const { profile } = membership;
          const isActive = profiles.activeProfile?.id === profile.id;
          const showInviteForm = invitingToProfileId === profile.id;
          const isLeaving = leavingProfileId === profile.id;

          return (
            <View key={profile.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardKicker}>
                    {membership.isReady ? 'YHTEINEN KAJO' : 'ODOTTAA HYVÄKSYNTÄÄ'}
                  </Text>
                  <Text style={styles.cardTitle}>{profile.name}</Text>
                </View>
                {isActive ? <Text style={styles.activeBadge}>AKTIIVINEN</Text> : null}
              </View>

              <Text style={styles.membersText}>
                {membership.members.map((member) => member.nickname).join(' · ')}
              </Text>

              {showInviteForm ? (
                <View style={styles.memberForm}>
                  <TextInput
                    accessibilityLabel={`Kutsuttavan jäsenen nimimerkki ryhmään ${profile.name}`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!sendingInvite && canUseSharedProfiles}
                    maxLength={MAXIMUM_SHARED_PROFILE_NICKNAME_LENGTH}
                    onChangeText={setMemberNickname}
                    placeholder="Nimimerkki"
                    placeholderTextColor={theme.base.textMuted}
                    style={styles.input}
                    value={memberNickname}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={sendingInvite || !canUseSharedProfiles}
                    onPress={() => void handleInviteMember(profile.id)}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                      (sendingInvite || !canUseSharedProfiles) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {sendingInvite ? 'Lähetetään…' : 'Lähetä kutsu'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setInvitingToProfileId(profile.id);
                    setMemberNickname('');
                    setActionError(null);
                    setActionNotice(null);
                  }}
                  style={({ pressed }) => [
                    styles.textButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.textButtonText}>Kutsu jäsen</Text>
                </Pressable>
              )}

              {membership.isReady ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Avaa yhteinen Kajo ${profile.name}`}
                  onPress={() => openProfile(profile.id)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isActive ? 'Palaa yhteiseen huoneeseen' : 'Avaa yhteinen Kajo'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.pendingText}>
                  Ryhmä avautuu, kun vähintään yksi kutsuttu käyttäjä hyväksyy kutsun.
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Poistu ryhmästä ${profile.name}`}
                disabled={isLeaving || leavingProfileId !== null}
                onPress={() => confirmLeave(profile.id, profile.name)}
                style={({ pressed }) => [
                  styles.leaveButton,
                  pressed && styles.pressed,
                  (isLeaving || leavingProfileId !== null) && styles.disabled,
                ]}
              >
                <Text style={styles.leaveButtonText}>
                  {isLeaving ? 'Poistutaan…' : 'Poistu ryhmästä'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {actionError ? <Text style={styles.actionMessage}>{actionError}</Text> : null}
        {actionNotice ? <Text style={styles.actionMessage}>{actionNotice}</Text> : null}

        <View style={styles.createSection}>
          <Text style={styles.sectionTitle}>Luo yhteinen Kajo</Text>
          <Text style={styles.helperText}>
            Anna ryhmälle nimi. Se syntyy ensin sinulle, minkä jälkeen lähetät
            vähintään yhdelle toiselle Kajo-käyttäjälle kutsun nimimerkillä.
          </Text>
          <TextInput
            accessibilityLabel="Uuden yhteisen Kajon nimi"
            autoCorrect={false}
            editable={!creating && canUseSharedProfiles}
            maxLength={MAXIMUM_SHARED_PROFILE_NAME_LENGTH}
            onChangeText={setNewProfileName}
            placeholder="Esim. Meidän Kajo"
            placeholderTextColor={theme.base.textMuted}
            style={styles.input}
            value={newProfileName}
          />
          <Pressable
            accessibilityRole="button"
            disabled={creating || !canUseSharedProfiles}
            onPress={() => void handleCreate()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              (creating || !canUseSharedProfiles) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {creating ? 'Luodaan…' : 'Luo yhteinen Kajo'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 36,
      gap: 14,
    },
    heading: {
      gap: 5,
      marginBottom: 4,
    },
    kicker: {
      color: theme.base.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2.1,
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 30,
      fontWeight: '600',
    },
    intro: {
      color: theme.base.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 3,
    },
    sectionHeader: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    sectionTitle: {
      color: theme.base.textPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
    card: {
      borderWidth: 1,
      borderColor: theme.base.border,
      borderRadius: 18,
      backgroundColor: theme.surface.panel,
      padding: 16,
      gap: 12,
    },
    personalCard: {
      marginBottom: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardTitleGroup: {
      flex: 1,
      gap: 3,
    },
    cardKicker: {
      color: theme.base.textMuted,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    cardTitle: {
      color: theme.base.textPrimary,
      fontSize: 19,
      fontWeight: '600',
    },
    activeBadge: {
      color: theme.base.textMuted,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.1,
      borderWidth: 1,
      borderColor: theme.base.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    membersText: {
      color: theme.base.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    memberForm: {
      gap: 9,
    },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: theme.base.border,
      borderRadius: 12,
      paddingHorizontal: 13,
      color: theme.base.textPrimary,
      backgroundColor: theme.surface.appChrome,
      fontSize: 14,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.base.structureLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      color: theme.base.appBackground,
      fontSize: 13,
      fontWeight: '700',
    },
    secondaryButton: {
      minHeight: 42,
      borderWidth: 1,
      borderColor: theme.base.border,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      color: theme.base.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    textButton: {
      alignSelf: 'flex-start',
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    textButtonText: {
      color: theme.base.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    leaveButton: {
      alignSelf: 'flex-start',
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    leaveButtonText: {
      color: theme.base.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    pendingText: {
      color: theme.base.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    notice: {
      borderWidth: 1,
      borderColor: theme.base.border,
      borderRadius: 14,
      padding: 13,
      gap: 7,
    },
    errorText: {
      color: theme.base.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    emptyText: {
      color: theme.base.textMuted,
      fontSize: 13,
      paddingVertical: 8,
    },
    actionMessage: {
      color: theme.base.textPrimary,
      fontSize: 13,
      lineHeight: 18,
      borderWidth: 1,
      borderColor: theme.base.border,
      borderRadius: 12,
      padding: 12,
    },
    createSection: {
      marginTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.base.border,
      paddingTop: 18,
      gap: 10,
    },
    helperText: {
      color: theme.base.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    pressed: {
      opacity: 0.72,
      transform: [{ scale: 0.99 }],
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
