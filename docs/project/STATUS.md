# Kajo Current Status

Last updated: **2026-09-09**
Current milestone: **MVP 0.1 — first public Kajo**  
Current sprint: **Sprint 014 — algorithm reliability / real catalog foundation**  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file is the authoritative current-state handoff. `ROADMAP.md` owns dependency order; `MVP.md` owns release blockers; `LAUNCH_LOOP.md` owns the Taste-first acquisition flow.

## New product truth — 2026-09-07 / #215 / #216

The first public Kajo must ship as a complete acquisition + recommendation system, not only as an installable recommender.

Canonical public loop:

```text
Taste/Friend link
→ anonymous Taste Test
→ first useful PersonalProfile
→ honest held-out prediction challenge
→ small unseen recommendation preview
→ Google/Apple conversion with taste preserved
→ full Kajo
→ personal Friend invite
→ accepted Friendship
→ explicit Friends → SharedProfile creation
→ joint recommendation
→ next invite
```

Important social decision:

- a personal invite does **not** create a SharedProfile automatically,
- successful invite acceptance creates a reciprocal `Friendship`,
- the Friend appears in Friends,
- SharedProfile is created explicitly from one or more Friends through normal consent/membership rules,
- Friendship grants no access to private PersonalProfile evidence.

Scale principle: **design contracts for one million users; provision infrastructure for measured demand.** No speculative Kafka/Kubernetes/graph-database/microservice requirement is introduced.

Canonical documents for this decision:

- `docs/product/LAUNCH_LOOP.md`
- `docs/product/MVP.md`
- `docs/project/ROADMAP.md`
- `docs/product/PRODUCT.md`
- `docs/architecture/decisions/0007-taste-first-acquisition-identity-social-boundaries.md`

The planning delivery from Issue #215 / PR #216 is merged on `main`. Taste/Friend runtime implementation remains planned; accepted documentation is not runtime acceptance.

## Current implementation truth

Already accepted/materially delivered foundations include:

- illustrated 2D Room and global `DiscoveryMode`,
- BOOK/MOVIE discovery/detail/swipe/rating/not-interest/save/undo foundations,
- PersonalProfile + consent-based SharedProfiles,
- Endorsement consensus, named Lists and Profile messaging foundations,
- generic server-owned Prediction V0/V1 path,
- WorkingState/ShortTermState/LongTermState/ScenarioMemory architecture,
- versioned PredictionRun/candidate traces,
- PredictorGenome/SleepLayer controlled-evolution foundations,
- provider-backed Item catalog architecture,
- PersonalProfile history import foundations,
- bounded no-import real-catalog calibration foundation,
- SharedProfile common-fit v1.1.

Current catalog truth from the latest verified checkpoint remains:

- BOOK: 415 discoverable, 385 with image, descriptions incomplete,
- MOVIE: 30 discoverable at that checkpoint, poster/description expansion still required.

Do not treat these numbers as permanent; re-query hosted truth when catalog work resumes.

## Exact continuation order

The new launch work **does not jump ahead of current algorithm correctness**.

### Next task now

**PR #219's database verification work is complete.** The remaining Phase 14.0
work is adoption and operational wiring of the tested fresh-install procedure,
not another round of export, fingerprint, platform or upgrade discovery.

[PR #219](https://github.com/Kajooja/Kajo/pull/219) is merged on `main` as
`0b2e8d76d453890689023e60493d04fe134262cb`. Continue from current `main`;
its old feature branch is historical. PR #217 (`42d605a`) and #218 (`2d1b0d5`)
are also merged. Do not create another documentation commit merely to record
this audit's own merge SHA or CI number; GitHub owns those changing fields.

Completed evidence (full provenance and report hashes are in
[ADR-0006](../architecture/decisions/0006-clean-install-database-baseline.md)):

| Verification | Result |
| --- | --- |
| Two independent pinned Supabase application installations | PASS: 30 tables, 122 application functions, 22 application/Auth triggers, exact schema/owners/ACLs/seeds, Auth/Personal/Shared/import runtime, reinstall refusal and cleanup |
| Populated existing-application forward upgrade | PASS: complete synthetic row hashes and all 221 existing application/native functions preserved through migration, rollback and reapplication |
| Unchanged owner-export upgrade in PGlite | PASS: all 123 original application functions preserved without the source function/compatibility supplement |
| Actual Supabase CLI fresh lineage | PASS: two resets, exact version/name history, source parity and failed-migration atomicity |
| Canonical automated check | PASS: 191 mobile + 14 catalog + 55 database tests (260 total), TypeScript, lint with zero errors/one existing Hook warning, iOS/Android bundles |

The final PR #219 head passed all five required jobs in
[CI #394](https://github.com/Kajooja/Kajo/actions/runs/34382607596).
Main [CI #395](https://github.com/Kajooja/Kajo/actions/runs/34383277848) first
failed during isolated Supabase stack startup; the one requested rerun passed
all five required checks. The original startup cause is unproven because the
old log withheld its detail. The [2026-09-09 retro](retros/2026-09-09.md) records
this distinction and the audit corrections. APK/device acceptance is separate;
a main-triggered APK build is not the next product work item to poll.

### Repository audit and blocked cleanup — #220

The retrospective reconciles current code, release requirements and historical
ideas. The [144-branch retirement manifest](retros/2026-09-09-branches.json)
contains 23 main ancestors, 118 exact merged PR heads and three individually
reviewed superseded drafts. No missing accepted feature needs an old branch
merged wholesale.

No remote refs were deleted. Automatic approval review blocked the bulk deletion
pending explicit owner confirmation of the exact 144-branch scope. Issue #220
retains that cleanup gate; it does not replace the product continuation below.
Recheck recorded tips/PR state before any approved deletion and preserve any new
work. No deletion workflow is installed on `main`.

### Remaining decision and exact next implementation

[Issue #208](https://github.com/Kajooja/Kajo/issues/208) explicitly requires
successful **unmodified chronological replay**. That chain still fails after 33
migrations at the catalog text patch. The tested alternative is a separate
source-derived baseline at cutoff `20260907155201`, followed by unchanged newer
migrations. Green baseline tests do not satisfy the issue's current literal
criterion. **#208, #207 and MVP-ALG-009 remain open.**

The concrete adoption proposal is recorded at the top of ADR-0006. Resolve that
acceptance/installation-procedure decision explicitly before activating a
canonical installer or changing #208's criterion. After adoption:

1. Wire the already-tested baseline builder and unchanged post-cutoff migrations
   into the agreed empty-database installation workspace, with source/image
   preflight checks, empty-database refusal, CLI history verification and cleanup.
   Reuse the existing implementation; do not rebuild the reconciliation pipeline.
2. Record the separate existing-database forward-deployment/rollback procedure.
   Preserve the 47 protected historical files and existing hosted tracking; the
   fresh baseline must never be applied to an existing database. Known hosted
   version/name differences still require their own reviewed procedure.
3. Validate only the new operational path and remaining bootstrap acceptance,
   then continue ROADMAP **14.0 → 14.1 evidence → 14.2 serving/shadow/candidates**.

The verified baseline, source/function/ACL reconciliation, platform ledger, two
installations, populated upgrade and CLI experiment are completed evidence. Do
not request another copy of the owner's export or a repeat Mac probe to reopen
those gates. Normal validation still applies when implementation changes.

Forward migration `20260909131913_close_postgres_function_defaults.sql` is present
as repository source and has **not been applied hosted**. It changes only future
postgres-created function grants; its global scope includes future platform
functions, which need explicit intended grants. Existing functions/other creators
are preserved. The actual deployment must capture its own prior defaults for
rollback instead of blindly reusing synthetic-fixture rollback SQL.

Hosted schema/data/history and the 47 protected migration files are unchanged.
Native platform callbacks remain intact; differing hosted/native callback hashes
are not a claim of semantic equality. SQL checks and bundles do not establish
HTTP Auth, real-device acceptance or recommendation quality. No new MVP
requirement or Sprint 014 acceptance is closed by this verification delivery.

Continue the existing Sprint 014 algorithm/database path from the current #207/#208 lineage:

1. Resolve fresh-install adoption and operational wiring; source/schema parity evidence is already complete.
2. Close bootstrap ranking correctness/regression gates.
3. Continue `ROADMAP.md` Phase 14 in order: evidence reliability → serving/shadow parity → catalog/features → adaptive memory/policy → operating SleepLayer.

Do not start public Taste-link implementation before these foundations are sufficiently stable for a trustworthy first-session algorithm.

### After Phase 14

Implement the new release path in this exact sequence:

1. **Phase 15.0** adaptive Taste Test + honest holdout prediction challenge.
2. **Phase 15.1** anonymous identity + web/app link continuation + Google/Apple conversion.
3. **Phase 15.2** recommendation preview + measurable conversion funnel.
4. **Phase 16.0** personal Friend invite.
5. **Phase 16.1** Friends surface + remove/block/abuse lifecycle.
6. **Phase 16.2** explicit Friends → SharedProfile creation.
7. **Phase 17** core UX, funnel telemetry, privacy/operations.
8. **Phase 18** closed external beta of the complete link-to-app loop.
9. **Phase 19** production/store release candidate.
10. **Phase 20 Share Link Gate**.

Only when Phase 20 passes may an agent answer:

> **Nyt on aika jakaa käyttäjille linkki.**

## Algorithm bar

The owner explicitly wants the algorithm driven toward the strongest reasonable first-release version rather than leaving known critical quality gaps for “later”. Therefore:

- do not defer known correctness/evidence/cold-start defects merely because the UI works,
- transparent baseline + tests come before opaque complexity,
- learned/complex additions are welcome only when they measurably improve the defined outcomes,
- honest insufficiency of evidence is acceptable; fabricated confidence is not,
- Taste Test must use the same trustworthy production feature/ranking concepts rather than a disconnected marketing quiz,
- SleepLayer/evolution remains evidence-gated and reversible.

## Distant vision remains preserved

`FUTURE_PLAN.md` remains the permanent backlog for:

- series,
- music albums,
- Helsinki-first events/things to do,
- broader activities/restaurants/travel,
- richer experience memory,
- stronger post-MVP friend/group learning,
- optional friend-review feed,
- local/global discovery,
- PopulationMemory / more advanced evolutionary learning,
- later consented people discovery,
- possible friendship/dating compatibility research,
- distributed/on-device research ideas.

These are not deleted. They are deliberately behind the first-release march order.

## Handoff for a new conversation

When the owner says **“jatketaan reposta”**:

1. sync/inspect current branch/PR/Issue handoff according to `AGENTS.md`,
2. read `STATUS.md`, `MVP.md`, active Sprint 014 file and `ROADMAP.md`,
3. continue the exact current Phase 14 task,
4. do not skip ahead to Taste/Friend implementation until Phase 14 dependencies are accepted,
5. once launch-loop implementation begins, read `LAUNCH_LOOP.md` + ADR-0007 before coding,
6. update STATUS at meaningful handoff points so no chat-only context is required.

APK/device tests may be performed at sensible user-facing checkpoints. Do not sit polling build completion unless the owner explicitly asks.
