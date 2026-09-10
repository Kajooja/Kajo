# Kajo Current Status

Last updated: **2026-09-10**
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

### Current delivery and next task

Phase 14.0 is accepted: #219 supplied source/schema/platform verification and
#223 (`fd7b82d`) delivered the operational fresh local/CI installation. #207 and
#208 are closed with their precise technical evidence. `MVP-ALG-001` is complete;
BOOT/device/catalog/usefulness and full `MVP-ALG-009` remain separate open gates.
The 47 protected historical files and their failing chronological diagnostic are
unchanged. [ADR-0006](../architecture/decisions/0006-clean-install-database-baseline.md#adopted-installation-procedure)
owns the adopted fresh lineage and existing-database forward procedure.

The latest **14.1 delivery is #224 / PR #225**:
rating, not-interest and their undo now have an idempotent/atomic server command
and a SQLite-backed actor/Profile/environment outbox. The command persists state,
Event and receipt together, preserves unrelated Saved state, rejects stale undo
and validates any supplied trace before correlation. The queue persists before
optimistic acceptance, survives restart/lost replies, preserves FIFO and stops
stale-scope dispatch/callbacks. A definitively rejected undo can be explicitly
discarded before reloading current server state. `DATA_EVENTS.md` owns the contract.
The reviewed server forward `20260909204512_atomic_item_actions.sql` is deployed
and its rollback-only command acceptance passed. All five gates in CI #403 passed
for the implementation; PR #225 owns final-head CI and merge evidence. Sprint 014
records exact rollout/source verification and the remaining device limitations.

The latest collection delivery is **Issue #226 / PR #227**, branch
`feat/226-atomic-collection-actions`, based on accepted main `e0d7610` / PR #225.
Implementation `0d299d5` passed all five required jobs in CI #407; the prior
handoff head `876f1b6` passed CI #408. Local implementation check passed 287 tests
plus lint/typecheck and both bundles. PR #227 owns final-head CI and merge evidence.

The owner explicitly approved hosted deployment on **2026-09-10**. Kajo
`mwrnvfosrzwygrunrltm` accepted `20260910071110_atomic_collection_actions.sql`,
SHA-256 `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`.
Only the filename changed to match the actual provider version. The prior hosted
approval blocker is resolved. Rollback-only hosted List/Shared command acceptance
and access-boundary checks passed; Sprint 014 records exact scope and limitations.

PR #227 passed all five CI #409 gates and is merged as `6dd1fec`. The local
collection branch is retired; remote branch deletion was unavailable (the connector
has no delete-ref operation and shell Git has no write credentials). Do not repeat
the already accepted hosted deployment.

The active continuation is **Issue #228 / draft PR #229**, branch `feat/228-delivered-origin`,
based on main `6dd1fec`. Its first checkpoint freezes the grid-to-detail/sliding
Item sequence, prediction/source, mode, environment/actor/Profile scope and session
in a bounded navigation snapshot. Detail refuses expired/mismatched snapshots,
keeps mounted origin through reranking and drops the latest-media-pool guessing.
Direct non-predicted entries remain a single Item; route query prediction IDs alone
are not trusted. This is a partial implementation, not DATA-004 acceptance.

The second checkpoint replaces the memory-only Event queue with SQLite-backed
Event/session envelopes using the existing bounded outbox implementation and a
separate environment/actor/Profile storage identity. Accepted enqueue now means
persisted bytes; restart replays the original session/ID/timestamp, and stale scope
callbacks cannot start the subsequent Event write. Impression dedup follows storage.

The third checkpoint guards both Item and collection dispatch against matching
pending impressions in the durable Event queue. It preserves command IDs and
original sessions on restart; failed exposure storage blocks correlated dispatch.
Unrelated/non-predicted actions do not wait for this guard. CI #412 passed the prior
`2e0c068` checkpoint; the PR owns current-head CI.

The fourth checkpoint freezes per-Item Shared delivery tiers with the navigation
snapshot. Injected pending/member-history Items have no borrowed Prediction ID;
actual ranked Items retain their run even when the overlay reorders them. Detail
impressions, dwell and Item/collection actions use that frozen origin. Dwell keeps
its start-time callback/mode, and undo navigation cannot borrow an unrelated run.
Prior head `dd6d86b` passed CI #413; current validation belongs to the draft PR.

The fifth checkpoint adds a client admission guard for frozen origin session/Item.
Events and explicit Item/collection actions refuse mismatches before enqueue.
Layout-time session invalidation also blocks old dispatch/hydration/receipt callbacks
before passive cleanup. Lists/Shared completion tokens include the Event session
and invalidate on unmount. Destination loading/saving belongs to the current open
request, so closing during save cannot strand a reopened sheet. Direct detail is
remounted for a new session. Existing durable commands retain their original session.

The sixth checkpoint adds a rollback-only server delivery-order matrix to both
PGlite acceptance and the required native CLI installation probe. Fourteen cases
cover Item/collection delayed-valid delivery, missing/late-arriving exposure,
exposure occurring after the action, another session/mode, and an unselected
candidate. Retry and undo preserve the original accepted attribution. No migration:
late exposure does not retrofit immutable unattributed receipts.

Owner device feedback is now recorded in Sprint 014 (expected test APK: #417,
`e7c84a7`; device/build details not supplied). Card sequence, close-during-save and
background/login were reported working; the offline case was tentative. Lists
remain a release blocker: named-list additions can remain in ordinary Discovery,
undo appeared ineffective, and normal exposure waiting was presented as an error.
A transient ranking change after undo was not reproducible. Do not infer complete
Shared/cross-Profile/device acceptance from this report.

The current feedback checkpoint distinguishes ordinary exposure waiting from real
persistence errors. It keeps the action pending and retries automatically instead
of publishing an error that prematurely resolves collection waiters. Real errors
remain visible; server correlation and durable queue semantics are unchanged.

The named-list correction is now a candidate on the same #228/#229 branch:
`20260910104420_list_membership_resurfacing.sql` replaces only the existing private
resurfacing decision function. Current Profile-scoped memberships participate in
suppression and reminder age; removing the final Personal membership restores
ordinary eligibility unless Saved/bootstrap/terminal reactions still suppress it.
The mobile ranking key includes collection revision, so a receipt invalidates stale
grid results even if LIKED/state fields did not change. Obsolete visible tokens
cannot create impressions in that invalidated grid.

The full-schema List probe covers actual authenticated add/remove/delete and
ranking, multiple Lists, reminder eligibility, terminal precedence, Profile
isolation and real Shared consensus. Deleting a Shared named List can leave its
SYSTEM_SAVED membership: it correctly remains suppressed. Direct Personal-style
Shared Saved removal is rejected by existing consent rules; this patch does not
weaken that boundary. Function identity/ACL and unrelated definitions are checked.

Next: review/deploy the exact candidate forward to the hosted project, including
metadata/advisor/rollback-only acceptance, then inspect the owner's ineffective
undo and the Shared withdrawal/removal UX before the replacement APK. The new
migration is NOT deployed and device behavior is NOT accepted. Keep #228/#229 and
DATA-003/004 open. No undo of List removal is required by the owner; retained undo
controls must work. “Mitä tänään” remains a separate FUTURE_PLAN idea.

Continue **14.1** after this delivery:

1. Freeze exact delivered Profile, prediction and slate origin through grid/detail/
   swipe/Lists/Shared overlays. Remove cross-Profile/run cache guessing, and make
   verify durable exposure delivery and its ordering with action/outcome writes; the
   draft now persists Event evidence and guards matching pending impressions before
   Item/collection dispatch; missing/already-committed late attribution remains open.
2. Verify late outcomes, real device process-death/reconnect/account switches and
   complete atomic List/Shared rollback/duplicate/undo authorization cases.
3. Then proceed to **14.2 serving/shadow/candidate availability**.

`MVP-DATA-003/004`, full `MVP-ALG-009`, Sprint 014 and Phase 14 quality/evaluation
acceptance remain open. No Taste/Friend implementation starts ahead of those
algorithm requirements. Do not restart completed source export/platform experiments.

### Existing hosted database and repository hygiene

The existing hosted database stays on the separately reviewed forward-only
procedure in ADR-0006. Its known tracking mismatch is not repaired by local-lineage
adoption. Forward file `20260909131913_close_postgres_function_defaults.sql` has
not been applied hosted; deployment must capture its own prior defaults/rollback.
The #223 local installer did not change hosted state. #224 applied only its new
atomic-action forward: all 31 old application/Auth table hashes, 123 existing
function fingerprints, 21 triggers, defaults and 44 old tracking rows remained
unchanged. The new tracking row uses the provider's actual version above.

The [2026-09-09 retrospective](retros/2026-09-09.md) and recovery manifest preserve
the completed #220 audit and removal of all 145 approved old remote branches.
The cleanup is finished; its old approval block and temporary branches are not
continuation work. Main CI #395 originally failed at isolated startup and passed
on one requested rerun; the original cause remains unproven. APK/device acceptance
is separate, and a main APK build is not a task to poll.

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
