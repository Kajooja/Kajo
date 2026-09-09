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

Audit correction: STATUS was corrupted during the `87fd3f8` API upload and is now
restored from the verified `61d1974` local content. The #219 follow-up fixes that
upload, removes CI's dependency on a conversation attachment and checks seed hashes
instead of merely reporting them. Export/source comparison now proves all 21
application-table trigger definitions and enabled states; Auth is the separate
22nd trigger. Full schema/platform/upgrade acceptance remains open. The earlier
chat-only proposal to jump straight to candidate pagination does not override
ROADMAP's 14.0 → 14.1 → 14.2 dependency order.

PR #217 is accepted and merged at `42d605a`; CI #371 passed. PR #212 and planning
PR #216 are also merged; older open-PR statements are historical checkpoints.
PR #218 is also accepted and merged at `2d1b0d5`; CI #373 passed.
Current follow-up: `test/208-export-install-diagnostic`, based on `2d1b0d5`.
Continue its PR if open; if merged, proceed with the clean-install supplements
below rather than repeating completed fingerprint checks.

Read-only 2026-09-07 verification: hosted PostgreSQL 17.6 exposes 123 public/private
function/procedure fingerprints. The four functions defined in the latest bootstrap
migration match repository fixture definitions, owners and direct ACLs exactly.
The new comparator detects body/configuration/ownership/permission/missing-function
drift; usage and scope are in ADR-0006. No hosted schema/history changed.

Read-only 2026-09-08 follow-up also verified the complete reconstructed
`private.rank_items_v1_internal` definition, owner and ACL against hosted truth.
All five checked functions match, including the V1 policy/trace implementation;
this is definition parity, not execution/quality or complete schema acceptance.

The owner now has Docker Desktop 4.90.0 / Engine 29.7.2 on macOS arm64, Node
22.20.0 and npm 11.6.1. Supabase CLI 2.117.0 was selected for the export workflow.
The supplied `kajo-schema.sql` is available as the conversation attachment
(SHA-256 `3f29a88a8937f38fd2014b3c8b8c4e2f9a46a0ee49b71bec680b5cdad7170c3e`).
Do not request another export or commit this unreviewed hosted DDL as canonical.

The complete unchanged export loaded into two independent PGlite 0.3.14 databases:
30 empty application tables, all with RLS enabled, 205 constraints, 19 policies,
123 functions. All 123 function definitions/owners/direct ACLs matched a fresh
read-only hosted snapshot. This proves export-to-hosted function parity, not
canonical repository parity for the remaining 118 functions or other objects.

Exact next work:

1. Owner reported PASS for the original rollback-only Personal/Auth probe on
   2026-09-08, using Supabase Postgres `17.6.1.167`; exact image evidence is in
   ADR-0006. Do not repeat that completed probe. The same #219 branch now adds
   Shared member ranking, aggregate-only explanation, outsider/revoked-member
   denial and versioned Shared traces. It now also uses 122 source-derived
   functions and tests 5000-row import/correction/removal and null-bootstrap
   eligibility. This revised full probe passed twice in PGlite; its Mac execution
   is pending and is distinct from the accepted original run.
2. **Continue non-function source reconciliation.** All 26 function differences
   have now been reviewed and resolved in the proposed empty-install function
   supplement: 19 formatting/comment changes, five alias-only changes and two
   intended source-patch corrections. Do not repeat that completed review. ADR-0006
   owns the explicit resolutions and source provenance. Source ownership/ACL,
   remaining table/RLS/schema/default grants and other non-function DDL still need
   reconciliation. Auth-trigger and deterministic system-seed supplements are
   already delivered for the probe and need real pinned installation acceptance.
   Account for
   platform event triggers, especially hosted `ensure_rls` calling
   `private.rls_auto_enable`, without overwriting platform-owned objects blindly.
3. Install in two empty pinned Supabase databases, verify schema/ACL/seed parity,
   run synthetic Personal/Shared/Auth and ranking tests, and prove the existing
   database's independent forward-upgrade path before closing #208.

The export omits the Auth trigger, all event triggers, PredictorGenome and
PolicyAssignment rows. It is not yet an accepted installation baseline. The
connected hosted project has only main; never use it as an installation target.
The probe temporarily supplies the source-derived function bundle, canonical Auth
trigger and deterministic system seeds, exercises Auth/Personal/Shared plus import
lifecycle behavior, then rolls everything back. It does not supply/change platform
event triggers or close the full replay gate.

The exact canonical system-seed source is now reconstructable without hosted
data through `scripts/database/system-seed-source.mjs`; ADR-0006 records its
hashes and the intentional installation-time PolicyAssignment timestamp. It does
not yet establish a full baseline or platform/forward-upgrade parity.

Audited continuation supersedes that experimental timestamp choice: the probe now
uses deterministic initial promotion/assignment IDs and the explicit schema-cutoff
epoch. Both full probe runs and exact seed-row comparisons pass in PGlite. Details
and provenance are in ADR-0006. Mac execution of this revised probe is pending;
the owner's earlier PASS remains valid only for the original Personal/Auth probe.

Table-definition fingerprints now also match across both export installations:
columns/defaults, constraints, indexes, RLS policies/flags, ownership and direct
table/column grants. Mutation regressions catch definition drift with unchanged
object counts. This is export repeatability, not remaining canonical source parity;
schema/default grants, roles, views/sequences and platform objects remain outside
this comparator. ADR-0006 records the diagnostic and exact limitations.

The raw export diagnostic still reports `REQUIRES_RECONCILIATION` (exit 1) with
`exportRepeatability: PASS`: unmodified export bytes and historical text patches
remain different. The separate function supplement now implements their reviewed
resolution for the proposed installation. Its post-supplement fingerprints match
across two empty PGlite installations, changing exactly 26 definitions and no
function owner/direct ACL. Regression tests reject both original broken bodies and
pass with the supplement. Historical replay still stops at the original catalog
migration; no hosted runtime or migration history changed.

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
