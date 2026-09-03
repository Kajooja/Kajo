# Milestone 001 — Kajo MVP 0.1

Status: **ACTIVE**
Started: **2026-08-25**

## Outcome

Deliver the first small but genuine Kajo product: two people can each have a personal Kajo, form a Shared Kajo, discover books/movies through the Room and grid/swipe experiences, build history, and receive generic personalized recommendations whose data model can later evolve into ScenarioMemory and evolutionary prediction.

## Acceptance source

`docs/product/MVP.md` is the executable requirement list for this milestone.

## Planned sprint sequence

See `docs/project/ROADMAP.md`.

## Delivered

Sprints 001–010 are accepted. The validated baseline includes the mobile foundation, Room and navigation shell, global DiscoveryMode curtain, BOOK/MOVIE grid and optional swipe flow, generic Item interaction/history/undo, configured Supabase authentication, PersonalProfile and consent-based SharedProfiles, append-only Event/session persistence, hosted Prediction V0 and accepted Shared Endorsement delivery.

Sprint 011 named Lists and Sprint 012 Profile messaging are delivered; their explicitly recorded refreshed device/hosted acceptance work remains open. Sprint 013 Prediction nervous-system/ScenarioMemory work is active in draft PR #166. Requirement-level truth remains in `docs/product/MVP.md`, current execution state in `docs/project/STATUS.md` and active branch resolution in `docs/project/HANDOFF_PROTOCOL.md`.

## Known milestone risks

- Over-expanding item domains before the book/movie core works.
- Building the evolution engine before enough outcome data exists.
- Letting the Room become a game/3D project instead of a minimal interface.
- Domain-specific code drift that breaks cross-domain learning.
- Losing project decisions in AI conversations instead of repository memory.

## Close requirements

At milestone close, all in-scope MVP IDs must be reviewed explicitly, known limitations recorded, documentation reconciled with code, and a next-milestone handoff written.

### Definition of a complete MVP

MVP 0.1 may be marked **COMPLETE** only when every gate below is satisfied. A draft PR, green unit tests, a bundle export or a locally installed APK alone is not completion.

| Gate | Required evidence |
|---|---|
| Scope | Every in-scope ID in `docs/product/MVP.md` is `[x]`, or scope removal is an explicit documented product decision; no `[-]` remains hidden as complete |
| Accepted code | All MVP implementation is reviewed and merged to `main`; no required behavior exists only in an open branch, local workspace or chat |
| Hosted backend | Required migrations/functions/configuration are permanently applied, authorization/RLS and rollback/recovery checks pass, and client roles have least privilege |
| End-to-end behavior | Clean account creation/login/recovery, PersonalProfile, Shared invitation/switching, all DiscoveryModes, Prediction, rating/consumption, Lists, Endorsement consensus, messaging, restart persistence and failure/retry paths are exercised |
| Prediction evidence | Hosted PredictionRun/candidate/session/Event/Outcome correlation is verified without Personal/Shared leakage; fallback remains distinguishable and rollback is documented |
| Real devices | Representative supported real-device flows pass; compilation or emulator-only evidence is insufficient for final acceptance |
| Release | A signed production build with stable identifiers, versioning, production email, privacy/support/store metadata and no embedded privileged secret is downloadable through an official app store |
| Operations | Crash/error/latency and critical backend health are observable; support, account deletion/data handling and release rollback paths are documented and tested at the agreed MVP level |
| Repository truth | `main` documentation, status, glossary, ADRs, code map, migrations and release state match reality; obsolete files/branches and superseded placeholders are cleaned safely |

The milestone closes only after a final product-owner acceptance of the installed store build. Closing Sprint 014 and changing this milestone to `COMPLETE` are the final roadmap actions, not administrative follow-ups.
