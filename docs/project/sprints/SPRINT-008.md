# Sprint 008 — Prediction V0

Status: **COMPLETE**
Milestone: **MVP 0.1**
Started: **2026-08-31**
Completed: **2026-08-31**

## Goal

Replace static mock-only ordering with the first real, generic and measurable
personalized ranking owned outside the mobile presentation layer. Prediction V0
uses current Item features, behavioural history, recency and DiscoveryMode to
rank Items for a Profile and returns traceable Predictions whose outcomes can
be evaluated through Sprint 007 Events.

## Scope

- Establish a server-owned Prediction request/response boundary shaped as
  `Profile + Context + DiscoveryMode + candidate scope -> ranked Predictions`.
- Keep Profile as the prediction target and actor authorization separate.
- Produce one traceable `predictionId` per ranked response.
- Use one generic scorer for BOOK and MOVIE candidates.
- Combine inspectable Item similarity/features, explicit behavioural evidence,
  longer-horizon evidence and recency-weighted ShortTermState-style evidence.
- Strongly suppress consumed Items and reflect explicit positive/negative evidence.
- Make `FOR_YOU`, `SURPRISE` and `RISK` measurably change exploration policy.
- Refresh affected rankings after materially relevant behavioural evidence or
  DiscoveryMode changes without requiring model training after every tap.
- Preserve an unconfigured/local fallback without describing it as Prediction V0.
- Carry returned `predictionId` through existing impression/action Events.

## Relevant MVP requirements

Completed in this sprint:

- `MVP-PRED-001..003`
- `MVP-DISC-005`, `MVP-DISC-007`
- `MVP-SWIPE-002..005`
- `MVP-MEM-003`

## Non-goals

- ScenarioMemory or vector retrieval (`MVP-PRED-004`, Sprint 011).
- Evolutionary optimization or model training.
- Separate BOOK/MOVIE user models or predictors.
- SharedProfile product UI.
- Search or dwell measurement.
- Final external book/movie provider selection.
- Recommendation logic in mobile presentation components.

## Delivered

- Issue #95 established authenticated `public.rank_items_v0` as the smallest
  real server-owned V0 boundary with Profile authorization, one response-level
  `predictionId`, deterministic scoring and BOOK/MOVIE-generic output.
- Hosted rollback smokes verified deterministic order, separate DiscoveryMode
  semantics, consumed suppression, least-privilege grants and unrelated-User denial.
- Issue #98 connected configured mobile discovery to hosted Prediction V0 through
  one typed data boundary with stale-response protection, controlled refresh and
  explicit local fallback.
- Issue #100 added one persistent global DiscoveryMode curtain in the authenticated
  app shell and removed duplicated screen-local mode state/control.
- Issue #101 replaced ambiguous binary reactions with canonical 0–10 rating,
  not-interested and save semantics. Rating implies consumed; not-interested does
  not; save stays orthogonal; exact undo remains intact.
- PR #109 taught Prediction V0 to consume rating magnitude and not-interested
  evidence while retaining legacy event readability and undo compensation.
- Issue #103 / PR #110 expanded the normalized MVP catalog to 12 BOOK + 12 MOVIE
  candidates, added a decaying 30-minute impression cooldown for unreacted Items
  and a stronger immediate queue penalty for explicit reactions.
- Hosted Supabase is on Prediction `v0.3`; deployed migrations and function
  definition were verified after merge.
- Security/performance advisor checks were reviewed after backend changes. No new
  Prediction-specific security warning was introduced; remaining pre-existing
  advisor debt is tracked outside this sprint.
- Configured standalone Android acceptance passed after PR #110. The user verified
  that the app works as intended with the broader catalog, queue rotation,
  feedback behavior and DiscoveryMode-aware Prediction flow.

## Decisions

- Mobile consumes prediction results; it does not own Prediction V0 scoring.
- Prediction remains generic and targets Profile, never separate media-specific
  taste profiles.
- A prediction identifier is evaluation correlation, not merely a UI render ID.
- Every integer rating from 0 through 10 implies consumed.
- A mere impression is temporary queue evidence, not a permanent rejection.
- Explicit reaction state rotates an Item out more strongly; consumed state
  remains the strongest suppression in Prediction V0.
- Sparse evidence may legitimately make mode orderings converge. The UI must
  never fake ranking differences.
- Prediction V0 uses a `SECURITY INVOKER` Postgres RPC while the data/model are
  small; transport may change later without changing the conceptual contract.

## Validation

- PR CI passed lint, TypeScript, tests and iOS/Android bundle smoke checks.
- Hosted scorer/migrations were verified after merge.
- Hosted normalized candidate counts were verified as 12 BOOK and 12 MOVIE.
- Prediction function reports `prediction-v0.3` with impression cooldown and
  reaction queue penalty enabled.
- Configured standalone Android acceptance passed on 2026-08-31.

## Deferred / not done

- Saved/Consumed persistent navigation remains Sprint 010 (#102).
- SharedProfile persistence, shared discovery and shared Room identity begin in Sprint 009.
- ScenarioMemory, population learning and evolutionary optimization remain later.
- Final external Item metadata providers remain undecided.

## Known issues

- Current normalized MVP Item features remain intentionally small/mock-backed and
  are not final provider metadata.
- Cold-start behavior still needs a prior because behavioural evidence starts sparse.
- Supabase exposes pre-existing security-hardening warnings unrelated to Prediction V0;
  they must be handled in a separately scoped security/hygiene task.

## Important files

- `/docs/product/MVP.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/STATUS.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/`

## Final handoff

Sprint 008 is accepted and complete. Prediction V0 is hosted, generic,
Profile-targeted, mode-aware and feedback-aware, with temporary impression cooldown
and traceable Events. The next roadmap sprint is **Sprint 009 — Shared Kajo**.
Start with persistent SharedProfile/member foundations and Profile-context switching;
do not jump ahead to ScenarioMemory or broad social/feed features.
