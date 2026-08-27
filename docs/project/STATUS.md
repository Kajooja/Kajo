# Kajo Current Status

Last updated: **2026-08-27**
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

Issue #57 / PR #58 delivered the reproducible User/Profile/ProfileMember/Item/current-interaction schema and least-privilege RLS foundation. Issue #59 / PR #60 delivered the package-manager-installed Supabase/Expo dependencies, public-only configuration contract and one root-scoped client/data boundary. Issue #61 / PR #62 delivered the persisted email/password authentication session and entry flow. Issue #63 / PR #64 delivered user-visible nickname onboarding plus one atomically created and hydrated PersonalProfile membership. Issue #65 / PR #66 delivered 12 stable-ID MVP Items and configured PersonalProfile interaction persistence/hydration. Issue #67 / PR #68 delivered optional public Supabase repository-variable support for CI and APK builds without committing project values. Issue #69 is the single remaining configured phone-acceptance gate.

Configured Sprint 006 backend/build checkpoint:

- one real Supabase project exists and all three committed migrations were applied successfully in timestamp order (user-confirmed),
- GitHub Actions repository variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set without copying their values into repository documentation or chat,
- manual `main` workflow [CI #96](https://github.com/Kajooja/Kajo/actions/runs/33080640204) passed validation and the standalone Android APK job,
- commit `71a33c0b0fb59ea076b691ecdfad69a073743bb8`,
- artifact `kajo-android-standalone-71a33c0b0fb59ea076b691ecdfad69a073743bb8`, 48,408,294 bytes,
- artifact digest `sha256:b0de89fd08a3618afa5c22473e03d476e84e723faf3ac7a22d3a232da4c66d6c`,
- artifact expires on 2026-09-03,
- the configured APK has not yet been validated on a real phone.

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
2. Download artifact `kajo-android-standalone-71a33c0b0fb59ea076b691ecdfad69a073743bb8` from [CI #96](https://github.com/Kajooja/Kajo/actions/runs/33080640204) before it expires on 2026-09-03.
3. Install the APK on a real phone and run the complete Issue #69 path: registration/sign-in, nickname/PersonalProfile, BOOK and MOVIE interactions, undo, restart hydration, sign-out and sign-in persistence.
4. Record exact pass evidence or exact reproduction evidence in Issue #69. Keep the three active MVP requirements incomplete and Sprint 006 open until the phone path passes.
5. Keep passwords, service-role keys and tokens out of the repository, Issues, logs and chat. Do not begin Sprint 007 Event work early.

## Known issues / open decisions

- Configured PersonalProfile interaction state hydrates and persists; intentionally unconfigured builds retain the accepted local mock behavior.
- The configured CI #96 APK has not yet been accepted on a real phone; this is the only remaining Sprint 006 gate.
- The CI #96 APK artifact expires on 2026-09-03 and must be downloaded before then.
- Email/password is the single Sprint 006 MVP authentication method; additional providers remain outside the current scope.
- Nickname is an MVP display name and is not globally unique; PersonalProfile ownership is unique per User.
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
- `/apps/mobile/.env.example`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/domain/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/supabase/migrations/20260827071000_personal_profile_onboarding.sql`
- `/supabase/migrations/20260827073000_seed_mvp_items.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 005 is accepted and complete. Sprint 006 is the only active sprint. The Supabase project, three migrations, two public repository variables and configured CI #96 APK are ready. Issue #69 remains open only for the real-phone acceptance. The first action in a new conversation is to download the CI #96 artifact, install it and execute the documented phone path; do not begin Sprint 007 Event work early.
