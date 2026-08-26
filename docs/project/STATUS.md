# Kajo Current Status

Last updated: **2026-08-26**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 006 — Backend Foundation** (`sprints/SPRINT-006.md`)
Last completed sprint: **Sprint 005 — Swipe & History** (`sprints/SPRINT-005.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–005 are complete. Sprint 005 closed after the final standalone Android build passed canonical CI and the user accepted the resulting app on a real phone.

Accepted Sprint 005 baseline:

- implementation merge `3b6d7c703f7574461441f2489bcaa1c0a8048740` (Issue #51 / PR #52),
- main CI run [#77](https://github.com/Kajooja/Kajo/actions/runs/32994213896) fully green,
- dependency install, lint, typecheck, 21 tests and iOS/Android bundle smoke passed,
- standalone Android release APK built, embedded JavaScript bundle verified and artifact uploaded,
- artifact `kajo-android-standalone-3b6d7c703f7574461441f2489bcaa1c0a8048740`,
- artifact digest `sha256:eecdcf15a6735b9a302a5d851607aaf8944c5b1f485e5474904b1b76822d52a5`,
- real-phone acceptance recorded in Issue #34 on 2026-08-26.

Delivered through Sprint 005:

- Room-first BOOK/MOVIE discovery with a visual grid and optional horizontal Item sequence,
- one app-wide three-state DiscoveryMode curtain with drag and tap-to-snap,
- generic BOOK/MOVIE interaction state for interest, save and consumed semantics,
- every explicit card choice commits, exits calmly and advances to the next Item,
- exact prior-state and previous-card restoration for the latest 10 committed actions,
- consumed suppression plus `Luetut` / `Katsotut` history,
- centralized feature-level interaction labels,
- deterministic tests without duplicate book/movie state, swipe routes or history routes.

Sprint 006 is **ACTIVE**. Its goal is the smallest real Supabase/PostgreSQL, authentication, identity and persistence foundation that can replace appropriate Sprint 005 in-memory state through a clear data boundary without rewriting presentation semantics.

Issue #57 is the first implementation step. It adds the reproducible User/Profile/ProfileMember/Item/current-interaction schema and least-privilege RLS foundation. Mobile client dependencies and configuration remain the next separate step so package installation and the lockfile stay package-manager-generated.

## MVP progress

See `../product/MVP.md`.

Completed through Sprint 005:

- `MVP-FOUND-001..003`
- `MVP-ROOM-001..005` except `MVP-ROOM-006`
- `MVP-DISC-001..007`
- `MVP-SWIPE-001..006`
- `MVP-MEM-001..002`

Active Sprint 006 targets:

- `MVP-AUTH-001` — lightweight/common register/sign-in,
- `MVP-AUTH-002` — user-visible nickname/username,
- `MVP-PROFILE-001` — every user has a PersonalProfile.

## Prediction and learning direction — decided, later implementation

The global curtain selection is a future Prediction input, not only a colour choice:

- `FOR_YOU` = lower exploration / higher expected fit,
- `SURPRISE` = more novelty while retaining meaningful fit,
- `RISK` = higher uncertainty/variance and bolder exploration.

Meaningful actions become durable learning evidence in Sprint 007. Sprint 008 introduces Prediction V0. Do not implement ranking logic in the mobile client during Sprint 006.

## Next — exact handoff order

1. Follow `sprints/SPRINT-006.md`; do not reopen Sprint 005 work.
2. Complete Issue #57: merge the initial migration and authorization foundation only with green canonical CI.
3. Open the next scoped Issue for package-manager-installed Supabase/Expo dependencies, the public configuration contract and one root mobile client/data boundary.
4. Keep secrets out of the repository and preserve the current presentation API while adding persistence underneath it.
5. Reserve another phone acceptance pass for a meaningful user-facing Sprint 006 checkpoint.

## Known issues / open decisions

- Current interaction state is still intentionally in-memory; Sprint 006 replaces it incrementally behind a data boundary.
- A Supabase project and its non-secret public client configuration will be required for end-to-end backend validation.
- Exact authentication provider/method mix remains open; the MVP requirement is provider-agnostic.
- Exact nickname/username uniqueness rules remain open.
- Current mode-dependent Item ordering is mock discovery logic, not Prediction V0.
- Final book metadata provider is not locked.
- Current Room/theme/mock covers remain structural rather than final production artwork.
- SharedProfile Room/theme/discovery identity remains later scope.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-006.md`
- `/apps/mobile/src/domain/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 005 is accepted and complete. Sprint 006 is the only active sprint. Issue #57 is the current change; after its migration passes CI and merges, add the mobile Supabase configuration/client boundary in its own Issue with a package-manager-generated lockfile.
