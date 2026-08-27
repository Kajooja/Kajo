import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { useAuthSession } from '@/features/auth/AuthSessionProvider';

import {
  completePersonalIdentity,
  loadPersonalIdentity,
  type PersonalIdentity,
  type PersonalProfileOperationResult,
  type PersonalProfileRpc,
} from './personalProfileOperations';

export type PersonalProfileSnapshot =
  | { status: 'inactive' }
  | { status: 'disabled' }
  | { status: 'loading'; userId: string }
  | { status: 'missing'; userId: string }
  | { status: 'error'; userId: string; message: string }
  | { status: 'ready'; identity: PersonalIdentity };

type UserBoundPersonalProfileSnapshot = Exclude<
  PersonalProfileSnapshot,
  { status: 'inactive' | 'disabled' }
>;

interface PersonalProfileActions {
  complete: (nickname: string) => Promise<PersonalProfileOperationResult>;
  retry: () => Promise<void>;
}

type PersonalProfileContextValue = PersonalProfileSnapshot &
  PersonalProfileActions;

const PersonalProfileContext =
  createContext<PersonalProfileContextValue | null>(null);

export function PersonalProfileProvider({ children }: PropsWithChildren) {
  const auth = useAuthSession();
  const connection = useSupabaseConnection();
  const [userSnapshot, setUserSnapshot] =
    useState<UserBoundPersonalProfileSnapshot | null>(null);
  const authenticatedUserId =
    auth.status === 'signed-in' ? auth.userId : null;

  const rpc = useCallback<PersonalProfileRpc>(
    async (functionName, arguments_) => {
      if (connection.status !== 'configured') {
        return {
          data: null,
          error: { message: 'Supabase connection unavailable' },
        };
      }

      const { data, error } = await connection.client.rpc(
        functionName,
        arguments_,
      );

      return {
        data,
        error: error ? { message: error.message } : null,
      };
    },
    [connection],
  );

  useEffect(() => {
    if (!authenticatedUserId || connection.status !== 'configured') {
      return;
    }

    let active = true;
    const userId = authenticatedUserId;

    void loadPersonalIdentity(rpc).then((result) => {
      if (active) {
        setUserSnapshot(toUserSnapshot(result, userId));
      }
    });

    return () => {
      active = false;
    };
  }, [authenticatedUserId, connection.status, rpc]);

  const complete = useCallback(
    async (nickname: string) => {
      const result = await completePersonalIdentity(rpc, nickname);

      if (authenticatedUserId && result.status === 'ready') {
        setUserSnapshot(toUserSnapshot(result, authenticatedUserId));
      }

      return result;
    },
    [authenticatedUserId, rpc],
  );

  const retry = useCallback(async () => {
    if (!authenticatedUserId || connection.status !== 'configured') {
      return;
    }

    const userId = authenticatedUserId;
    setUserSnapshot({ status: 'loading', userId });
    const result = await loadPersonalIdentity(rpc);
    setUserSnapshot(toUserSnapshot(result, userId));
  }, [authenticatedUserId, connection.status, rpc]);

  const snapshot = getVisibleSnapshot(auth, connection.status, userSnapshot);

  const value = useMemo<PersonalProfileContextValue>(
    () => ({ ...snapshot, complete, retry }),
    [complete, retry, snapshot],
  );

  return (
    <PersonalProfileContext.Provider value={value}>
      {children}
    </PersonalProfileContext.Provider>
  );
}

export function usePersonalProfile(): PersonalProfileContextValue {
  const state = useContext(PersonalProfileContext);

  if (!state) {
    throw new Error(
      'usePersonalProfile must be used within PersonalProfileProvider',
    );
  }

  return state;
}

function getVisibleSnapshot(
  auth: ReturnType<typeof useAuthSession>,
  connectionStatus: ReturnType<typeof useSupabaseConnection>['status'],
  userSnapshot: UserBoundPersonalProfileSnapshot | null,
): PersonalProfileSnapshot {
  if (auth.status === 'disabled' || connectionStatus === 'unconfigured') {
    return { status: 'disabled' };
  }

  if (auth.status !== 'signed-in' || connectionStatus !== 'configured') {
    return { status: 'inactive' };
  }

  if (!userSnapshot || getSnapshotUserId(userSnapshot) !== auth.userId) {
    return { status: 'loading', userId: auth.userId };
  }

  return userSnapshot;
}

function toUserSnapshot(
  result: PersonalProfileOperationResult,
  userId: string,
): UserBoundPersonalProfileSnapshot {
  if (result.status === 'ready') {
    if (result.identity.user.id !== userId) {
      return {
        status: 'error',
        userId,
        message: 'Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.',
      };
    }

    return { status: 'ready', identity: result.identity };
  }

  if (result.status === 'missing') {
    return { status: 'missing', userId };
  }

  return { status: 'error', userId, message: result.message };
}

function getSnapshotUserId(snapshot: UserBoundPersonalProfileSnapshot): string {
  return snapshot.status === 'ready'
    ? snapshot.identity.user.id
    : snapshot.userId;
}
