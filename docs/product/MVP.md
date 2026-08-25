# Kajo MVP

Milestone: **MVP 0.1**

Status legend: `[ ] planned`, `[-] in progress`, `[x] complete`.

This file defines the MVP boundary. Adding a new MVP requirement requires an explicit product decision; implementation convenience is not enough.

## Foundation

- [x] `MVP-FOUND-001` Mobile project runs on iOS and Android through React Native + Expo.
- [x] `MVP-FOUND-002` Repository has CI for lint/typecheck/tests once code exists.
- [x] `MVP-FOUND-003` Core domain contracts use Profile, Item, Event and Context terminology.

## Room and theme

- [ ] `MVP-ROOM-001` A user has a personal minimalist 2D Room.
- [ ] `MVP-ROOM-002` The Room is the primary home/navigation surface.
- [ ] `MVP-ROOM-003` Bookshelf opens book discovery.
- [ ] `MVP-ROOM-004` Screen/projector opens movie discovery.
- [ ] `MVP-ROOM-005` User theme is represented by reusable theme tokens rather than hard-coded component colours.
- [ ] `MVP-ROOM-006` SharedProfile can have its own shared Room/theme identity.

## Discovery

- [ ] `MVP-DISC-001` Books and movies have a visual grid discovery experience.
- [ ] `MVP-DISC-002` Discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- [ ] `MVP-DISC-003` The curtain controls DiscoveryMode with three snap states.
- [ ] `MVP-DISC-004` DiscoveryMode maps visually to dawn, evening and night without replacing the base user theme.
- [ ] `MVP-DISC-005` Grid ranking changes when DiscoveryMode changes.
- [ ] `MVP-DISC-006` User can open Item details.

## Swipe and state

- [ ] `MVP-SWIPE-001` User can enter an optional swipe mode for books and movies.
- [ ] `MVP-SWIPE-002` User can express positive/negative interest.
- [ ] `MVP-SWIPE-003` User can mark a movie as watched and a book as read.
- [ ] `MVP-SWIPE-004` Already-consumed Items are strongly suppressed from ordinary repeated discovery.

## Saved, consumed and memory

- [ ] `MVP-MEM-001` User can save/unsave an Item.
- [ ] `MVP-MEM-002` User can view consumed books/movies.
- [ ] `MVP-MEM-003` User can add a simple rating to a consumed Item.
- [ ] `MVP-MEM-004` Data model leaves a clear extension point for future note/photo/people/location/date memories.

## Profiles and social

- [ ] `MVP-PROFILE-001` Every user has a PersonalProfile.
- [ ] `MVP-PROFILE-002` 2-N users can belong to a persistent SharedProfile.
- [ ] `MVP-PROFILE-003` Events store `actorUserId` separately from `profileId`.
- [ ] `MVP-SOCIAL-001` SharedProfile has joint saved items.
- [ ] `MVP-SOCIAL-002` Members can browse/swipe in the SharedProfile context.
- [ ] `MVP-SOCIAL-003` A member can suggest an Item within a SharedProfile.

## Data and prediction

- [ ] `MVP-DATA-001` Meaningful discovery behaviour is captured through a generic event interface.
- [ ] `MVP-DATA-002` Recommendation impressions are traceable to a `predictionId`.
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
