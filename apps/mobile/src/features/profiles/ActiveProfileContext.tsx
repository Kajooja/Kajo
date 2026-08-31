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
  getSelectableProfiles,
  resolveActiveProfile,
} from './activeProfileState';
import {
  createSharedProfile as createSharedProfileOperation,
  inviteSharedProfileMember as inviteSharedProfileMemberOperation,
  loadSharedProfileInvitations,
  loadSharedProfiles,
  respondSharedProfileInvitation as respondSharedProfileInvitationOperation,
  type SharedProfileCreateResult,
  type SharedProfileInvitation,
  type SharedProfileInvitationResponseResult,
  type SharedProfileInviteResult,
  type SharedProfileMembership,
  type SharedProfileRpc,
} from './sharedProfileOperations';

export type SharedProfileRemoteStatus =
  | 'disabled'
  | 'inactive'
  | 'loading'
  | 'ready'
  | 'error';
export type SharedProfilesStatus = SharedProfileRemoteStatus;
export type SharedProfileInvitationsStatus = SharedProfileRemoteStatus;
export type ActiveProfileStatus = 'disabled' | 'inactive' | 'ready';

interface ActiveProfileContextValue {
  status: ActiveProfileStatus;
  actorUserId: UserId | null;
  activeProfile: Profile | null;
  personalProfile: PersonalProfile | null;
  sharedProfiles: readonly SharedProfileMembership[];
  invitations: readonly SharedProfileInvitation[];
  selectableProfiles: readonly Profile[];
  sharedProfilesStatus: SharedProfilesStatus;
  sharedProfilesError: string | null;
  invitationsStatus: SharedProfileInvitationsStatus;
  invitationsError: string | null;
  selectProfile: (profileId: ProfileId) => boolean;
  retrySharedProfiles: () => void;
  retryInvitations: () => void;
  createSharedProfile: (name: string) => Promise<SharedProfileCreateResult>;
  inviteSharedProfileMember: (
    profileId: ProfileId,
    nickname: string,
  ) => Promise<SharedProfileInviteResult>;
  respondSharedProfileInvitation: (
    invitationId: string,
    accept: boolean,
  ) => Promise<SharedProfileInvitationResponseResult>;
}

interface SharedProfilesSnapshot {
  actorUserId: UserId;
  status: 'ready' | 'error';
  profiles: readonly SharedProfileMembership[];
  message: string | null;
}

interface InvitationsSnapshot {
  actorUserId: UserId;
  status: 'ready' | 'error';
  invitations: readonly SharedProfileInvitation[];
  message: string | null;
}

interface ActiveSelection {
  actorUserId: UserId;
  profileId: ProfileId;
}

const EMPTY_SHARED_PROFILES: readonly SharedProfileMembership[] = [];
const EMPTY_INVITATIONS: readonly SharedProfileInvitation[] = [];
const SHARED_PROFILE_UNAVAILABLE_MESSAGE =
  'Yhteinen Kajo ei ole käytettävissä tällä hetkellä.';
const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);

export function ActiveProfileProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const personal = usePersonalProfile();
  const [selection, setSelection] = useState<ActiveSelection | null>(null);
  const [sharedSnapshot, setSharedSnapshot] =
    useState<SharedProfilesSnapshot | null>(null);
  const [invitationsSnapshot, setInvitationsSnapshot] =
    useState<InvitationsSnapshot | null>(null);
  const [sharedAttempt, setSharedAttempt] = useState(0);
  const [invitationAttempt, setInvitationAttempt] = useState(0);
  const [refreshingSharedActorUserId, setRefreshingSharedActorUserId] =
    useState<UserId | null>(null);
  const [refreshingInvitationsActorUserId, setRefreshingInvitationsActorUserId] =
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
              error: error
                ? { code: error.code, message: error.message }
                : null,
            };
          }
        : null,
    [connection],
  );

  useEffect(() => {
    if (!actorUserId || !rpc) return;

    let active = true;
    const scopeActorUserId = actorUserId;

    void loadSharedProfiles(rpc).then((result) => {
      if (!active) return;

      setRefreshingSharedActorUserId((current) =>
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

  useEffect(() => {
    if (!actorUserId || !rpc) return;

    let active = true;
    const scopeActorUserId = actorUserId;

    void loadSharedProfileInvitations(rpc).then((result) => {
      if (!active) return;

      setRefreshingInvitationsActorUserId((current) =>
        current === scopeActorUserId ? null : current,
      );

      if (result.status === 'error') {
        setInvitationsSnapshot((current) => ({
          actorUserId: scopeActorUserId,
          status: 'error',
          invitations:
            current?.actorUserId === scopeActorUserId
              ? current.invitations
              : EMPTY_INVITATIONS,
          message: result.message,
        }));
        return;
      }

      setInvitationsSnapshot({
        actorUserId: scopeActorUserId,
        status: 'ready',
        invitations: result.invitations,
        message: null,
      });
    });

    return () => {
      active = false;
    };
  }, [actorUserId, invitationAttempt, rpc]);

  const visibleSharedProfiles =
    actorUserId && sharedSnapshot?.actorUserId === actorUserId
      ? sharedSnapshot.profiles
      : EMPTY_SHARED_PROFILES;
  const visibleInvitations =
    actorUserId && invitationsSnapshot?.actorUserId === actorUserId
      ? invitationsSnapshot.invitations
      : EMPTY_INVITATIONS;
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

    setRefreshingSharedActorUserId(actorUserId);
    setSharedAttempt((current) => current + 1);
  }, [actorUserId]);

  const retryInvitations = useCallback(() => {
    if (!actorUserId) return;

    setRefreshingInvitationsActorUserId(actorUserId);
    setInvitationAttempt((current) => current + 1);
  }, [actorUserId]);

  const createSharedProfile = useCallback(
    async (name: string): Promise<SharedProfileCreateResult> => {
      if (!rpc || !actorUserId) {
        return { status: 'error', message: SHARED_PROFILE_UNAVAILABLE_MESSAGE };
      }

      const result = await createSharedProfileOperation(rpc, name);

      if (result.status === 'success') retrySharedProfiles();

      return result;
    },
    [actorUserId, retrySharedProfiles, rpc],
  );

  const inviteSharedProfileMember = useCallback(
    async (
      profileId: ProfileId,
      nickname: string,
    ): Promise<SharedProfileInviteResult> => {
      if (!rpc || !actorUserId) {
        return { status: 'error', message: SHARED_PROFILE_UNAVAILABLE_MESSAGE };
      }

      return inviteSharedProfileMemberOperation(rpc, profileId, nickname);
    },
    [actorUserId, rpc],
  );

  const respondSharedProfileInvitation = useCallback(
    async (
      invitationId: string,
      accept: boolean,
    ): Promise<SharedProfileInvitationResponseResult> => {
      if (!rpc || !actorUserId) {
        return { status: 'error', message: SHARED_PROFILE_UNAVAILABLE_MESSAGE };
      }

      const result = await respondSharedProfileInvitationOperation(
        rpc,
        invitationId,
        accept,
      );

      if (result.status === 'success') {
        retryInvitations();
        retrySharedProfiles();
      }

      return result;
    },
    [actorUserId, retryInvitations, retrySharedProfiles, rpc],
  );

  const status = getActiveProfileStatus(personal.status);
  const sharedProfilesStatus = getRemoteStatus(
    personal.status,
    connection.status,
    actorUserId,
    sharedSnapshot,
    refreshingSharedActorUserId,
  );
  const invitationsStatus = getRemoteStatus(
    personal.status,
    connection.status,
    actorUserId,
    invitationsSnapshot,
    refreshingInvitationsActorUserId,
  );
  const sharedProfilesError =
    sharedProfilesStatus === 'error' && sharedSnapshot?.actorUserId === actorUserId
      ? sharedSnapshot.message
      : null;
  const invitationsError =
    invitationsStatus === 'error' &&
    invitationsSnapshot?.actorUserId === actorUserId
      ? invitationsSnapshot.message
      : null;

  const value = useMemo<ActiveProfileContextValue>(
    () => ({
      status,
      actorUserId,
      activeProfile,
      personalProfile,
      sharedProfiles: visibleSharedProfiles,
      invitations: visibleInvitations,
      selectableProfiles,
      sharedProfilesStatus,
      sharedProfilesError,
      invitationsStatus,
      invitationsError,
      selectProfile,
      retrySharedProfiles,
      retryInvitations,
      createSharedProfile,
      inviteSharedProfileMember,
      respondSharedProfileInvitation,
    }),
    [
      activeProfile,
      actorUserId,
      createSharedProfile,
      invitationsError,
      invitationsStatus,
      inviteSharedProfileMember,
      personalProfile,
      respondSharedProfileInvitation,
      retryInvitations,
      retrySharedProfiles,
      selectProfile,
      selectableProfiles,
      sharedProfilesError,
      sharedProfilesStatus,
      status,
      visibleInvitations,
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

function getActiveProfileStatus(
  personalStatus: ReturnType<typeof usePersonalProfile>['status'],
): ActiveProfileStatus {
  if (personalStatus === 'disabled') return 'disabled';
  return personalStatus === 'ready' ? 'ready' : 'inactive';
}

function getRemoteStatus(
  personalStatus: ReturnType<typeof usePersonalProfile>['status'],
  connectionStatus: ReturnType<typeof useSupabaseConnection>['status'],
  actorUserId: UserId | null,
  snapshot: { actorUserId: UserId; status: 'ready' | 'error' } | null,
  refreshingActorUserId: UserId | null,
): SharedProfileRemoteStatus {
  if (personalStatus === 'disabled' || connectionStatus === 'unconfigured') {
    return 'disabled';
  }

  if (!actorUserId || connectionStatus !== 'configured') {
    return 'inactive';
  }

  if (refreshingActorUserId === actorUserId) return 'loading';
  if (!snapshot || snapshot.actorUserId !== actorUserId) return 'loading';
  return snapshot.status;
}
