# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

## Milestone: MVP 0.1

### Sprint 001 — Foundation

Repository memory, mobile skeleton, workspace, CI, domain contracts.

### Sprint 002 — Room

First recognisable minimalist 2D fireplace Room with window, fireplace, bookshelf and movie screen using mock data.

### Sprint 003 — Curtain & Theme

Theme engine, user theme tokens, draggable curtain, three snap states, DAWN/EVENING/NIGHT transitions.

### Sprint 004 — Discovery UI

Books + Movies grids, Item cards/details, mock ranking, DiscoveryMode switching.

### Sprint 005 — Swipe & History

Optional swipe, like/dislike, watched/read, saved state and consumed-history suppression. Grid remains the primary discovery surface; opening an Item should be able to flow naturally into the swipe-oriented browsing experience rather than feeling like a disconnected mode.

Sprint 005 close also includes the real-device acceptance refinements identified on 2026-08-26:

- curtain becomes the single global three-state DiscoveryMode/risk control with drag + tap-to-snap,
- redundant downstream mode selectors are removed,
- consumed actions visibly auto-advance with restrained motion,
- recent interaction choices can be undone,
- reusable action labels are centrally maintained without coupling UI wording to domain semantics.

### Sprint 006 — Backend Foundation

Supabase/PostgreSQL, lightweight/common register/sign-in authentication, user nickname/username identity, Profile, ProfileMember, Item persistence, migrations and authorization foundations. Replace appropriate Sprint 005 in-memory state with a clear persistence boundary without rewriting presentation semantics.

### Sprint 007 — Event Engine

Generic event capture, sessions, prediction traceability and analytics-quality behavioural contracts. Persist meaningful interaction evidence such as interest, saved/unsaved, consumed/read/watched and later ratings using stable canonical event/state semantics independent of visible UI copy.

### Sprint 008 — Prediction V0

First real generic personalized ranking using Item similarity, behavioural history, recency/ShortTermState and exploration policy. Rankings should refresh when materially relevant behavioural evidence or the global DiscoveryMode/risk selection changes; the mobile client consumes prediction results rather than owning ranking logic.

Configured-phone feedback on 2026-08-31 adds these acceptance refinements before Sprint 008 closes:

- expose the one shared DiscoveryMode as one compact persistent app-shell control; remove the duplicate Room control until the post-MVP Room redesign,
- replace ambiguous binary like/dislike/consumed controls with a feedback drawer: 0–10 rating (always consumed), not interested (not consumed) and save,
- move every explicitly reacted Item out of the immediate queue and apply a temporary impression cooldown to unreacted Items,
- expand the normalized MVP candidate set enough to observe ranking/cooldown behaviour on a configured phone.

With the small seed catalog and sparse evidence, hosted mode orderings may legitimately converge. Sprint 008 must not fake a visible reorder: #103 expands the test catalog and configured acceptance verifies differentiation only after enough Item/evidence variation exists.

### Sprint 009 — Shared Kajo

Persistent SharedProfiles, consent-based invitations, shared Room/theme, joint interaction/discovery context and traceable member suggestions. Sprint 009 closes only after configured two-account Android re-acceptance and hosted verification of SharedProfile-scoped interactions/Events.

### Sprint 010 — Navigation & Profile Lifecycle

Build the durable navigation shell before adding more destination surfaces.

- the persistent top Kajo logo always returns to the currently active Profile's Room,
- a restrained bottom dock owns global navigation controls rather than cluttering the Room/header,
- left bottom menu button opens the Profile-aware side drawer,
- right bottom envelope opens Inbox; invitations live there now and messages later,
- general navigation originates from the Room or side drawer rather than a conventional multi-tab app bar,
- drawer owns Profile switching plus Profile, Lists and Groups destinations as they become real,
- nickname max length becomes 24 characters and SharedProfile name max length 32 characters,
- SharedProfile member can leave a group only after an `Oletko varma?` confirmation; authorization and active-Profile fallback remain safe.

Primary issues: #136 and #137.

### Sprint 011 — Named Lists & Collaborative Curation

Turn Lists into a first-class generic Profile capability instead of only a `saved` boolean/history view.

- PersonalProfile and SharedProfile can own multiple named Lists,
- List names are 1–40 characters,
- a List may contain any generic Item type in the same collection,
- `Tallenna` opens a destination picker and can create/name a List,
- one Item may belong to multiple Lists,
- existing saved/consumed/rating semantics remain canonical and are not duplicated into list rows,
- list detail supports list/card presentation toggle,
- deterministic sorting includes added newest/oldest and supported generic metadata,
- filtering supports all Items, books, movies and future ItemTypes without schema redesign,
- every SharedProfile list membership stores and displays who added the Item and when; PersonalProfile hides redundant actor display,
- current watched/read/consumed state and rating are shown from the active Profile's interaction state,
- Saved and watched/read history remain reachable alongside named Lists.

Primary issue: #102.

### Sprint 012 — Profile Messaging

Add a deliberately narrow messaging layer after Lists are stable so messages can reference established Profile/List/Item identities.

- PersonalProfile has a private owner-only thread/note stream,
- SharedProfile has a member-only group chat retaining the actual sending User as actor,
- bottom-envelope Inbox combines invitation and message activity without adding Room clutter,
- optional message when saving an Item to a List references the Profile, List and Item rather than duplicating text into list membership,
- messaging persistence stays separate from behavioural Event/prediction evidence by default,
- no arbitrary user-to-user DM graph, public feed or follower model is introduced for MVP.

Primary issue: #138.

### Sprint 013 — Scenario Memory

Vector/scenario representation and similarity retrieval over historical situations. This starts only after navigation, Lists and the narrow Profile messaging model are stable enough that later memory/context features do not force their redesign.

### Sprint 014 — MVP Hardening

Onboarding, performance, accessibility, end-to-end flows, quality, privacy checks and release readiness across PersonalProfile, SharedProfile, navigation, Lists, messaging and Prediction.

## Post-MVP direction

After real prediction/outcome data exists:

- population scenario learning at scale,
- predictor evaluation framework,
- evolutionary predictor/genome engine,
- additional domains such as music, events and travel,
- richer personal/shared memories including images, people, location and context,
- richer Item/List comments and media attachments built on the MVP message reference model,
- public/shared discovery features only after privacy/product rules are intentionally designed,
- advanced list features such as folders, smart rules and public sharing.

Roadmap changes must be deliberate. Do not rewrite completed sprint history when sequencing changes.
