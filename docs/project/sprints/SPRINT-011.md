# Sprint 011 — Shared Curation & Named Lists

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-09-01**

## Goal

Turn SharedProfile discovery into a real joint decision surface, then add durable Profile-scoped Lists without creating a second recommendation system or media-specific architecture.

Sprint 010 navigation is accepted and frozen as the durable shell. Room visual polish is documented separately and must not block Sprint 011 behavior work.

## Ordered scope

Sprint 011 has two ordered slices. **11A must be stable before 11B.**

## 11A — Shared discovery + Endorsement consensus — #151

### Discovery eligibility

- When active Profile is `SHARED`, an Item already consumed/rated in any currently accepted member's PersonalProfile is not eligible for ordinary Shared discovery.
- SharedProfile's own consumed/rated state also suppresses the Item.
- Personal save alone does not suppress Shared discovery.
- Suppression affects discovery only; Lists/history retain the Item and may show current consumed/rating state.
- Rules remain generic across BOOK, MOVIE and future ItemTypes.

### Common-fit ranking

Shared Prediction remains targeted to the SharedProfile.

V0 may combine:

- SharedProfile joint behavior as strongest evidence,
- relevant accepted-member PersonalProfile taste evidence,
- an inspectable aggregate member-fit signal,
- an explicit disagreement penalty so one member's strong preference cannot silently hide another member's strong negative evidence.

Do not create separate per-member or media-specific recommenders.

### Endorsement

- Shared positive quick action becomes actor-specific `Endorsement` (`Tykkää` copy may vary).
- One member Endorsement is not Shared saved state.
- Persist actual `actorUserId` separately from `profileId`.
- Endorser's Item leaves that actor's ordinary immediate Shared queue.
- Members who have not endorsed receive the pending Item ahead of ordinary recommendations with restrained real-actor provenance.
- Accepted membership is required for all endorsement reads/writes.

### Consensus

- MVP uses unanimity among currently accepted members.
- On unanimity, promote once to Shared saved state.
- Preserve endorsement/consensus provenance.
- A later new member does not retroactively revoke already-reached consensus.
- No majority voting or custom-List voting in MVP.

### Events/state

Canonical planned semantics:

- current actor-specific Endorsement state per `(profile_id, item_id, actor_user_id)`,
- append-only `ITEM_ENDORSED`,
- compensating `ITEM_ENDORSEMENT_REVERSED` if reversal is exposed,
- consensus may emit canonical `ITEM_SAVED` with source such as `SHARED_CONSENSUS`.

Do not reuse one member's Endorsement as `item_interactions.saved=true` before consensus.

### 11A acceptance

- member PersonalProfile consumed/rated Item absent from ordinary Shared discovery,
- common-fit ranking uses accepted-member evidence without media-specific architecture,
- first Endorsement persists only for that actor,
- pending Item prioritized for another non-endorsing member with actor provenance,
- original endorser does not keep receiving it in normal queue,
- unanimity promotes exactly once to Shared saved state,
- PersonalProfile state remains isolated,
- hosted authorization/RLS checks pass,
- configured Android acceptance passes.

## 11B — Named Lists & collaborative browsing — #102

Start only after 11A is stable.

### Data model

- Profile-scoped generic Lists.
- `SYSTEM_SAVED` + `CUSTOM` list kinds.
- Exactly one system `Tallennetut` per Profile.
- Custom list names 1–40 characters, case-insensitively unique inside a Profile.
- One List may contain BOOK, MOVIE and future ItemTypes.
- Membership rows keep Item reference plus `added_by_user_id` and `added_at`; do not duplicate rating/consumed/title metadata.

### Behavior

- Personal `Tallenna` can choose destination and create/rename Lists.
- Shared unanimous Endorsement auto-promotes only to system `Tallennetut`.
- Custom Shared Lists remain collaborative organization: accepted members may add Items without unanimity.
- Same Item may exist in multiple different Lists, once per List.
- List detail supports list/card views, added-order sorting, ItemType filters and current consumed/rating display.
- Shared List UI can show real add provenance; Personal can hide redundant actor identity.

### 11B acceptance

- existing saved state safely backfilled to system Lists,
- members can read/write own Profile Lists and outsiders are denied,
- current rating/consumed remains sourced from canonical interactions,
- save compatibility projection/Events remain intact,
- mobile destination picker/list browsing works on configured Android,
- `npm run check` and hosted migration/security verification pass.

## Non-goals

- chat/messages (#138 / Sprint 012),
- public feeds/followers,
- majority voting,
- ScenarioMemory,
- Room art implementation/redesign,
- media-specific Shared or List tables.

## Required execution order

1. Implement/test #151 backend/domain authorization and state semantics.
2. Integrate Shared mobile discovery/pending Endorsement UX.
3. Run hosted rollback/security tests and configured Android acceptance for 11A.
4. Only then implement #102 Lists backend foundation/backfill.
5. Add List mobile browsing/save destination flow and configured acceptance.
6. Update STATUS/MVP/CODEMAP/Event/Prediction docs at each completed slice.
7. Close Sprint 011 only when both 11A and 11B are accepted.

## Progress

- PR #157 merged the prediction-core-independent Endorsement current state, membership authorization, idempotent endorse/reverse RPCs, unanimity -> Shared Saved projection, Event vocabulary and leave cleanup.
- The active follow-up implements the separate authorized Shared discovery overlay plus mobile `Tykkää`, pending provenance and queue composition.
- #156 gates common-fit coefficients and all final EvoBot/LongTermState/ShortTermState/ScenarioMemory algorithm work until the user-approved Prediction Core MVP design is canonical.
- 11A remains open until hosted overlay/RLS verification, CI and configured Android acceptance pass.

## Room/navigation constraint during this sprint

Preserve the accepted Sprint 010 shell and approved Room direction:

- warm simple illustrated 2D/light 2.5D cabin-living-room,
- no navigable 3D or futuristic glossy UI,
- bookshelf=BOOK, TV/screen=MOVIE,
- one global DiscoveryMode curtain,
- no Room title/helper copy,
- no visual redesign may become a blocker for #151/#102.

## Handoff

A fresh conversation starts by reading `/AGENTS.md`, `/docs/project/STATUS.md`, `/docs/product/MVP.md`, this file, glossary/domain docs and CODEMAP.

Immediate implementation target: **#151**. Do not start #102 first.
