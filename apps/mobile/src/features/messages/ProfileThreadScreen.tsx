import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProfileId } from '@/domain/contracts';
import { getAmbientPhase } from '@/domain/discovery';
import { getRoomTheme, type RoomTheme } from '@/theme/roomTheme';
import { useAuthSession } from '@/features/auth/AuthSessionProvider';
import { useDiscoveryMode } from '@/features/discovery/DiscoveryModeContext';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';

import { useProfileMessages } from './ProfileMessagesContext';
import {
  MAXIMUM_PROFILE_MESSAGE_LENGTH,
  validateProfileMessage,
  type ProfileMessage,
} from './profileMessageOperations';

interface ProfileThreadScreenProps {
  profileId: ProfileId;
}

export function ProfileThreadScreen({ profileId }: ProfileThreadScreenProps) {
  const auth = useAuthSession();
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const messages = useProfileMessages();
  const { loadMessages, markRead } = messages;
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const thread = messages.threads.find((candidate) => candidate.profileId === profileId);
  const failed = messages.failedMessages.filter((draft) => draft.profileId === profileId);
  const [loadedMessages, setLoadedMessages] = useState<readonly ProfileMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await loadMessages(profileId);
    setLoading(false);
    if (result.status === 'error') {
      setLoadError(result.message);
      return;
    }
    setLoadedMessages(result.messages);
    const latest = result.messages.at(-1)?.createdAt ?? null;
    if (latest) void markRead(profileId, latest);
  }, [loadMessages, markRead, profileId]);

  useEffect(() => {
    let active = true;
    void loadMessages(profileId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.status === 'error') {
        setLoadError(result.message);
        return;
      }
      setLoadedMessages(result.messages);
      const latest = result.messages.at(-1)?.createdAt ?? null;
      if (latest) void markRead(profileId, latest);
    });
    return () => { active = false; };
  }, [loadMessages, markRead, profileId]);

  async function submit() {
    if (sending) return;
    const validation = validateProfileMessage(draft);
    if (validation.status === 'invalid') {
      setSendError(validation.message);
      return;
    }

    setSending(true);
    setSendError(null);
    const result = await messages.send({
      profileId,
      body: validation.body,
      listId: null,
      itemId: null,
    });
    setSending(false);
    if (result.status === 'error') {
      setSendError(`${result.message} Luonnos säilytettiin uudelleenyritystä varten.`);
      return;
    }

    setDraft('');
    setLoadedMessages((current) => current.some(
      (message) => message.id === result.message.id,
    ) ? current : [...current, result.message]);
  }

  async function retry(messageId: string) {
    setSendError(null);
    const result = await messages.retry(messageId);
    if (result.status === 'error') {
      setSendError(result.message);
      return;
    }
    setLoadedMessages((current) => current.some(
      (message) => message.id === result.message.id,
    ) ? current : [...current, result.message]);
  }

  if (messages.status === 'loading' && !thread) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ActivityIndicator color={theme.base.textMuted} style={styles.centered} />
      </SafeAreaView>
    );
  }

  if (!thread) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.centeredPanel}>
          <Text style={styles.title}>Viestiketjua ei löytynyt.</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Takaisin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{thread.profileName}</Text>
            <Text style={styles.subtitle}>
              {thread.profileType === 'SHARED' ? 'RYHMÄN VIESTIT' : 'OMAT MUISTIINPANOT'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.messageList}>
          {loading ? <ActivityIndicator color={theme.base.textMuted} /> : null}
          {loadError ? (
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text style={styles.error}>{loadError} Paina yrittääksesi uudelleen.</Text>
            </Pressable>
          ) : null}
          {!loading && !loadError && loadedMessages.length === 0 ? (
            <Text style={styles.empty}>Aloita keskustelu kirjoittamalla ensimmäinen viesti.</Text>
          ) : null}
          {loadedMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              own={auth.status === 'signed-in' && message.actorUserId === auth.userId}
              styles={styles}
            />
          ))}
          {failed.map((message) => (
            <View key={message.messageId} style={styles.failedBubble}>
              <Text style={styles.failedLabel}>Lähetys epäonnistui</Text>
              <Text style={styles.messageBody}>{message.body}</Text>
              <View style={styles.failedActions}>
                <Pressable onPress={() => void retry(message.messageId)}>
                  <Text style={styles.retryText}>Yritä uudelleen</Text>
                </Pressable>
                <Pressable onPress={() => messages.discard(message.messageId)}>
                  <Text style={styles.discardText}>Poista</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Viesti"
            editable={!sending}
            maxLength={MAXIMUM_PROFILE_MESSAGE_LENGTH}
            onChangeText={(value) => {
              setDraft(value);
              setSendError(null);
            }}
            onSubmitEditing={() => void submit()}
            placeholder="Kirjoita viesti"
            placeholderTextColor={theme.base.textMuted}
            returnKeyType="send"
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            disabled={sending || draft.trim().length === 0}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
          >
            <Text style={styles.sendButtonText}>{sending ? '…' : 'Lähetä'}</Text>
          </Pressable>
        </View>
        {sendError ? <Text style={styles.composerError}>{sendError}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({
  message,
  own,
  styles,
}: {
  message: ProfileMessage;
  own: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const context = [message.listName, message.itemTitle].filter(Boolean).join(' · ');
  return (
    <View style={[styles.messageBubble, own && styles.ownBubble]}>
      <Text style={styles.messageMeta}>
        {own ? 'Sinä' : message.actorNickname} · {formatMessageTime(message.createdAt)}
      </Text>
      <Text style={styles.messageBody}>{message.body}</Text>
      {context ? <Text style={styles.messageContext}>{context}</Text> : null}
    </View>
  );
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    container: { flex: 1 },
    centered: { flex: 1 },
    centeredPanel: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    header: {
      minHeight: 62,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.base.border,
    },
    back: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
    backText: { color: theme.base.textPrimary, fontSize: 34, lineHeight: 36 },
    heading: { flex: 1 },
    title: { color: theme.base.textPrimary, fontSize: 19, fontWeight: '800' },
    subtitle: { color: theme.base.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
    messageList: { padding: 16, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
    empty: { color: theme.base.textMuted, textAlign: 'center', lineHeight: 20 },
    error: { color: '#f2a6a6', textAlign: 'center', lineHeight: 20 },
    messageBubble: {
      maxWidth: '88%',
      alignSelf: 'flex-start',
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.raised,
      gap: 4,
    },
    ownBubble: { alignSelf: 'flex-end', backgroundColor: theme.ambient.curtain },
    messageMeta: { color: theme.base.textMuted, fontSize: 10, fontWeight: '700' },
    messageBody: { color: theme.base.textPrimary, fontSize: 14, lineHeight: 20 },
    messageContext: { color: theme.ambient.curtainHighlight, fontSize: 11, fontWeight: '700' },
    failedBubble: {
      maxWidth: '88%',
      alignSelf: 'flex-end',
      padding: 11,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#b96b6b',
      gap: 5,
    },
    failedLabel: { color: '#f2a6a6', fontSize: 10, fontWeight: '800' },
    failedActions: { flexDirection: 'row', gap: 18, marginTop: 3 },
    retryText: { color: theme.ambient.curtainHighlight, fontSize: 12, fontWeight: '800' },
    discardText: { color: theme.base.textMuted, fontSize: 12, fontWeight: '700' },
    composer: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
      flexDirection: 'row',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.base.border,
    },
    input: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.base.border,
      color: theme.base.textPrimary,
      backgroundColor: theme.surface.raised,
    },
    sendButton: {
      minWidth: 72,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: theme.ambient.curtain,
    },
    sendButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    composerError: { color: '#f2a6a6', fontSize: 11, paddingHorizontal: 13, paddingBottom: 8 },
    primaryButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.ambient.curtain },
    primaryButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    pressed: { opacity: 0.7 },
  });
}
