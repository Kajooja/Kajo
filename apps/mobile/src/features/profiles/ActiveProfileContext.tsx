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
import type {
  PersonalProfile,
  Profile,
  ProfileId,
  UserId,
} from '@/domain/contracts';

import { usePersonalProfile } from './PersonalProfileProvider';
import {
  loadSharedProfiles,
  type SharedProfileMembership,
  type SharedProfileRpc,
} from './sharedProfileOperations';

export type SharedProfilesStatus =
  | 'disabled'
  | 'inactive'
  | 'loading'
  | 'ready'
  | 'error';

export type ActiveProfileStatus = 'disabled' | 'inactive' | 'ready';

interface ActiveProfileContextValue {
  status: ActiveProfileStatus;
  actorUserId: UserId | null;
  activeProfile: Profile | null;
  personalProfile: PersonalProfile | null;
  sharedProfiles: readonly SharedProfileMembership[];
  selectableProfiles: readonly Profile[];
  sharedProfilesStatus: SharedProfilesStatus;
  sharedProfilesError: string | null;
  selectProfile: (profileId: ProfileId) => boolean;
  retrySharedProfiles: () => void;
}

interface SharedProfilesSnapshot {
  actorUserId: UserId;
  status: 'ready' | 'error';
  profiles: readonly SharedProfileMembership[];
  message: string | null;
}

interface ActiveSelection {
  actorUserId: UserId;
  profileId: ProfileId;
}

const EMPTY_SHARED_PROFILES: readonly SharedProfileMembership[] = [];
const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);

export function ActiveProfileProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const personal = usePersonalProfile();
  const [selection, setSelection] = useState<ActiveSelection | null>(null);
  const [sharedSnapshot, setSharedSnapshot] =
    useState<SharedProfilesSnapshot | null>(null);
  const [sharedAttempt, setSharedAttempt] = useState(0);
  const [refreshingActorUserId, setRefreshingActorUserId] =
    useState<UserId | null>(null);

  const personalIdentity = personal.status === 'ready' ? personal.identity : null;
  const actorUserId = personalIdentity?.user.id ?? null;
  const personalProfile = personalIdentity?.profile ?? null;

  const rpc = useMemo<SharedProfileRpc | null>(
    () =>
      connection.status === 'configured'
        ? async (functionName, arguments_) => {
            const { data, error } = await connection.client.rpc(
              functionName,
              arguments_,
            );

            return {
              data,
              error: error ? { message: error.message } : null,
            };
          }
        : null,
    [connection],
  );

  useEffect(() => {
    if (!actorUserId || !rpc) {
      return;
    }

    let active = true;
    const scopeActorUserId = actorUserId;

    void loadSharedProfiles(rpc).then((result) => {
      if (!active) return;

      setRefreshingActorUserId((current) =>
        current === scopeActorUserId ? null : current,
      );

      if (result.status === 'error') {
        setSharedSnapshot((current) => ({
          actorUserId: scopeActorUserId,
          status: 'error',
          profiles:
            current?.actorUserId === scopeActorUserId
              ? current.profiles
              : EMPTY_SHARED_PROFILES,
          message: result.message,
        }));
        return;
      }

      setSharedSnapshot({
        actorUserId: scopeActorUserId,
        status: 'ready',
        profiles: result.profiles,
        message: null,
      });
    });

    return () => {
      active = false;
    };
  }, [actorUserId, rpc, sharedAttempt]);

  const visibleSharedProfiles =
    actorUserId && sharedSnapshot?.actorUserId === actorUserId
      ? sharedSnapshot.profiles
      : EMPTY_SHARED_PROFILES;
  const selectableProfiles = useMemo(
    () => getSelectableProfiles(personalProfile, visibleSharedProfiles),
    [personalProfile, visibleSharedProfiles],
  );
  const requestedProfileId =
    actorUserId && selection?.actorUserId === actorUserId
      ? selection.profileId
      : personalProfile?.id ?? null;
  const activeProfile = resolveActiveProfile(
    requestedProfileId,
    personalProfile,
    visibleSharedProfiles,
  );

  const selectProfile = useCallback(
    (profileId: ProfileId) => {
      if (!actorUserId) return false;

      const selectable = selectableProfiles.some(
        (profile) => profile.id === profileId,
      );

      if (!selectable) return false;

      setSelection({ actorUserId, profileId });
      return true;
    },
    [actorUserId, selectableProfiles],
  );

  const retrySharedProfiles = useCallback(() => {
    if (!actorUserId) return;

    setRefreshingActorUserId(actorUserId);
    setSharedAttempt((current) => current + 1);
  }, [actorUserId]);

  const status = getActiveProfileStatus(personal.status);
  const sharedProfilesStatus = getSharedProfilesStatus(
    personal.status,
    connection.status,
    actorUserId,
    sharedSnapshot,
    refreshingActorUserId,
  );
  const sharedProfilesError =
    sharedProfilesStatus === 'error' && sharedSnapshot?.actorUserId === actorUserId
      ? sharedSnapshot.message
      : null;

  const value = useMemo<ActiveProfileContextValue>(
    () => ({
      status,
      actorUserId,
      activeProfile,
      personalProfile,
      sharedProfiles: visibleSharedProfiles,
      selectableProfiles,
      sharedProfilesStatus,
      sharedProfilesError,
      selectProfile,
      retrySharedProfiles,
    }),
    [
      activeProfile,
      actorUserId,
      personalProfile,
      retrySharedProfiles,
      selectProfile,
      selectableProfiles,
      sharedProfilesError,
      sharedProfilesStatus,
      status,
      visibleSharedProfiles,
    ],
  );

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile(): ActiveProfileContextValue {
  const value = useContext(ActiveProfileContext);

  if (!value) {
    throw new Error('useActiveProfile must be used within ActiveProfileProvider');
  }

  return value;
}

export function getSelectableProfiles(
  personalProfile: PersonalProfile | null,
  sharedProfiles: readonly SharedProfileMembership[],
): readonly Profile[] {
  if (!personalProfile) return [];

  return [
    personalProfile,
    ...sharedProfiles
      .filter((membership) => membership.isReady)
      .map((membership) => membership.profile),
  ];
}

export function resolveActiveProfile(
  requestedProfileId: ProfileId | null,
  personalProfile: PersonalProfile | null,
  sharedProfiles: readonly SharedProfileMembership[],
): Profile | null {
  if (!personalProfile) return null;

  if (!requestedProfileId || requestedProfileId === personalProfile.id) {
    return personalProfile;
  }

  const shared = sharedProfiles.find(
    (membership) =>
      membership.isReady && membership.profile.id === requestedProfileId,
  );

  return shared?.profile ?? personalProfile;
}

function getActiveProfileStatus(
  personalStatus: ReturnType<typeof usePersonalProfile>['status'],
): ActiveProfileStatus {
  if (personalStatus === 'disabled') return 'disabled';
  return personalStatus === 'ready' ? 'ready' : 'inactive';
}

function getSharedProfilesStatus(
  personalStatus: ReturnType<typeof usePersonalProfile>['status'],
  connectionStatus: ReturnType<typeof useSupabaseConnection>['status'],
  actorUserId: UserId | null,
  snapshot: SharedProfilesSnapshot | null,
  refreshingActorUserId: UserId | null,
): SharedProfilesStatus {
  if (personalStatus === 'disabled' || connectionStatus === 'unconfigured') {
    return 'disabled';
  }

  if (!actorUserId || connectionStatus !== 'configured') {
    return 'inactive';
  }

  if (refreshingActorUserId === actorUserId) {
    return 'loading';
  }

  if (!snapshot || snapshot.actorUserId !== actorUserId) {
    return 'loading';
  }

  return snapshot.status;
}
