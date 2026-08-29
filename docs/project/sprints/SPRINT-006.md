# Sprint 006 — Backend Foundation

Status: **COMPLETED**
Milestone: **MVP 0.1**
Started: **2026-08-26**
Completed: **2026-08-29**

## Goal

Add the smallest real Supabase/PostgreSQL, authentication, identity and persistence foundation needed to move appropriate Sprint 005 in-memory state behind a clear data boundary without rewriting the accepted presentation flow.

## Scope

- Keep the mobile Supabase configuration public-only and all secrets out of the repository.
- Use one mobile Supabase client/data boundary rather than direct backend calls scattered through screens.
- Keep the User/Profile/ProfileMember/Item/current-interaction backend reproducible through committed migrations.
- Protect profile data with authenticated membership-based authorization.
- Support MVP password authentication with one unique email and one unique nickname linked to the same User.
- Preserve nickname display casing while treating nickname uniqueness and sign-in case-insensitively.
- Support registration, native email confirmation, sign-in with email or nickname and password recovery through the account email.
- Ensure every signed-in User has a PersonalProfile before entering the Room.
- Persist and hydrate the existing generic BOOK/MOVIE interaction state through the data boundary.
- Preserve the accepted Room -> discovery -> Item/swipe presentation semantics.

## Relevant MVP requirements

- `MVP-AUTH-001`
- `MVP-AUTH-002`
- `MVP-PROFILE-001`

## Non-goals

- Google or Apple sign-in; tracked separately in Issue #73.
- Generic Event capture; Sprint 007.
- Prediction V0 or learned ranking; Sprint 008.
- SharedProfile product flows, ratings, rich memories or final content ingestion.
- Final Room art or a visual redesign.

## Issue sequence

1. Schema and authorization foundation — Issue #57 / PR #58.
2. Mobile Supabase client/data boundary — Issue #59 / PR #60.
3. Initial email/password authentication — Issue #61 / PR #62.
4. Nickname and PersonalProfile onboarding — Issue #63 / PR #64.
5. Generic BOOK/MOVIE interaction persistence — Issue #65 / PR #66.
6. Configured CI/APK support — Issue #67 / PR #68.
7. Configured real-project and phone acceptance — Issue #69.
8. Auth/Profile correction and native-link acceptance hardening — Issue #72 / PRs #74, #76, #77, #79, #82, #83 and #84.
9. Android-compatible splash asset and startup sizing increments — PRs #80 and #81.

## Definition of Done

- A user can register with a unique email and unique nickname and confirm the account from the received email.
- The same User can sign in using either email or case-insensitive nickname with the password.
- Unknown identifier, wrong password, duplicate identity and unconfirmed email have deterministic user-facing handling.
- A user can request recovery by email or nickname, set a new password from the received link and then sign in with the new password.
- Every signed-in User has the correct visible nickname and PersonalProfile.
- Schema and corrections are reproducible from committed migrations and protected by reviewed membership-based authorization.
- Generic BOOK/MOVIE current interaction state persists, hydrates and supports the accepted undo flow.
- Canonical validation passes and the complete configured flow passes on a real phone.
- Repository documentation reflects the accepted implementation and the next sprint is explicit.

## Delivered

### Backend and authorization

- Reproducible User, Profile, ProfileMember, generic Item and current Item-interaction schema.
- Separate `actor_user_id` and `profile_id`, integrity constraints, indexes and update timestamps.
- Membership-based row-level authorization with explicit grants.
- Case-insensitive unique nickname identity with preserved display casing.
- Signup-time PersonalProfile provisioning and authenticated fallback completion.
- Twelve stable-ID BOOK/MOVIE seed Items shared by the app and database.

### Mobile data and identity boundary

- One public-only Expo Supabase configuration and one module-scoped persistent-session client.
- Root-scoped authentication and PersonalProfile providers rather than direct backend calls in screens.
- Email + nickname registration and email-or-nickname password sign-in.
- Deterministic identity/error mapping, confirmation resend and password recovery.
- Configured PersonalProfile interaction hydration and ordered persistence while unconfigured builds retain the accepted mock path.

### Native email-link hardening

- Scanner-safe public `auth-callback` hop that carries the token without consuming it.
- Explicit native confirmation and recovery routes, including direct token-path fallbacks for Android launches that reach Expo Router before URL rewriting.
- Mobile-only token verification, an explicit confirmation-success state and a recovery session that remains in memory only.
- Recovery updates the password, clears the temporary session and returns to signed-out login.

### Build support

- Optional public GitHub Actions repository variables configure Supabase without committing project values.
- `main` validates and can build, verify and upload a standalone Android release APK.
- The coloured Kajo PNG was normalized to an Android-compatible format after AAPT2 exposed the incompatible asset.

## Validation evidence

- PR #84's final implementation state passed `npm run check`: lint, TypeScript typecheck, 71 automated tests, and iOS + Android Expo bundle smoke checks.
- The committed migrations, `password-auth` and `auth-callback` functions and native redirect configuration were deployed to the configured Supabase project.
- Hosted evidence showed successful email token verification, password update and subsequent password login. The same account had the expected application User and PersonalProfile records.
- The configured standalone Android APK from merged main commit `3f7d79018d8bbdeacaec01e472e57b8d62d83d0c` passed real-phone acceptance on 2026-08-29:
  - registration -> confirmation email -> confirmation success -> signed-out login,
  - email login and case-insensitive nickname login,
  - not-found, wrong-password, duplicate-account and unconfirmed-email handling,
  - forgot password -> recovery email -> new-password screen -> new-password login,
  - PersonalProfile/Room entry,
  - BOOK and MOVIE interaction commits, exact undo, app restart hydration and sign-out/sign-in persistence.
- A final read-only database check confirmed persisted BOOK and MOVIE interaction rows after the phone flow; the result was not only local mobile state.
- The closing documentation change also passed the canonical `npm run check` gate before merge.

No account email, nickname, user ID, token or project secret is recorded in repository evidence.

## Repository hygiene review

- Static query-based and dynamic token-path auth callback routes are both intentional fallbacks and remain referenced by the native link flow.
- The callback Edge Function intentionally does not verify/consume email tokens; the app remains the single verifier.
- Current interaction snapshots remain the UI hydration state; they are not a duplicate of the append-only Event history beginning in Sprint 007.
- No obsolete auth route, superseded helper, empty feature folder or abandoned implementation was found during closure review.

## Decisions

- Keep Supabase/PostgreSQL/Auth and repository-committed migrations as the backend direction.
- Keep nickname-to-email resolution behind the scoped `password-auth` Edge Function; never expose resolved email or privileged credentials to the client.
- Keep email and nickname as unique identifiers for one User while preserving nickname display casing.
- Keep auth token verification in the native client so scanners and tracking redirects cannot consume the one-time token first.
- Keep generic Event capture out of current-interaction persistence and implement it as append-only evidence in Sprint 007.
- Treat the final auth acceptance as passed even though two non-blocking navigation/branding polish items remain; neither prevents confirmation, recovery or subsequent login.

## Deferred / not done

- Google and Apple authentication — Issue #73.
- Event Engine — Sprint 007.
- Prediction V0 and scenario memory — Sprint 008+.
- SharedProfile product flow, shared discovery and shared memory.
- Rating and rich memory fields.

## Known issues

- After a successful confirmation or recovery flow, tapping `Palaa Kajoon` can return to the email app's previous task instead of foregrounding Kajo login. The auth operation itself succeeds; fix the task/navigation behavior in the next user-facing mobile change.
- The startup Kajo lettering is still smaller than the requested nearly full-screen width. Enlarge the visible logo treatment in the same next user-facing mobile change and recheck Android asset compatibility.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/STATUS.md`
- `/docs/project/sprints/SPRINT-007.md`
- `/apps/mobile/app/auth/confirm.tsx`
- `/apps/mobile/app/auth/confirm/[token].tsx`
- `/apps/mobile/app/auth/recovery.tsx`
- `/apps/mobile/app/auth/recovery/[token].tsx`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/config.toml`
- `/supabase/functions/auth-callback/index.ts`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/supabase/migrations/20260827071000_personal_profile_onboarding.sql`
- `/supabase/migrations/20260827073000_seed_mvp_items.sql`
- `/supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql`
- `/.github/workflows/ci.yml`

## Final handoff

Sprint 006 is accepted and complete. Sprint 007 — Event Engine is active in `SPRINT-007.md`. Start with Issue #85: add the generic append-only Event/session persistence foundation without changing the accepted auth, PersonalProfile or current-interaction behavior. Do not begin Prediction V0 early.
