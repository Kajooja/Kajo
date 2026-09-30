import type { SupabaseClient } from '@supabase/supabase-js';

import type { ItemId, ProfileId } from '../../domain/contracts';
import {
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

export interface ItemInteractionPersistenceApi {
  load(profileId: ProfileId): PromiseLike<PersistenceResponse>;
}

export type InteractionLoadResult =
  | { status: 'success'; interactions: ItemInteractionMap }
  | { status: 'error'; message: string };

// A replayed receipt describes its original commit. Once the queue drains,
// reload current state without allowing an old read to replace a newer action.
export function createAcknowledgedInteractionRefresh(options: {
  load: () => Promise<InteractionLoadResult>;
  canApply: () => boolean;
  onLoaded: (interactions: ItemInteractionMap) => void;
}) {
  let generation = 0;
  return async () => {
    const requestedGeneration = ++generation;
    const result = await options.load();
    if (requestedGeneration === generation && options.canApply() && result.status === 'success') {
      options.onLoaded(result.interactions);
    }
  };
}

const LOAD_ERROR_MESSAGE =
  'Valintojen lataaminen epäonnistui. Tarkista yhteys ja yritä uudelleen.';

export function createSupabaseItemInteractionPersistenceApi(
  client: SupabaseClient,
): ItemInteractionPersistenceApi {
  return {
    async load(profileId) {
      // One authorized snapshot includes native state and source-tagged history.
      // The server never copies bootstrap ratings into native interactions/Events.
      const { data, error } = await client.rpc('get_profile_item_states_v1', {
        target_profile_id: profileId,
      });

      return {
        data,
        error: error ? { message: error.message } : null,
      };
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

function mapPersistedInteraction(
  value: unknown,
): { itemId: ItemId; state: ItemInteraction } | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.item_id) ||
    !isItemInterest(value.interest) ||
    typeof value.saved !== 'boolean' ||
    typeof value.consumed !== 'boolean' ||
    !isRating(value.rating) ||
    typeof value.not_interested !== 'boolean'
  ) {
    return null;
  }

  return {
    itemId: value.item_id,
    state: {
      interest: value.interest,
      saved: value.saved,
      consumed: value.consumed,
      rating: value.rating,
      notInterested: value.not_interested,
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

function isRating(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10)
  );
}
