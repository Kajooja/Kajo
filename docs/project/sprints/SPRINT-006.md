# Sprint 006 — Backend Foundation

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-26**

## Goal

Add the smallest real Supabase/PostgreSQL authentication, identity and persistence foundation needed to move appropriate Sprint 005 in-memory state behind a clear data boundary without rewriting the accepted presentation flow.

## Scope

- Public-only mobile Supabase configuration; no secrets in repository/chat/logs.
- One root mobile Supabase data/auth boundary instead of scattered backend calls.
- Reproducible User/Profile/ProfileMember/Item/current-interaction schema through committed migrations.
- Membership-based authorization for profile data.
- Password authentication with one unique email and one unique nickname linked to the same User.
- Preserve nickname display casing while matching uniqueness/sign-in/search case-insensitively.
- Registration, native email confirmation, sign-in by email or nickname, and password recovery through the account email.
- A valid PersonalProfile for every signed-in User before the Room.
- Persist/hydrate existing generic BOOK/MOVIE interaction state.
- Preserve accepted Room/discovery/Item/swipe semantics.

## Relevant MVP requirements

- `MVP-AUTH-001` — unique email + nickname registration, mobile confirmation, email-or-nickname password sign-in and password recovery.
- `MVP-AUTH-002` — one visible unique nickname with preserved display casing and case-insensitive identity matching.
- `MVP-PROFILE-001` — every user has a PersonalProfile.

These remain **in progress** until the corrected full phone path passes.

## Non-goals

- Google/Apple sign-in — Issue #73 after Sprint 006 acceptance.
- Event Engine — Sprint 007.
- Prediction V0 — Sprint 008.
- SharedProfile product flows.
- Rating/note/photo/location memory expansion.
- Final metadata providers or Room artwork.
- pgvector/evolutionary prediction machinery.

## Issue sequence

1. #57 / PR #58 — initial schema + authorization.
2. #59 / PR #60 — mobile Supabase boundary/configuration.
3. #61 / PR #62 — initial password auth/session.
4. #63 / PR #64 — initial nickname + PersonalProfile onboarding.
5. #65 / PR #66 — Item interaction persistence/hydration.
6. #67 / PR #68 — configured CI/APK support.
7. #69 — real-project/phone acceptance.
8. #72 / PR #74 — auth/profile correction exposed by #69 acceptance.

## Architecture constraints

- Use Supabase/PostgreSQL/Auth and repository-committed migrations.
- Presentation screens do not own arbitrary backend calls.
- Nickname-to-email resolution is server-side only behind `supabase/functions/password-auth`; do not expose it as an unauthenticated mobile/database API.
- Privileged secret/service-role credentials stay only in the hosted server environment.
- Preserve canonical `User`, `Profile`, `ProfileMember`, `Item` terminology.
- Keep `actorUserId` separate from `profileId` for Sprint 007.
- Do not introduce Event/Prediction abstractions early.
- Corrections to already-applied SQL use new migrations, never ad-hoc rewrites.

## Definition of Done

- Unique email + unique nickname registration works.
- Confirmation email opens the native Kajo app.
- Email and nickname both sign in to the same User.
- Unknown identifier -> `Käyttäjätunnusta ei löydy.`
- Known identifier + wrong password -> `Salasana on väärin.`
- Duplicate identity -> `Sinulla on jo tili. Unohditko salasanasi?`
- Password recovery returns to Kajo and allows a new password.
- Correct nickname and PersonalProfile are available before the Room.
- Backend state is reproducible from committed migrations/functions.
- Membership authorization remains intact.
- BOOK/MOVIE interaction state persists/hydrates; undo and presentation behavior stay intact.
- No backend-call sprawl, duplicate state model, empty folder or unused scaffold is introduced.
- Canonical CI is green.
- The complete corrected configured path passes on a real phone.
- `STATUS.md`, `MVP.md`, `CODEMAP.md` and this file reflect repository truth.

## Delivered baseline

- #57: canonical backend/RLS foundation.
- #59: one configured/unconfigured mobile Supabase boundary.
- #61: first persisted email/password auth flow.
- #63: first nickname/PersonalProfile onboarding.
- #65: configured current interaction persistence/hydration.
- #67: configured `main` APK workflow support.

The first auth/profile implementations were intentionally tested on a real hosted project before being declared complete.

## Acceptance evidence — Issue #69 / CI #96

The real Supabase project, original three migrations and public repository variables were configured. CI #96 produced a standalone APK from `71a33c0b0fb59ea076b691ecdfad69a073743bb8`.

Real-phone acceptance failed and established the final MVP auth semantics:

- unique email + unique nickname linked to one User,
- preserved nickname display casing with case-insensitive matching,
- distinct unknown-identifier and wrong-password messages,
- duplicate account recovery guidance,
- native confirmation instead of `localhost:3000`,
- email-based password recovery,
- reliable PersonalProfile creation before entering the Room.

The phone also reproduced `Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.` during nickname/profile onboarding. CI #96 is failure evidence, not the final candidate.

## Auth acceptance correction — Issue #72 / PR #74

PR #74 was squash-merged as `50bceadcb7949e5d51020391fb0b76b2593652f3` after final PR CI #107 passed lint, typecheck, tests and iOS/Android bundle smoke.

Merged correction:

- case-insensitive unique nickname index while preserving display casing,
- server-side `password-auth` Edge Function for identifier resolution, sign-in and recovery request without returning resolved email or privileged keys,
- follow-up migration instead of editing already-applied migrations,
- signup-time PersonalProfile provisioning plus corrected fallback completion RPC,
- `kajo://auth/confirm` and `kajo://auth/recovery` handling,
- registration existence checks for email and nickname,
- deterministic auth error UX,
- in-app password update after recovery,
- deterministic auth/deep-link/profile tests,
- no npm dependency additions or unrelated feature expansion.

Issue #72 remains open because its Definition of Done includes hosted deployment and fresh real-phone acceptance, not only code merge.

## Decisions

- Keep Supabase/PostgreSQL/Auth.
- Keep one root mobile data/auth boundary.
- Email and nickname are unique identifiers for the same User.
- Nickname display casing is preserved; matching is case-insensitive.
- Password recovery belongs in Sprint 006 because acceptance demonstrated the need.
- Identifier-to-email resolution is server-side only.
- Google/Apple auth is deferred to #73.
- Durable generic Event capture remains Sprint 007.

## Remaining gate / exact next order

1. Apply `supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql` to the real project.
2. Deploy `supabase/functions/password-auth/index.ts` with committed `supabase/config.toml` (`verify_jwt = false`).
3. Allow `kajo://**` in Supabase Auth redirect URLs.
4. Use a fresh configured `main` APK containing merge `50bceadcb7949e5d51020391fb0b76b2593652f3` or later documentation-only commit with identical app code.
5. Rerun Issue #69 on a real phone: registration, native confirmation, email login, mixed-case nickname login, exact error messages, recovery, Room/profile, BOOK+MOVIE interaction, undo, restart hydration and sign-out/sign-in persistence.
6. Record evidence in #69/#72 and close Sprint 006 only when the whole path passes.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/STATUS.md`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/supabase/config.toml`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql`
- `/.github/workflows/ci.yml`

## Mid-sprint handoff — 2026-08-27

The auth/profile correction is merged and automated validation is green. The next action is hosted Supabase deployment, beginning with the new committed migration. Do not start Sprint 007 or Google/Apple auth before corrected phone acceptance passes.
