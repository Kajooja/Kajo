import type { SupabaseClient } from '@supabase/supabase-js';

import type { ItemId, ProfileId, UserId } from '../../domain/contracts';
import {
  EMPTY_ITEM_INTERACTION,
  type ItemInteraction,
  type ItemInteractionMap,
  type ItemInterest,
} from './itemInteraction';

interface PersistenceErrorLike {
  message: string;
}

interface PersistenceResponse {
  data: unknown;
  error: PersistenceErrorLike | null;
}

interface MutationResponse {
  error: PersistenceErrorLike | null;
}

export interface ItemInteractionPersistenceApi {
  load(profileId: ProfileId): PromiseLike<PersistenceResponse>;
  upsert(row: PersistedItemInteractionRow): PromiseLike<MutationResponse>;
  remove(profileId: ProfileId, itemId: ItemId): PromiseLike<MutationResponse>;
}

export interface PersistedItemInteractionRow {
  profile_id: ProfileId;
  item_id: ItemId;
  actor_user_id: UserId;
  interest: ItemInterest | null;
  saved: boolean;
  consumed: boolean;
}

export interface ItemInteractionWriteRequest {
  profileId: ProfileId;
  actorUserId: UserId;
  itemId: ItemId;
  interaction: ItemInteraction;
}

export type InteractionLoadResult =
  | { status: 'success'; interactions: ItemInteractionMap }
  | { status: 'error'; message: string };

export type InteractionPersistenceResult =
  | { status: 'success' }
  | { status: 'error'; message: string };

export interface SerializedItemInteractionWriter {
  enqueue(
    request: ItemInteractionWriteRequest,
  ): Promise<InteractionPersistenceResult>;
}

export type ItemInteractionWriteOutcome =
  | 'failed'
  | 'succeeded'
  | 'superseded';

export interface ItemInteractionWriteFailureTracker {
  queued(request: ItemInteractionWriteRequest): void;
  settled(
    request: ItemInteractionWriteRequest,
    result: InteractionPersistenceResult,
  ): ItemInteractionWriteOutcome;
  getFailed(profileId: ProfileId): readonly ItemInteractionWriteRequest[];
  hasFailed(profileId: ProfileId): boolean;
}

const LOAD_ERROR_MESSAGE =
  'Valintojen lataaminen epäonnistui. Tarkista yhteys ja yritä uudelleen.';
const SAVE_ERROR_MESSAGE =
  'Valintaa ei voitu tallentaa. Tarkista yhteys ja yritä uudelleen.';

export function createSupabaseItemInteractionPersistenceApi(
  client: SupabaseClient,
): ItemInteractionPersistenceApi {
  return {
    async load(profileId) {
      const { data, error } = await client
        .from('item_interactions')
        .select('item_id, interest, saved, consumed')
        .eq('profile_id', profileId);

      return {
        data,
        error: error ? { message: error.message } : null,
      };
    },
    async upsert(row) {
      const { error } = await client
        .from('item_interactions')
        .upsert(row, { onConflict: 'profile_id,item_id' });

      return { error: error ? { message: error.message } : null };
    },
    async remove(profileId, itemId) {
      const { error } = await client
        .from('item_interactions')
        .delete()
        .eq('profile_id', profileId)
        .eq('item_id', itemId);

      return { error: error ? { message: error.message } : null };
    },
  };
}

export async function loadPersistedItemInteractions(
  api: ItemInteractionPersistenceApi,
  profileId: ProfileId,
): Promise<InteractionLoadResult> {
  try {
    const response = await api.load(profileId);

    if (response.error || !Array.isArray(response.data)) {
      return { status: 'error', message: LOAD_ERROR_MESSAGE };
    }

    const interactions: Record<ItemId, ItemInteraction> = {};

    for (const row of response.data) {
      const interaction = mapPersistedInteraction(row);

      if (!interaction) {
        return { status: 'error', message: LOAD_ERROR_MESSAGE };
      }

      interactions[interaction.itemId] = interaction.state;
    }

    return { status: 'success', interactions };
  } catch {
    return { status: 'error', message: LOAD_ERROR_MESSAGE };
  }
}

export async function persistItemInteraction(
  api: ItemInteractionPersistenceApi,
  request: ItemInteractionWriteRequest,
): Promise<InteractionPersistenceResult> {
  try {
    const response = isDefaultInteraction(request.interaction)
      ? await api.remove(request.profileId, request.itemId)
      : await api.upsert({
          profile_id: request.profileId,
          item_id: request.itemId,
          actor_user_id: request.actorUserId,
          interest: request.interaction.interest,
          saved: request.interaction.saved,
          consumed: request.interaction.consumed,
        });

    return response.error
      ? { status: 'error', message: SAVE_ERROR_MESSAGE }
      : { status: 'success' };
  } catch {
    return { status: 'error', message: SAVE_ERROR_MESSAGE };
  }
}

export function createSerializedItemInteractionWriter(
  write: (
    request: ItemInteractionWriteRequest,
  ) => Promise<InteractionPersistenceResult>,
): SerializedItemInteractionWriter {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(request) {
      const operation = tail.then(() => write(request));
      tail = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}

export function createItemInteractionWriteFailureTracker(): ItemInteractionWriteFailureTracker {
  const latest = new Map<string, ItemInteractionWriteRequest>();
  const failed = new Map<string, ItemInteractionWriteRequest>();

  return {
    queued(request) {
      const key = getWriteKey(request);
      latest.set(key, request);

      if (failed.has(key)) {
        failed.set(key, request);
      }
    },
    settled(request, result) {
      const key = getWriteKey(request);

      if (latest.get(key) !== request) {
        return 'superseded';
      }

      if (result.status === 'error') {
        failed.set(key, request);
        return 'failed';
      }

      failed.delete(key);
      return 'succeeded';
    },
    getFailed(profileId) {
      return [...failed.values()].filter(
        (request) => request.profileId === profileId,
      );
    },
    hasFailed(profileId) {
      return [...failed.values()].some(
        (request) => request.profileId === profileId,
      );
    },
  };
}

export function isDefaultInteraction(interaction: ItemInteraction): boolean {
  return (
    interaction.interest === EMPTY_ITEM_INTERACTION.interest &&
    interaction.saved === EMPTY_ITEM_INTERACTION.saved &&
    interaction.consumed === EMPTY_ITEM_INTERACTION.consumed
  );
}

function mapPersistedInteraction(
  value: unknown,
): { itemId: ItemId; state: ItemInteraction } | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.item_id) ||
    !isItemInterest(value.interest) ||
    typeof value.saved !== 'boolean' ||
    typeof value.consumed !== 'boolean'
  ) {
    return null;
  }

  return {
    itemId: value.item_id,
    state: {
      interest: value.interest,
      saved: value.saved,
      consumed: value.consumed,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isItemInterest(value: unknown): value is ItemInterest | null {
  return value === null || value === 'LIKED' || value === 'DISLIKED';
}

function getWriteKey(request: ItemInteractionWriteRequest): string {
  return `${request.profileId}:${request.itemId}`;
}
