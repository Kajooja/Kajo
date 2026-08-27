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

import { useSupabaseConnection } from '@/data/SupabaseProvider';

import {
  signOut as signOutWithApi,
  submitEmailPassword,
  type AuthSubmissionResult,
  type SignOutResult,
} from './authOperations';

export type AuthSessionSnapshot =
  | { status: 'disabled' }
  | { status: 'configuration-error' }
  | { status: 'loading' }
  | { status: 'session-error' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string };

interface AuthSessionActions {
  signIn: (email: string, password: string) => Promise<AuthSubmissionResult>;
  signUp: (email: string, password: string) => Promise<AuthSubmissionResult>;
  signOut: () => Promise<SignOutResult>;
  retrySession: () => Promise<void>;
}

type AuthSessionContextValue = AuthSessionSnapshot & AuthSessionActions;

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>(() => {
    if (connection.status === 'unconfigured') {
      return { status: 'disabled' };
    }

    if (connection.status === 'invalid') {
      return { status: 'configuration-error' };
    }

    return { status: 'loading' };
  });

  useEffect(() => {
    if (connection.status !== 'configured') {
      return;
    }

    let active = true;
    let authEventObserved = false;
    const { client } = connection;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      authEventObserved = true;

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

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (connection.status !== 'configured') {
        return unavailableAuthResult();
      }

      const result = await submitEmailPassword(
        connection.client.auth,
        'sign-in',
        email,
        password,
      );

      if (result.status === 'authenticated') {
        setSnapshot({ status: 'signed-in', userId: result.userId });
      }

      return result;
    },
    [connection],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (connection.status !== 'configured') {
        return unavailableAuthResult();
      }

      const result = await submitEmailPassword(
        connection.client.auth,
        'sign-up',
        email,
        password,
      );

      if (result.status === 'authenticated') {
        setSnapshot({ status: 'signed-in', userId: result.userId });
      }

      return result;
    },
    [connection],
  );

  const signOut = useCallback(async () => {
    if (connection.status !== 'configured') {
      return unavailableSignOutResult();
    }

    const result = await signOutWithApi(connection.client.auth);

    if (result.status === 'signed-out') {
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
    () => ({ ...snapshot, signIn, signUp, signOut, retrySession }),
    [retrySession, signIn, signOut, signUp, snapshot],
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
