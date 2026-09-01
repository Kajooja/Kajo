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
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';

import type { ItemId, ProfileId, UserId } from '../../domain/contracts';
import {
  EMPTY_SHARED_DISCOVERY_STATE,
  type SharedDiscoveryStateMap,
} from './sharedEndorsement';
import {
  endorseSharedItem,
  loadSharedDiscoveryOverlay,
  type SharedEndorsementCommitResult,
  type SharedEndorsementRpc,
} from './sharedEndorsementOperations';

export type SharedEndorsementStatus =
  | 'disabled'
  | 'inactive'
  | 'loading'
  | 'ready'
  | 'error';

interface SharedEndorsementContextValue {
  status: SharedEndorsementStatus;
  stateByItemId: SharedDiscoveryStateMap;
  error: string | null;
  endorse: (itemId: ItemId) => Promise<SharedEndorsementCommitResult>;
  retry: () => void;
}

interface SharedEndorsementSnapshot {
  profileId: ProfileId;
  actorUserId: UserId;
  stateByItemId: SharedDiscoveryStateMap;
  error: string | null;
}

const REFRESH_INTERVAL_MS = 15_000;
const UNAVAILABLE_MESSAGE =
  'Yhteinen valinta ei ole käytettävissä tällä hetkellä.';
const SharedEndorsementContext =
  createContext<SharedEndorsementContextValue | null>(null);

export function SharedEndorsementProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const activeProfile = useActiveProfile();
  const [snapshot, setSnapshot] = useState<SharedEndorsementSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeSharedProfile =
    activeProfile.status === 'ready' &&
    activeProfile.activeProfile?.type === 'SHARED'
      ? activeProfile.activeProfile
      : null;
  const actorUserId = activeProfile.actorUserId;
  const rpc = useMemo<SharedEndorsementRpc | null>(
    () =>
      connection.status === 'configured'
        ? async (functionName, arguments_) => {
            const { data, error } = await connection.client.rpc(
              functionName,
              arguments_,
            );

            return {
              data,
              error: error
                ? { code: error.code, message: error.message }
                : null,
            };
          }
        : null,
    [connection],
  );

  useEffect(() => {
    if (!activeSharedProfile || !actorUserId || !rpc) return;

    let active = true;
    const profileId = activeSharedProfile.id;

    void loadSharedDiscoveryOverlay(rpc, profileId).then((result) => {
      if (!active) return;

      setSnapshot({
        profileId,
        actorUserId,
        stateByItemId:
          result.status === 'success'
            ? result.stateByItemId
            : EMPTY_SHARED_DISCOVERY_STATE,
        error: result.status === 'error' ? result.message : null,
      });
    });

    return () => {
      active = false;
    };
  }, [activeSharedProfile, actorUserId, attempt, rpc]);

  useEffect(() => {
    if (!activeSharedProfile || !actorUserId || !rpc) return;

    const intervalId = setInterval(
      () => setAttempt((current) => current + 1),
      REFRESH_INTERVAL_MS,
    );

    return () => clearInterval(intervalId);
  }, [activeSharedProfile, actorUserId, rpc]);

  const hasCurrentSnapshot = Boolean(
    activeSharedProfile &&
      actorUserId &&
      snapshot?.profileId === activeSharedProfile.id &&
      snapshot.actorUserId === actorUserId,
  );
  const status = getStatus(
    connection.status,
    activeProfile.status,
    Boolean(activeSharedProfile),
    Boolean(rpc),
    hasCurrentSnapshot,
    hasCurrentSnapshot ? snapshot?.error ?? null : null,
  );
  const stateByItemId =
    hasCurrentSnapshot && snapshot
      ? snapshot.stateByItemId
      : EMPTY_SHARED_DISCOVERY_STATE;
  const error = hasCurrentSnapshot ? snapshot?.error ?? null : null;

  const endorse = useCallback(
    async (itemId: ItemId): Promise<SharedEndorsementCommitResult> => {
      if (!rpc || !activeSharedProfile || !actorUserId || status !== 'ready') {
        return { status: 'error', message: UNAVAILABLE_MESSAGE };
      }

      const result = await endorseSharedItem(rpc, activeSharedProfile.id, itemId);

      if (result.status === 'error') return result;

      setSnapshot((current) => {
        if (
          !current ||
          current.profileId !== activeSharedProfile.id ||
          current.actorUserId !== actorUserId
        ) {
          return current;
        }

        const currentState = current.stateByItemId[itemId];

        if (!currentState) return current;

        const endorserUserIds = currentState.endorserUserIds.includes(actorUserId)
          ? currentState.endorserUserIds
          : [...currentState.endorserUserIds, actorUserId];

        return {
          ...current,
          stateByItemId: {
            ...current.stateByItemId,
            [itemId]: {
              ...currentState,
              currentActorEndorsed: true,
              pendingEndorsement: !result.commit.consensusSaved,
              consensusSaved: result.commit.consensusSaved,
              endorserUserIds,
              firstEndorsedAt:
                currentState.firstEndorsedAt ?? new Date().toISOString(),
            },
          },
        };
      });
      setAttempt((current) => current + 1);

      return result;
    }, [activeSharedProfile, actorUserId, rpc, status]);

  const retry = useCallback(() => {
    if (!activeSharedProfile || !actorUserId || !rpc) return;

    setSnapshot(null);
    setAttempt((current) => current + 1);
  }, [activeSharedProfile, actorUserId, rpc]);

  const value = useMemo<SharedEndorsementContextValue>(
    () => ({ status, stateByItemId, error, endorse, retry }),
    [endorse, error, retry, stateByItemId, status],
  );

  return (
    <SharedEndorsementContext.Provider value={value}>
      {children}
    </SharedEndorsementContext.Provider>
  );
}

export function useSharedEndorsements(): SharedEndorsementContextValue {
  const value = useContext(SharedEndorsementContext);

  if (!value) {
    throw new Error(
      'useSharedEndorsements must be used within SharedEndorsementProvider',
    );
  }

  return value;
}

function getStatus(
  connectionStatus: ReturnType<typeof useSupabaseConnection>['status'],
  profileStatus: ReturnType<typeof useActiveProfile>['status'],
  isSharedProfile: boolean,
  hasRpc: boolean,
  hasSnapshot: boolean,
  error: string | null,
): SharedEndorsementStatus {
  if (connectionStatus === 'unconfigured' || profileStatus === 'disabled') {
    return 'disabled';
  }

  if (!isSharedProfile) return 'inactive';
  if (!hasRpc || profileStatus !== 'ready') return 'inactive';
  if (!hasSnapshot) return 'loading';
  return error ? 'error' : 'ready';
}
