import type { DiscoveryMode, EventSession } from '../../domain/contracts';
import {
  setItemNotInterested,
  setItemRating,
  type ItemInteraction,
  type ItemInteractionMap,
} from '../discovery/itemInteraction';

export interface ItemActionScope {
  actorUserId: string;
  profileId: string;
}

export type ItemActionIntent =
  | { kind: 'SET_RATING'; rating: number }
  | { kind: 'SET_NOT_INTERESTED'; notInterested: boolean }
  | { kind: 'UNDO'; reversesActionId: string };

export type ItemActionCommand = ItemActionScope & ItemActionIntent & {
  version: 1;
  actionId: string;
  itemId: string;
  occurredAt: string;
  session: Pick<EventSession, 'sessionId' | 'startedAt' | 'context'>;
  discoveryMode: DiscoveryMode | null;
  predictionId: string | null;
};

export interface PendingItemAction {
  command: ItemActionCommand;
  // Presentation only. The server restores its own recorded prior state.
  restoredInteraction?: ItemInteraction;
}

export interface ItemActionReceipt {
  version: 1;
  actionId: string;
  profileId: string;
  itemId: string;
  interaction: ItemInteraction;
}

export function isItemInteraction(value: unknown): value is ItemInteraction {
  if (!isRecord(value)) return false;
  return (value.interest === null || value.interest === 'LIKED' || value.interest === 'DISLIKED')
    && typeof value.saved === 'boolean' && typeof value.consumed === 'boolean'
    && typeof value.notInterested === 'boolean'
    && (value.rating === null || isRating(value.rating));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function isPendingItemAction(value: unknown, scope: ItemActionScope): value is PendingItemAction {
  if (!isRecord(value) || !isRecord(value.command)) return false;
  const command = value.command;
  if (command.version !== 1 || command.actorUserId !== scope.actorUserId || command.profileId !== scope.profileId
    || !isUuid(command.actorUserId) || !isUuid(command.profileId) || !isUuid(command.actionId) || !isUuid(command.itemId)
    || !isTimestamp(command.occurredAt) || !isRecord(command.session) || !isUuid(command.session.sessionId)
    || !isTimestamp(command.session.startedAt) || !isRecord(command.session.context)
    || Date.parse(command.session.startedAt) > Date.parse(command.occurredAt)
    || (command.predictionId !== null && !isUuid(command.predictionId))
    || (command.discoveryMode !== null && !['FOR_YOU', 'SURPRISE', 'RISK'].includes(String(command.discoveryMode)))) return false;
  switch (command.kind) {
    case 'SET_RATING': return isRating(command.rating);
    case 'SET_NOT_INTERESTED': return typeof command.notInterested === 'boolean';
    case 'UNDO': return isUuid(command.reversesActionId) && isItemInteraction(value.restoredInteraction);
    default: return false;
  }
}

export function projectPendingItemActions(
  interactions: ItemInteractionMap,
  pending: readonly PendingItemAction[],
): ItemInteractionMap {
  return pending.reduce<ItemInteractionMap>((current, entry) => {
    const command = entry.command;
    switch (command.kind) {
      case 'SET_RATING': return setItemRating(current, command.itemId, command.rating);
      case 'SET_NOT_INTERESTED': return setItemNotInterested(current, command.itemId, command.notInterested);
      case 'UNDO': return entry.restoredInteraction
        ? { ...current, [command.itemId]: entry.restoredInteraction } : current;
    }
  }, interactions);
}
