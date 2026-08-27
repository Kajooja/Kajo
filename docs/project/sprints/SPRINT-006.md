# Sprint 006 — Backend Foundation

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-26**

## Goal

Add the smallest real Supabase/PostgreSQL, authentication, identity and persistence foundation needed to move appropriate Sprint 005 in-memory state behind a clear data boundary without rewriting the accepted presentation flow.

## Scope

- Document the required non-secret mobile configuration contract and keep all secrets out of the repository.
- Add one mobile Supabase client/data boundary used by services or providers rather than direct calls scattered through screens.
- Commit real PostgreSQL migrations for the initial User/Profile/ProfileMember/Item and interaction-persistence foundation.
- Add authorization/RLS foundations that scope personal data to authenticated membership.
- Implement at least one lightweight/common register/sign-in path.
- Associate each signed-in User with a user-visible nickname/username and PersonalProfile.
- Persist and hydrate the appropriate existing generic BOOK/MOVIE interaction state through the new boundary.
- Preserve the accepted Room -> discovery -> Item/swipe presentation semantics.
- Add deterministic tests for configuration, mapping and persistence behavior where practical.

## Relevant MVP requirements

- `MVP-AUTH-001` — lightweight/common register/sign-in.
- `MVP-AUTH-002` — user-visible nickname/username.
- `MVP-PROFILE-001` — every user has a PersonalProfile.

Sprint 006 also provides persistence and authorization foundations for later profile, event and prediction requirements without claiming those later requirements complete.

## Non-goals

- Generic Event capture or analytics-quality event contracts; Sprint 007.
- Prediction V0, ranking refresh or learned profile scenarios; Sprint 008.
- SharedProfile product flows or shared Room UI.
- Rating, note, photo, people, location or date memories.
- Final book/movie metadata ingestion.
- Final Room art or visual redesign.
- pgvector or evolutionary prediction machinery.

## Planned Issues

Implement in this order, one scoped Issue/branch/PR at a time:

1. Initial User/Profile/ProfileMember/Item/current-interaction migration and authorization foundation — Issue #57.
2. Package-manager-installed Supabase/Expo dependencies, public configuration contract and one root mobile client/data boundary — Issue #59.
3. Authentication session plus register/sign-in UI with no provider sprawl.
4. Nickname/username onboarding and automatic PersonalProfile membership.
5. Persist/hydrate the existing generic Item interaction state through the boundary.
6. Reconcile the sprint against its Definition of Done and run one meaningful user-facing acceptance checkpoint.

Issue #55 closes Sprint 005 and opens this sprint; it does not implement backend code.

## Architecture constraints

- Use Supabase/PostgreSQL/Auth and repository-committed migrations as specified in `docs/architecture/ARCHITECTURE.md`.
- Presentation components must not contain arbitrary direct Supabase calls.
- Preserve generic `Item`, `Profile` and `ProfileMember` terminology and BOOK/MOVIE interaction semantics.
- Keep `actorUserId` and `profileId` conceptually separate so Sprint 007 Events do not require a schema reversal.
- Use row-level authorization based on authenticated profile membership.
- Add no secret values to source, examples, logs or CI.
- Create `apps/mobile/src/data/` and `supabase/migrations/` only when the first Issue adds real used implementation there.
- Do not add prediction or event abstractions early under the name of future-proofing.

## Definition of Done

- A user can register and sign in through at least one lightweight/common method.
- Every signed-in User has a visible nickname/username and PersonalProfile.
- Initial backend schema is reproducible from committed migrations.
- Personal Profile data is protected by tested/reviewed membership-based authorization policies.
- Appropriate Sprint 005 Item interaction state persists and hydrates through one clear data boundary.
- Existing accepted discovery/swipe presentation semantics remain intact.
- No direct backend-call sprawl, duplicate state model, empty folder or unused scaffold remains.
- Canonical CI passes for every merged Issue.
- A meaningful final Sprint 006 user-facing path is validated on a phone/emulator before sprint close.
- `STATUS.md`, `MVP.md`, `CODEMAP.md` and this sprint file reflect repository truth at close.

## Delivered

### Initial schema and authorization foundation — Issue #57

- one committed PostgreSQL migration for canonical User, Profile, ProfileMember, generic BOOK/MOVIE Item and current Item interaction state,
- separate `actor_user_id` and `profile_id` in persisted interaction state,
- integrity constraints, relationship/policy indexes and database-maintained update timestamps,
- RLS on every exposed table,
- default client grants revoked and only increment-required authenticated operations granted back,
- explicit own-User, Profile-membership, authenticated-Item and membership-scoped interaction policies,
- no Event/prediction schema, mobile client scaffold, secret or empty backend folder.

### Mobile Supabase client boundary — Issue #59

- package-manager-installed `@supabase/supabase-js`, `expo-sqlite` and React Native URL polyfill with a committed lockfile,
- placeholder-only public Expo environment contract for project URL and publishable key,
- deterministic unconfigured, invalid and configured states without logging configuration values,
- no client creation when configuration is absent or invalid,
- one module-scoped Supabase client with SQLite-backed persistent session storage when configuration is valid,
- one root provider boundary; presentation screens remain free of direct Supabase calls,
- deterministic tests for missing, partial, invalid and valid configuration plus single client creation,
- no auth UI, profile onboarding or Item-interaction persistence in this increment.

### Email/password authentication entry — Issue #61

- one root-scoped authentication provider restores the persisted Supabase session and tracks subsequent auth changes,
- one calm email/password screen supports registration and sign-in without OAuth, magic-link or reset-password sprawl,
- registration handles both an immediate session and the hosted email-confirmation response,
- authenticated users can sign out from the Room through the provider boundary,
- invalid configuration has a deterministic non-secret error state while unconfigured builds preserve the accepted mock flow,
- auth input normalization, validation, provider-operation selection, confirmation handling, error mapping and sign-out have deterministic credential-free tests,
- no nickname/PersonalProfile onboarding, interaction persistence, Event or Prediction work is included.

### Nickname and PersonalProfile onboarding — Issue #63

- nickname is a visible display name rather than a globally unique MVP handle,
- one database owner relation and partial unique index enforce at most one PersonalProfile per User,
- authenticated RPCs read or atomically reconcile the User, PersonalProfile and ProfileMember identity without client insert grants,
- the root profile provider binds hydrated identity to the authenticated `userId` so account changes cannot expose stale profile state,
- configured signed-in users with missing identity receive one nickname onboarding step before entering the Room,
- the accepted unconfigured mock flow remains unchanged and the hydrated nickname is visible in the Room,
- deterministic tests cover nickname normalization/bounds, RPC selection, response mapping, missing identity and non-secret failure handling,
- no interaction persistence, Event, Prediction or SharedProfile product flow is included.

### PersonalProfile Item interaction persistence — Issue #65

- the 12 current generic BOOK/MOVIE MVP Items use stable UUIDs shared by the mobile mock adapter and a committed seed migration,
- the existing single interaction store remains local for intentionally unconfigured builds and hydrates current PersonalProfile state when configured,
- `interest`, `saved` and `consumed` changes use the existing membership-protected current-state table without creating an Event model early,
- meaningful state upserts while a fully default state deletes its row,
- configured writes are serialized, optimistic state is retained on failure and a non-secret retry path always targets the newest Item state,
- hydration finishes before configured users enter the accepted Room/discovery flow,
- undo retains the accepted in-session 10-action/exact-card semantics and persists the restored current state,
- deterministic tests cover row mapping, malformed hydration, upsert/delete selection and write ordering,
- no Prediction, durable Event history or SharedProfile product flow is included.

### Configured acceptance build — Issue #67

- CI and standalone APK jobs map two optional GitHub Actions repository variables to the existing public Expo Supabase configuration contract,
- absent variables preserve the accepted unconfigured mock build,
- no project URL, key, token, password or other environment-specific value is committed,
- the exact external handoff is: create one Supabase project, apply the three migrations in timestamp order, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as repository variables, then run the final configured workflow and phone acceptance,
- no application feature, schema, Event or Prediction scope is added.

### Configured project and CI #96 checkpoint — Issue #69

- one real Supabase project was created and all three committed migrations were applied successfully in timestamp order (user-confirmed),
- the two documented public GitHub Actions repository variables were set without recording their values,
- manual `main` workflow [CI #96](https://github.com/Kajooja/Kajo/actions/runs/33080640204) passed validation, release APK assembly, embedded-bundle verification and artifact upload,
- accepted build candidate commit: `71a33c0b0fb59ea076b691ecdfad69a073743bb8`,
- artifact: `kajo-android-standalone-71a33c0b0fb59ea076b691ecdfad69a073743bb8`,
- digest: `sha256:b0de89fd08a3618afa5c22473e03d476e84e723faf3ac7a22d3a232da4c66d6c`,
- artifact expiry: 2026-09-03,
- real-phone acceptance remains pending, so the sprint and its three active MVP requirements remain open.

## Decisions

- Follow the existing Supabase/PostgreSQL/Auth direction; this sprint does not reopen the backend choice.
- Replace in-memory behavior incrementally behind a data boundary so the accepted presentation flow remains stable.
- Reserve durable generic Event capture for Sprint 007 instead of treating persisted current state as an event engine.
- Treat absent mobile configuration as an intentional unconfigured state so the accepted mock flow remains runnable until a real project is connected.
- Keep the Supabase client module-scoped and expose it through one root provider rather than constructing clients or calling Supabase in screens.
- Use email/password as the one Sprint 006 MVP authentication method; defer additional providers and account-recovery flows until a demonstrated product need.
- Treat nickname as a non-unique display name in MVP 0.1 while enforcing unique PersonalProfile ownership per User.
- Create User, PersonalProfile and ProfileMember identity atomically through a least-privilege authenticated RPC rather than three client-side inserts.

## Deferred / not done

- SharedProfile membership product flow, shared discovery and shared memory remain later roadmap scope.
- Prediction semantics and continuous scenario updates remain Sprint 007–008 work.

## Known issues

- The configured CI #96 APK has not yet passed the Issue #69 real-phone acceptance path.
- The CI #96 artifact expires on 2026-09-03 and must be downloaded before then.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/STATUS.md`
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

## Mid-sprint handoff — 2026-08-27

Project creation, all three migrations, the two public repository variables and configured [CI #96](https://github.com/Kajooja/Kajo/actions/runs/33080640204) are complete. Download its identified APK artifact before 2026-09-03, install it on a real phone and execute every acceptance step in Issue #69. Record exact pass evidence or exact reproduction evidence. Do not close Sprint 006, mark `MVP-AUTH-001`, `MVP-AUTH-002` or `MVP-PROFILE-001` complete, or begin Sprint 007 until that phone path passes.
