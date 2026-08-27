# Kajo Current Status

Last updated: **2026-08-27**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 006 — Backend Foundation** (`sprints/SPRINT-006.md`)
Last completed sprint: **Sprint 005 — Swipe & History** (`sprints/SPRINT-005.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–005 are complete. Sprint 006 is **ACTIVE** and remains blocked only by the corrected configured-backend deployment plus real-phone acceptance.

Delivered before acceptance:

- Issue #57 / PR #58 — User/Profile/ProfileMember/Item/current-interaction schema and RLS foundation.
- Issue #59 / PR #60 — Supabase/Expo dependencies and one root mobile data boundary.
- Issue #61 / PR #62 — initial email/password auth/session flow.
- Issue #63 / PR #64 — initial nickname + PersonalProfile onboarding.
- Issue #65 / PR #66 — stable MVP Items and configured interaction persistence/hydration.
- Issue #67 / PR #68 — configured CI/APK support through public repository variables.

Issue #69 tested configured CI #96 on a real phone. That build failed the Sprint 006 auth/onboarding acceptance and is retained only as failure evidence.

## Phone findings from CI #96

The accepted auth behavior is now:

- email and nickname are both unique identifiers linked to one User,
- sign-in accepts either email or nickname,
- nickname display casing is preserved (`KeTTu`) while uniqueness/sign-in/search are case-insensitive (`kettu`, `KETTU`, etc.),
- unknown identifier -> `Käyttäjätunnusta ei löydy.`,
- known identifier + wrong password -> `Salasana on väärin.`,
- duplicate registration identity -> `Sinulla on jo tili. Unohditko salasanasi?`,
- email confirmation must return to the native Kajo app rather than `localhost:3000`,
- password recovery uses the account email and returns to Kajo,
- every authenticated User must reach a valid PersonalProfile before the Room.

The CI #96 phone test also reproduced the blocking profile error `Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.` after nickname onboarding.

## Auth acceptance correction — Issue #72

PR #74 was squash-merged to `main` as commit `50bceadcb7949e5d51020391fb0b76b2593652f3` after final PR CI #107 passed lint, typecheck, tests and iOS/Android bundle smoke.

Merged correction:

- case-insensitive unique nickname key with preserved display casing,
- email-or-nickname sign-in through one server-side identifier boundary,
- deterministic not-found / wrong-password / unconfirmed-email UX,
- registration availability checks for both email and nickname,
- native `kajo://auth/confirm` and `kajo://auth/recovery` handling,
- password-reset request and in-app new-password flow,
- signup-time PersonalProfile provisioning plus corrected fallback RPC,
- one follow-up migration and one scoped `password-auth` Supabase Edge Function,
- deterministic auth/deep-link/profile tests,
- no new npm dependencies or unrelated feature scope.

Google and Apple sign-in are tracked separately in Issue #73 and must not begin before Sprint 006 acceptance.

## MVP progress

Still in progress until the complete corrected phone path passes:

- `MVP-AUTH-001`
- `MVP-AUTH-002`
- `MVP-PROFILE-001`

Do not begin Sprint 007 Event work early.

## Next — exact handoff order

1. In the real Supabase project, apply `supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql` exactly as committed.
2. Deploy the committed `password-auth` Edge Function using `supabase/config.toml` so `verify_jwt = false` is applied. Do not expose secret/service-role values.
3. In Supabase Auth URL Configuration, allow the native redirect pattern `kajo://**`.
4. Use a fresh configured `main` standalone Android APK containing merge `50bceadcb7949e5d51020391fb0b76b2593652f3` (or a later documentation-only commit with identical app code).
5. Rerun Issue #69 on a real phone: registration, confirmation returning to Kajo, email sign-in, mixed-case nickname sign-in, exact not-found/wrong-password messages, password recovery, PersonalProfile/Room entry, BOOK+MOVIE interactions, undo, restart hydration and sign-out/sign-in persistence.
6. Record exact pass/failure evidence in Issues #69 and #72. Close Sprint 006 and mark its three MVP requirements complete only after the whole path passes.

## Known remaining gate

- The new migration, Edge Function/config and `kajo://**` Auth redirect allowlist have not yet been applied/deployed to the hosted project.
- A fresh post-fix APK has not yet passed real-phone acceptance.
- Issue #69 and Issue #72 remain open.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-006.md`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/config.toml`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**. The first external action is the new Supabase migration; no further product feature work should start before the corrected phone acceptance passes.
