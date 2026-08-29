import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Keyboard,
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

import { useAuthSession } from '@/features/auth/AuthSessionProvider';
import { MINIMUM_PASSWORD_LENGTH } from '@/features/auth/authOperations';
import { returnToSignedOutLogin } from '@/features/auth/authNavigation';
import { PERSONAL_ROOM_BASE_THEME } from '@/theme/roomTheme';

type RecoveryState = 'verifying' | 'ready' | 'error';

export default function AuthRecoveryRoute() {
  const { updatePassword, verifyEmailLink } = useAuthSession();
  const params = useLocalSearchParams();
  const [state, setState] = useState<RecoveryState>('verifying');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const started = useRef(false);

  const tokenHash = firstParam(params.token_hash) ?? firstParam(params.token);
  const accessToken = firstParam(params.access_token);
  const refreshToken = firstParam(params.refresh_token);

  useEffect(() => {
    let active = true;

    async function verifyRecoverySession() {
      const link = tokenHash
        ? { tokenHash, type: 'recovery' as const }
        : accessToken && refreshToken
          ? { accessToken, refreshToken, type: 'recovery' as const }
          : null;

      if (!link) {
        if (active) setState('error');
        return;
      }

      const result = await verifyEmailLink(link);

      if (!active) return;
      setState(result.status === 'error' ? 'error' : 'ready');
    }

    if (!started.current) {
      started.current = true;
      void verifyRecoverySession();
    }

    return () => {
      active = false;
    };
  }, [accessToken, refreshToken, tokenHash, verifyEmailLink]);

  async function submit() {
    if (state !== 'ready' || submitting) return;

    Keyboard.dismiss();
    setFeedback(null);

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setFeedback(`Salasanassa pitää olla vähintään ${MINIMUM_PASSWORD_LENGTH} merkkiä.`);
      return;
    }

    if (password !== confirmation) {
      setFeedback('Salasanat eivät täsmää.');
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);

    if (result.status === 'error') {
      setFeedback(result.message);
      setSubmitting(false);
      return;
    }

    returnToSignedOutLogin(router);
  }

  if (state === 'verifying') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <ActivityIndicator color={PERSONAL_ROOM_BASE_THEME.textPrimary} />
          <Text style={styles.title}>Avataan salasanan palautusta…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <Text style={styles.title}>Palautuslinkkiä ei voitu käsitellä</Text>
          <Text style={styles.message}>
            Linkki voi olla vanhentunut tai jo käytetty. Pyydä uusi palautuslinkki kirjautumisnäkymästä.
          </Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => returnToSignedOutLogin(router)}
          >
            <Text style={styles.secondaryButtonText}>Palaa kirjautumiseen</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.kicker}>KAJO</Text>
            <Text style={styles.title}>Aseta uusi salasana</Text>
            <Text style={styles.message}>
              Palautuslinkki on vahvistettu. Luo tilillesi uusi salasana.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Uusi salasana</Text>
            <TextInput
              accessibilityLabel="Uusi salasana"
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder="Vähintään 6 merkkiä"
              placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
              returnKeyType="next"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            <Text style={styles.label}>Uusi salasana uudelleen</Text>
            <TextInput
              accessibilityLabel="Uusi salasana uudelleen"
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={setConfirmation}
              onSubmitEditing={() => void submit()}
              placeholder="Kirjoita salasana uudelleen"
              placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              value={confirmation}
            />

            {feedback ? (
              <Text accessibilityLiveRegion="polite" style={styles.feedback}>
                {feedback}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                submitting && styles.disabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Tallenna uusi salasana</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  intro: {
    marginBottom: 32,
  },
  kicker: {
    color: PERSONAL_ROOM_BASE_THEME.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    marginBottom: 10,
  },
  title: {
    color: PERSONAL_ROOM_BASE_THEME.textPrimary,
    fontSize: 30,
    fontWeight: '600',
    textAlign: 'left',
  },
  message: {
    color: PERSONAL_ROOM_BASE_THEME.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  form: {
    gap: 10,
  },
  label: {
    color: PERSONAL_ROOM_BASE_THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: PERSONAL_ROOM_BASE_THEME.border,
    borderRadius: 14,
    color: PERSONAL_ROOM_BASE_THEME.textPrimary,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  feedback: {
    color: PERSONAL_ROOM_BASE_THEME.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PERSONAL_ROOM_BASE_THEME.border,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: PERSONAL_ROOM_BASE_THEME.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
