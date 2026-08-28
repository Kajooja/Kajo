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

import { useItemInteractions } from '@/features/discovery/ItemInteractionContext';
import { usePersonalProfile } from '@/features/profiles/PersonalProfileProvider';
import { PERSONAL_ROOM_BASE_THEME } from '@/theme/roomTheme';

import { useAuthSession } from './AuthSessionProvider';
import type { AuthEntryMode } from './authOperations';

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuthSession();
  const personalProfile = usePersonalProfile();
  const itemInteractions = useItemInteractions();

  if (auth.status === 'disabled') {
    return children;
  }

  if (auth.status === 'signed-in') {
    if (auth.recoveryMode) {
      return <PasswordRecoveryScreen />;
    }

    if (personalProfile.status === 'disabled') {
      return children;
    }

    if (personalProfile.status === 'ready') {
      if (
        itemInteractions.persistenceStatus === 'ready' ||
        itemInteractions.persistenceStatus === 'disabled'
      ) {
        return children;
      }

      if (itemInteractions.persistenceStatus === 'error') {
        return (
          <AuthStatusScreen
            title="Valintoja ei voitu ladata"
            message={
              itemInteractions.hydrationError ??
              'Tarkista verkkoyhteys ja yritä uudelleen.'
            }
            actionLabel="Yritä uudelleen"
            onAction={itemInteractions.retryHydration}
          />
        );
      }

      return (
        <AuthStatusScreen
          title="Kajo"
          message="Palautetaan valintojasi…"
          loading
        />
      );
    }

    if (
      personalProfile.status === 'loading' ||
      personalProfile.status === 'inactive'
    ) {
      return (
        <AuthStatusScreen
          title="Kajo"
          message="Avataan omaa profiiliasi…"
          loading
        />
      );
    }

    if (personalProfile.status === 'error') {
      return (
        <AuthStatusScreen
          title="Profiilia ei voitu ladata"
          message={personalProfile.message}
          actionLabel="Yritä uudelleen"
          onAction={() => void personalProfile.retry()}
        />
      );
    }

    return <NicknameEntryScreen />;
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
        message={
          auth.message ?? 'Tarkista verkkoyhteys ja yritä uudelleen.'
        }
        actionLabel="Jatka"
        onAction={() => void auth.retrySession()}
      />
    );
  }

  return <AuthEntryScreen />;
}

function NicknameEntryScreen() {
  const auth = useAuthSession();
  const personalProfile = usePersonalProfile();
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit() {
    if (submitting || signingOut) {
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);
    setFeedback(null);

    const result = await personalProfile.complete(nickname);

    if (result.status === 'ready') {
      return;
    }

    setFeedback(
      result.status === 'error'
        ? result.message
        : 'Oman Kajo-profiilin luominen epäonnistui. Yritä uudelleen.',
    );
    setSubmitting(false);
  }

  async function signOut() {
    if (submitting || signingOut) {
      return;
    }

    setSigningOut(true);
    setFeedback(null);
    const result = await auth.signOut();

    if (result.status === 'error') {
      setFeedback(result.message);
      setSigningOut(false);
    }
  }

  return (
    <AuthFormShell>
      <View style={styles.intro}>
        <Text style={styles.kicker}>OMA KAJO</Text>
        <Text style={styles.title}>Luo nimimerkki</Text>
        <Text style={styles.message}>
          Nimimerkki on yksilöllinen kirjautumistunnuksesi. Kirjainkoko säilyy
          näkyvissä, mutta sillä ei ole merkitystä kirjautumisessa tai haussa.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Nimimerkki</Text>
        <TextInput
          accessibilityLabel="Nimimerkki"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
          onChangeText={setNickname}
          onSubmitEditing={() => void submit()}
          placeholder="Esimerkiksi KeTTu"
          placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
          returnKeyType="done"
          style={styles.input}
          value={nickname}
        />

        <FeedbackText feedback={feedback} />

        <PrimaryButton
          label="Jatka omaan Kajoosi"
          loading={submitting}
          disabled={submitting || signingOut}
          onPress={() => void submit()}
        />

        <SwitchButton
          label={signingOut ? 'Kirjaudutaan ulos…' : 'Kirjaudu ulos'}
          disabled={submitting || signingOut}
          onPress={() => void signOut()}
        />
      </View>
    </AuthFormShell>
  );
}

function AuthEntryScreen() {
  const { signIn, signUp, requestPasswordRecovery } = useAuthSession();
  const [mode, setMode] = useState<AuthEntryMode>('sign-in');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isSignIn = mode === 'sign-in';

  async function submit() {
    if (submitting || recoverySubmitting) {
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);
    setFeedback(null);

    const result = isSignIn
      ? await signIn(identifier, password)
      : await signUp(email, nickname, password);

    if (result.status === 'authenticated') {
      return;
    }

    if (result.status === 'error') {
      setFeedback(result.message);
    } else {
      setPassword('');
      setFeedback(
        `Vahvistusviesti lähetettiin osoitteeseen ${result.email}. ` +
          'Avaa viestin linkki tällä puhelimella.',
      );
    }

    setSubmitting(false);
  }

  async function requestRecovery() {
    if (submitting || recoverySubmitting) {
      return;
    }

    if (!isSignIn) {
      switchMode('sign-in');
      setFeedback('Kirjaudu tai palauta salasana sähköpostilla tai nimimerkillä.');
      return;
    }

    Keyboard.dismiss();
    setRecoverySubmitting(true);
    setFeedback(null);
    const result = await requestPasswordRecovery(identifier);

    setFeedback(
      result.status === 'sent'
        ? 'Salasanan palautuslinkki lähetettiin tilin sähköpostiin. Avaa linkki tällä puhelimella ja jatka salasanan vaihtoon.'
        : result.message,
    );
    setRecoverySubmitting(false);
  }

  function switchMode(nextMode?: AuthEntryMode) {
    const targetMode = nextMode ?? (isSignIn ? 'sign-up' : 'sign-in');
    setMode(targetMode);
    setPassword('');
    setFeedback(null);
  }

  return (
    <AuthFormShell>
      <View style={styles.intro}>
        <Text style={styles.kicker}>KAJO</Text>
        <Text style={styles.title}>
          {isSignIn ? 'Tervetuloa takaisin' : 'Luo oma Kajo'}
        </Text>
        <Text style={styles.message}>
          {isSignIn
            ? 'Kirjaudu sähköpostilla tai nimimerkillä.'
            : 'Luo tili sähköpostilla, yksilöllisellä nimimerkillä ja salasanalla.'}
        </Text>
      </View>

      <View style={styles.form}>
        {isSignIn ? (
          <>
            <Text style={styles.label}>Sähköposti tai nimimerkki</Text>
            <TextInput
              accessibilityLabel="Sähköposti tai nimimerkki"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              onChangeText={setIdentifier}
              placeholder="sinä@esimerkki.fi tai KeTTu"
              placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
              returnKeyType="next"
              style={styles.input}
              value={identifier}
            />
          </>
        ) : (
          <>
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

            <Text style={styles.label}>Luo nimimerkki</Text>
            <TextInput
              accessibilityLabel="Luo nimimerkki"
              autoCapitalize="none"
              autoComplete="username-new"
              autoCorrect={false}
              maxLength={32}
              onChangeText={setNickname}
              placeholder="Esimerkiksi KeTTu"
              placeholderTextColor={PERSONAL_ROOM_BASE_THEME.textMuted}
              returnKeyType="next"
              style={styles.input}
              value={nickname}
            />
          </>
        )}

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

        <FeedbackText feedback={feedback} />

        <PrimaryButton
          label={isSignIn ? 'Kirjaudu' : 'Luo tili'}
          loading={submitting}
          disabled={submitting || recoverySubmitting}
          onPress={() => void submit()}
        />

        <SwitchButton
          label={
            recoverySubmitting
              ? 'Lähetetään palautuslinkkiä…'
              : 'Unohditko salasanasi?'
          }
          disabled={submitting || recoverySubmitting}
          onPress={() => void requestRecovery()}
        />

        <SwitchButton
          label={
            isSignIn
              ? 'Ei vielä tiliä? Luo tili'
              : 'Onko sinulla jo tili? Kirjaudu'
          }
          disabled={submitting || recoverySubmitting}
          onPress={() => switchMode()}
        />
      </View>
    </AuthFormShell>
  );
}

function PasswordRecoveryScreen() {
  const auth = useAuthSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit() {
    if (submitting) {
      return;
    }

    Keyboard.dismiss();
    setFeedback(null);

    if (password !== confirmation) {
      setFeedback('Salasanat eivät täsmää.');
      return;
    }

    setSubmitting(true);
    const result = await auth.updatePassword(password);

    if (result.status === 'error') {
      setFeedback(result.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthFormShell>
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

        <FeedbackText feedback={feedback} />

        <PrimaryButton
          label="Tallenna uusi salasana"
          loading={submitting}
          disabled={submitting}
          onPress={() => void submit()}
        />
      </View>
    </AuthFormShell>
  );
}

function AuthFormShell({ children }: PropsWithChildren) {
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
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FeedbackText({ feedback }: { feedback: string | null }) {
  return feedback ? (
    <Text accessibilityLiveRegion="polite" style={styles.feedback}>
      {feedback}
    </Text>
  ) : null;
}

interface PrimaryButtonProps {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

function PrimaryButton({
  label,
  loading,
  disabled,
  onPress,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={PERSONAL_ROOM_BASE_THEME.appBackground} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

interface SwitchButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
}

function SwitchButton({ label, disabled, onPress }: SwitchButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.switchButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.switchButtonText}>{label}</Text>
    </Pressable>
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
