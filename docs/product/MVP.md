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
- [x] `MVP-AUTH-002` Every signed-in User has one user-visible unique nickname linked to the same identity as their authentication email; stored/display casing is preserved while uniqueness, sign-in and search are case-insensitive.
- [x] `MVP-AUTH-003` New nicknames are limited to 2–24 characters consistently in mobile and backend validation so persistent navigation never depends on arbitrary truncation.

## Room and theme

- [x] `MVP-ROOM-001` A user has a personal minimalist 2D Room.
- [x] `MVP-ROOM-002` The Room is the primary home/navigation surface; the persistent Kajo brand mark always returns to the active Profile Room.
- [x] `MVP-ROOM-003` Bookshelf opens book discovery.
- [x] `MVP-ROOM-004` Screen/projector opens movie discovery.
- [x] `MVP-ROOM-005` User theme is represented by reusable theme tokens rather than hard-coded component colours.
- [x] `MVP-ROOM-006` SharedProfile has its own restrained shared Room/theme identity.

## Navigation shell

- [x] `MVP-NAV-001` The persistent top Kajo logo returns to the currently active Profile's Room; changing Personal/Shared Profile does not change this contract.
- [x] `MVP-NAV-002` A small persistent bottom dock provides a menu control that opens a Profile-aware side drawer and an envelope control that opens Inbox; Kajo does not use a conventional multi-tab bottom navigation bar.
- [x] `MVP-NAV-003` General account/content navigation is reachable from the Room or side drawer; the drawer owns active Profile switching plus Profile, Lists and Groups destinations when those destinations exist, without duplicate/dead navigation entries.
- [-] `MVP-NAV-004` Tapping the bottom-center active Profile identity opens a lightweight actor-local quick switcher with at most five recent/most-used SharedProfiles; selecting one activates that existing Profile and `Näytä lisää` opens the canonical Groups page without a duplicate Profile/membership model. Configured-Android acceptance is required before completion.

## Discovery

- [x] `MVP-DISC-001` Books and movies have a visual grid discovery experience.
- [x] `MVP-DISC-002` Discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- [x] `MVP-DISC-003` The persistent curtain control selects DiscoveryMode with three snap states.
- [x] `MVP-DISC-004` DiscoveryMode maps visually to dawn, evening and night without replacing the base user theme.
- [x] `MVP-DISC-005` Grid ranking changes when DiscoveryMode changes through the hosted generic scorer; configured Android acceptance passed with the broader normalized catalog.
- [x] `MVP-DISC-006` User can open Item details.
- [x] `MVP-DISC-007` One shared three-state DiscoveryMode/risk value persists through Room, discovery and Item browsing; one compact persistent app-shell curtain manipulates that state without screen-local copies or duplicate Room controls.

## Swipe and state

- [x] `MVP-SWIPE-001` User can enter an optional swipe mode for books and movies.
- [x] `MVP-SWIPE-002` User can give consumed Items a 0–10 rating or mark an unconsumed Item as not currently interesting; these are distinct canonical signals.
- [x] `MVP-SWIPE-003` A 0–10 rating always marks a movie watched or a book read; consumption is not a separate ambiguous action.
- [x] `MVP-SWIPE-004` Consumed Items are strongly suppressed, explicitly reacted Items leave the immediate queue, and unreacted impressions use a temporary cooldown so they may return later.
- [x] `MVP-SWIPE-005` Rating, not-interested and `Lisää listaan` actions live in one restrained feedback drawer, visibly commit and advance without an index jump. List addition is the positive/like action; there is no separate Like button.
- [x] `MVP-SWIPE-006` User can undo recent interaction choices through a clear back/undo control; the MVP interaction layer retains at least the latest 10 committed actions and restores both prior state and exact previous Item/card.

## Saved, consumed and memory

- [x] `MVP-MEM-001` User can save/unsave an Item.
- [x] `MVP-MEM-002` User can view consumed books/movies, including Items advanced away from active swipe after being marked read/watched.
- [x] `MVP-MEM-003` User can add a 0–10 rating to an Item, which always records that Item as consumed.
- [ ] `MVP-MEM-004` Data model leaves a clear extension point for future note/photo/people/location/date memories.
- [-] `MVP-MEM-005` User can open Profile-scoped Saved and watched/read/consumed collections from persistent navigation and see current consumed/rating state without duplicating that state into collection rows.

## Profiles and Shared Kajo

- [x] `MVP-PROFILE-001` Every User has a PersonalProfile.
- [x] `MVP-PROFILE-002` 2-N Users can belong to a persistent SharedProfile through consent-based accepted membership.
- [x] `MVP-PROFILE-003` Events store `actorUserId` separately from `profileId`.
- [x] `MVP-PROFILE-004` New SharedProfile names are limited to 2–32 characters consistently in mobile/backend validation.
- [x] `MVP-PROFILE-005` An accepted member can leave a SharedProfile only after an `Oletko varma?` confirmation; leaving removes membership/access, falls back safely from an active group and preserves history for remaining members.
- [x] `MVP-SOCIAL-001` SharedProfile has joint current Item state and actor/Profile-separated persistence.
- [x] `MVP-SOCIAL-002` Members can browse/swipe and receive Prediction V0 in SharedProfile context without a separate media/social predictor.
- [x] `MVP-SOCIAL-003` In SharedProfile discovery, one member can endorse an Item as worth doing together; the endorsement is actor-specific pending state, not shared `saved=true`.
- [x] `MVP-SOCIAL-004` A pending endorsement is suppressed for the endorser and prioritized ahead of ordinary recommendations for accepted members who have not endorsed it, with restrained real-actor provenance.
- [x] `MVP-SOCIAL-005` Unanimous endorsement by all currently accepted members promotes the Item once to Shared saved state / system `Tallennetut`; a later new member does not retroactively revoke that historical consensus.
- [x] `MVP-SOCIAL-006` Ordinary Shared discovery retains Items consumed/rated in an accepted member's PersonalProfile as a clearly attributed lower-priority history tier; higher member ratings may lift Items only inside that tier. SharedProfile-consumed and consensus-saved Items remain outside ordinary discovery, and no history/List data is deleted.

## Named Lists

- [-] `MVP-LIST-001` PersonalProfile and SharedProfile can own multiple Profile-scoped named Lists; List names are 1–40 characters and one List may contain mixed generic Item types such as BOOK and MOVIE.
- [-] `MVP-LIST-002` `Lisää listaan` opens a compact single-destination picker ordered by the current actor's most recent use, shows at most five Lists before `Lisää`, and can create/name/rename a List. One action chooses exactly one destination; separate later actions may still place the same Item in multiple Lists without silently removing existing memberships.
- [-] `MVP-LIST-003` A successful Personal List addition is the positive discovery action and advances to the next card. In SharedProfile the first actor's custom-List choice creates a pending Endorsement and advances/hides the card for that actor; another member sees a green proposer/List approval bar. Unanimous approval produces `Pari!`, commits the chosen custom-List membership and promotes to system `Tallennetut`, then advances/hides the card for the approving members.
- [-] `MVP-LIST-004` List detail can toggle between list and card/grid presentation, sort deterministically by added order/supported generic metadata, and filter by generic ItemType (`Kaikki`, `Kirjat`, `Elokuvat`, later domains without schema redesign).
- [-] `MVP-LIST-005` Every list membership stores `addedByUserId` and `addedAt`; SharedProfile UI displays who added the Item and when, while PersonalProfile hides redundant actor identity. Current watched/read/consumed state and rating are joined from canonical Profile interaction state.
- [-] `MVP-LIST-006` SharedProfile List read/write access follows accepted membership authorization and a former member loses access after leaving the group.

## Profile messaging

- [-] `MVP-MSG-001` Each Profile can expose one narrow chat/thread surface: PersonalProfile thread is owner-only and SharedProfile thread is accepted-member-only while retaining actual sending `actorUserId`.
- [-] `MVP-MSG-002` The persistent envelope Inbox surfaces pending invitations and message activity without adding Room clutter; unread/message state is user-facing delivery state rather than generic Item interaction state.
- [-] `MVP-MSG-003` Saving/adding an Item to a List may include an optional message that references the correct `profileId`, `listId` and `itemId`; List membership remains independent from message persistence and chat text is not Prediction evidence by default.

## Data and prediction

- [x] `MVP-DATA-001` Meaningful discovery behaviour is captured through a generic event interface.
- [x] `MVP-DATA-002` Recommendation impressions are traceable to a `predictionId`.
- [x] `MVP-PRED-001` Prediction V0 ranks generic Items for a Profile rather than using separate book/movie user models.
- [x] `MVP-PRED-002` Prediction V0 includes long-term behaviour, recent behaviour and Item similarity signals.
- [x] `MVP-PRED-003` DiscoveryMode changes exploration/ranking semantics, not only UI.
- [x] `MVP-PRED-004` Architecture supports scenario-memory retrieval without redesigning core Profile/Item/Event/Prediction contracts.
- [ ] `MVP-PRED-005` SharedProfile Prediction V0 can combine Shared joint evidence with accepted members' PersonalProfile taste evidence using an inspectable common-fit aggregation/disagreement penalty while the Prediction target remains the SharedProfile.
- [x] `MVP-PRED-006` Every hosted learnable recommendation persists a versioned PredictionRun and complete candidate pool with actor/Profile/session Context, MemoryStateSnapshot, source/final ordering and delivery selection before correlated exposure/outcome learning.
- [x] `MVP-PRED-007` Prediction V1 uses a bounded, inspectable same-Profile ScenarioMemory signal and degrades safely to the base scorer when no traced Scenario evidence exists; Personal and Shared memories remain isolated.

## Production release

- [ ] `MVP-REL-001` Kajo has stable production application identifiers, versioning, signing and release configuration for its supported mobile platforms; no development-only secret or service-role credential is embedded in a client build.
- [ ] `MVP-REL-002` Production authentication email delivery, privacy/support information, store assets, required permissions and account/data lifecycle flows are verified for an external user.
- [ ] `MVP-REL-003` A signed production release is downloadable through an official app store, and clean install, authentication, PersonalProfile, SharedProfile, discovery, Lists and update flows pass on representative real devices.

## Explicitly outside MVP 0.1

- Full evolutionary predictor population/genetic optimization.
- Music, series, games, restaurants, travel and live-event production domains.
- Public follower/feed/influencer mechanics.
- Arbitrary direct messages between unrelated Users; MVP messaging is limited to active Profile context.
- Public Lists, folders, advanced smart-list rules and rich list media attachments.
- Majority-vote automatic Shared saving; MVP automatic Shared promotion uses unanimity.
- Complex 3D or game-like Room editor.
- Full photo-rich life journal.
- Advanced demographic personalization beyond optional cold-start prior.
