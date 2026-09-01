# Sprint 010 — Navigation & Profile lifecycle

Status: **COMPLETE — CONFIGURED ANDROID ACCEPTED 2026-09-01**
Milestone: **MVP 0.1**

## Goal

Make Kajo navigation quiet and predictable before collaborative curation and named Lists. The Room remains the visual home of the active Profile; global navigation lives in a restrained top/bottom shell and side drawer.

## Delivered

### Navigation shell — #136 / PR #142

- top Kajo mark returns to the currently active Profile Room,
- bottom dock contains left menu, center active Profile/Home and right Inbox,
- menu opens a Profile-aware side drawer,
- Profile switching remains in place and seamless,
- no conventional multi-tab navigation was introduced.

### Profile lifecycle — #137 / PR #141

- nickname maximum 24,
- SharedProfile name maximum 32,
- matching mobile/database validation,
- safe `Poistu ryhmästä` confirmation,
- active SharedProfile leave falls back to PersonalProfile,
- one remaining member keeps provisional SharedProfile/history,
- zero-member orphan cleanup,
- membership authorization remains the access boundary.

Hosted migration: `20260901082902_profile_lifecycle_limits_and_leave`.

Verification passed rollback/security/production smoke suites with no QA residue.

### Nickname input consistency — #143 / PR #147

Both AuthGate nickname inputs stop at 24 characters.

### Final navigation polish — #149 / PR #150

Merged main commit: `c10a4edc736965f3184cca3e477e2e4ccb9210ca`.

Delivered:

1. bottom-center active Profile identity is another Home action,
2. `Kirjaudu ulos` moved to the drawer bottom,
3. standalone `Huone` heading removed,
4. Room helper copy removed,
5. Room content between global bars is only the visual Room/domain objects,
6. obsolete separate `Ehdota yhteiseen` panel/helper/tests removed.

## Acceptance

The latest configured Android navigation APK was reviewed by the user on **2026-09-01** and behaved as intended. Sprint 010 is closed.

Accepted durable contract:

- top Kajo mark and bottom-center Profile identity return Home,
- Room has no standalone title/helper/sign-out chrome,
- drawer owns account/Profile/List/Group navigation,
- Inbox remains bottom-right,
- Personal/Shared switching stays seamless,
- BOOK/MOVIE and DiscoveryMode navigation remain intact,
- no `Ehdota yhteiseen` UI returns.

Further Room visual work must preserve this navigation contract and must not reopen Sprint 010.

## Visual follow-up decision

The approved Room direction is documented in `docs/product/UX_PRINCIPLES.md`: warm simple illustrated 2D/lightly layered 2.5D cabin-living-room, no navigable 3D/futuristic chrome, with fireplace, bookshelf, TV/screen, window and one global DiscoveryMode curtain.

## Handoff

Sprint 011 is now current.

Immediate order:

1. #151 — Shared discovery member-history suppression, common-fit ranking and Endorsement consensus.
2. #102 — system + named Profile-scoped Lists after #151 is stable.
3. #138 — Profile messaging only after Lists are stable.

ScenarioMemory remains later. Do not reintroduce the retired suggestion surface.