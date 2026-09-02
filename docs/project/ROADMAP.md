# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

## Milestone: MVP 0.1

### Sprint 001 — Foundation

Repository memory, mobile skeleton, workspace, CI, domain contracts.

### Sprint 002 — Room

First recognisable minimalist illustrated Room with window, fireplace, bookshelf and movie screen using mock data.

Canonical visual direction now remains a warm simple cabin/living-room illustration: 2D first with only lightly layered 2.5D depth, never a navigable 3D world or futuristic control surface. Fireplace, window, bookshelf, TV/screen and the single DiscoveryMode curtain remain the MVP vocabulary.

### Sprint 003 — Curtain & Theme

Theme engine, user theme tokens, draggable curtain, three snap states, DAWN/EVENING/NIGHT transitions.

### Sprint 004 — Discovery UI

Books + Movies grids, Item cards/details, mock ranking, DiscoveryMode switching.

### Sprint 005 — Swipe & History

Optional swipe, watched/read, saved/current state, feedback drawer, consumed-history suppression, exact recent undo and one shared DiscoveryMode control.

### Sprint 006 — Backend Foundation

Supabase/PostgreSQL, authentication, unique nickname identity, Profile/ProfileMember, Item persistence, migrations and authorization foundations.

### Sprint 007 — Event Engine

Generic append-only event capture, sessions, actor/Profile separation, prediction traceability and analytics-quality behavioural contracts.

### Sprint 008 — Prediction V0

First real generic personalized ranking using Item similarity, behavioural history, LongTermState, ShortTermState, DiscoveryMode exploration policy, explicit feedback and impression cooldown. Mobile consumes server-owned rankings rather than owning recommendation logic.

### Sprint 009 — Shared Kajo — COMPLETE

Persistent SharedProfiles, consent-based invitations, Shared Room/theme identity, generic Shared interaction/Event/Prediction context and seamless Personal/Shared switching.

The first configured Android acceptance exposed real membership/persistence/navigation failures. Those were corrected and then accepted through configured-device use plus hosted verification. Issue #125 is closed.

The initial separate `Ehdota yhteiseen` experiment is historical and retired. Its replacement is the Sprint 011 Endorsement model, not a parallel suggestion list.

### Sprint 010 — Navigation & Profile Lifecycle — COMPLETE

Durable shell before adding more destination surfaces.

Accepted on configured Android 2026-09-01:

- persistent top Kajo mark returns to the active Profile Room,
- restrained bottom dock with menu + active Profile identity/Home + Inbox,
- Profile-aware side drawer instead of a conventional multi-tab bottom bar,
- drawer owns Profile switching plus Profile/Lists/Groups destinations as they become real,
- nickname max 24 and SharedProfile name max 32,
- safe `Poistu ryhmästä` confirmation and PersonalProfile fallback,
- bottom-center active Profile identity also returns Home,
- `Kirjaudu ulos` lives at drawer bottom,
- Room has no standalone heading/helper copy,
- obsolete separate `Ehdota yhteiseen` UI is removed.

Further visual Room work must preserve this accepted shell and the simple illustrated Room contract; it must not reopen Sprint 010.

### Sprint 011 — Shared Curation & Named Lists — ACTIVE

Sprint 011 deliberately has **two ordered slices**.

#### 11A — Shared discovery + Endorsement consensus — #151

Accepted and closed on configured Android 2026-09-02.

Make Shared discovery behave like a joint decision surface without creating a separate social recommender.

- pending Endorsements remain first, ordinary unseen recommendations retain Prediction order next, and Items already consumed/rated in an accepted member's PersonalProfile form an attributed lower-priority tier,
- higher accepted-member ratings may reorder only that history tier; this does not define common-fit or EvoBot weights,
- SharedProfile-consumed/rated and consensus-saved Items remain suppressed from ordinary discovery; existing Lists/history keep the Item and may show consumed/rating state,
- Shared Prediction remains targeted to the SharedProfile,
- Prediction V0 may combine Shared joint evidence with accepted members' PersonalProfile evidence using an inspectable common-fit aggregate plus disagreement penalty,
- one member's Shared quick positive action becomes an actor-specific `Endorsement`, not Shared `saved=true`,
- the pending Item leaves the endorser's own ordinary queue,
- members who have not endorsed it receive it ahead of normal recommendations with restrained real-actor provenance,
- unanimity among currently accepted members promotes the Item once to Shared saved state,
- later new membership does not retroactively revoke an already-reached consensus.

No majority voting, chat or custom-list voting is introduced here.

#### 11B — Named Lists & collaborative browsing — #102

#151 is stable. Backend and mobile implementation are complete locally; configured Android acceptance remains:

- PersonalProfile and SharedProfile own generic system/custom Lists,
- List names are 1–40 characters,
- one List may contain BOOK, MOVIE and future ItemTypes together,
- every Profile has one system `Tallennetut` List,
- Personal `Tallenna` opens a destination picker and can create/name/rename Lists,
- Shared unanimous endorsement from #151 auto-promotes only to system `Tallennetut`,
- custom Shared Lists can be explicitly curated by accepted members without unanimity,
- one Item may belong to multiple Lists,
- List detail supports list/card presentation, added-order sorting, generic ItemType filters and current consumed/rating display,
- Shared list entries show real added-by + added-at provenance; Personal hides redundant actor identity,
- existing saved/consumed/rating state remains canonical and is not duplicated into List rows.

### Sprint 012 — Profile Messaging

Add narrow messaging only after Lists are stable so messages can reference established Profile/List/Item identities.

- PersonalProfile owner-only note/thread stream,
- SharedProfile accepted-member group chat retaining actual sending User,
- Inbox combines invitations and message activity,
- optional message when adding/saving an Item references Profile/List/Item,
- messaging persistence stays separate from behavioural Prediction evidence by default,
- no unrelated-user DM graph, public feed or follower model.

Primary issue: #138.

### Sprint 013 — Scenario Memory

Vector/scenario representation and similarity retrieval over historical situations. Starts only after navigation, Shared curation, Lists and narrow Profile messaging are stable.

### Sprint 014 — MVP Hardening & Store Release

Onboarding, performance, accessibility, end-to-end flows, quality and privacy checks across PersonalProfile, SharedProfile, navigation, Lists, messaging and Prediction.

The milestone closes only with a genuinely shareable store release: stable production identifiers/versioning/signing, production authentication email delivery, privacy/support and store metadata/assets, least-privilege client configuration, and verified clean install/update flows on representative real devices through an official app store.

Primary production-security issue: #160. Production email delivery remains coordinated with #127.

## Post-MVP direction

After real prediction/outcome data exists:

- population scenario learning at scale,
- predictor evaluation framework,
- evolutionary predictor/genome engine,
- additional domains such as music, events and travel,
- richer personal/shared memories including images, people, location and context,
- richer Item/List comments and media attachments built on the MVP message reference model,
- public/shared discovery features only after privacy/product rules are intentionally designed,
- advanced List features such as folders, smart rules and public sharing.

Roadmap changes must be deliberate. Do not rewrite completed sprint history when sequencing changes.
