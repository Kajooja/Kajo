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
  ItemId,
  ItemListId,
  ProfileId,
  ProfileMessageId,
} from '@/domain/contracts';
import { useAuthSession } from '@/features/auth/AuthSessionProvider';
import { createUuidV7 } from '@/features/events/eventTracking';

import {
  loadProfileMessages,
  loadProfileMessageThreads,
  markProfileMessagesRead,
  sendProfileMessage,
  type MarkMessagesReadResult,
  type MessageThreadsResult,
  type ProfileMessageRpc,
  type ProfileMessagesResult,
  type ProfileMessageThread,
  type SendProfileMessageResult,
} from './profileMessageOperations';

export type ProfileMessagesStatus =
  | 'disabled'
  | 'inactive'
  | 'loading'
  | 'ready'
  | 'error';

export interface OutgoingProfileMessage {
  messageId: ProfileMessageId;
  profileId: ProfileId;
  body: string;
  listId: ItemListId | null;
  itemId: ItemId | null;
}

interface ProfileMessagesContextValue {
  status: ProfileMessagesStatus;
  threads: readonly ProfileMessageThread[];
  unreadTotal: number;
  error: string | null;
  failedMessages: readonly OutgoingProfileMessage[];
  refresh: () => void;
  loadMessages: (profileId: ProfileId, limit?: number) => Promise<ProfileMessagesResult>;
  send: (input: Omit<OutgoingProfileMessage, 'messageId'> & {
    messageId?: ProfileMessageId;
  }) => Promise<SendProfileMessageResult>;
  retry: (messageId: ProfileMessageId) => Promise<SendProfileMessageResult>;
  discard: (messageId: ProfileMessageId) => void;
  markRead: (
    profileId: ProfileId,
    readThrough?: string | null,
  ) => Promise<MarkMessagesReadResult>;
}

const EMPTY_THREADS: readonly ProfileMessageThread[] = [];
const UNAVAILABLE_MESSAGE = 'Viestit eivät ole käytettävissä tällä hetkellä.';
const ProfileMessagesContext = createContext<ProfileMessagesContextValue | null>(null);

interface ThreadSnapshot {
  userId: string;
  result: MessageThreadsResult;
}

interface StoredOutgoingProfileMessage extends OutgoingProfileMessage {
  ownerUserId: string;
}

export function ProfileMessagesProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const auth = useAuthSession();
  const [snapshot, setSnapshot] = useState<ThreadSnapshot | null>(null);
  const [storedFailures, setStoredFailures] = useState<readonly StoredOutgoingProfileMessage[]>([]);
  const [attempt, setAttempt] = useState(0);
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  const rpc = useMemo<ProfileMessageRpc | null>(
    () => connection.status === 'configured'
      ? async (functionName, arguments_) => {
          const { data, error } = await connection.client.rpc(functionName, arguments_);
          return {
            data,
            error: error ? { code: error.code, message: error.message } : null,
          };
        }
      : null,
    [connection],
  );

  useEffect(() => {
    if (!rpc || !userId) return;

    let active = true;
    void loadProfileMessageThreads(rpc).then((result) => {
      if (active) setSnapshot({ userId, result });
    });
    return () => { active = false; };
  }, [attempt, rpc, userId]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  const loadMessages = useCallback(
    (profileId: ProfileId, limit?: number) => rpc && userId
      ? loadProfileMessages(rpc, profileId, limit)
      : Promise.resolve({
          status: 'error',
          message: UNAVAILABLE_MESSAGE,
        } as ProfileMessagesResult),
    [rpc, userId],
  );

  const sendDraft = useCallback(async (
    draft: OutgoingProfileMessage,
  ): Promise<SendProfileMessageResult> => {
    const result = rpc && userId
      ? await sendProfileMessage(rpc, draft)
      : { status: 'error' as const, message: UNAVAILABLE_MESSAGE };

    setStoredFailures((current) => result.status === 'success'
      ? current.filter((candidate) => candidate.messageId !== draft.messageId)
      : current.some((candidate) => candidate.messageId === draft.messageId)
        ? current
        : [...current, { ...draft, ownerUserId: userId ?? '' }]);
    if (result.status === 'success') refresh();
    return result;
  }, [refresh, rpc, userId]);

  const send = useCallback(
    (input: Omit<OutgoingProfileMessage, 'messageId'> & {
      messageId?: ProfileMessageId;
    }) => sendDraft({ ...input, messageId: input.messageId ?? createUuidV7() }),
    [sendDraft],
  );

  const retry = useCallback(async (messageId: ProfileMessageId) => {
    const draft = storedFailures.find((candidate) => (
      candidate.messageId === messageId && candidate.ownerUserId === userId
    ));
    return draft
      ? sendDraft(draft)
      : { status: 'error' as const, message: UNAVAILABLE_MESSAGE };
  }, [sendDraft, storedFailures, userId]);

  const discard = useCallback((messageId: ProfileMessageId) => {
    setStoredFailures((current) => current.filter(
      (candidate) => candidate.messageId !== messageId,
    ));
  }, []);

  const markRead = useCallback(async (
    profileId: ProfileId,
    readThrough?: string | null,
  ) => {
    const result = rpc && userId
      ? await markProfileMessagesRead(rpc, profileId, readThrough)
      : { status: 'error' as const, message: UNAVAILABLE_MESSAGE };
    if (result.status === 'success') {
      setSnapshot((current) => current?.userId === userId && current.result.status === 'success'
        ? {
            userId,
            result: {
              status: 'success',
              threads: current.result.threads.map((thread) => thread.profileId === profileId
                ? { ...thread, unreadCount: 0 }
                : thread),
            },
          }
        : current);
    }
    return result;
  }, [rpc, userId]);

  const status: ProfileMessagesStatus = connection.status === 'unconfigured'
    ? 'disabled'
    : !userId
      ? 'inactive'
      : snapshot?.userId !== userId
        ? 'loading'
        : snapshot.result.status === 'success'
          ? 'ready'
          : 'error';
  const threads = snapshot?.userId === userId && snapshot.result.status === 'success'
    ? snapshot.result.threads
    : EMPTY_THREADS;
  const error = snapshot?.userId === userId && snapshot.result.status === 'error'
    ? snapshot.result.message
    : null;
  const failedMessages = storedFailures
    .filter((candidate) => candidate.ownerUserId === userId)
    .map(({ ownerUserId: _ownerUserId, ...draft }) => draft);
  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const value = useMemo<ProfileMessagesContextValue>(() => ({
    status,
    threads,
    unreadTotal,
    error,
    failedMessages,
    refresh,
    loadMessages,
    send,
    retry,
    discard,
    markRead,
  }), [
    discard,
    error,
    failedMessages,
    loadMessages,
    markRead,
    refresh,
    retry,
    send,
    status,
    threads,
    unreadTotal,
  ]);

  return (
    <ProfileMessagesContext.Provider value={value}>
      {children}
    </ProfileMessagesContext.Provider>
  );
}

export function useProfileMessages(): ProfileMessagesContextValue {
  const value = useContext(ProfileMessagesContext);
  if (!value) {
    throw new Error('useProfileMessages must be used within ProfileMessagesProvider');
  }
  return value;
}
