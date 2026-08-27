# Sprint 006 — Backend Foundation

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-26**

## Goal

Add the smallest real Supabase/PostgreSQL, authentication, identity and persistence foundation needed to move appropriate Sprint 005 in-memory state behind a clear data boundary without rewriting the accepted presentation flow.

## Scope

- Keep the mobile Supabase configuration public-only and all secrets out of the repository.
- Use one mobile Supabase client/data boundary rather than direct backend calls scattered through screens.
- Keep the User/Profile/ProfileMember/Item/current-interaction backend reproducible through committed migrations.
- Protect profile data with authenticated membership-based authorization.
- Support MVP password authentication with one unique email and one unique nickname linked to the same User.
- Preserve nickname display casing while treating nickname uniqueness, sign-in and later search case-insensitively.
- Support registration, native email confirmation, sign-in with email or nickname and password recovery through the account email.
- Ensure every signed-in User has a PersonalProfile before entering the Room.
- Persist and hydrate the existing generic BOOK/MOVIE interaction state through the data boundary.
- Preserve the accepted Room -> discovery -> Item/swipe presentation semantics.
- Add deterministic tests for configuration, auth mapping, identity and persistence behavior where practical.

## Relevant MVP requirements

- `MVP-AUTH-001` — unique email + nickname registration, mobile email confirmation, email-or-nickname password sign-in and password recovery.
- `MVP-AUTH-002` — one visible unique nickname linked to the User identity, with preserved display casing and case-insensitive matching.
- `MVP-PROFILE-001` — every user has a PersonalProfile.

Sprint 006 also provides persistence and authorization foundations for later profile, event and prediction requirements without claiming those later requirements complete.

## Non-goals

- Google or Apple sign-in; tracked separately in Issue #73 after Sprint 006 acceptance.
- Generic Event capture or analytics-quality event contracts; Sprint 007.
- Prediction V0, ranking refresh or learned profile scenarios; Sprint 008.
- SharedProfile product flows or shared Room UI.
- Rating, note, photo, people, location or date memories.
- Final book/movie metadata ingestion.
- Final Room art or visual redesign.
- pgvector or evolutionary prediction machinery.

## Issue sequence

1. Initial User/Profile/ProfileMember/Item/current-interaction migration and authorization foundation — Issue #57 / PR #58.
2. Supabase/Expo dependencies, public configuration contract and one root mobile client/data boundary — Issue #59 / PR #60.
3. Initial email/password authentication session and entry UI — Issue #61 / PR #62.
4. Initial nickname/PersonalProfile onboarding — Issue #63 / PR #64.
5. Persist/hydrate generic Item interaction state — Issue #65 / PR #66.
6. Configured CI/APK support — Issue #67 / PR #68.
7. Configured real-project and phone acceptance — Issue #69.
8. Correct the auth and PersonalProfile failures exposed by the Issue #69 phone test — Issue #72 / PR #74.

Issue #55 closed Sprint 005 and opened this sprint; it did not implement backend code.

## Architecture constraints

- Use Supabase/PostgreSQL/Auth and repository-committed migrations as specified in `docs/architecture/ARCHITECTURE.md`.
- Presentation components must not contain arbitrary direct Supabase calls.
- Nickname-to-email resolution must not be exposed as an unauthenticated mobile/database API. It belongs behind the scoped server-side `password-auth` Edge Function.
- Privileged Supabase secret/service-role credentials may exist only in the hosted server environment; never in the mobile bundle, repository, Issues or chat.
- Preserve generic `Item`, `Profile` and `ProfileMember` terminology and BOOK/MOVIE interaction semantics.
- Keep `actorUserId` and `profileId` conceptually separate so Sprint 007 Events do not require a schema reversal.
- Use row-level authorization based on authenticated profile membership.
- Do not add prediction or event abstractions early under the name of future-proofing.

## Definition of Done

- A user can register with a unique email and unique nickname.
- Confirmation email returns to the native Kajo app instead of localhost/web-only flow.
- The same User can sign in using either email or nickname with the password.
- Unknown identifier and wrong password have the agreed deterministic user-facing messages.
- A user can request password recovery by email or nickname and set a new password from the native recovery link.
- Every signed-in User has the correct visible nickname and PersonalProfile.
- Initial backend schema and every correction are reproducible from committed migrations.
- PersonalProfile data is protected by reviewed membership-based authorization policies.
- Appropriate Sprint 005 Item interaction state persists and hydrates through one clear data boundary.
- Existing accepted discovery/swipe presentation semantics remain intact.
- No direct backend-call sprawl, duplicate state model, empty folder or unused scaffold remains.
- Canonical CI passes for every merged Issue.
- The complete final Sprint 006 path passes on a real phone before sprint close.
- `STATUS.md`, `MVP.md`, `CODEMAP.md` and this sprint file reflect repository truth at close.

## Delivered baseline

### Initial schema and authorization foundation — Issue #57

- committed PostgreSQL schema for canonical User, Profile, ProfileMember, generic BOOK/MOVIE Item and current Item interaction state,
- separate `actor_user_id` and `profile_id`, integrity constraints, indexes and update timestamps,
- RLS on exposed tables with explicit membership-based grants/policies,
- no premature Event or Prediction schema.

### Mobile Supabase client boundary — Issue #59

- package-managed Supabase/Expo dependencies and committed lockfile,
- public-only Expo environment contract,
- deterministic configured/unconfigured states,
- one persistent-session module-scoped Supabase client and root provider,
- no direct Supabase calls spread through presentation screens.

### Initial email/password authentication — Issue #61

- root-scoped persisted auth session/provider,
- first email/password registration/sign-in entry UI,
- hosted confirmation response handling,
- sign-out and deterministic credential-free tests.

This was an implementation increment, not final acceptance. The later real-phone test in Issue #69 demonstrated that the confirmation/deep-link and identifier/error behavior needed correction in Issue #72.

### Initial nickname and PersonalProfile onboarding — Issue #63

- one PersonalProfile owner relation and at-most-one-PersonalProfile-per-User rule,
- authenticated profile RPCs and root profile hydration,
- first nickname onboarding screen and Room nickname display,
- deterministic profile mapping/validation tests.

The original non-unique-display-name assumption was superseded by the product decision recorded during Issue #69 acceptance: nickname is now a unique login identity with case-insensitive matching and preserved display casing. The observed hosted profile-completion failure is corrected in Issue #72 rather than rewriting the already-applied migration.

### PersonalProfile Item interaction persistence — Issue #65

- 12 current generic BOOK/MOVIE Items use stable UUIDs shared by mobile and the seed migration,
- configured PersonalProfile interaction state hydrates/persists through the existing single interaction store,
- current interest/saved/consumed state uses membership-protected persistence without creating Event history early,
- ordered writes, retry feedback and exact-card undo semantics remain intact.

### Configured acceptance build support — Issue #67

- optional GitHub Actions repository variables feed the public Expo Supabase configuration,
- absent variables preserve the unconfigured mock build,
- `main` can build, verify and upload a standalone Android release APK without committing project values.

## Acceptance evidence — Issue #69

One real Supabase project was created, the original three committed migrations were applied successfully, the two public repository variables were configured, and [CI #96](https://github.com/Kajooja/Kajo/actions/runs/33080640204) produced the configured APK from commit `71a33c0b0fb59ea076b691ecdfad69a073743bb8`.

The real-phone test **failed Sprint 006 acceptance** and established these required corrections:

- sign-in must accept either unique email or unique nickname linked to the same User,
- nickname casing such as `KeTTu` must remain visible exactly while `kettu`, `KETTU` etc. match the same identity,
- unknown identifier -> `Käyttäjätunnusta ei löydy.`,
- known identifier + wrong password -> `Salasana on väärin.`,
- duplicate identity -> `Sinulla on jo tili. Unohditko salasanasi?`,
- Supabase confirmation incorrectly returned to `localhost:3000`,
- password recovery through the account email is required,
- PersonalProfile creation failed with `Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.` and blocked the Room.

CI #96 therefore remains evidence of the failing acceptance attempt, not the final Sprint 006 candidate.

## In progress — auth acceptance correction, Issue #72 / PR #74

PR #74 contains the scoped correction only:

- case-insensitive unique nickname index while preserving stored/display casing,
- one server-side `password-auth` Edge Function for email/nickname existence resolution, password sign-in and recovery request without exposing resolved email or privileged keys,
- one follow-up migration rather than editing already-applied migrations,
- signup-time PersonalProfile provisioning plus corrected fallback profile completion,
- native `kajo://auth/confirm` and `kajo://auth/recovery` handling,
- registration availability checks for email and nickname,
- deterministic not-found, wrong-password, duplicate and unconfirmed-email UX,
- in-app new-password flow after recovery,
- deterministic auth, deep-link and profile tests.

PR #74 [CI #99](https://github.com/Kajooja/Kajo/actions/runs/33099264933) passed dependency install, lint, typecheck, tests and iOS/Android bundle smoke at the implementation checkpoint. The latest PR head must also be green after documentation finalization before merge.

## Decisions

- Keep the existing Supabase/PostgreSQL/Auth backend direction.
- Keep the accepted presentation flow and replace state incrementally behind data/auth boundaries.
- Reserve durable generic Event capture for Sprint 007.
- Keep absent mobile configuration as an intentional unconfigured/mock state.
- Keep the Supabase client module-scoped and exposed through root providers rather than constructing clients in screens.
- Email and nickname are both unique identifiers linked to one User; nickname display casing is preserved while matching is case-insensitive.
- Password recovery is part of Sprint 006 because the real-phone auth acceptance demonstrated the requirement.
- Use one server-side identifier auth boundary instead of exposing nickname-to-email lookup to the mobile client.
- Google and Apple sign-in are deferred to Issue #73 after this sprint; do not expand the current fix.
- Never edit already-applied hosted SQL ad hoc; corrections use new committed migrations.

## Deferred / not done

- Google and Apple authentication — Issue #73 after Sprint 006 acceptance.
- SharedProfile membership/product flow, shared discovery and shared memory.
- Event Engine — Sprint 007.
- Prediction and scenario-memory implementation — Sprint 008+.

## Known issues / remaining gate

- PR #74 code is not yet merged.
- The new migration, `password-auth` Edge Function/config and native Auth redirect allowlist have not yet been applied/deployed to the hosted Supabase project.
- No fresh post-fix configured Android APK has been phone-tested.
- Issue #69 and Issue #72 stay open until the corrected complete phone path passes.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/STATUS.md`
- `/apps/mobile/.env.example`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/config.toml`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/supabase/migrations/20260827071000_personal_profile_onboarding.sql`
- `/supabase/migrations/20260827073000_seed_mvp_items.sql`
- `/supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql`
- `/.github/workflows/ci.yml`

## Mid-sprint handoff — 2026-08-27

Issue #69 real-phone acceptance exposed blocking auth/profile defects in CI #96. Issue #72 / draft PR #74 contains the scoped correction. Finish PR #74 review with a green latest CI, merge it, then apply the new migration, deploy `password-auth`, allow `kajo://**` in Supabase Auth redirects, run a fresh configured `main` APK and rerun the complete Issue #69 phone path. Do not close Sprint 006 or begin Sprint 007 until that path passes.
