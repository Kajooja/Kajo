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
- [ ] `MVP-AUTH-003` New nicknames are limited to 2–24 characters consistently in mobile and backend validation so persistent navigation never depends on truncating arbitrarily long identity labels.

## Room and theme

- [x] `MVP-ROOM-001` A user has a personal minimalist 2D Room.
- [x] `MVP-ROOM-002` The Room is the primary home/navigation surface; the persistent Kajo brand mark always returns the signed-in user to the Room.
- [x] `MVP-ROOM-003` Bookshelf opens book discovery.
- [x] `MVP-ROOM-004` Screen/projector opens movie discovery.
- [x] `MVP-ROOM-005` User theme is represented by reusable theme tokens rather than hard-coded component colours.
- [ ] `MVP-ROOM-006` SharedProfile can have its own shared Room/theme identity.

## Navigation shell

- [ ] `MVP-NAV-001` The persistent top Kajo logo always returns to the currently active Profile's Room; changing Personal/Shared Profile does not change this contract.
- [ ] `MVP-NAV-002` A small persistent bottom dock provides a menu control that opens a Profile-aware side drawer and an envelope control that opens Inbox; Kajo does not use a conventional multi-tab bottom navigation bar.
- [ ] `MVP-NAV-003` General account/content navigation is reachable from the Room or side drawer; the drawer owns active Profile switching plus Profile, Lists and Groups destinations when those destinations exist, without duplicate/dead navigation entries.

## Discovery

- [x] `MVP-DISC-001` Books and movies have a visual grid discovery experience.
- [x] `MVP-DISC-002` Discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- [x] `MVP-DISC-003` The persistent curtain control selects DiscoveryMode with three snap states.
- [x] `MVP-DISC-004` DiscoveryMode maps visually to dawn, evening and night without replacing the base user theme.
- [x] `MVP-DISC-005` Grid ranking changes when DiscoveryMode changes through the hosted generic scorer; configured Android acceptance passed with the broader normalized catalog.
- [x] `MVP-DISC-006` User can open Item details.
- [x] `MVP-DISC-007` One shared three-state DiscoveryMode/risk value persists through Room, discovery and Item browsing; one compact persistent app-shell curtain manipulates that state without screen-local copies or a duplicate Room control.

## Swipe and state

- [x] `MVP-SWIPE-001` User can enter an optional swipe mode for books and movies.
- [x] `MVP-SWIPE-002` User can give consumed Items a 0–10 rating or mark an unconsumed Item as not currently interesting; these are distinct canonical signals.
- [x] `MVP-SWIPE-003` A 0–10 rating always marks a movie watched or a book read; consumption is not a separate ambiguous action.
- [x] `MVP-SWIPE-004` Consumed Items are strongly suppressed, explicitly reacted Items leave the immediate queue, and unreacted impressions use a temporary cooldown so they may return later.
- [x] `MVP-SWIPE-005` Rating, not-interested and save actions live in one restrained feedback drawer, visibly commit and advance without an index jump.
- [x] `MVP-SWIPE-006` User can undo recent interaction choices through a clear back/undo control; the MVP interaction layer retains at least the latest 10 committed actions and restores both the prior state and exact previous Item/card.

## Saved, consumed and memory

- [x] `MVP-MEM-001` User can save/unsave an Item.
- [x] `MVP-MEM-002` User can view consumed books/movies, including Items advanced away from the active swipe after being marked read/watched.
- [x] `MVP-MEM-003` User can add a 0–10 rating to an Item, which always records that Item as consumed.
- [ ] `MVP-MEM-004` Data model leaves a clear extension point for future note/photo/people/location/date memories.
- [ ] `MVP-MEM-005` User can open Profile-scoped Saved and watched/read/consumed collections from persistent navigation and see current consumed/rating state without duplicating that state into collection rows.

## Named Lists

- [ ] `MVP-LIST-001` PersonalProfile and SharedProfile can own multiple Profile-scoped named Lists; List names are 1–40 characters and one List may contain mixed generic Item types such as BOOK and MOVIE.
- [ ] `MVP-LIST-002` `Tallenna` opens a destination picker, can create/name/rename a List and allows the same Item to belong to multiple Lists while preserving existing saved behaviour/prediction evidence.
- [ ] `MVP-LIST-003` List detail can toggle between list and card/grid presentation, sort deterministically by added order and supported generic metadata, and filter by generic ItemType (`Kaikki`, `Kirjat`, `Elokuvat`, later domains without schema redesign).
- [ ] `MVP-LIST-004` Every list membership stores `addedByUserId` and `addedAt`; SharedProfile UI displays who added the Item and when, while PersonalProfile hides redundant actor identity. Current watched/read/consumed state and rating are joined from canonical Profile interaction state.
- [ ] `MVP-LIST-005` SharedProfile List read/write access follows accepted membership authorization and a former member loses access after leaving the group.

## Profiles and social

- [x] `MVP-PROFILE-001` Every user has a PersonalProfile.
- [ ] `MVP-PROFILE-002` 2-N users can belong to a persistent SharedProfile.
- [x] `MVP-PROFILE-003` Events store `actorUserId` separately from `profileId`.
- [ ] `MVP-PROFILE-004` New SharedProfile names are limited to 2–32 characters consistently in mobile/backend validation.
- [ ] `MVP-PROFILE-005` An accepted member can leave a SharedProfile only after an `Oletko varma?` confirmation; leaving removes membership/access, falls back safely from an active group and preserves shared history for remaining members.
- [ ] `MVP-SOCIAL-001` SharedProfile has joint saved/current Item state.
- [ ] `MVP-SOCIAL-002` Members can browse/swipe in the SharedProfile context.
- [ ] `MVP-SOCIAL-003` A member can suggest an Item within a SharedProfile.

## Profile messaging

- [ ] `MVP-MSG-001` Each Profile can expose one narrow chat/thread surface: PersonalProfile thread is owner-only and SharedProfile thread is accepted-member-only while retaining the actual sending `actorUserId`.
- [ ] `MVP-MSG-002` The persistent envelope Inbox surfaces pending invitations and message activity without adding Room clutter; unread/message state is user-facing delivery state rather than generic Item interaction state.
- [ ] `MVP-MSG-003` Saving an Item to a List may include an optional message that references the correct `profileId`, `listId` and `itemId`; List membership remains independent from message persistence and chat text is not Prediction evidence by default.

## Data and prediction

- [x] `MVP-DATA-001` Meaningful discovery behaviour is captured through a generic event interface.
- [x] `MVP-DATA-002` Recommendation impressions are traceable to a `predictionId`.
- [x] `MVP-PRED-001` Prediction V0 ranks generic Items for a Profile rather than using separate book/movie user models.
- [x] `MVP-PRED-002` Prediction V0 includes long-term behaviour, recent behaviour and Item similarity signals.
- [x] `MVP-PRED-003` DiscoveryMode changes exploration/ranking semantics, not only UI.
- [ ] `MVP-PRED-004` Architecture supports later scenario-memory retrieval without redesigning the core contracts.

## Explicitly outside MVP 0.1

- Full evolutionary predictor population/genetic optimization.
- Music, series, games, restaurants, travel and live-event production domains.
- Public follower/feed/influencer mechanics.
- Arbitrary direct messages between unrelated Users; MVP messaging is limited to the active Profile context.
- Public Lists, folders, advanced smart-list rules and rich list media attachments.
- Complex 3D or game-like Room editor.
- Full photo-rich life journal.
- Advanced demographic personalization beyond optional cold-start prior.
