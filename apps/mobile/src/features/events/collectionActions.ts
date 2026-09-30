import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemInteraction, ItemInteractionMap } from '../discovery/itemInteraction';
import { mapSharedEndorsementCommit } from '../discovery/sharedEndorsementOperations';
import { ITEM_LIST_RPC, mapItemLists, validateItemListName, type ItemListRpc } from '../lists/itemListOperations';
import type { EventRecordInput } from './eventTracking';
import {
  isItemInteraction, isPendingItemAction, isRecord, isTimestamp, isUuid, projectPendingItemActions,
  type ItemActionCommand, type ItemActionReceipt, type ItemActionScope, type PendingItemAction,
} from './itemActionCommands';
import { createItemActionSender, type ItemActionResult } from './itemActionPersistence';

export type CollectionActionIntent =
  | { kind: 'CLEAR_HISTORY'; itemId: string }
  | { kind: 'CREATE_LIST'; itemId: null; name: string }
  | { kind: 'RENAME_LIST'; itemId: null; listId: string; name: string }
  | { kind: 'DELETE_LIST'; itemId: null; listId: string }
  | { kind: 'SET_LIST_ENTRY'; itemId: string; listId: string; present: boolean; positive: boolean }
  | { kind: 'UNDO_LIST_ENTRY'; itemId: string; reversesActionId: string }
  | { kind: 'ENDORSE_SHARED_ITEM'; itemId: string; listId: string | null; listIds?: readonly string[] }
  | { kind: 'REVERSE_ENDORSEMENT'; itemId: string };

export type CollectionActionSource = 'LISTS' | 'LIST_DETAIL' | 'ITEM_DESTINATION_PICKER' | 'SHARED_DISCOVERY';
export type CollectionActionCommand = Omit<ItemActionCommand, 'kind' | 'itemId'> & CollectionActionIntent & {
  source: CollectionActionSource;
};
export interface PendingCollectionAction {
  command: CollectionActionCommand;
  // Presentation only: the server restores its own receipt, including List membership.
  restoredInteraction?: ItemInteraction;
}
export interface CollectionActionReceipt {
  version: 1;
  actionId: string;
  profileId: string;
  kind: CollectionActionIntent['kind'];
  itemId: string | null;
  listId: string | null;
  result: unknown;
  eventIds: string[];
  changed: boolean;
  undoable: boolean;
  interaction: ItemInteraction | null;
  beforeInteraction: ItemInteraction | null;
  predictionId: string | null;
  discoveryMode: ItemActionCommand['discoveryMode'];
}
export type PendingProfileAction = PendingItemAction | PendingCollectionAction;
export type ProfileActionReceipt = ItemActionReceipt | CollectionActionReceipt;
export type CollectionSubmissionResult =
  | { status: 'success'; receipt: CollectionActionReceipt }
  | { status: 'error'; message: string };

export type SubmitCollectionAction = (intent: CollectionActionIntent, source: CollectionActionSource,
  origin?: EventRecordInput) => Promise<CollectionSubmissionResult>;

// Keep name validation and result mapping at the List service boundary. Every
// mutation crosses the durable command path; only read RPCs use the old API.
export function createCollectionMutationRpc(submit: SubmitCollectionAction, profileId: string,
  source: CollectionActionSource, origin?: EventRecordInput, positive = false): ItemListRpc {
  return async (name, args = {}) => {
    let intent: CollectionActionIntent;
    if (args.target_profile_id !== undefined && args.target_profile_id !== profileId) {
      return { data: null, error: { code: 'KAJO_ACTION', message: 'Profiili vaihtui. Avaa lista uudelleen.' } };
    }
    switch (name) {
      case ITEM_LIST_RPC.create: intent = { kind: 'CREATE_LIST', itemId: null, name: String(args.requested_name) }; break;
      case ITEM_LIST_RPC.rename: intent = { kind: 'RENAME_LIST', itemId: null,
        listId: String(args.target_list_id), name: String(args.requested_name) }; break;
      case ITEM_LIST_RPC.remove: intent = { kind: 'DELETE_LIST', itemId: null, listId: String(args.target_list_id) }; break;
      case ITEM_LIST_RPC.setEntry: intent = { kind: 'SET_LIST_ENTRY', itemId: String(args.target_item_id),
        listId: String(args.target_list_id), present: args.requested_present === true, positive }; break;
      default: throw new Error('Unsupported collection mutation');
    }
    const result = await submit(intent, source, origin);
    return result.status === 'success' ? { data: result.receipt.result, error: null }
      : { data: null, error: { code: 'KAJO_ACTION', message: result.message } };
  };
}

export function isCollectionCommand(command: { kind: string }): command is CollectionActionCommand {
  return ['CREATE_LIST', 'RENAME_LIST', 'DELETE_LIST', 'SET_LIST_ENTRY', 'UNDO_LIST_ENTRY',
    'ENDORSE_SHARED_ITEM', 'REVERSE_ENDORSEMENT', 'CLEAR_HISTORY'].includes(command.kind);
}

export function isPendingProfileAction(value: unknown, scope: ItemActionScope): value is PendingProfileAction {
  if (isPendingItemAction(value, scope)) return true;
  if (!isRecord(value) || !isRecord(value.command)) return false;
  const c = value.command;
  if (c.version !== 1 || c.actorUserId !== scope.actorUserId || c.profileId !== scope.profileId
    || !isUuid(c.actorUserId) || !isUuid(c.profileId) || !isUuid(c.actionId)
    || !isTimestamp(c.occurredAt) || !isRecord(c.session) || !isUuid(c.session.sessionId)
    || !isTimestamp(c.session.startedAt) || !isRecord(c.session.context)
    || Date.parse(c.session.startedAt) > Date.parse(c.occurredAt)
    || (c.predictionId !== null && !isUuid(c.predictionId))
    || (c.discoveryMode !== null && !['FOR_YOU', 'SURPRISE', 'RISK'].includes(String(c.discoveryMode)))
    || !['LISTS', 'LIST_DETAIL', 'ITEM_DESTINATION_PICKER', 'SHARED_DISCOVERY'].includes(String(c.source))) return false;
  const validName = typeof c.name === 'string' && validateItemListName(c.name).status === 'valid';
  switch (c.kind) {
    case 'CLEAR_HISTORY': return isUuid(c.itemId) && c.predictionId === null && c.discoveryMode === null
      && (c.listId === undefined || c.listId === null);
    case 'CREATE_LIST': return c.itemId === null && validName;
    case 'RENAME_LIST': return c.itemId === null && isUuid(c.listId) && validName;
    case 'DELETE_LIST': return c.itemId === null && isUuid(c.listId);
    case 'SET_LIST_ENTRY': return isUuid(c.itemId) && isUuid(c.listId)
      && typeof c.present === 'boolean' && typeof c.positive === 'boolean'
      && (!c.positive || (c.present && c.source === 'ITEM_DESTINATION_PICKER'));
    case 'UNDO_LIST_ENTRY': return isUuid(c.itemId) && isUuid(c.reversesActionId) && isItemInteraction(value.restoredInteraction);
    case 'ENDORSE_SHARED_ITEM': return isUuid(c.itemId) && (c.listId === null || isUuid(c.listId))
      && (c.listIds === undefined || (Array.isArray(c.listIds) && c.listIds.length > 0 && c.listIds.length <= 32
        && c.listIds.every(isUuid) && new Set(c.listIds).size === c.listIds.length
        && (c.listId === null || c.listIds.includes(c.listId))));
    case 'REVERSE_ENDORSEMENT': return isUuid(c.itemId);
    default: return false;
  }
}

export function projectPendingProfileActions(interactions: ItemInteractionMap, pending: readonly PendingProfileAction[]) {
  return pending.reduce<ItemInteractionMap>((current, entry) => {
    if (!isCollectionCommand(entry.command)) return projectPendingItemActions(current, [entry as PendingItemAction]);
    return entry.command.kind === 'UNDO_LIST_ENTRY' && entry.restoredInteraction
      ? { ...current, [entry.command.itemId]: entry.restoredInteraction } : current;
  }, interactions);
}

function validReceipt(data: unknown, command: CollectionActionCommand): data is CollectionActionReceipt {
  if (!isRecord(data) || data.version !== 1 || data.actionId !== command.actionId
    || data.profileId !== command.profileId || data.kind !== command.kind || data.itemId !== command.itemId
    || (data.listId !== null && !isUuid(data.listId))
    || !Array.isArray(data.eventIds) || !data.eventIds.every(isUuid)
    || new Set(data.eventIds).size !== data.eventIds.length
    || data.changed !== (data.eventIds.length > 0) || typeof data.undoable !== 'boolean'
    || (data.undoable && (command.kind !== 'SET_LIST_ENTRY' || !data.changed))
    || (command.itemId === null ? data.interaction !== null || data.beforeInteraction !== null
      : !isItemInteraction(data.interaction) || !isItemInteraction(data.beforeInteraction))
    || (data.predictionId !== null && !isUuid(data.predictionId))
    || (data.discoveryMode !== null && !['FOR_YOU', 'SURPRISE', 'RISK'].includes(String(data.discoveryMode)))) return false;
  if ('listId' in command && command.listId !== null && data.listId !== command.listId) return false;
  if (data.eventIds.length && data.eventIds[0] !== command.actionId) return false;
  switch (command.kind) {
    case 'CREATE_LIST':
    case 'RENAME_LIST': {
      const mapped = mapItemLists(data.result);
      return mapped.status === 'success' && mapped.lists.length === 1
        && mapped.lists[0]?.id === data.listId && mapped.lists[0]?.profileId === command.profileId;
    }
    case 'ENDORSE_SHARED_ITEM': {
      const mapped = mapSharedEndorsementCommit(data.result);
      return mapped.status === 'success' && mapped.commit.profileId === command.profileId
        && mapped.commit.itemId === command.itemId && mapped.commit.actorUserId === command.actorUserId
        && mapped.commit.proposalListId === data.listId
        && (command.listIds === undefined || (mapped.commit.proposalLists?.length === command.listIds.length
          && mapped.commit.proposalLists.every(list => command.listIds!.includes(list.id))));
    }
    case 'REVERSE_ENDORSEMENT': {
      const row = Array.isArray(data.result) && data.result.length === 1 ? data.result[0] : null;
      return isRecord(row) && row.profile_id === command.profileId && row.item_id === command.itemId
        && row.actor_user_id === command.actorUserId && typeof row.endorsement_reversed === 'boolean'
        && Number.isInteger(row.endorsement_count) && (row.endorsement_count as number) >= 0;
    }
    case 'CLEAR_HISTORY': return data.result === true && data.listId === null
      && data.predictionId === null && data.discoveryMode === null
      && isItemInteraction(data.interaction) && data.interaction.rating === null && !data.interaction.consumed;
    case 'SET_LIST_ENTRY': return data.result === command.present;
    case 'DELETE_LIST':
    case 'UNDO_LIST_ENTRY': return data.result === true;
  }
}

export function createProfileActionSender(client: SupabaseClient) {
  const sendItem = createItemActionSender(client);
  return async (command: PendingProfileAction['command']): Promise<ItemActionResult<ProfileActionReceipt>> => {
    if (!isCollectionCommand(command)) return sendItem(command);
    try {
      const { data, error } = await client.rpc('commit_collection_action_v1', { request: command });
      if (error) {
        if (error.code === 'KJ002' || (error.code === 'KJ001' && command.kind === 'UNDO_LIST_ENTRY')) {
          return { status: 'error', retryable: false, rejectedAction: true,
            message: 'Valintaa ei voitu toteuttaa, koska listan tai valinnan tilanne on muuttunut. Hylkää valinta ja tarkista nykytilanne.' };
        }
        const permanent = /^(22|23|42)/.test(error.code ?? '') || error.code === 'PGRST202';
        return { status: 'error', retryable: !permanent, message: permanent
          ? 'Valintaa ei vielä voitu vahvistaa. Tarkista profiilin käyttöoikeus ja yritä uudelleen.'
          : 'Valinta odottaa yhteyttä. Yritämme tallennusta uudelleen.' };
      }
      return validReceipt(data, command) ? { status: 'success', receipt: data }
        : { status: 'error', retryable: false, message: 'Tallennuksen vahvistus oli puutteellinen. Valinta säilyy odottamassa.' };
    } catch {
      return { status: 'error', retryable: true, message: 'Valinta odottaa yhteyttä. Yritämme tallennusta uudelleen.' };
    }
  };
}
