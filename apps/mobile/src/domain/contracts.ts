export type UserId = string;
export type ProfileId = string;
export type ItemId = string;
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
  | 'ITEM_SAVED'
  | 'ITEM_UNSAVED'
  | 'ITEM_SUGGESTED'
  | 'ITEM_CONSUMED'
  | 'ITEM_RATED'
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

export interface Context {
  locale?: string;
  timezone?: string;
  occurredAt?: string;
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
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
