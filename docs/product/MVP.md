# Kajo MVP

Milestone: **MVP 0.1**

Status legend: `[ ] planned`, `[-] in progress`, `[x] complete`.

This file defines the MVP boundary. Adding a new MVP requirement requires an explicit product decision; implementation convenience is not enough.

## Foundation

- [x] `MVP-FOUND-001` Mobile project runs on iOS and Android through React Native + Expo.
- [x] `MVP-FOUND-002` Repository has CI for lint/typecheck/tests once code exists.
- [x] `MVP-FOUND-003` Core domain contracts use Profile, Item, Event and Context terminology.

## Authentication and identity

- [x] `MVP-AUTH-001` User can register with a unique email + unique nickname, confirm the email in the mobile flow, sign in with either email or nickname plus password, and recover a forgotten password through the account email.
- [x] `MVP-AUTH-002` Every signed-in User has one user-visible unique nickname linked to the same identity as their authentication email; stored/display casing is preserved while uniqueness, sign-in and nickname search are case-insensitive.

## Room and theme

- [x] `MVP-ROOM-001` A user has a personal minimalist 2D Room.
- [x] `MVP-ROOM-002` The Room is the primary home/navigation surface.
- [x] `MVP-ROOM-003` Bookshelf opens book discovery.
- [x] `MVP-ROOM-004` Screen/projector opens movie discovery.
- [x] `MVP-ROOM-005` User theme is represented by reusable theme tokens rather than hard-coded component colours.
- [ ] `MVP-ROOM-006` SharedProfile can have its own shared Room/theme identity.

## Discovery

- [x] `MVP-DISC-001` Books and movies have a visual grid discovery experience.
- [x] `MVP-DISC-002` Discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- [x] `MVP-DISC-003` The curtain controls DiscoveryMode with three snap states.
- [x] `MVP-DISC-004` DiscoveryMode maps visually to dawn, evening and night without replacing the base user theme.
- [x] `MVP-DISC-005` Grid ranking changes when DiscoveryMode changes.
- [x] `MVP-DISC-006` User can open Item details.
- [x] `MVP-DISC-007` Curtain is the single app-wide three-state DiscoveryMode/risk control: it supports drag and tap-to-snap, visually interpolates smoothly, and the selected mode persists through Room, discovery and swipe without duplicate per-screen selectors.

## Swipe and state

- [x] `MVP-SWIPE-001` User can enter an optional swipe mode for books and movies.
- [x] `MVP-SWIPE-002` User can express positive/negative interest.
- [x] `MVP-SWIPE-003` User can mark a movie as watched and a book as read.
- [x] `MVP-SWIPE-004` Already-consumed Items are strongly suppressed from ordinary repeated discovery.
- [x] `MVP-SWIPE-005` Every explicit interest, save or consumed choice visibly commits with a restrained exit/advance animation and presents the next Item without an index jump.
- [x] `MVP-SWIPE-006` User can undo recent interaction choices through a clear back/undo control; the MVP interaction layer retains at least the latest 10 committed actions and restores both the prior state and exact previous Item/card.

## Saved, consumed and memory

- [x] `MVP-MEM-001` User can save/unsave an Item.
- [x] `MVP-MEM-002` User can view consumed books/movies, including Items advanced away from the active swipe after being marked read/watched.
- [ ] `MVP-MEM-003` User can add a simple rating to a consumed Item.
- [ ] `MVP-MEM-004` Data model leaves a clear extension point for future note/photo/people/location/date memories.

## Profiles and social

- [x] `MVP-PROFILE-001` Every user has a PersonalProfile.
- [ ] `MVP-PROFILE-002` 2-N users can belong to a persistent SharedProfile.
- [-] `MVP-PROFILE-003` Events store `actorUserId` separately from `profileId`.
- [ ] `MVP-SOCIAL-001` SharedProfile has joint saved items.
- [ ] `MVP-SOCIAL-002` Members can browse/swipe in the SharedProfile context.
- [ ] `MVP-SOCIAL-003` A member can suggest an Item within a SharedProfile.

## Data and prediction

- [-] `MVP-DATA-001` Meaningful discovery behaviour is captured through a generic event interface.
- [-] `MVP-DATA-002` Recommendation impressions are traceable to a `predictionId`.
- [ ] `MVP-PRED-001` Prediction V0 ranks generic Items for a Profile rather than using separate book/movie user models.
- [ ] `MVP-PRED-002` Prediction V0 includes long-term behaviour, recent behaviour and Item similarity signals.
- [ ] `MVP-PRED-003` DiscoveryMode changes exploration/ranking semantics, not only UI.
- [ ] `MVP-PRED-004` Architecture supports later scenario-memory retrieval without redesigning the core contracts.

## Explicitly outside MVP 0.1

- Full evolutionary predictor population/genetic optimization.
- Music, series, games, restaurants, travel and live-event production domains.
- Public follower/feed/influencer mechanics.
- General chat/messaging.
- Complex 3D or game-like Room editor.
- Full photo-rich life journal.
- Advanced demographic personalization beyond optional cold-start prior.
