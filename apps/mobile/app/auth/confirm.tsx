import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { PERSONAL_ROOM_BASE_THEME } from '@/theme/roomTheme';

type CallbackState = 'verifying' | 'error';

export default function AuthConfirmRoute() {
  const connection = useSupabaseConnection();
  const params = useLocalSearchParams();
  const [state, setState] = useState<CallbackState>('verifying');

  useEffect(() => {
    let active = true;

    async function confirm() {
      if (connection.status !== 'configured') {
        if (active) setState('error');
        return;
      }

      const accessToken = firstParam(params.access_token);
      const refreshToken = firstParam(params.refresh_token);

      if (!accessToken || !refreshToken) {
        if (active) setState('error');
        return;
      }

      const { data, error } = await connection.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!active) return;

      if (error || !data.session) {
        setState('error');
        return;
      }

      router.replace('/');
    }

    void confirm();

    return () => {
      active = false;
    };
  }, [connection, params.access_token, params.refresh_token]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {state === 'verifying' ? (
          <>
            <ActivityIndicator color={PERSONAL_ROOM_BASE_THEME.textPrimary} />
            <Text style={styles.title}>Vahvistetaan sähköpostia…</Text>
            <Text style={styles.message}>Kajo avautuu hetken kuluttua.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Vahvistuslinkkiä ei voitu käsitellä</Text>
            <Text style={styles.message}>
              Linkki voi olla vanhentunut tai jo käytetty. Palaa kirjautumiseen ja yritä uudelleen.
            </Text>
            <Pressable style={styles.button} onPress={() => router.replace('/')}>
              <Text style={styles.buttonText}>Palaa Kajoon</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    color: PERSONAL_ROOM_BASE_THEME.textPrimary,
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    color: PERSONAL_ROOM_BASE_THEME.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PERSONAL_ROOM_BASE_THEME.border,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: PERSONAL_ROOM_BASE_THEME.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
