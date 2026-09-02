import { describe, expect, it, vi } from 'vitest';

import {
  loadProfileMessages,
  loadProfileMessageThreads,
  markProfileMessagesRead,
  PROFILE_MESSAGE_RPC,
  sendProfileMessage,
  validateProfileMessage,
  type ProfileMessageRpc,
} from './profileMessageOperations';

const messageRow = {
  message_id: 'message-1',
  profile_id: 'profile-1',
  actor_user_id: 'user-1',
  actor_nickname: 'Aino',
  body: 'Tämä voisi olla meille hyvä.',
  list_id: 'list-1',
  list_name: 'Syksyn elokuvat',
  item_id: 'item-1',
  item_title: 'Arrival',
  created_at: '2026-09-02T18:30:00.000Z',
};

function rpcWith(data: unknown): ProfileMessageRpc {
  return vi.fn(async () => ({ data, error: null }));
}

describe('Profile message validation', () => {
  it('trims a valid short message', () => {
    expect(validateProfileMessage('  Hyvä idea  ')).toEqual({
      status: 'valid',
      body: 'Hyvä idea',
    });
  });

  it('rejects empty, oversized and control-character messages', () => {
    expect(validateProfileMessage('   ').status).toBe('invalid');
    expect(validateProfileMessage('a'.repeat(501)).status).toBe('invalid');
    expect(validateProfileMessage('rivi\ntoinen').status).toBe('invalid');
  });
});

describe('Profile message RPC boundary', () => {
  it('loads threads with latest context and unread count', async () => {
    const rpc = rpcWith([{
      profile_id: 'profile-1',
      profile_type: 'SHARED',
      profile_name: 'Leffaporukka',
      latest_message_id: messageRow.message_id,
      latest_actor_user_id: messageRow.actor_user_id,
      latest_actor_nickname: messageRow.actor_nickname,
      latest_body: messageRow.body,
      latest_list_id: messageRow.list_id,
      latest_list_name: messageRow.list_name,
      latest_item_id: messageRow.item_id,
      latest_item_title: messageRow.item_title,
      latest_created_at: messageRow.created_at,
      unread_count: 2,
    }]);

    await expect(loadProfileMessageThreads(rpc)).resolves.toEqual({
      status: 'success',
      threads: [{
        profileId: 'profile-1',
        profileType: 'SHARED',
        profileName: 'Leffaporukka',
        latestMessage: {
          id: 'message-1',
          profileId: 'profile-1',
          actorUserId: 'user-1',
          actorNickname: 'Aino',
          body: 'Tämä voisi olla meille hyvä.',
          listId: 'list-1',
          listName: 'Syksyn elokuvat',
          itemId: 'item-1',
          itemTitle: 'Arrival',
          createdAt: '2026-09-02T18:30:00.000Z',
        },
        unreadCount: 2,
      }],
    });
    expect(rpc).toHaveBeenCalledWith(PROFILE_MESSAGE_RPC.threads);
  });

  it('loads a bounded message page', async () => {
    const rpc = rpcWith([messageRow]);
    const result = await loadProfileMessages(rpc, 'profile-1', 999);

    expect(result.status).toBe('success');
    expect(rpc).toHaveBeenCalledWith(PROFILE_MESSAGE_RPC.messages, {
      target_profile_id: 'profile-1',
      requested_limit: 100,
    });
  });

  it('sends a normalized contextual message by stable ID', async () => {
    const rpc = rpcWith([{ ...messageRow, created: true }]);
    const result = await sendProfileMessage(rpc, {
      profileId: 'profile-1',
      messageId: 'message-1',
      body: '  Tämä voisi olla meille hyvä. ',
      listId: 'list-1',
      itemId: 'item-1',
    });

    expect(result).toMatchObject({ status: 'success', created: true });
    expect(rpc).toHaveBeenCalledWith(PROFILE_MESSAGE_RPC.send, {
      target_profile_id: 'profile-1',
      requested_message_id: 'message-1',
      requested_body: 'Tämä voisi olla meille hyvä.',
      referenced_list_id: 'list-1',
      referenced_item_id: 'item-1',
    });
  });

  it('marks the selected cursor as read', async () => {
    const rpc = rpcWith('2026-09-02T18:30:00.000Z');
    await expect(markProfileMessagesRead(
      rpc,
      'profile-1',
      '2026-09-02T18:30:00.000Z',
    )).resolves.toEqual({
      status: 'success',
      readThrough: '2026-09-02T18:30:00.000Z',
    });
  });

  it('maps malformed and backend responses to stable errors', async () => {
    await expect(loadProfileMessageThreads(rpcWith({}))).resolves.toMatchObject({
      status: 'error',
    });
    await expect(loadProfileMessages(rpcWith([{}]), 'profile-1')).resolves.toMatchObject({
      status: 'error',
    });

    const failingRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'database error' },
    }));
    await expect(sendProfileMessage(failingRpc, {
      profileId: 'profile-1',
      messageId: 'message-2',
      body: 'Viesti',
    })).resolves.toMatchObject({ status: 'error' });
  });
});
