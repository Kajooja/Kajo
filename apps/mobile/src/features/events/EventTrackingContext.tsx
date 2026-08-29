import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { usePersonalProfile } from '@/features/profiles/PersonalProfileProvider';

import type { EventId } from '../../domain/contracts';
import {
  createSupabaseEventPersistenceApi,
  type EventPersistenceApi,
} from './eventPersistence';
import {
  createEventSession,
  createEventWriteCoordinator,
  createTrackedEvent,
  createUuidV7,
  getImpressionDeduplicationKey,
  type EventRecordInput,
  type EventTrackingScope,
  type EventWriteCoordinator,
} from './eventTracking';

export type EventTrackingStatus =
  | 'disabled'
  | 'inactive'
  | 'ready';

interface EventTrackingState {
  status: EventTrackingStatus;
  persistenceError: string | null;
  createEventId: () => EventId;
  recordEvent: (input: EventRecordInput, eventId?: EventId) => EventId | null;
  retryPersistence: () => void;
}

interface ScopedCoordinator {
  key: string;
  coordinator: EventWriteCoordinator;
  session: ReturnType<typeof createEventSession>;
}

interface ScopedFailure {
  key: string;
  message: string;
}

const EventTrackingContext = createContext<EventTrackingState | null>(null);

export function EventTrackingProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const personalProfile = usePersonalProfile();
  const [failure, setFailure] = useState<ScopedFailure | null>(null);
  const impressionKeys = useRef(new Set<string>());
  const defaultContext = useMemo(() => getRuntimeContext(), []);
  const persistenceApi = useMemo<EventPersistenceApi | null>(
    () =>
      connection.status === 'configured'
        ? createSupabaseEventPersistenceApi(connection.client)
        : null,
    [connection],
  );
  const scope = useMemo(
    () => getTrackingScope(personalProfile, persistenceApi),
    [persistenceApi, personalProfile],
  );
  const scopeKey = scope
    ? `${scope.profileId}:${scope.actorUserId}`
    : null;
  const scopedCoordinator = useMemo<ScopedCoordinator | null>(() => {
    if (!scope || !scopeKey || !persistenceApi) {
      return null;
    }

    const session = createEventSession(
      scope,
      createUuidV7(),
      new Date().toISOString(),
      defaultContext,
    );
    const coordinator = createEventWriteCoordinator(
      persistenceApi,
      session,
      (snapshot) => {
        setFailure(
          snapshot.message
            ? { key: scopeKey, message: snapshot.message }
            : null,
        );
      },
    );

    return { key: scopeKey, coordinator, session };
  }, [defaultContext, persistenceApi, scope, scopeKey]);
  const status = getEventTrackingStatus(
    connection.status,
    personalProfile.status,
    Boolean(scopedCoordinator),
  );
  const persistenceError =
    failure?.key === scopeKey ? failure.message : null;

  useEffect(() => {
    impressionKeys.current.clear();

    return () => {
      scopedCoordinator?.coordinator.dispose();
    };
  }, [scopedCoordinator]);

  const createEventId = useCallback(() => createUuidV7(), []);

  const recordEvent = useCallback(
    (input: EventRecordInput, suppliedEventId?: EventId) => {
      const current = scopedCoordinator;

      if (!current) return null;

      const deduplicationKey = getImpressionDeduplicationKey(input);

      if (
        deduplicationKey &&
        impressionKeys.current.has(deduplicationKey)
      ) {
        return null;
      }

      const eventId = suppliedEventId ?? createUuidV7();
      const event = createTrackedEvent(
        current.session,
        input,
        eventId,
        new Date().toISOString(),
        defaultContext,
      );

      if (deduplicationKey) {
        impressionKeys.current.add(deduplicationKey);
      }

      current.coordinator.enqueue(event);
      return eventId;
    },
    [defaultContext, scopedCoordinator],
  );

  const retryPersistence = useCallback(() => {
    scopedCoordinator?.coordinator.retry();
  }, [scopedCoordinator]);

  const value = useMemo<EventTrackingState>(
    () => ({
      status,
      persistenceError,
      createEventId,
      recordEvent,
      retryPersistence,
    }),
    [
      createEventId,
      persistenceError,
      recordEvent,
      retryPersistence,
      status,
    ],
  );

  return (
    <EventTrackingContext.Provider value={value}>
      {children}
    </EventTrackingContext.Provider>
  );
}

export function useEventTracking(): EventTrackingState {
  const state = useContext(EventTrackingContext);

  if (!state) {
    throw new Error(
      'useEventTracking must be used within EventTrackingProvider',
    );
  }

  return state;
}

function getTrackingScope(
  personalProfile: ReturnType<typeof usePersonalProfile>,
  persistenceApi: EventPersistenceApi | null,
): EventTrackingScope | null {
  if (personalProfile.status !== 'ready' || !persistenceApi) {
    return null;
  }

  return {
    profileId: personalProfile.identity.profile.id,
    actorUserId: personalProfile.identity.user.id,
  };
}

function getRuntimeContext() {
  const resolved = Intl.DateTimeFormat().resolvedOptions();

  return {
    ...(resolved.locale ? { locale: resolved.locale } : {}),
    ...(resolved.timeZone ? { timezone: resolved.timeZone } : {}),
  };
}

function getEventTrackingStatus(
  connectionStatus: ReturnType<typeof useSupabaseConnection>['status'],
  profileStatus: ReturnType<typeof usePersonalProfile>['status'],
  hasScope: boolean,
): EventTrackingStatus {
  if (connectionStatus === 'unconfigured' || profileStatus === 'disabled') {
    return 'disabled';
  }

  return hasScope ? 'ready' : 'inactive';
}
