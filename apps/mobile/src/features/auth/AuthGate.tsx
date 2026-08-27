import { useState, type PropsWithChildren } from 'react';
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

import { PERSONAL_ROOM_BASE_THEME } from '@/theme/roomTheme';

import { useAuthSession } from './AuthSessionProvider';
import type { AuthEntryMode } from './authOperations';

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuthSession();

  if (auth.status === 'disabled' || auth.status === 'signed-in') {
    return children;
  }

  if (auth.status === 'configuration-error') {
    return (
      <AuthStatusScreen
        title="Yhteysasetukset ovat virheelliset"
        message="Tarkista EXPO_PUBLIC_SUPABASE_URL ja EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
      />
    );
  }

  if (auth.status === 'loading') {
    return (
      <AuthStatusScreen
        title="Kajo"
        message="Palautetaan istuntoa…"
        loading
      />
    );
  }

  if (auth.status === 'session-error') {
    return (
      <AuthStatusScreen
        title="Istuntoa ei voitu ladata"
        message="Tarkista verkkoyhteys ja yritä uudelleen."
        actionLabel="Yritä uudelleen"
        onAction={() => void auth.retrySession()}
      />
    );
  }

  return <AuthEntryScreen />;
}

function AuthEntryScreen() {
  const { signIn, signUp } = useAuthSession();
  const [mode, setMode] = useState<AuthEntryMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isSignIn = mode === 'sign-in';

  async function submit() {
    if (submitting) {
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);
    setFeedback(null);

    const result = isSignIn
      ? await signIn(email, password)
      : await signUp(email, password);

    if (result.status === 'authenticated') {
      return;
    }

    if (result.status === 'error') {
      setFeedback(result.message);
    } else {
      setPassword('');
      setFeedback(`Vahvistusviesti lähetettiin osoitteeseen ${result.email}.`);
    }

    setSubmitting(false);
  }

  function switchMode() {
    setMode(isSignIn ? 'sign-up' : 'sign-in');
    setPassword('');
    setFeedback(null);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.entryContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.kicker}>KAJO</Text>
            <Text style={styles.title}>
              {isSignIn ? 'Tervetuloa takaisin' : 'Luo oma Kajo'}
            </Text>
            <Text style={styles.message}>
              {isSignIn
                ? 'Kirjaudu jatkaaksesi omaan huoneeseesi.'
                : 'Aloita sähköpostilla ja salasanalla.'}
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Sähköposti</Text>
            <TextInput
              accessibilityLabel="Sähköposti"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="sinä@esimerkki.fi"
              placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
              returnKeyType="next"
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Salasana</Text>
            <TextInput
              accessibilityLabel="Salasana"
              autoCapitalize="none"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              placeholder="Vähintään 6 merkkiä"
              placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              value={password}
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
                <ActivityIndicator color={PERSONAL_ROOM_BASE_THEME.appBackground} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignIn ? 'Kirjaudu' : 'Luo tili'}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={switchMode}
              style={({ pressed }) => [
                styles.switchButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.switchButtonText}>
                {isSignIn
                  ? 'Ei vielä tiliä? Luo tili'
                  : 'Onko sinulla jo tili? Kirjaudu'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface AuthStatusScreenProps {
  title: string;
  message: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

function AuthStatusScreen({
  title,
  message,
  loading = false,
  actionLabel,
  onAction,
}: AuthStatusScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.statusContent}>
        {loading ? (
          <ActivityIndicator
            color={PERSONAL_ROOM_BASE_THEME.textPrimary}
            size="large"
          />
        ) : null}
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusMessage}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const theme = PERSONAL_ROOM_BASE_THEME;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.appBackground,
  },
  entryContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  intro: {
    marginBottom: 34,
  },
  kicker: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.6,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 32,
    fontWeight: '600',
    marginTop: 8,
  },
  message: {
    color: theme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  form: {
    gap: 12,
  },
  label: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  input: {
    minHeight: 52,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.textPrimary,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  feedback: {
    color: theme.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    backgroundColor: theme.textPrimary,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: theme.appBackground,
    fontSize: 15,
    fontWeight: '700',
  },
  switchButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  switchButtonText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  statusContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  statusTitle: {
    color: theme.textPrimary,
    fontSize: 25,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  statusMessage: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 46,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
