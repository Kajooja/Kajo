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

The planning delivery is tracked by Issue #215 / PR #216. Once merged, `main` is the authoritative truth; while the PR is open, treat the PR as pending planning rather than delivered runtime behavior. The documentation does not claim Taste/Friend runtime implementation exists yet.

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

Continue **Issue #208 / PR #219**, branch
`test/208-export-install-diagnostic`. PR #217 (`42d605a`) and PR #218
(`2d1b0d5`) are accepted and merged; #219 remains a proposal on top of main.
The earlier upload corruption was repaired, and subsequent published blobs/trees
were checked against their intended contents. ROADMAP order remains
**14.0 clean installation → 14.1 evidence → 14.2 serving/shadow/candidates**.

**The two real clean installations now PASS.** [CI #388](https://github.com/Kajooja/Kajo/actions/runs/34366985506)
at `0c9a4808ca79fb5e145c97ab96c1d0b8bada706a` passed validation, platform/default
checks and both independently committed application installations. Each had
30 tables, 122 application functions and 22 application/Auth triggers; schema,
owners/direct ACLs, deterministic seeds and runtime checks matched the separate
source reference and each other. Auth provisioning, Personal bootstrap ranking,
Shared common-fit/privacy/denial, 5000-row import/correction/removal, future
function grants, reinstall refusal, rollback and cleanup passed. Native functions,
roles and callbacks stayed unchanged. ADR-0006 records exact image/report hashes.

CI #387's expected reinstall error had been masked by Docker stdin EPIPE. The
shared SQL transport now buffers input before psql starts and deletes its private
temporary file on exit. Both CI and Mac use the correction. The full local
`npm run check` and CI #388 passed 191 mobile + 14 catalog + 50 database tests,
TypeScript, lint (zero errors; one existing DiscoveryScreen Hook warning), and
iOS/Android bundles.

**The independent populated-application upgrade and rollback now PASS.**
[CI #390](https://github.com/Kajooja/Kajo/actions/runs/34371882375) at
`7507d3501d08b38478250e5437c0dd08892d9cb6` passed validation, platform/defaults,
both application installations and the separate upgrade job. The source-checkpoint
fixture committed Auth/Profile/membership, native/imported evidence, predictions,
shadow jobs, Lists and seeds before applying only the ordinary forward migration.
All complete row hashes, 221 existing application/native functions, table/trigger
metadata and unrelated defaults stayed unchanged. Old-to-new function defaults,
runtime, exact rollback, reapplication and cleanup passed. The report was downloaded
and its ZIP/report hashes verified. Do not repeat this completed upgrade discovery.

The optional unchanged-export variant separately passed in PGlite with all 123
original application functions and populated row hashes preserved, without the
function/compatibility supplement. It restores pg_dump's client row_security
setting to ON before authenticated runtime checks. ADR-0006 records both scopes,
commands, source identities and final report hashes. The invalid synthetic import
fingerprint caught in CI #389 was corrected; all four upgrade regressions and the
full `npm run check` passed (191 mobile + 14 catalog + 54 database = 259 tests,
TypeScript/lint and both bundles).

**The proposed CLI installation lineage and atomic history now PASS.** The
`database-cli-installation` job generates only a source baseline at the protected
cutoff plus unchanged post-cutoff migrations inside its own disposable workspace.
It invokes pinned Supabase `db reset --local --no-seed` twice, compares source
schema/ACL/seeds and runtime, and checks the CLI's actual version/name history.
An intentionally failing extra test migration must leave neither its table nor
an applied-history row. This is test-only: the repository's canonical migrations
and existing hosted history stay intact. The actual CLI job in CI #391 passed:
its two successful resets matched the source snapshot, and the deliberate failing
migration left neither DDL nor a history row. The report was downloaded and
verified; ADR-0006 records its identifiers. Do not repeat the completed CLI proof.

CI #391 as a whole was not green: the separate upgrade job received the identical
Postgres image from ghcr.io instead of public.ecr.aws. The strict reference-string
check stopped before application SQL, despite the exact same pinned content ID.
The corrected check accepts only those two observed Supabase references, the same
17.6.1.167 tag and the exact reviewed image ID. Changed content/version/registry
still fails; the added regression and full check passed 260 tests (55 database)
and both bundles. Verify its complete CI rerun before merging.

After that, review adoption of the explicit fresh-install lineage in ADR-0006.
Issue #208 currently requires successful unmodified chronological replay; that
literal criterion remains unsatisfied. The tested source baseline is an explicit
alternative, not evidence that the original chain passed. Keep #208/MVP-ALG-009
open until the acceptance/installation procedure is explicitly resolved. PR #219
is still open; its test results are not accepted main truth.

Completed reviews must not be restarted:

- The exact owner export (SHA-256
  `3f29a88a8937f38fd2014b3c8b8c4e2f9a46a0ee49b71bec680b5cdad7170c3e`)
  loaded unchanged twice in PGlite; all 123 exported function definitions,
  owners and direct ACLs matched the earlier read-only hosted snapshot.
  Keep it as the supplied diagnostic input; do not request another export or
  promote it to canonical DDL.
- Protected history/source reconstruction proves all 30 table structures,
  205 constraints, 112 indexes and 19 RLS policies. All 21 application triggers
  match; the omitted Auth trigger is reconstructed separately.
- All 26 function differences have reviewed resolutions in the proposed
  122-function source supplement. Compatibility grants explicitly preserve
  existing service_role rights on 12 named tables and 18 named public functions.
  Reviewed table/function owner/direct ACL comparisons match.
- CI #385's pinned platform report was downloaded and compared with hosted
  catalogs. Fresh Supabase lacks private schema and the hosted ensure_rls helper.
  Candidate RLS is explicit source DDL. Six native callback function hashes
  differ from hosted; native callbacks/roles remain intact and no semantic
  equality is inferred. Schema/direct/default-grant differences and provenance
  are documented in ADR-0006.
- System seeds are source-derived, checksum checked and deterministic:
  four genomes, four promotion decisions and one initial GLOBAL assignment.

Forward migration `20260909131913_close_postgres_function_defaults.sql` closes
future postgres-created function grants globally and clears public/private
additions. Existing functions and other creators' defaults are preserved. Its
global scope also affects future postgres-created platform/extension functions,
which need their own intended grants. It is **not applied hosted**.

The owner previously passed the original Personal/Auth rollback probe on Mac
arm64 (Supabase CLI 2.117.0, Postgres 17.6.1.167). The expanded Mac report remains
unrun; CI now provides the repeated Linux x64 installation proof, so do not block
that completed gate on another manual Mac run. Neither SQL checks nor bundles
establish HTTP Auth, device acceptance or recommendation quality.

Historical migration bytes and hosted schema/data/history remain unchanged.
Unmodified chronological replay still fails after 33 migrations at the known
catalog patch; the raw export diagnostic still reports
`REQUIRES_RECONCILIATION`, with separate reviewed resolutions. #208 and
MVP-ALG-009 stay open until upgrade evidence and a separately reviewed canonical
installer/history transition and rollback procedure satisfy ADR-0006. Do not
reset hosted main, repair tracking or treat the proposed installer as accepted.

Continue the existing Sprint 014 algorithm/database path from the current #207/#208 lineage:

1. Finish clean-install database/replay strategy and schema parity work.
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
