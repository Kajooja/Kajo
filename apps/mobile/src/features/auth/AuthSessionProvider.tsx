import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { validateNickname } from '@/features/profiles/personalProfileOperations';

import {
  accountExistsMessage,
  checkAccountAvailability,
  MINIMUM_PASSWORD_LENGTH,
  requestPasswordRecovery as requestPasswordRecoveryWithApi,
  signOut as signOutWithApi,
  submitEmailSignUp,
  submitIdentifierPassword,
  validateEmailPassword,
  verifyPasswordRecoveryCode,
  type AuthSubmissionResult,
  type PasswordAuthBridge,
  type PasswordRecoveryRequestResult,
  type SignOutResult,
} from './authOperations';
import {
  AUTH_CONFIRM_REDIRECT,
  parseAuthDeepLink,
} from './authDeepLink';

export type AuthSessionSnapshot =
  | { status: 'disabled' }
  | { status: 'configuration-error' }
  | { status: 'loading' }
  | { status: 'session-error'; message?: string }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string };

export type PasswordUpdateResult =
  | { status: 'updated' }
  | { status: 'error'; message: string };

export type PasswordRecoveryCodeResult =
  | { status: 'verified' }
  | { status: 'error'; message: string };

interface AuthSessionActions {
  signIn: (
    identifier: string,
    password: string,
  ) => Promise<AuthSubmissionResult>;
  signUp: (
    email: string,
    nickname: string,
    password: string,
  ) => Promise<AuthSubmissionResult>;
  requestPasswordRecovery: (
    identifier: string,
  ) => Promise<PasswordRecoveryRequestResult>;
  verifyPasswordRecovery: (
    identifier: string,
    token: string,
  ) => Promise<PasswordRecoveryCodeResult>;
  updatePassword: (password: string) => Promise<PasswordUpdateResult>;
  signOut: () => Promise<SignOutResult>;
  retrySession: () => Promise<void>;
}

type AuthSessionContextValue = AuthSessionSnapshot &
  AuthSessionActions & {
    recoveryMode: boolean;
  };

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>(() => {
    if (connection.status === 'unconfigured') {
      return { status: 'disabled' };
    }

    if (connection.status === 'invalid') {
      return { status: 'configuration-error' };
    }

    return { status: 'loading' };
  });

  const passwordAuthBridge = useMemo<PasswordAuthBridge>(
    () => ({
      invoke: async (request) => {
        if (connection.status !== 'configured') {
          return {
            data: null,
            error: { message: 'Supabase connection unavailable' },
          };
        }

        const { data, error } = await connection.client.functions.invoke(
          'password-auth',
          { body: request },
        );

        return {
          data,
          error: error ? { message: error.message } : null,
        };
      },
    }),
    [connection],
  );

  useEffect(() => {
    if (connection.status !== 'configured') {
      return;
    }

    let active = true;
    let authEventObserved = false;
    const { client } = connection;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      authEventObserved = true;

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setRecoveryMode(false);
      }

      if (active) {
        setSnapshot(getSnapshotForSession(session));
      }
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEventObserved) {
          return;
        }

        setSnapshot(
          error
            ? { status: 'session-error' }
            : getSnapshotForSession(data.session),
        );
      })
      .catch(() => {
        if (active && !authEventObserved) {
          setSnapshot({ status: 'session-error' });
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [connection]);

  useEffect(() => {
    if (connection.status !== 'configured') {
      return;
    }

    let active = true;
    const { client } = connection;

    async function handleAuthUrl(url: string) {
      const parsed = parseAuthDeepLink(url);

      if (!active || parsed.status === 'ignored') {
        return;
      }

      if (parsed.status === 'error') {
        setSnapshot({ status: 'session-error', message: parsed.message });
        return;
      }

      setRecoveryMode(parsed.recovery);
      const { data, error } = await client.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });

      if (!active) {
        return;
      }

      setSnapshot(
        error || !data.session
          ? {
              status: 'session-error',
              message: 'Kirjautumislinkkiä ei voitu vahvistaa. Yritä uudelleen.',
            }
          : getSnapshotForSession(data.session),
      );
    }

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleAuthUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [connection]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<AuthSubmissionResult> => {
      if (connection.status !== 'configured') {
        return unavailableAuthResult();
      }

      const result = await submitIdentifierPassword(
        passwordAuthBridge,
        identifier,
        password,
      );

      if (result.status === 'error') {
        return result;
      }

      const { data, error } = await connection.client.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      if (error || !data.session) {
        return unavailableAuthResult();
      }

      setRecoveryMode(false);
      setSnapshot({ status: 'signed-in', userId: result.userId });
      return { status: 'authenticated', userId: result.userId };
    },
    [connection, passwordAuthBridge],
  );

  const signUp = useCallback(
    async (email: string, nicknameInput: string, password: string) => {
      if (connection.status !== 'configured') {
        return unavailableAuthResult();
      }

      const emailPasswordValidation = validateEmailPassword(email, password);

      if (emailPasswordValidation.status === 'invalid') {
        return {
          status: 'error' as const,
          message: emailPasswordValidation.message,
        };
      }

      const nicknameValidation = validateNickname(nicknameInput);

      if (nicknameValidation.status === 'invalid') {
        return {
          status: 'error' as const,
          message: nicknameValidation.message,
        };
      }

      const emailAvailability = await checkAccountAvailability(
        passwordAuthBridge,
        emailPasswordValidation.email,
      );

      if (emailAvailability.status === 'error') {
        return { status: 'error' as const, message: emailAvailability.message };
      }

      if (emailAvailability.status === 'exists') {
        return { status: 'error' as const, message: accountExistsMessage() };
      }

      const nicknameAvailability = await checkAccountAvailability(
        passwordAuthBridge,
        nicknameValidation.nickname,
      );

      if (nicknameAvailability.status === 'error') {
        return {
          status: 'error' as const,
          message: nicknameAvailability.message,
        };
      }

      if (nicknameAvailability.status === 'exists') {
        return { status: 'error' as const, message: accountExistsMessage() };
      }

      const result = await submitEmailSignUp(
        connection.client.auth,
        emailPasswordValidation.email,
        emailPasswordValidation.password,
        nicknameValidation.nickname,
        AUTH_CONFIRM_REDIRECT,
      );

      if (result.status === 'authenticated') {
        setRecoveryMode(false);
        setSnapshot({ status: 'signed-in', userId: result.userId });
      }

      return result;
    },
    [connection, passwordAuthBridge],
  );

  const requestPasswordRecovery = useCallback(
    async (identifier: string) => {
      if (connection.status !== 'configured') {
        return {
          status: 'error' as const,
          message: 'Salasanan palautusyhteys ei ole käytettävissä.',
        };
      }

      return requestPasswordRecoveryWithApi(passwordAuthBridge, identifier);
    },
    [connection.status, passwordAuthBridge],
  );

  const verifyPasswordRecovery = useCallback(
    async (
      identifier: string,
      token: string,
    ): Promise<PasswordRecoveryCodeResult> => {
      if (connection.status !== 'configured') {
        return {
          status: 'error',
          message: 'Palautuskoodin tarkistaminen ei ole käytettävissä.',
        };
      }

      const result = await verifyPasswordRecoveryCode(
        passwordAuthBridge,
        identifier,
        token,
      );

      if (result.status === 'error') {
        return result;
      }

      const { data, error } = await connection.client.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      if (error || !data.session) {
        return {
          status: 'error',
          message: 'Palautuskoodin tarkistaminen epäonnistui. Yritä uudelleen.',
        };
      }

      setRecoveryMode(true);
      setSnapshot({ status: 'signed-in', userId: result.userId });
      return { status: 'verified' };
    },
    [connection, passwordAuthBridge],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<PasswordUpdateResult> => {
      if (connection.status !== 'configured') {
        return {
          status: 'error',
          message: 'Salasanan vaihtaminen ei ole käytettävissä.',
        };
      }

      if (password.length < MINIMUM_PASSWORD_LENGTH) {
        return {
          status: 'error',
          message: `Salasanassa pitää olla vähintään ${MINIMUM_PASSWORD_LENGTH} merkkiä.`,
        };
      }

      try {
        const { error } = await connection.client.auth.updateUser({ password });

        if (error) {
          return {
            status: 'error',
            message: 'Salasanan vaihtaminen epäonnistui. Yritä uudelleen.',
          };
        }

        setRecoveryMode(false);
        return { status: 'updated' };
      } catch {
        return {
          status: 'error',
          message: 'Salasanan vaihtaminen epäonnistui. Yritä uudelleen.',
        };
      }
    },
    [connection],
  );

  const signOut = useCallback(async () => {
    if (connection.status !== 'configured') {
      return unavailableSignOutResult();
    }

    const result = await signOutWithApi(connection.client.auth);

    if (result.status === 'signed-out') {
      setRecoveryMode(false);
      setSnapshot({ status: 'signed-out' });
    }

    return result;
  }, [connection]);

  const retrySession = useCallback(async () => {
    if (connection.status !== 'configured') {
      return;
    }

    setSnapshot({ status: 'loading' });

    try {
      const { data, error } = await connection.client.auth.getSession();
      setSnapshot(
        error ? { status: 'session-error' } : getSnapshotForSession(data.session),
      );
    } catch {
      setSnapshot({ status: 'session-error' });
    }
  }, [connection]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      ...snapshot,
      recoveryMode,
      signIn,
      signUp,
      requestPasswordRecovery,
      verifyPasswordRecovery,
      updatePassword,
      signOut,
      retrySession,
    }),
    [
      recoveryMode,
      requestPasswordRecovery,
      retrySession,
      signIn,
      signOut,
      signUp,
      snapshot,
      updatePassword,
      verifyPasswordRecovery,
    ],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const state = useContext(AuthSessionContext);

  if (!state) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return state;
}

function getSnapshotForSession(session: Session | null): AuthSessionSnapshot {
  if (!session) {
    return { status: 'signed-out' };
  }

  return { status: 'signed-in', userId: session.user.id };
}

function unavailableAuthResult(): AuthSubmissionResult {
  return {
    status: 'error',
    message: 'Kirjautumisyhteys ei ole käytettävissä.',
  };
}

function unavailableSignOutResult(): SignOutResult {
  return {
    status: 'error',
    message: 'Uloskirjautumisyhteys ei ole käytettävissä.',
  };
}
