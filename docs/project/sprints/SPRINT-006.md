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
2. Package-manager-installed Supabase/Expo dependencies, public configuration contract and one root mobile client/data boundary.
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

## Decisions

- Follow the existing Supabase/PostgreSQL/Auth direction; this sprint does not reopen the backend choice.
- Replace in-memory behavior incrementally behind a data boundary so the accepted presentation flow remains stable.
- Reserve durable generic Event capture for Sprint 007 instead of treating persisted current state as an event engine.

## Deferred / not done

- SharedProfile membership product flow, shared discovery and shared memory remain later roadmap scope.
- Prediction semantics and continuous scenario updates remain Sprint 007–008 work.

## Known issues

- End-to-end backend validation needs a configured Supabase project and public mobile client values.
- Authentication method mix and nickname/username uniqueness policy require the smallest implementation decision that satisfies the MVP requirements.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/STATUS.md`
- `/apps/mobile/src/domain/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/.github/workflows/ci.yml`

## Final handoff

After Issue #57 passes canonical CI and merges, open the next scoped Issue for package-manager-installed Supabase/Expo dependencies, the public configuration contract and one root mobile client/data boundary. Do not begin authentication UI or interaction-state integration in that PR.
