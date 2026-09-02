import type {
  ItemId,
  ItemListId,
  ProfileId,
  ProfileMessageId,
  ProfileType,
  UserId,
} from '../../domain/contracts';

export const PROFILE_MESSAGE_RPC = {
  threads: 'get_profile_message_threads',
  messages: 'get_profile_messages',
  send: 'send_profile_message',
  markRead: 'mark_profile_messages_read',
} as const;

export const MAXIMUM_PROFILE_MESSAGE_LENGTH = 500;

interface RpcErrorLike {
  code?: string;
  message: string;
}

interface RpcResponse {
  data: unknown;
  error: RpcErrorLike | null;
}

export type ProfileMessageRpc = (
  functionName: string,
  arguments_?: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

export interface ProfileMessage {
  id: ProfileMessageId;
  profileId: ProfileId;
  actorUserId: UserId;
  actorNickname: string;
  body: string;
  listId: ItemListId | null;
  listName: string | null;
  itemId: ItemId | null;
  itemTitle: string | null;
  createdAt: string;
}

export interface ProfileMessageThread {
  profileId: ProfileId;
  profileType: ProfileType;
  profileName: string;
  latestMessage: ProfileMessage | null;
  unreadCount: number;
}

export type MessageValidationResult =
  | { status: 'valid'; body: string }
  | { status: 'invalid'; message: string };

export type MessageThreadsResult =
  | { status: 'success'; threads: readonly ProfileMessageThread[] }
  | { status: 'error'; message: string };

export type ProfileMessagesResult =
  | { status: 'success'; messages: readonly ProfileMessage[] }
  | { status: 'error'; message: string };

export type SendProfileMessageResult =
  | { status: 'success'; message: ProfileMessage; created: boolean }
  | { status: 'error'; message: string };

export type MarkMessagesReadResult =
  | { status: 'success'; readThrough: string }
  | { status: 'error'; message: string };

const LOAD_THREADS_ERROR = 'Viestiketjuja ei voitu ladata. Yritä uudelleen.';
const LOAD_MESSAGES_ERROR = 'Viestejä ei voitu ladata. Yritä uudelleen.';
const SEND_MESSAGE_ERROR = 'Viestiä ei voitu lähettää. Yritä uudelleen.';
const MARK_READ_ERROR = 'Viestien lukutilaa ei voitu päivittää.';

export function validateProfileMessage(value: string): MessageValidationResult {
  const body = value.trim();

  if (body.length === 0) {
    return { status: 'invalid', message: 'Kirjoita viesti.' };
  }

  if (body.length > MAXIMUM_PROFILE_MESSAGE_LENGTH) {
    return {
      status: 'invalid',
      message: `Viestissä voi olla enintään ${MAXIMUM_PROFILE_MESSAGE_LENGTH} merkkiä.`,
    };
  }

  if (/\p{Cc}/u.test(body)) {
    return {
      status: 'invalid',
      message: 'Viestissä on merkkejä, joita ei voi käyttää.',
    };
  }

  return { status: 'valid', body };
}

export async function loadProfileMessageThreads(
  rpc: ProfileMessageRpc,
): Promise<MessageThreadsResult> {
  try {
    const response = await rpc(PROFILE_MESSAGE_RPC.threads);
    if (response.error) return { status: 'error', message: LOAD_THREADS_ERROR };
    return mapThreads(response.data);
  } catch {
    return { status: 'error', message: LOAD_THREADS_ERROR };
  }
}

export async function loadProfileMessages(
  rpc: ProfileMessageRpc,
  profileId: ProfileId,
  limit = 50,
): Promise<ProfileMessagesResult> {
  try {
    const response = await rpc(PROFILE_MESSAGE_RPC.messages, {
      target_profile_id: profileId,
      requested_limit: Math.min(Math.max(Math.trunc(limit), 1), 100),
    });
    if (response.error) return { status: 'error', message: LOAD_MESSAGES_ERROR };
    return mapMessages(response.data);
  } catch {
    return { status: 'error', message: LOAD_MESSAGES_ERROR };
  }
}

export async function sendProfileMessage(
  rpc: ProfileMessageRpc,
  input: {
    profileId: ProfileId;
    messageId: ProfileMessageId;
    body: string;
    listId?: ItemListId | null;
    itemId?: ItemId | null;
  },
): Promise<SendProfileMessageResult> {
  const validation = validateProfileMessage(input.body);
  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await rpc(PROFILE_MESSAGE_RPC.send, {
      target_profile_id: input.profileId,
      requested_message_id: input.messageId,
      requested_body: validation.body,
      referenced_list_id: input.listId ?? null,
      referenced_item_id: input.itemId ?? null,
    });
    if (response.error) return { status: 'error', message: SEND_MESSAGE_ERROR };
    return mapSentMessage(response.data);
  } catch {
    return { status: 'error', message: SEND_MESSAGE_ERROR };
  }
}

export async function markProfileMessagesRead(
  rpc: ProfileMessageRpc,
  profileId: ProfileId,
  readThrough?: string | null,
): Promise<MarkMessagesReadResult> {
  try {
    const response = await rpc(PROFILE_MESSAGE_RPC.markRead, {
      target_profile_id: profileId,
      read_through: readThrough ?? null,
    });
    if (response.error || typeof response.data !== 'string') {
      return { status: 'error', message: MARK_READ_ERROR };
    }
    return { status: 'success', readThrough: response.data };
  } catch {
    return { status: 'error', message: MARK_READ_ERROR };
  }
}

function mapThreads(data: unknown): MessageThreadsResult {
  if (!Array.isArray(data)) return { status: 'error', message: LOAD_THREADS_ERROR };

  const threads: ProfileMessageThread[] = [];
  for (const row of data) {
    if (!isRecord(row)) return { status: 'error', message: LOAD_THREADS_ERROR };
    const profileType = row.profile_type;
    if (
      typeof row.profile_id !== 'string' ||
      (profileType !== 'PERSONAL' && profileType !== 'SHARED') ||
      typeof row.profile_name !== 'string' ||
      typeof row.unread_count !== 'number'
    ) {
      return { status: 'error', message: LOAD_THREADS_ERROR };
    }

    const hasLatest = row.latest_message_id !== null;
    const latestMessage = hasLatest
      ? mapMessageRow({
          message_id: row.latest_message_id,
          profile_id: row.profile_id,
          actor_user_id: row.latest_actor_user_id,
          actor_nickname: row.latest_actor_nickname,
          body: row.latest_body,
          list_id: row.latest_list_id,
          list_name: row.latest_list_name,
          item_id: row.latest_item_id,
          item_title: row.latest_item_title,
          created_at: row.latest_created_at,
        })
      : null;
    if (hasLatest && !latestMessage) {
      return { status: 'error', message: LOAD_THREADS_ERROR };
    }

    threads.push({
      profileId: row.profile_id,
      profileType,
      profileName: row.profile_name,
      latestMessage,
      unreadCount: Math.max(0, Math.trunc(row.unread_count)),
    });
  }

  return { status: 'success', threads };
}

function mapMessages(data: unknown): ProfileMessagesResult {
  if (!Array.isArray(data)) return { status: 'error', message: LOAD_MESSAGES_ERROR };
  const messages = data.map(mapMessageRow);
  return messages.every((message): message is ProfileMessage => message !== null)
    ? { status: 'success', messages }
    : { status: 'error', message: LOAD_MESSAGES_ERROR };
}

function mapSentMessage(data: unknown): SendProfileMessageResult {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return { status: 'error', message: SEND_MESSAGE_ERROR };
  }
  const message = mapMessageRow(data[0]);
  return message && typeof data[0].created === 'boolean'
    ? { status: 'success', message, created: data[0].created }
    : { status: 'error', message: SEND_MESSAGE_ERROR };
}

function mapMessageRow(row: unknown): ProfileMessage | null {
  if (!isRecord(row)) return null;
  if (
    typeof row.message_id !== 'string' ||
    typeof row.profile_id !== 'string' ||
    typeof row.actor_user_id !== 'string' ||
    typeof row.actor_nickname !== 'string' ||
    typeof row.body !== 'string' ||
    typeof row.created_at !== 'string' ||
    !isNullableString(row.list_id) ||
    !isNullableString(row.list_name) ||
    !isNullableString(row.item_id) ||
    !isNullableString(row.item_title)
  ) return null;

  return {
    id: row.message_id,
    profileId: row.profile_id,
    actorUserId: row.actor_user_id,
    actorNickname: row.actor_nickname,
    body: row.body,
    listId: row.list_id,
    listName: row.list_name,
    itemId: row.item_id,
    itemTitle: row.item_title,
    createdAt: row.created_at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
