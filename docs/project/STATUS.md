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

Issue #57 / PR #58 delivered the reproducible User/Profile/ProfileMember/Item/current-interaction schema and least-privilege RLS foundation. Issue #59 / PR #60 delivered the package-manager-installed Supabase/Expo dependencies, public-only configuration contract and one root-scoped client/data boundary. Issue #61 / PR #62 delivered the first persisted email/password authentication session and entry flow. Issue #63 / PR #64 delivered the first nickname onboarding and PersonalProfile membership flow. Issue #65 / PR #66 delivered 12 stable-ID MVP Items and configured PersonalProfile interaction persistence/hydration. Issue #67 / PR #68 delivered optional public Supabase repository-variable support for CI and APK builds.

Issue #69 began the configured real-phone acceptance against CI #96. That phone test **did not pass** and exposed the auth requirements/defects now tracked in Issue #72 / PR #74. Sprint 006 and `MVP-AUTH-001`, `MVP-AUTH-002`, `MVP-PROFILE-001` remain open.

## Configured phone-acceptance evidence

Completed before the phone test:

- one real Supabase project exists and the original three committed migrations were applied successfully in timestamp order (user-confirmed),
- GitHub Actions repository variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set without copying their values into repository documentation or chat,
- manual `main` workflow [CI #96](https://github.com/Kajooja/Kajo/actions/runs/33080640204) passed validation and standalone Android APK creation,
- tested build commit `71a33c0b0fb59ea076b691ecdfad69a073743bb8`.

Real-phone findings from that build:

- sign-in must accept either the unique email or the unique nickname linked to the same User,
- nickname display casing must be preserved while uniqueness/sign-in/search are case-insensitive,
- unknown identifier must show `Käyttäjätunnusta ei löydy.`, while a known identifier with wrong password must show `Salasana on väärin.`,
- duplicate registration identity must guide the user with `Sinulla on jo tili. Unohditko salasanasi?`,
- the hosted confirmation link incorrectly returned to `localhost:3000` instead of the mobile app,
- password recovery through the account email is required for this MVP auth checkpoint,
- the first nickname/PersonalProfile completion failed with `Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.` and blocked entry to the Room.

CI #96 is therefore retained only as failure evidence and is **not** the final Sprint 006 acceptance build.

## Active auth correction — Issue #72 / PR #74

PR #74 currently contains:

- one unique case-insensitive nickname key while preserving the stored/display nickname casing,
- email-or-nickname password sign-in through one server-side identifier boundary,
- deterministic not-found / wrong-password / unconfirmed-email messages,
- registration availability checks for both email and nickname,
- native `kajo://` confirmation and password-recovery deep-link handling,
- password-reset request and in-app new-password flow,
- signup-time PersonalProfile provisioning plus a corrected authenticated fallback RPC,
- one new follow-up migration, one scoped `password-auth` Supabase Edge Function and its function configuration,
- deterministic auth/deep-link/profile tests.

PR #74 validation [CI #99](https://github.com/Kajooja/Kajo/actions/runs/33099264933) passed dependency install, lint, typecheck, tests and both iOS/Android bundle smoke tests. PR standalone APK creation is intentionally skipped; a fresh configured main APK is required after merge and hosted Supabase deployment.

Google and Apple sign-in are explicitly deferred to Issue #73 after Sprint 006 acceptance; they must not expand PR #74.

## MVP progress

See `../product/MVP.md`.

Completed through Sprint 005:

- `MVP-FOUND-001..003`
- `MVP-ROOM-001..005` except `MVP-ROOM-006`
- `MVP-DISC-001..007`
- `MVP-SWIPE-001..006`
- `MVP-MEM-001..002`

Active Sprint 006 targets:

- `MVP-AUTH-001` — unique email + nickname registration, mobile email confirmation, email-or-nickname password sign-in and password recovery,
- `MVP-AUTH-002` — one visible unique nickname with preserved display casing and case-insensitive identity matching,
- `MVP-PROFILE-001` — every user has a PersonalProfile.

## Prediction and learning direction — decided, later implementation

The global curtain selection is a future Prediction input, not only a colour choice:

- `FOR_YOU` = lower exploration / higher expected fit,
- `SURPRISE` = more novelty while retaining meaningful fit,
- `RISK` = higher uncertainty/variance and bolder exploration.

Meaningful actions become durable learning evidence in Sprint 007. Sprint 008 introduces Prediction V0. Do not implement ranking logic in the mobile client during Sprint 006.

## Next — exact handoff order

1. Follow `sprints/SPRINT-006.md`; do not reopen Sprint 005 work or begin Sprint 007.
2. Finish review of Issue #72 / draft PR #74. Its CI #99 validation is green; keep the change scoped to the demonstrated auth acceptance failures.
3. Merge PR #74 only after the final diff/repository-hygiene review is clean.
4. In the real Supabase project, apply the new committed migration `20260827173000_auth_identifier_and_profile_fix.sql`, deploy the committed `password-auth` Edge Function/config, and allow the native `kajo://**` Auth redirect pattern. Do not make uncommitted SQL changes or expose secret/service-role keys.
5. Run a fresh configured `main` workflow so the standalone Android APK contains the merged auth fix.
6. Rerun Issue #69 on a real phone, including: unique email+nickname registration, confirmation link returning to Kajo, sign-in by email, sign-in by nickname with mixed casing, exact not-found/wrong-password messages, password recovery, PersonalProfile/Room entry, BOOK+MOVIE interactions, undo, restart hydration and sign-out/sign-in persistence.
7. Record exact pass/failure evidence in Issues #69 and #72. Close the sprint and mark its three MVP requirements complete only after the whole phone path passes.

## Known issues / open decisions

- PR #74 code validation is green, but its new migration/Edge Function/Auth redirect configuration has not yet been deployed to the hosted project or phone-tested.
- The original CI #96 phone build failed Sprint 006 auth acceptance and must not be reused as the final candidate.
- Google and Apple authentication are tracked in Issue #73 and remain outside the current acceptance fix.
- Current mode-dependent Item ordering is mock discovery logic, not Prediction V0.
- Final book metadata provider is not locked.
- Current Room/theme/mock covers remain structural rather than final production artwork.
- SharedProfile Room/theme/discovery identity remains later scope.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
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
- `/supabase/config.toml`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/supabase/migrations/20260827071000_personal_profile_onboarding.sql`
- `/supabase/migrations/20260827073000_seed_mvp_items.sql`
- `/supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 005 is accepted and complete. Sprint 006 is the only active sprint. Issue #69 phone acceptance exposed blocking auth defects; Issue #72 / draft PR #74 contains the scoped correction and CI #99 validation is green. The next work is final PR/hygiene review, merge, hosted Supabase migration/function/redirect deployment, fresh configured APK and the complete real-phone acceptance rerun. Do not begin Sprint 007 early.
