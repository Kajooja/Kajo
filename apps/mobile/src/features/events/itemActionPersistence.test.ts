import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_ITEM_INTERACTION } from '../discovery/itemInteraction';
import type { ItemActionCommand } from './itemActionCommands';
import { createItemActionSender } from './itemActionPersistence';

const command: ItemActionCommand = { version: 1, actionId: 'a', actorUserId: 'actor', profileId: 'profile',
  itemId: 'item', kind: 'SET_RATING', rating: 8, occurredAt: '2026-09-09T12:00:00.000Z',
  session: { sessionId: 'session', startedAt: '2026-09-09T11:00:00.000Z', context: {} },
  predictionId: null, discoveryMode: 'FOR_YOU' };
const receipt = { version: 1, actionId: 'a', profileId: 'profile', itemId: 'item',
  interaction: { ...EMPTY_ITEM_INTERACTION, consumed: true, rating: 8 } };

describe('atomic action transport', () => {
  it('sends the frozen actor and requires a matching structured acknowledgement', async () => {
    const rpc = vi.fn(async () => ({ data: receipt, error: null }));
    const send = createItemActionSender({ rpc } as unknown as SupabaseClient);
    expect(await send(command)).toEqual({ status: 'success', receipt });
    expect(rpc).toHaveBeenCalledWith('commit_item_action_v1', { request: command });
    rpc.mockResolvedValueOnce({ data: { ...receipt, profileId: 'other' }, error: null });
    expect(await send(command)).toMatchObject({ status: 'error', retryable: false });
  });
  it('retains network failures for retry and blocks rejected/missing server commands', async () => {
    for (const [code, retryable] of [['42501', false], ['22023', false], ['PGRST202', false], ['PGRST000', true]]) {
      const rpc = vi.fn(async () => ({ data: null, error: { code } }));
      const send = createItemActionSender({ rpc } as unknown as SupabaseClient);
      expect(await send(command)).toMatchObject({ status: 'error', retryable });
    }
    const rpc = vi.fn(async () => { throw new Error('offline'); });
    expect(await createItemActionSender({ rpc } as unknown as SupabaseClient)(command)).toMatchObject({ status: 'error', retryable: true });
  });
});
