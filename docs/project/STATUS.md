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

The named-list correction is deployed server-side; its mobile changes remain on #228/#229:
`20260910110344_list_membership_resurfacing.sql` replaces only the existing private
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

Hosted rollout passed on `mwrnvfosrzwygrunrltm`: provider version
`20260910110344`, name `list_membership_resurfacing`, exact SQL SHA-256
`889e424c3ebefa4145534e2cca0a531d107947b187d7c225f6d355dcc9f26711`.
Only the filename was aligned to the actual provider version; SQL is unchanged.
The affected private function retained owner, ACL, security mode and search path;
128 unrelated function fingerprints, 21 application triggers, default ACLs and
all 46 previous migration identities stayed unchanged. No whole user-data parity
claim is made. Security advisors retained the existing 18 no-policy informational
findings and disabled leaked-password-protection warning; no new finding.

The rollback-only hosted List probe passed, including actual authenticated
mutations and public suppression. The original fixture incorrectly required its
synthetic book to reach the top 20 in the populated catalog. The corrected probe
always verifies eligibility restoration; exact top-20 return remains mandatory
only in the small isolated fixture. Hosted top-20 return was not observed or
required. Both failed and successful probes rolled back. Recovery SQL is captured
in `scripts/database/list-membership-rollback.sql` for a new reviewed forward
migration if needed, never a history deletion.

The next device-feedback patch corrects a confirmed client mismatch: Undo was
advertised from stack length even while the durable queue rejected dispatch.
Undo availability now requires current-session readiness and zero pending actions;
its handler rechecks the live queue and reports a refused start. Changed List
removals are not offered for undo and invalidate earlier same-Item history; List
deletion clears session undo history because its receipt omits affected Item IDs.
Other Items remain reversible after a single entry removal. List additions and
mixed Item/List undo retain their order. This is a concrete defect fix, not proof
that every owner-reported ineffective undo had this cause.

Shared review confirmed that pending endorsement withdrawal exists but completed
consensus cannot be reversed through that API. Shared SYSTEM_SAVED no longer
advertises direct removal; the screen states the missing capability honestly.
Custom Shared List removal remains available and does not erase durable consensus.
A completed-consensus removal lifecycle remains unimplemented and needs a scoped
product/domain decision; no consent boundary was weakened or server SQL changed.

Owner device checkpoint at `b51f962`: current List suppression/restoration,
List-add undo, rejection/rating undo and reconnect passed. Older choices still
reported “item not found”; do not mark all historical navigation accepted. New
owner requirements are part of the next bounded #228/#229 corrections, not the
distant “Mitä tänään” idea:

1. Personal destination selection must allow adding one Item to multiple Lists
   before leaving the card. Preserve completed saves on partial failure; Shared
   proposals must retain consent semantics rather than silently duplicating them.
2. Discovery and Lists must open the same Luetut/Katsotut collection of already
   rated/consumed Items, show the current rating, and allow List addition, rating
   changes and explicit history removal. Removal clears the terminal reaction and
   restores Discovery eligibility unless another active reason still suppresses it;
   it needs a canonical atomic action/evidence contract, not direct row deletion.
3. All collections need the same cover grid and swipe-card browsing as Discovery,
   with a shared top view selector and an explicit saved/history context.
4. Pull down to refresh Discovery/Lists/history; finish replacing ordinary retry
   presentation while retaining accessible recovery for persistence failures.
5. Small green RYHMÄTILA flag below the risk selector identifies Shared mode.
6. Before the NEXT device test, the owner explicitly authorizes clearing all
   Profiles' choices and all Shared groups. Preserve login accounts and catalog.
   Prepare a reviewed scoped cleanup covering derived evidence/queues so old local
   actions cannot repopulate reset state. Reset is NOT performed yet; do it after
   these changes are ready, immediately before the next test. No new APK now.

Current code checkpoint fixes two concrete source bugs: Luetut previously filtered
an already suppression-filtered recommendation pool, and List/history detail
navigation searched only the mock catalog. Both entry points now use the actual
history query and loaded authorized Item snapshots. Collection snapshots have no
Prediction ID, are bound to Profile/session, retain consumed Items while swiping,
and label the return destination. History loading keys include Profile/collection
revision and reload after interaction changes. Pull refresh is wired on Discovery,
Lists and history; the green Shared flag is implemented. The Personal multi-destination picker now keeps the sheet open after each
acknowledged addition. Each tap uses its own durable command; Valmis advances once.
Completed additions survive later failure or close. Duplicate taps are synchronously
guarded, existing memberships are marked, and a collection refresh does not erase
the in-progress message/create draft. Shared proposal flow is unchanged. The common collection cover grid/card entry is now implemented: Lists and history
reuse DiscoveryItemCard, show rating badges (including zero), dates and Shared
provenance, and expose Ruudukko / Kortit controls. Images/cells are virtualized in
bounded batches; card browsing keeps the loaded collection. The history-clear server candidate is implemented and tested locally; its mobile
command/UI wiring, hosted rollout and ordinary pull-refresh UX are implemented; the new UI needs device validation. Reset remains scheduled for the
next test checkpoint, not this partial delivery.

Next: prepare and execute the already authorized data reset with stale-client
protection, then a combined device test. Keep #228/#229 and DATA-003/004 open and the PR draft.

Publication approval: the owner explicitly approved publishing this Personal
multi-destination correction to the existing public Kajooja/Kajo repository,
`feat/228-delivered-origin` / PR #229. That delivery is published as `4e8e301`;
the earlier automatic-review block is resolved. Continue from this PR; remaining
work and test/reset ordering are listed above.

The owner explicitly approved publication of the subsequent common collection
grid/card code and documentation to this same public repository, branch and PR.
The grid/card publication approval boundary is resolved. Continue with the
history-clear hosted rollout and the remaining refresh/reset/device sequence
above; no new APK or data reset was performed at this publication checkpoint.

History-clear server checkpoint (2026-09-10): candidate forward
`20260910134428_clear_consumed_history.sql` preserves existing function identity/ACLs,
adds non-undoable CLEAR_HISTORY and ITEM_HISTORY_CLEARED, corrects all active native
rated/consumed Events, and deactivates matching terminal bootstrap evidence.
Saved/interest/rejection/List memberships and other Profiles survive. Rollback-only
acceptance verifies Memory cancellation, immutable retries/no-op, rerating, stale
undo rejection, nonmember denial and injected Event-failure atomicity.
Validation: full `npm run check` passed 324 tests (249 mobile, 14 catalog,
61 database), lint/TypeScript and both platform exports; exit status 0.
No hosted migration, user/group reset or APK was performed in this checkpoint.
The owner explicitly approved publication of this history-clear server candidate,
Event contract, regression/CI wiring and canonical documentation to public
`Kajooja/Kajo`, branch `feat/228-delivered-origin`, draft PR #229. This resolves
the earlier automatic-review publication boundary. Mobile command/UI wiring is now implemented. Next work is reviewed hosted rollout,
followed by refresh/reset/device
acceptance in the order above.


History-clear mobile checkpoint: Luetut/Katsotut exposes Poista historiasta through
the existing durable collection queue, with no borrowed Prediction or DiscoveryMode.
The collection reloads after acknowledgement; duplicate taps are locked.
Profile/Event-session keyed content ignores stale completion feedback after a switch
or unmount. A malformed receipt retaining rating/consumed state is rejected.
Regression coverage includes offline persistence/restart with the exact command
and receipt validation. Full `npm run check` passed 325 tests (250 mobile,
14 catalog, 61 database), lint/TypeScript and both platform exports (exit 0). Hosted rollout, native CI and real-device acceptance remain
pending; do not start the combined APK checkpoint before rollout and remaining UX.

The owner explicitly approved publication of this mobile history-clear checkpoint
(command/UI/test and canonical documentation) to public `Kajooja/Kajo`, branch
`feat/228-delivered-origin`, draft PR #229. This resolves the earlier automatic
publication-review boundary. Hosted rollout remains the next task, followed by
remaining refresh UX and the authorized reset/combined device checkpoint.

Hosted history-clear rollout completed (2026-09-10): deployed version/name
`20260910134428_clear_consumed_history`, unchanged SQL SHA-256
`2801b3702715b4c9e79025c056f5eb115d6311300bae9333c8441bac5c578b57`.
The candidate filename was aligned from 20260910130156 to the provider-assigned
version; SQL bytes and earlier migration history are unchanged. Preflight matched
the old collection function body exactly. Postflight matches the candidate body
MD5 `61b539deba7fbaca79a182842b816769`; all 129 function identities/ACLs and
128 unrelated definitions retain their combined metadata digest.
Hosted rollback-only smoke passed actual Memory cancellation, import/independent
state preservation, idempotent retry/rerating, stale undo and nonmember denial.
The temporary Event-failure injection was omitted on hosted; it remains covered
in isolated full-schema tests. No real user/group reset or APK was performed.
Security advisors remain the existing 18 RLS/no-policy INFO and one leaked-password
protection WARN, with no new finding.
Recovery, if needed: use a reviewed new forward migration to restore only the
private collection function from `20260910071110_atomic_collection_actions.sql`
(the captured preflight body matched exactly). Preserve the added Event type and
already committed corrections/receipts; do not delete deployed history or rewrite
user evidence. This disables new CLEAR_HISTORY commands until fixed.
After filename alignment, full `npm run check` passed 325 tests, lint/TypeScript
and both platform exports (exit 0).
This rollout supersedes the earlier pending-hosted notes above. Next: the already authorized choice/group reset with stale-client protection
immediately before device tests.

Pull-refresh checkpoint: Discovery, List index, individual Lists and history
now refresh by pulling down. Ordinary load errors show a pull instruction instead
of a retry button. Lists index now has a native RefreshControl; cover grids allow
vertical overscroll with short/empty content. Shared Discovery's refresh indicator
waits for both recommendation and Shared-choice loading. Durable command recovery
controls remain separate; refresh does not discard or resend mutations as new
commands. No device acceptance is claimed.
Next reset must cover native choices, imported evidence, derived learning, receipts
and all Shared groups while preserving Auth/accounts/catalog. Invalidate stale
client sessions/queued envelopes before clearing data so old clients cannot
repopulate reset choices. The reset is authorized but NOT executed in this step.
Validation: full `npm run check` passed 325 tests, lint/TypeScript and both
platform exports (exit 0); pull gestures still need a phone/emulator test.

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
