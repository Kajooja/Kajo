# Milestone 001 — Kajo MVP 0.1

Status: **ACTIVE**
Started: **2026-08-25**

## Outcome

Deliver the complete non-commercial first public BOOK/MOVIE Kajo: anonymous Taste/link entry, an honest held-out prediction challenge, taste-preserving Google/Apple conversion, useful and measurably adaptive Personal/Shared recommendations, personal Friend invitations and explicit consent-based Shared creation. Core browsing/collaboration, reliable evidence, real-device flows and operated production services with tested data lifecycle and recovery must pass the Share Link Gate. Graphics may evolve without changing these behavioral contracts.

The 2026-09-12 refinement adds executable independent-engine contracts and an
isolated reproducible MovieLens baseline report (E1 #235 → D1 #236 → D2 #237).
It does not require a winning learned prior, full neural world model or automatic
promotion. Required Shared rating rounds and controlled rewatch (#232, Phase16.3)
preserve each participant's response before completed joint history. MVP owns
the corresponding ENG and SOCIAL requirement IDs; none is delivered by planning.

## Acceptance source

`docs/product/MVP.md` is the executable requirement list for this milestone.

## Planned sprint sequence

See `docs/project/ROADMAP.md`.

## Delivered

Sprints 001–010 are accepted. The validated baseline includes the mobile foundation, Room and navigation shell, global DiscoveryMode curtain, BOOK/MOVIE grid and optional swipe flow, generic Item interaction/history/undo, configured Supabase authentication, PersonalProfile and consent-based SharedProfiles, append-only Event/session persistence, hosted Prediction V0 and accepted Shared Endorsement delivery.

Sprint 011 Lists and Sprint 012 messaging foundations are delivered with refreshed acceptance pending. Sprint 013 architecture/persistence was accepted; current algorithm reliability and operational evaluation gates are explicitly open. Sprint 014 is active. Current implementation/acceptance truth belongs to `STATUS.md` and requirement-level truth to `MVP.md`; do not infer completion from historical sprint labels.

## Known milestone risks

- Over-expanding item domains before the book/movie core works.
- Admitting native evolution before enough valid outcome data exists, or delaying
  isolated public-data research merely because native volume is still small.
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
| End-to-end behavior | Anonymous link → adaptive Taste → frozen holdout challenge → unseen preview → Google/Apple conversion preserves taste; personal invite → accepted Friendship → explicit Shared creation is exercised, alongside login/recovery, all DiscoveryModes, rating/consumption, Lists, Endorsement, messaging, restart and failure/retry paths |
| Prediction evidence | Hosted PredictionRun/candidate/session/Event/Outcome correlation is verified without Personal/Shared leakage; fallback remains distinguishable and rollback is documented |
| Portable engine/research | E1/D1/D2 run reproducibly on declared fixtures/real-data cohort with train-only temporal evaluation, an honest report and artifact admission/rejection/fallback; external/synthetic records never become native evidence |
| Joint experience | #232 participant responses, completion/correction/rewatch and Personal isolation pass before beta; no first actor is treated as every member |
| Real devices | Representative supported real-device flows pass; compilation or emulator-only evidence is insufficient for final acceptance |
| Release | A signed production build with stable identifiers, versioning, production email, privacy/support/store metadata and no embedded privileged secret is downloadable through an official app store; the corresponding browser-to-app link/identity flow is accepted |
| Operations | Crash/error/latency and critical backend health are observable; support, account deletion/data handling and release rollback paths are documented and tested at the agreed MVP level |
| Repository truth | `main` documentation, status, glossary, ADRs, code map, migrations and release state match reality; obsolete files/branches and superseded placeholders are cleaned safely |

The milestone closes only after explicit product-owner acceptance of ROADMAP Phase 20, the Share Link Gate. Sprint 014 owns Phase 14 algorithm/catalog reliability. Taste acquisition follows in Phase 15, Friends/Shared in Phase 16, UX/operations in Phase 17, full-flow closed beta in Phase 18 and production/store acceptance in Phase 19. The old Sprint 014 external-beta / Sprint 015 store-close schedule is superseded by the 2026-09-07 release decision. Monetization is outside MVP 0.1.
