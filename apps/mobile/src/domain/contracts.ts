export type UserId = string;
export type ProfileId = string;
export type ItemId = string;
export type ItemListId = string;
export type ProfileMessageId = string;
export type EventId = string;
export type PredictionId = string;
export type SessionId = string;

export type ProfileType = 'PERSONAL' | 'SHARED';
export type ItemType = 'BOOK' | 'MOVIE';

export type DiscoveryMode = 'FOR_YOU' | 'SURPRISE' | 'RISK';
export type AmbientPhase = 'DAWN' | 'EVENING' | 'NIGHT';

export type EventType =
  | 'ITEM_IMPRESSION'
  | 'ITEM_OPENED'
  | 'ITEM_DWELL'
  | 'ITEM_LIKED'
  | 'ITEM_DISLIKED'
  | 'ITEM_INTEREST_CLEARED'
  | 'ITEM_NOT_INTERESTED'
  | 'ITEM_SAVED'
  | 'ITEM_UNSAVED'
  | 'ITEM_SUGGESTED'
  | 'ITEM_ENDORSED'
  | 'ITEM_ENDORSEMENT_REVERSED'
  | 'ITEM_CONSUMED'
  | 'ITEM_CONSUMPTION_REVERSED'
  | 'ITEM_INTERACTION_UNDONE'
  | 'ITEM_RATED'
  | 'ITEM_ADDED_TO_LIST'
  | 'ITEM_REMOVED_FROM_LIST'
  | 'LIST_CREATED'
  | 'LIST_RENAMED'
  | 'LIST_DELETED'
  | 'SEARCH_PERFORMED'
  | 'DISCOVERY_MODE_CHANGED';

export interface User {
  id: UserId;
  nickname: string;
}

export interface ProfileBase {
  id: ProfileId;
  type: ProfileType;
  name: string;
}

export interface PersonalProfile extends ProfileBase {
  type: 'PERSONAL';
  ownerUserId: UserId;
}

export interface SharedProfile extends ProfileBase {
  type: 'SHARED';
  memberUserIds: readonly UserId[];
}

export type Profile = PersonalProfile | SharedProfile;

export interface Item {
  id: ItemId;
  itemType: ItemType;
  title: string;
  description?: string;
  tags?: readonly string[];
}

export type ItemListKind = 'SYSTEM_SAVED' | 'CUSTOM';

export interface ItemList {
  id: ItemListId;
  profileId: ProfileId;
  kind: ItemListKind;
  name: string;
  itemCount: number;
  containsItem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Context {
  sessionId?: SessionId;
  locale?: string;
  timezone?: string;
  occurredAt?: string;
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface EventSession {
  sessionId: SessionId;
  actorUserId: UserId;
  profileId: ProfileId;
  startedAt: string;
  context: Context;
}

export interface Event {
  eventId: EventId;
  actorUserId: UserId;
  profileId: ProfileId;
  eventType: EventType;
  timestamp: string;
  context: Context;
  itemId?: ItemId;
  itemType?: ItemType;
  sessionId?: SessionId;
  predictionId?: PredictionId;
  discoveryMode?: DiscoveryMode;
  properties?: Readonly<Record<string, unknown>>;
}

export interface Prediction {
  predictionId: PredictionId;
  profileId: ProfileId;
  itemId: ItemId;
  discoveryMode: DiscoveryMode;
  score: number;
  confidence?: number;
}
