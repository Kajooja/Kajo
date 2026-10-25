# Sprint 014 — Algorithm Reliability, Real Catalog & Portable Engine

Status: **ACTIVE — PHASE 14 ACCEPTANCE OPEN; DELIVERED FOUNDATIONS ON MAIN**

## Outcome and current scope

Complete ROADMAP Phase 14: clean-database/bootstrap correctness, trustworthy action/delivery evidence, serving/shadow parity and candidate availability, real catalog/features, portable engine contracts and isolated public-data evaluation, adaptive memory/policy and operating bounded SleepLayer evaluation. Current requirements and acceptance belong to [MVP.md](../../product/MVP.md) and [ROADMAP.md](../ROADMAP.md).

The 2026-09-07 Taste-first release decision supersedes the old Sprint 014 external-beta / Sprint 015 store-close schedule. Taste acquisition is Phase 15, Friends/Shared is Phase 16, core UX/operations is Phase 17, complete-flow closed beta is Phase 18, production/stores are Phase 19 and owner acceptance is Phase 20. Monetization is outside MVP 0.1.

[STATUS.md](../STATUS.md) owns the exact next task. #208/#207 are technically complete through #223. Delivery #224 / PR #225 implements the first Phase 14.1 atomic/durable Item actions; Delivery #226 implements List/Shared commands and their durable mobile path; exact delivered provenance follows. PR #219's source/platform experiments are completed evidence.

## How to read this record

The 14A–14D sections below preserve earlier foundation deliveries and device evidence. Their labels are historical work packages, not the current numbered ROADMAP phases. Catalog counts and hosted evidence are dated checkpoints, not a live inventory. Dated continuation entries later in this file preserve what was pending then; the current STATUS overrides their old next-step instructions. The [2026-09-09 retro](../retros/2026-09-09.md) records the reconciliation.

## Verified curated BOOK cover implementation — 2026-10-25

The first ADR-0011 foundation now supplies a reviewed 30-book Work/English
Edition/creator/cover mapping and the guarded `curated-book-covers.mjs` operator.
Actual downloaded JPEGs were decoded and visually checked; a provider-linked
revision-guide cover, audio packaging and an Edition creator mismatch were
rejected. Seven focused tests include full-schema preservation, stale-batch
rollback, source mismatch, corrupt images and inert replay. The exact 30-Item
operation also passes a disposable current-schema replay. The only intended
write fields are canonical image URL, cover attribution and the existing update
timestamp. The hosted repair is applied: all 30 mappings are installed and BOOK
image-URL coverage is 415/415. All guarded account/evidence/source tables and
non-target catalogue rows retain their digests; target non-presentation JSONB
values match. STATUS records the numeric-formatting digest distinction and its
operator regression. Phone rendering remains open. Exact source/check receipts
belong to STATUS/current PR. No APK,
account reset, new selector or calibrated readiness is delivered by this packet.
Shared input/conditional prediction remains the next engine dependency.

## Guided Discovery and measured Taste readiness — 2026-10-25

The owner reports that Taste still feels isolated, mixes BOOK/MOVIE cards and
shows some books without covers. The required successor is common Discovery
prediction/learning, BOOK → MOVIE guidance and a genuine readiness meter that
controls advancement/completion. [ADR-0011](../../architecture/decisions/0011-taste-as-guided-discovery.md)
records the target and retained-state constraints. The current source audit
confirms V4's separate utility/domain lead and always-INSUFFICIENT readiness.
The read-only hosted audit finds 415 discoverable books, of which 30 curated
rows have no image URL, and 425 discoverable movies with image URLs. No hosted
writes or account resets occurred. This packet records the design, audited gaps
and prioritized work; it does not deliver the new selection/readiness model.
#357's UI source and successful #724 APK remain the predecessor checkpoint;
this feedback is not a pass of its four requested device checks. STATUS owns the
new single handoff; performance measurement remains in ROADMAP.

## Taste card layout parity blocker — 2026-10-25

The owner reports that #721 Taste has wrong margins, oversized artwork and
inaccessible rating controls, and explicitly requires the same appearance as
BOOK/MOVIE Discovery card mode. This blocks the fresh V4/adaptation device test.
The source now uses shared `FeedScreenFrame` / `DiscoveryBackdrop` boundaries and
measured non-artwork card height, retained through rolling previews. All 80 mobile
files / 904 tests, mobile types and lint pass; 24/24 native Yoga Taste/reference
fixtures match with reachable controls. Approximate text fixtures are not device
acceptance. Broad root checks/exports were interrupted by tool quota; no full
local root/export pass is claimed. PR #357 owns the final-source CI and matching
APK receipts as they become available. The focused
[device checks](../DEVICE_TEST.md#apk-721-taste-layout-blocker--2026-10-25)
remain open until actual owner observations are recorded. The prior six
Discovery observations retain their scope. V4 installation and the scoped
October 24 reset remain complete; preserve new accounts/answers and do not replay
either operation. [STATUS](../STATUS.md) and the active #357 PR own continuation
and exact source/build receipts; UX_PRINCIPLES owns presentation parity.

## V4 hosted rollout, two-account reset and performance plan — 2026-10-24

#355/#356 source integration is complete; #356's final head passed CI #720 and
accepted main `340d0da660fe02d6d9d47d468bee75e134546fa3` passed all six CI #721 jobs,
including the configured APK. The owner accepts the six supplied device cases;
long-browse → Löydä takes approximately 4–5 seconds, acceptable with improvement
desired. [DEVICE_TEST](../DEVICE_TEST.md#apk-721-owner-observations-and-next-test-boundary--2026-10-24)
owns that scoped acceptance, not a measured latency distribution or full quality
gate. #356 owns exact source/build receipts; no unchanged repeat is required.

The current `feat/336-taste-rollout-performance-plan` packet adds
`personal-taste-pool-hosted-upgrade.{mjs,test.mjs}`: a source-pinned, private
checkpoint-bound single-forward preparation helper with read-only pre/postflight,
atomic preservation assertions and replay/drift rejection. UTC row-digest capture
and a narrow provider-owned Auth-history lock boundary retain full pre/post
guards. Four focused helper tests pass; the full local root check stops at the
unchanged Deno registry connection refusal, with remaining stages passed separately.
The helper itself does not execute hosted writes or reset accounts. The one
accepted V4 forward is now installed: history advanced 86 → 87, new sessions
default to V4 and read-only metadata/security/row-preservation postflight passed.
The owner-required reset of exactly two intended test-account roots is also
complete, with independent read-only postflight: account/session roots and 60
checked test-state tables are empty, while catalogue/source/model structure hashes,
87 migration receipts and the V4 default are preserved. The owner must register
the same two email addresses again with owner-chosen passwords, creating fresh
identities before V4 device/adaptation testing. [STATUS](../STATUS.md) owns the
aggregate receipt; exact private identities/checkpoints stay outside Git.
The owner explicitly approved publication of this completed eight-file
helper/docs packet on 2026-10-24, resolving the earlier automatic approval
rejection. No workaround or publication retry preceded that approval. Publish
the approved branch packet; its PR owns the exact published head and CI receipts.
Publication approval does not establish new CI success, source merge or V4 device
acceptance, and does not repeat the completed hosted rollout/reset.

[ROADMAP's performance work package](../ROADMAP.md#end-to-end-performance-measurement--2026-10-24)
and `MVP-UX-008` promote end-to-end measurement into near-term work: establish the
visible/actionable/saved baseline, diagnose queue/handoff/RPC/rendering costs and
remeasure bounded changes before broad optimization. Fresh-account device testing
and the initial timing baseline are next; full measurement/operational acceptance
stays in Phase 17 and scoring quality remains separate. No measured speed
improvement, V4 device/quality acceptance or Sprint 014 closure is claimed.

## Earlier authorized feed integration and Taste pool continuation — 2026-10-24

The owner explicitly authorized merging #355 and then #356 after verification,
resolving the earlier automatic merge rejection. #355 is merged as
`94beb27962c735582fa5eabf3db361be37e1255a`, preserving the tested #716 tree
`047496716bbb79b1fb4ab3f597e98f33e675ac35` and scoped owner browsing acceptance.
#356 is ready for review and targets main; it remains unmerged at this checkpoint.
Its implementation source `90c70343a64fe336391d8ae5c234bccd2d6a808a`, tree
`aee918b92394342b6ad5cc9125203c29daf6502b`, passed all five
[CI #718 gates](https://github.com/Kajooja/Kajo/actions/runs/40098065673), including
native populated-predecessor preservation and separately committed V4 pool RPCs.
The APK job was skipped. Complete the current handoff head's required checks and
authorized merge; #356 owns its exact final source/CI/merge receipt.

[STATUS](../STATUS.md) owns the one continuation: inspect that receipt, continue
from fresh main after integration, then prepare the guarded matching V4 hosted
forward and configured APK/device acceptance. Preserve accounts, retained policies,
frozen panels and exact commands; do not replay installed migrations. No hosted
V4 deployment, successor device result, measured quality or Sprint 014 closure is
claimed. Earlier dated pending-source entries below retain their historical scope.

## Discovery return and horizontal history — #239 / 2026-10-24

The owner reports #714 works, accepting the reported feed/Undo correction after
all six CI jobs and the single installed performance forward. STATUS/PR #355
own its exact source/build/provider receipt; the PR remains unmerged. The new
packet reduces changed-evidence grid return work to six Items and removes the
refocus debounce, retaining focused revision coalescing and exact origins.
Löydä and canonical Katsotut/Luetut become finger-follow horizontal pages below
their shared header. Hidden previews are inert and create no exposure; the
accepted vertical reel/rating/Undo and standalone history route stay intact.
Canonical policies precede implementation. New source/CI/APK and actual phone
acceptance are pending; do not replay installed migrations or reset accounts.

## Repeated Undo ranking timeout continuation — #239 / 2026-10-23

The owner accepts the rest of #713's feed but reports long Undo loading and a
recommendation-refresh error after repeated cycles. Hosted read-only logs show
SQLSTATE 57014 in canonical scenario retrieval after 8,184 ms. This supersedes
the earlier pending #711/#712 continuation handoff; #713's final CI/APK receipt
is in STATUS and PR #355, which remains unmerged.

The scoped continuation uses one five-Item restoration probe before the original
bounded three-page, 50-Item search, retaining exact pending requests and fresh
same-Item activation. The additive CLI-created performance forward changes only
redundant evaluation of the same history/similarity, with exact scoring/evidence
and function-identity parity required. Existing accounts, queues, installed
migrations, frozen runs and release gates remain preserved. STATUS owns the
current validation/hosted/build state; PR #355's final receipt supersedes this
pre-publication checkpoint. Actual phone timing and repeated-cycle acceptance
remain required after the correction.

## Owned mobile source accepted — #331 / 2026-10-12

[#331](https://github.com/Kajooja/Kajo/pull/331) is merged as `b3d8a080882160305f2dda5d4e9b1f98fcd0cd3c`,
accepting source `bebd53613a0bc10917feb36b87e9a221dcf2295b` and tree
`25ea91d280d407921cbc8a4678cdef58fa9970a4`. All five final-source
[CI #650 gates](https://github.com/Kajooja/Kajo/actions/runs/38284940245) pass:
complete root validation (517 mobile, 225 database and 245 engine tests, remaining
suites and four exports), platform/defaults, two clean installations, populated
upgrade and native CLI installation/history/concurrency. All 276 local document
links/anchors passed before this acceptance handoff; recheck links after edits.

The main push started [CI #651](https://github.com/Kajooja/Kajo/actions/runs/38287239357)
and its automatic APK stage; it is still running at this source-acceptance receipt.

Issue #330's source packet is complete. STATUS now owns guarded matching-backend/APK/
native acceptance in DEVICE_TEST/#238, then canonical unseen preview. A new APK
must match this consumer; #648 predates it. No hosted migration, phone observation,
account reset or measured usefulness is claimed. The entry below preserves what
was pending before source CI/acceptance; it is not another source implementation request.

## Owned adaptive mobile Taste consumer — #330 / 2026-10-12

Source parent: accepted main `9237b3814b2b408a43ec8abb664c3a6c0a57baca`, all five
CI #647/#648 gates. Main #648 also built the verified APK; it predates this consumer.
The `feat/mobile-personal-taste` packet connects both owned server Taste RPCs to
mobile through typed receipt validation and a separate one-command SQLite controller.
New cold-start creation waits for explicit start/import choice; retained sessions
and completed setup follow server truth, independently of native six-strong status.
Movie-to-book acknowledgement, genuine zero/neutral, independent unknown/not-interest,
masked challenge forecasts, honest ordinal counts and confirmed removal are implemented.

One backend/actor/Profile-scoped immutable pending command is persisted before send.
Lost replies and local acknowledgement failure retain the exact ID/body; current
server state is resumed before another decision. Confirmed conflict/rejection needs
explicit reload, without rebasing an answer. Layout/generation cancellation rejects
old callbacks; corrupt queues are preserved without dispatch/overwrite. Only a
confirmed missing first session RPC enables legacy static calibration. Full retained
answers/forecasts remain server-owned; this is not a new native Event/learning writer.

Validation: 35 focused mobile tests, existing legacy regressions and the actual
full-current-schema mobile-adapter SQL contract pass through stages, canonical
freeze/completion and both removal boundaries. Local lint/typecheck, dependency,
mobile and catalogue checks pass. Local root reaches refused Deno npm-registry
access; full-root success is not claimed. Final full CI/native export receipts
belong to #330's PR. DEVICE_TEST lists exact matching-source/backend cases;
no real device, hosted rollout, account reset or measured usefulness is claimed.

Next: finish source CI, then guarded matching-backend/native acceptance. Canonical
unseen preview follows. Anonymous lifecycle/abuse/measurement, later answer
projection, genuine #232F, Shared rollout and incomplete MVP gates stay open.

## Owner-authorized source integration — 2026-10-12

The owner explicitly instructed: “No jatka, yhdistä mainiin, hyväksy kaikki.”
This supersedes the prior #229 configured-device/fresh-account source merge hold.
Source approval does not manufacture phone tests, deploy forwards, enroll a cohort
or close incomplete release/quality requirements.

PR #329 is retargeted to main as the integration of all 27 open source PRs:
#229, #301, #304, #305 and #307–#329. Every original head is an ancestor of
`5aaeb9dbcf297cc5b6f211cf2332a53581f337f7`; its full source passed all five CI #646
jobs, including 224 database tests and four exports. The reconciliation changes
only documentation, preserves main #300's complete September 30 entry below and
requires all five final-head CI gates before the history-preserving merge.
The final source/tree, CI and resulting main merge SHA belong to PR #329.

Canonical documents now distinguish retained historical baselines from the
integrated native source. STATUS points to one next packet: owned adaptive mobile
TasteSession/challenge resume, retry, transition, unknown/zero and honest result
presentation. The earlier static calibration remains until explicitly replaced.
Configured-device observations remain in DEVICE_TEST/#238. No new APK, hosted
write, account reset, provider acquisition or model admission is claimed.
Consumed catalogue operation refs and active worktrees remain retained.

## Frozen own-Personal Taste challenge — 2026-10-12

The #328 parent is complete for source review: exact `b7dd4f799358ca167ec1d5a178d290608aacd9ed`,
tree `3e434b54b8b26230265552933739ab1ba92ef954`, all five CI #644 gates pass.
The current `feat/personal-taste-challenge` continuation advances EB-03/EB-08
(sections 30/32/33/40) without changing the scorer or promoting a model.

Delivered source: `taste_challenge_v1` reserves up to three real unseen Items per
domain before one canonical cross-domain FOR_YOU run; freezes full run/pool,
state/model/genome and holdout commitments; accepts immutable first answers with
exact retry/CAS and durable resume; and reveals forecasts only at completion.
Same-domain ordinal agreement reports known/unknown/not-interest, score/rating
ties and missing forecasts, with unavailable small-dependent-sample uncertainty.
Scores are not converted to calibrated ratings or percentages. Answers remain
EVALUATION_ONLY, without native Event/bootstrap/reward writes.

Private ownership/RLS/ACL boundaries, anonymous refusal, live catalog withdrawal,
Taste/import removal, source Prediction erasure and account cascade are covered.
Existing rows/functions/ACLs and historical predictions retain their bytes.
The additive migration was created by pinned Supabase CLI 2.117.0. Native CLI
probes exercise separate connections for duplicate creation/answer, revision
conflict and source removal, and compare complete canonical state after cleanup.
Local and exact-source final CI receipts belong to the active PR/#229 handoff.
Local native advisors require the unavailable local Postgres stack; configured
backend/device behavior and real usefulness are not claimed.

Hygiene reconciliation corrects the stale “no native consumer” wording to the
actual server-versus-mobile boundary and records #327's completed integration CI.
Canonical protocol/evidence/model, CODEMAP, launch semantics, MVP partial status,
ROADMAP, capability ledger and STATUS now describe the same source and next task.
No older sprint result is rewritten, no branch dependency is deleted and no
hosted write, account reset, provider acquisition or main merge is performed.

Next: verify this source's CI, then integrate the owned adaptive mobile Taste and
challenge flow through both RPCs. Keep anonymous lifecycle/abuse/measurement,
explicit later answer projection, canonical preview, observed first-session value,
#229 configured-device/fresh-account and the complete MVP/Share Link gates open.

## Durable own-Personal TasteSession — 2026-10-12

The interrupted #326/#327 follow-up is complete: CI #639 and #641 pass all five
required gates; optional APK jobs were skipped. No dependent stack was merged
past #229's configured-device/fresh-account gate.

The successor `feat/personal-taste-session` adds one bounded own-Personal session
with frozen real catalog/policy/feature dictionary, durable opportunities and
answer revisions, server-owned selection, transition acknowledgement, exact
request replay, optimistic revision conflicts and removal. SQL/portable selector
parity covers ADAPTIVE and PRIOR_ONLY, replay, zero/unknown/not-interest/correction,
withdrawal and stage/stop rules. Ratings project incrementally into the existing
bootstrap boundary with distinct `TASTE_SESSION_V1`/`TASTE_TEST` provenance; no
native Events or Shared evidence are fabricated. Other withdrawn Items remain
withdrawn when a different Item is answered.

Private RLS tables and revoked helper/table permissions restrict access to the
owner RPC. Anonymous/foreign/Shared calls fail. Source removal atomically clears
session and retry copies, including removal via the existing import endpoint;
account deletion cascades them. Live catalog withdrawal blocks delivery/writes
except REMOVE. The v1 source intentionally does not admit not-interest into the
older rating/consumed/saved bootstrap kinds or claim anonymous/public/UI readiness.

The additive forward is generated with pinned CLI 2.117.0. Populated-forward
regressions preserve every old table row and function identity/body/ACL. Local
focused full-schema tests pass; full root/database and exact-source CI receipts
are finalized in this PR. Native CLI includes authenticated smoke plus separate
connection duplicate/conflict/removal lock probes. Local advisors cannot connect
without a local Supabase/Postgres service; this is not a clean-advisor claim.
No hosted migration, mobile gate activation, account reset or learning admission.
Next source packet is the genuinely frozen own-Personal holdout challenge.

## Personal source fusion/forgetting — 2026-10-12

Completed #325 CI #637 passes all five required jobs on exact source tree
`84f0279c2868411caba0b031030996766218962d`. Earlier #324 CI #636 passes all five
and standalone APK; its actual checkout/source tree and archive receipt belong
to STATUS/DEVICE_TEST. Build completion does not close device or public-release
acceptance.

The bounded #326 source continuation targets current Personal rating ownership,
selective clear/Undo/ambiguity, effective six-strong setup support and versioned
bootstrap floor removal, with common memory/ordinary/catalogue source semantics.
Structural memory/feature generations and old frozen outputs remain compatible;
Shared native calculations, real repeat experiences and measured quality remain
separate. Final implementation/tests/source version details follow STATUS and
PREDICTION_MODEL; no hosted write, history/account reset or quality activation occurs.

The actual verified CLI2.117.0 bootstrap creates
`20261012060821_personal_source_fusion.sql`; a temporary read-only runner workflow
is removed from the final diff. Official archive, artifact, binary and tested
checkout hashes verify provenance rather than inventing a filename. The local
CLI is now available for subsequent source migrations.

The continuation now completes the forward and native CLI populated-upgrade/runtime
wiring. Regressions cover canonical equal/backdated rating edits through List
receipts, exact Undo, legacy ambiguity/malformed values, invalid/cyclic/competing
lineage, depth 512 and overflow, future controls, Saved/List removal/deletion,
public owner authorization and genuine Shared preservation. A backdated Saved/List
removal defect was reproduced and corrected using validated receipt order.
Old-generation smoke matrices remain on their actual pre-fusion source; new source
checks own the intentional version/count/overlap changes. Existing general fresh
install/history smoke checks now recognize that one current rating can have two
retained raw Events.

The current STATUS is condensed to one handoff, source/build/hosted/device gates
and links to this historical log. The 35-ref audit retains all live dependencies
and eight consumed operation identities; no branches or user data are deleted.
Final source is #326 `70d4e48f8260bc3462fa40cbea221184e63c0bb3`, tested tree
`612d4997b015f5e673d72aec856db00f07aa827b`. Serial database **192/192**, engine
**245**, mobile **493**, catalogue **444**, dependency **43**, research **19 Python
+ 43 Node**, acceptance **6 + 5**, and four explicit demo-mode exports pass.
Root check remains blocked at locked Edge registry loading after earlier stages
pass. All **253 local links / 73 anchors** pass. CI #639
(run `38229883071`) owns the completed source's pending required gates.

A separate documentation successor reconciles #303's complete 51-section map into
the current source/dependency stack. README, documentation map, ADR-0008 and
ROADMAP now link the twelve capability packets; the ledger records October 12
source foundations without ticking full capabilities or restoring stale handoffs.
ROADMAP and AGENTS now distinguish completed decay/support/Shared integration
source from remaining hosted/device acceptance. Duplicate #306 is closed after
all six implementation/test/migration files match #323 exactly; its branch and
original guarded rollout evidence remain preserved. #302 remains the full-engine tracker. New integration CI, native stack merge,
hosted/device/observed-quality and Share Link acceptance remain separate.

## Native base confidence distinct-Item support — 2026-10-12

The old ordinary/catalogue kernel defect is reproduced on an actual populated
schema: one native Item/eight matching tags yields confidence one. The guarded
source forward replaces only its new base support with distinct admitted matching
native Items; repeated tags/actions cannot create extra units. Legacy tag incidence
remains diagnostic; explanation count/basis/version and uncalibrated status make
the heuristic explicit. Scores/features/ranks/versions and old frozen evidence/
receipts/functions retain their approved semantics. Bootstrap-only native support
remains zero; same-Item source fusion and the retained bootstrap floor remain open.

A private denied-API pure helper, independent populated preservation/drift verifier,
BOOK/MOVIE/mode/zero/repeat/UNDO/temporal/foreign/missing/bootstrap matrix and actual
CLI upgrade/smoke stages supply engineering coverage. The pinned CLI is unavailable
locally and offline npm returns ENOTCACHED; the new forward uses a UTC-generated
name. Focused full-schema **6/6**, syntax/whitespace pass; the actual 120-Item
instrumented regression proves helper calls **1/7/50** for requested limits,
without changing complete results or retained helper metadata. Final frozen full
serial database **173/173**, independent support **6/6**, source/CLI review and
**141 links / 77 anchors** pass. Root lint/typecheck/dependency **43**/mobile **493**/
catalogue **444** pass before unavailable Edge registry loading; complete local
root success is unclaimed. Completed parent #323 CI #634
passes all five required jobs on the exact integrated tree; #324 CI #635/636
and opted-in APK remain pending. STATUS/#229 own final publication/CI/build and
subsequent native rollout/device/quality gates. No production mutation or quality activation occurs.

## Personal Taste selector and calibration source — 2026-10-12

A separate portable `taste-selection-v1` export now chooses immutable next
questions, transitions and stops from trusted frozen caller inputs. Fixed
ADAPTIVE/PRIOR_ONLY controls use recognition/diversity/feature-coverage heuristics;
zero/unknown/not-interest, revisions/withdrawal, replay, no-repeat bounds and
exhaustion are explicit. Source defaults propose 12–24 opportunities, eight known
ratings and ten MOVIE → transition → ten BOOK. Generic non-media coverage and
strict Kajo owned-Personal/canonical-real-Item normalization retain the independent
root estimator graph. New tests **25/25**, full engine **245/245**, built exports,
lint/typecheck and independent selector review pass.

The existing calibration receives independent unknown after wheel movement,
genuine zero preservation, append-only presented-prefix expansion and async
profile-scope cancellation. Its static/interleaved six-known gate remains current;
it does not consume the adaptive selector. Independent screen/operations
**17/17**, full mobile **493/493**, lint/typecheck pass. Root dependency **43**,
catalogue **444**, research **19 Python + 43 Node**, acceptance **6 + 5** and
configured application/description exports pass. Required root check is blocked
at unavailable Edge registry/cache; complete local success is not claimed.
Full database serial recheck and exact source CI remain pending in STATUS/#229.

No native TasteSession consumer, anonymous foundation, frozen challenge, canonical
preview or observed usefulness is admitted. Native confidence still needs distinct
Item support rather than summed tag counts. Required anonymous identity/retention/
abuse/measurement, actual Working cohort/operator prerequisites, genuine #232F,
#306 hosted rollout and configured-device/MVP gates remain open. No hosted write,
account/history reset or main merge occurs.

## Shared overlay source integration — 2026-10-12

Completed #322 CI #633 passes all five required jobs. The separate #306 source
is integrated without replacing current Shared/Working probes or canonical
handoff documents. Six code/test/SQL files are byte-identical to reviewed
`d14c705d33ff633f86d3bc133dd9b701b6f210cd`; the guarded migration SHA-256 remains
`49aba479d9b5055cd314798ec5e23d09330369887eb37e504d90bdc90f1eb698`.
The three-line CLI stage runs alongside all subsequent native probes.
Focused mobile **26/26** and populated full-schema eligibility/negative-control/
metadata-preservation **1/1** pass. Integrated CI, hosted rollout and device
observations remain distinct. No account/history reset or hosted mutation occurs.
The stale staged #199 terminal-refresh footer is superseded by the current
append/compact-layout source. STATUS owns publication and the next Personal
first-session source work; every anonymous/quality/Shared/device release gate stays.

## Bounded future Working cohort protocol — 2026-10-11

Parent #321 source `963a3ab0ccf577d22cab02b2a5300f59d7eee9db`, tree
`851b27af5ba64bdb6ba26fd3e352e1c02368e403`, has all five successful CI #632
gates in the completed receipt inspection after implementation; the earlier
unfinished check had four passed jobs. The synthetic merge has that same tree;
APK was skipped. STATUS/#229 own exact new-source gates.

The new offline declaration/checker fixes a future existing-owner roster,
half-open enrollment window, fixed horizon/settlement/report cutoff, complete
supplied ledger reconciliation, all adjacent same-tier OFF pairs and first
reserved capture revision 1. Missing captures retain all planned pairs;
omissions, altered windows, substitution, overlap, excess budgets and declared
withdrawal reject the whole cohort. File digests establish internal integrity
only. The private artifacts need current owner access and removal at withdrawal
or the fixed seven-day review deadline; no automatic erasure occurs.

This source-only packet has no actual authorized roster/inventory or independent
native/operator declaration receipt. It creates no real untouched cohort and
collects no observed coverage. Fixture observed evidence stays zero, and all
learning/activation/quality gates remain unchanged. The next actual collection
requires that native/operator path and existing-owner scope, after required
source gates. No accounts, histories, SQL, hosted state or APK change.

New cohort **9/9**, independent combined cohort/Working/ordinal **30/30**,
actual SQL-to-cohort **5/5**, engine **220/220** plus built import graphs,
research **19 Python + 43 Node**, acceptance **6 + 5** pass. Root lint/typecheck,
dependency **43**, mobile **478** and catalogue **444** pass before unavailable
Edge registry/cache; fresh smoke fails closed without production configuration.
Complete local root/application exports remain unclaimed. Independent source
and docs review, **145 file links / 78 anchors**, syntax/whitespace pass.
Root lock, 74 migrations, engine source, production functions and all tracked
SQL remain byte-identical; this source still requires its own native CI gates.

## Private owner Working report and native fixture repair — 2026-10-11

The #320 source `f68569b5c0545e5081fbc2b246ea27cacd33c572`, tree
`88625552287ff26da8398156f255171fcf6e82f6`, has four successful CI #631 gates;
CLI/history fails its strict JSON read after prospective native lock probes.
DO/PERFORM suppresses fixture-only setup/sleep result rows, retaining the separate
committed enrollment boundary. The strengthened regression requires exactly one
JSON acknowledgement; no migration or production SQL changes.

The private `engine:working` report consumes actual enrollment/source/control and
immutable outcome snapshots through existing adapters. All planned pairs remain
in coverage, native identity and alias guards reject reused units, and actor/
session clusters expose dependence. Outputs are bounded private exclusive files
outside Git; fixture observed evidence is zero. Files need current owner access
and withdrawal/retention handling. The report does not establish an untouched
cohort, statistical independence, measured quality or any admission. STATUS/#229
own exact validation/publication and the next predeclared native coverage window.

Final full database **165/165**, engine **220/220** with built exports,
research **19 Python + 34 Node**, acceptance **6 + 5**, dependency **43**,
mobile **478**, catalogue **444**, native SQL-to-CLI **4/4** and independently
reviewed Working/ordinal **21/21** pass. An independent guard mutation reproduces
one false comparable unit from reused inert input, rejected by the final source.
All 74 migrations/core/scorer/lock bytes are unchanged. Root Edge loading lacks
registry cache and fresh app smoke lacks production configuration; complete
local root/exports/native CI acceptance remain unclaimed. STATUS/#229 retain
exact new-source gates and all release dependencies.

## Prospective Personal enrollment and outcomes — 2026-10-10

The prior #319 source `0103d941944cbf0b545686ad60d13b08bc068b9d`, tree
`868e9f15d91e19735c45a15e7a9de676104e43e2`, has all five CI #630 jobs successful.
The new `feat/personal-working-prospective` packet adds CLI-generated forward74
for private pre-evidence enrollment, durable sixteen-write reservations, immutable
latest-terminal captures and whole-source withdrawal. Actual same-tier OFF pair
receipt, three controls and dedicated declaration transaction precede real
exposure. Complete correction closure preserves zero and abstains on ties/unknown/
clear/missing; V1 strongest-episode reward remains separate. Actual later snapshot
reads retain their clock beside the stored declaration. Source limits, erasure,
local/native receipts and next bounded report belong to STATUS/#229. All quality,
historical-feature, learning, activation and release gates remain open.

Final resumed engineering validation: engine **220/220**, full database
**164/164**, zero failures/skips, and independent actual-producer/commit-guard
review pass. Native upgrade/mutation/interop/bounds/source withdrawal and
SAVEPOINT cases are covered; no fixture adds observed quality evidence. Root
lint/typecheck, dependency43/mobile478/catalogue444, research19Python+23Node,
acceptance6+5 and Markdown references pass. Complete local root/app-export/native
receipts remain unclaimed: Edge registry connection and absent local PostgreSQL
block those gates. Exact-source CI/publication is retained only in #229.

## Frozen native candidate features and support — 2026-10-10

Exact parent #318 source `9352e3e711e41e773d9092167eb58052c71156da`, tree
`d7bd1f6a92fc037373599d9e378b700f6969345c`, has all five required jobs
completed successfully at the continuation CI #629 inspection: validation/exports,
platform/defaults, two clean native installations, populated upgrade and
CLI/history. Precision, frozen-consumer/reset and native-installation probes
pass for that exact parent; this new packet retains its own exact-source gate. Source work
continues on `feat/personal-working-candidate-features`. STATUS/#229 retain one
exact publication and next packet; no full native admission is inferred.

New guarded CLI forward **73** freezes complete dense binary candidate features
in capture/features/OFF-policy/shadow v3 over the unchanged bounded input schema.
Compact six-field schema/artifact references and
`CAPTURE_DIMENSION_ORDER_BINARY_V1` arrays bind the full immutable schema once
in the capture; exact original dimension order is decoded before core sorting.
No candidate-only tag expands dimensions; a complete zero vector has zero
coverage rather than unavailable features. Actual ranking-statement tags supply
both the existing adjustment and new vector. Candidate availability stays
`SOURCE_RANKING_STATEMENT_SNAPSHOT`, `availableAt:null`, commit UNKNOWN, with
cutoff only an input reference. No common capture/candidate MVCC instant or
historical availability is claimed. The immutable v1/v2 sources, cached
comparisons/pages/reset lineage and exact OFF scorer/delivery policy remain;
function identities/security/ACL/config, including precision72, are preserved.
No table/API or new control assignment is introduced.

The pure adapter reconstructs active v3 from frozen raw input and features,
retargets both state and observations to the ordinal audit contract, and aliases
all input Items/Events/UNDO targets before derivation. It checks support/vector/
scalar agreement with finite 1e-12 independent numeric tolerance, preserving
exact OFF. Complete scoped aliases must remain stable across later outcome
captures/batches. Source binding keeps the candidate availability unknown.
Candidate-specific STATIC/ORDERED support is Item-weight concentration, not
outcome sample size/confidence. V1/v2 and inactive v3 remain explicitly
unavailable. Owned native-producer fixtures add no observed native quality.

Full engine **193/193** with built exports, final adapter **27/27**, database
**140/140**, final candidate file **5/5**, research **19 + 23** and acceptance
**6 + 5** pass. Actual mode/domain/V2/V3 sources, 50-candidate × 32-dimension
bounds, inactive/overflow fallback, exact old rows/function metadata/precision,
four drift guards and genuine V2 cursor continuation after later catalog/
correction/reset changes are verified. The paired actual V2 large-name regression
(two inputs, 32 valid maximum-length dimensions, 50 candidates) is accepted at
measured **459,590 → 497,590 bytes**, below the unchanged **2 MiB** ceiling;
this is bounded-case evidence rather than universal near-cap headroom. Root lint/typecheck/dependency **43** /
mobile **478** / catalog contracts **3** pass; interrupted parallel catalog is
followed by a successful serial **441** run. Cached Edge fails on missing
`@supabase/auth-js`; complete local root check/fresh app exports/native receipt
remain unclaimed. Independent adapter/interop review, syntax/diff and **62**
Markdown / **291** local links / **97** anchors pass. All 72 old migrations and
root lock retain bytes; eight reviewed function bodies retain identities and
all metadata. Migration SHA-256:
`988e84d61ab2ff39e6b132e7e351dca56c8733b731ec78c6dd58afe3ac42ee8e`.
Next exact CI once, then bounded prospective enrollment and immutable own-
exposure/latest-rating/correction capture before untouched evaluation and
quality admission.
All bootstrap/independent support/transfer/first-session, Taste/anonymous,
genuine Shared, device and release gates remain. No main merge, hosted write,
APK or account/history reset.

## Frozen WorkingState order and support evaluation — 2026-10-10

Exact parent #317 source `78a79dd0cfb5e49b400357443bf8d54de01cf6e7`, tree
`105fb9abf38e88ae218628ad75bfc41f33ea6dd6`, has four required CI #627 jobs
passed at its single continuation inspection; CLI remains in progress.
Source work continues on `feat/personal-working-evaluation` without admitting
native/hosted behavior or quality. STATUS/#229 own exact publication and one next
packet; the September 30 checkpoint stays intact.

The continuation inspection of current-source CI #628 (`ff136d6a5da8f4f2757be74504fdbcc750d1f6e6`,
tree `dbff11aefb3eff9d838bff79c77f13154d0c8128`) finds four required jobs passed,
including validation/application exports, while CLI installation/history fails
the native exact OFF assertion. The caller's native precision setting was not
logged. A full-schema reproduction proves rounded JSON score serialization can
change binary values despite exact scorer/rank/policy outputs. New guarded
forward `20261010153638_personal_working_shadow_precision.sql` sets only the
comparison writer's function-local `extra_float_digits=3`, restoring the caller
on return. Both source generations retain exact new scores. Existing rows,
including previously rounded comparisons, stay immutable and may still fail an
exact audit; neither tolerance nor historical rewriting is introduced.
Migration SHA-256:
`57394e07607be2df9a02197926e8cc19b904b2cea5f012295545cff25c3e7f8c`.

The isolated portable audit freezes one actual OFF/STATIC/ORDERED pool, versions,
target/horizon and disjoint pairs before labels. Control creation/availability
and plan selection clocks cannot be substituted by the source cutoff. Typed
reconciled outcome captures retain scope/actor/source/exposure/maturity and
correction boundaries. One shared directional pair mask reports ordinal
agreement/tie/disagreement; absent/unavailable evidence stays unscored and all
planned pairs retain coverage. Synthetic metrics are separate. Batch lineage
checks prevent the same raw observation/revision/experience or subject-Item pair
from multiplying units; subject/session clusters are not statistical independence.
No rating RMSE, confidence/probability, causal uplift or admission follows.

Candidate-specific Item coefficients collapse all tags before weighted effective
Item concentration is calculated under actual STATIC/ORDERED weights. This is
component influence, not independent outcome N. The strict Kajo plan adapter uses
real frozen source/control rows and exact OFF/policy provenance; owned SQL
producer fixtures demonstrate interoperability, without native observed quality.
No native prospective enrollment or outcome capture writer is delivered yet.
Current native pools retain adjustment scalars but no complete candidate feature
vectors; native candidate support reports `FROZEN_CANDIDATE_FEATURES_UNAVAILABLE`
without consulting later catalog tags. Full generic features exercise support
diagnostics, without certifying native support.
Fresh continuation validation: full engine **178/178** with built ESM/isolation
graphs, full database **135/135** including actual v1/v2 SQL producer interop and
**4/4** precision regressions, research **19 + 23** and acceptance **6 + 5** pass.
Populated true v1/v2 artifacts exercise caller -3/0/1, exact OFF float8 bytes and
delivery fields, cached receipt/row bytes, only approved function config changes,
error-path restoration and injected score/rank/selection/row/body/ACL rejection.
Native CLI adds the populated receipt and unchanged strict bridge fixture at
caller0. Independent precision review is clean. Fresh offline root check passes
lint/typecheck/dependency **43**/mobile **478**/catalog **444** (**441** scripts plus
**3** contracts), then Edge registry loading is interrupted (130); cached-only
fails on missing `@supabase/auth-js` metadata. Complete local root check, fresh
application exports and native execution remain unclaimed. Docker/local advisors
remain unavailable. All **62** Markdown
files, **291** local links and **97** anchors resolve; syntax/diff checks pass.
All **71** previous migrations, old engine/scoring source and root lockfile
retain bytes; this config repair is migration **72**.
Next repaired exact CI once, then versioned native candidate-feature freezing with old
captures and exact OFF preserved, followed by prospective enrollment/own exposed latest-rating
correction capture, a preregistered untouched evaluation window and observed
coverage before quality. Preserve V1 reward meaning, bootstrap/independent
support/transfer/first-session, Taste/anonymous, genuine Shared, device and all
release gates. No main merge, hosted write, APK or account/history reset.

## Bounded private native WorkingState reset controls — 2026-10-10

Exact parent #316 source `0b98c3eaa2d7b6c44a6460d1de041d9cec782e5a` contains
the finite 1e-12 vector-oracle repair; OFF/nonnumeric/source bytes stay exact.
At the single CI #626 inspection validation/exports, platform/defaults, two clean
native installations and populated upgrade pass; CLI remains in progress.
Source work on `feat/personal-working-reset` overlaps without claiming native
admission. STATUS/#229 own exact publication and one resumable task.

The new CLI-generated forward adds a private immutable scoped reset-control
ledger and API-denied security-invoker controller. Reauthorized exact receipts
precede quota/time checks; new writes require READ COMMITTED and a post-lock
server instant. There are at most 128 controls per actor/PersonalProfile/session.
Capture v2 reads full cutoff-visible controls together with its bounded complete
Item/correction prefix in one MVCC statement, freezes latest resetAt and excludes
at-or-before taste/activity. Reset adds no taste, history deletion, clock refresh
or four-hour session renewal. Control overflow abstains without partial evidence.
New features/off-policy v2 retain exact default OFF; v1 frozen sources/shadows,
page retries and copied V2 windows remain supported. Future fresh pages see resets.

Raw controls survive forecast-only erasure to prevent stale-intent resurrection;
actual User/Profile/session cascade removes them. API denial, parent-only immutable
guard and old-object/row preservation remain enforced. All 70 previous migration
files and root lockfile retain bytes. Existing native CLI acceptance gains bounded
populated/runtime probes and independently connected reset-ID/Profile/quota and
source-erasure lock races with exact owned cleanup. Migration SHA-256:
`402250688e24c3862f61c2d2448d35a715c5016bf611da84501224fdd07f774b`;
eight exact guarded function-body transforms preserve old identities/metadata.
Full database **130**, affected **22**, concurrency fixture/source **3**, engine
**137**, research **19 Python + 23 Node** and acceptance **6 + 5** pass.
The old bridge runtime smoke passes on the latest schema. Independent reviews,
syntax/diff and **62 Markdown / 287 local links / 93 heading references** pass.
Fresh root lint/types, dependency **43**, mobile **478** and catalog **444** pass
before Deno registry Connection refused (exit 1); no full root/fresh export pass.
Local Docker/live advisors are unavailable (local54322
connection refused); source/PGlite tests do not certify actual races or quality.

Next resolve exact CI once, then prospective versioned OFF/STATIC/ORDERED quality
and effective independent support/bootstrap/transfer/first-session evidence.
Public reset UI/API, adaptive Taste/anonymous prerequisites, genuine #232F Shared,
#306, #229 device/fresh-account, planned group/today flow and all release gates
remain open. No main merge, hosted write, APK or account/history reset.

## Native WorkingState numeric comparison repair — 2026-10-10

PR #316 source `7593e7b397134778fb1ac041e2d312cbd321125d` fails CI #625
validation only at a seeded SQL/JavaScript ordered-vector strict-equality check,
with roughly 8e-17 last-digit roundoff. Platform/defaults passed; other native
gates were in progress/skipped at the single inspection, not accepted. Scalar
vector parity now requires exact keys, finite numbers and 1e-12 tolerance;
state/provenance and genuine OFF scores/ranks/selection stay exact. The concrete
CI pair passes and material differences, malformed numbers and missing/extra
controls/features fail. Final affected **13/13** pass; full database
**118/118** passes. Independent review and syntax/diff pass. All **70**
migration files, runtime source and lockfile remain unchanged. STATUS/#229 own
new exact-source CI and the gated next native reset lifecycle/control task.

## Native Personal WorkingState capture and frozen controls — 2026-10-10

Exact parent #315 source `523d8eb6eb45045da6f9b9c4327b96b3a5d036ea` passes
all five required CI #624 jobs at the single continuation lookup. Current source
is `feat/personal-working-bridge`; STATUS/#229 own publication and the one next
task while preserving the complete September 30 checkpoint.

The new CLI-generated forward freezes authorized Personal session/correction
closure and current Item-tag features in one bounded MVCC statement. Both native
rankers consume versioned capture/features with exact default OFF scores. Shared
remains without this capture. The precise Personal policy suffix is accepted by
V2 windows; copied continuation preserves the original source while V3 captures
new evidence. Native no-session/empty/overflow or unsupported-source/precision
captures remain inert, with no partial evidence or invented dimensions; portable
input validation stays strict. Actual owner-only private immutable
OFF/STATIC/ORDERED comparisons rescore frozen candidates with the original genome
and final delivery policy, rerank/reselect and follow source/actor/Profile erasure.
This is not new evaluation support, automatic admission, serving ON, reset or UI.

Four guarded old-body edits preserve metadata and old rows; all 69 older
migrations and lockfile remain unchanged. Existing CLI gates gain populated-upgrade
and runtime capture/consumer probes. Validation: database **117/117**, engine **137/137** plus built ESM/import graphs, research **19 Python + 23 Node** and acceptance **6 + 5** pass.
Tests cover all V2/V3/domain/mode combinations, copied continuation, 24 seeded
prefixes/480 Events/72 numeric controls, source/precision/resource fallbacks,
corrections and authorization/immutability/erasure. Independent reviews pass.
Fresh root lint/types, dependency **43**, mobile **478**, catalog **444** pass before Deno registry
connection refusal; no complete root/export/native/advisor pass is claimed.

Continue exact-source CI once, then bounded native reset lifecycle/control with
frozen-source, retry and scope tests. Prospective OFF/STATIC/ORDERED quality,
effective independent support/bootstrap and real first-session usefulness follow. Anonymous prerequisites precede real adaptive Taste.
Genuine #232F Shared consumption, #306, #229 configured-device/fresh-account,
planned consent-based 2–5 group/five-option today flow and all release gates remain.
No main merge, hosted write, APK or account/data reset.

## Bounded Personal session state and next social planning — 2026-10-09

Continue from exact #314 source `b822fcadf9b9c78eeeaf213ac2543dd52467810e`.
CI #623 completed failure only in the CLI gate; the other four required jobs,
including full validation/exports and native installation/upgrade, passed. The
CLI fixture's five legitimate system Lists require an initialized full snapshot
for active checks and the original full snapshot for owned-cleanup restoration.
The correction preserves all 17 relation count/hash checks and race/cleanup rules.

The owner queues compact consent-based 2–5-person creation under 16.2 and a bounded
five-option Shared “watch/read today” session under 16.4 after round/rewatch
evidence. Initial adaptive Taste remains required before release. Planned session
veto/seen replacement neither rewrites history nor supplies confirmed group
outcomes; all requirements remain open. Product/domain documents own semantics.

The completed separate `./working-state` and `./adapters/kajo-working-state`
source exports represent bounded ordered Personal session intent with independent
latest Item support, complete correction closure, selective clear/UNDO, equal-time
ambiguity and explicit reset/expiry. Default bounds are 128 records/32 Items/32
features/256 invalidations, two distinct Items, four-hour session/30-minute idle
and a ±0.25 uncalibrated component. Only selected-session Item-linked activity
refreshes the clock; other-session corrections cannot import taste. OFF is default,
with explicit STATIC/ORDERED controls. Stored creation is an availability proxy,
not commit certification. Native serving, Shared algorithms and old E1/scalar/
frozen traces remain unchanged; native admission and MVP-ALG-004 stay open.

Database **105/105**, engine **137/137** plus built ESM/import graphs, research
**19 Python + 23 Node** and acceptance **6 + 5** pass. New **60** unit tests,
actual full-schema command bridge and
full initialized/original canonical-snapshot regression pass, including final
strengthened cross-session correction/UNDO and old Event/receipt/run preservation.
Independent review, syntax/diff and **62 Markdown / 283 local-link / 89 heading**
audits pass; all **69** migrations and the root lockfile retain bytes. Fresh root lint/typecheck, dependency **43**, mobile **478** and catalog
**444** pass before Deno registry `Connection refused` (exit 1). No complete
local root or fresh application-export pass is claimed; application source/build
inputs are unchanged in this packet.
STATUS/#229 own exact publication and one current handoff to a bounded native
Personal capture/consumer bridge with versioned shadow/static/off admission.

## Native memory/scoring parity and execution audit — 2026-10-09

The owner requests continuation, a current-documentation audit and future-aware
resequencing. Published #313 source `16e8e64a382fa07fd49b78815dc1339d0fa3d72a`
is the exact parent; CI #622 remains in progress at the single continuation
lookup. The audit finds no broken active local links, but corrects stale
portable-foundation, publication, UI-disposition and anonymous-dependency
summaries while preserving dated evidence and outstanding acceptance.

ROADMAP prioritizes the Personal BOOK/MOVIE vertical slice through native memory/
serving parity, ordered session/state policy and adaptive Taste/frozen challenge.
Independent Shared/source/native/device work can proceed alongside it; the
genuine #232F consumer and all first-release requirements remain queued gates.
Anonymous identity and minimum retention/abuse/measurement precede real Taste
acceptance. Advanced group models, optional public-data model admission and
later engine generations do not serialize every Personal source increment.

The completed source correction removes the serving-only native 365-day clamp
through the shared private unclamped 180-day helper. New live metadata names
`native-long-term-decay-v2` / `prediction-v0.5-native-decay`. Finite native
Event/UNDO occurrence cutoffs exclude future/nonfinite inputs;
`nativeEvidenceAsOf` discloses the existing distinct memory/base clocks, without
claiming commit-time availability. Strengths, ShortTerm, bootstrap floor,
structural features/genomes and old frozen replay remain preserved. The pinned
CLI-generated forward SHA-256 is
`fb1bdb933a287b4d2942cc821162a712ccb2669bf80e63fa72d93798bd0f6f98`.

Full database **103/103**, final populated/frozen-parity target, engine **77**,
research **19 Python + 23 Node**, acceptance **6 + 5**, independent review and
syntax/diff checks pass. All 62 Markdown files / 279 local links resolve.
Fresh root lint/types, dependency **43**, mobile **478** and catalog **444** pass
before Deno registry connection refusal; separate application smoke fails closed
without local production Supabase configuration. No complete root/export/native
activation or measured-quality pass is claimed. The existing required CLI gate
now includes populated upgrade and live math/serving/frozen-parity stages; Docker
native execution remains CI evidence. All 68 earlier migrations and lockfile
are unchanged. STATUS and #229 own the one exact publication/continuation;
Phase 14 remains open.

## Prepared pre-first-response prediction input — 2026-10-09 / #232F

The continuation starts from published #312 source
`6708f2a56ba61385898d8dd5ed823095a3d2b25b`, with CI #621 still in progress at
the single continuation lookup. The next bounded input producer freezes the
whole current enrollment and zero-response OPEN/RECONFIRM prefix before any
answer in the target experience, plus explicit same-roster prior outcome
captures. Unknown, clear and old-set answers reject a new first-response capture.
Private immutable source dependencies remove whole copied inputs during source
withdrawal, and guarded owner preparation covers current/former copied actors.
`INPUT_CAPTURE_ONLY` keeps actual forecast consumption unrecorded and historical
feature/learning/reward admission closed. Existing serving and ordinal behavior
remain unchanged. Final source passes database **102/102**, engine **77/77**
plus built ESM graph checks, research **19 Python + 23 Node** and acceptance
**6 + 5**. Root lint/types, dependency **43**, mobile **478** and catalog **444**
checks pass before Deno registry `Connection refused`; no complete local check
or fresh application-export claim is made. Populated preservation negative
controls and the complete enrollment/prefix/source/erasure matrix pass, including
legacy UUID/numeric spellings and exact retries at stronger isolation.
Independent source reviews pass; old migrations and root lockfile remain exact.
Nine independent-session lock orders join the required native CLI gate, but
Docker/native execution and live security advisors are unavailable locally.
STATUS owns exact source publication, #229's preserved handoff and the genuine
consumer lineage that follows. Source tests/probe implementation do not close
native, measured-quality, learning, device or Phase 14 acceptance.

## Portable exposed-outcome ordinal audit — 2026-10-08 / #232E

The owner's long continuation advances from narrow #311 startup lifecycle source
`c3b98bbaf1f4c7cb26b2a3f7c76ced6c6503e873`; its new #620 native CI acceptance
remains open at publication. The separate portable pair/batch evaluator and strict
Kajo snapshot adapter declare a complete exposed-vector Pareto target against
both Items from one frozen production/shadow pool. Required scoped member/
enrollment handles, own per-actor exposure, versions/windows, zero/ties/missing/
disagreement, maturity and pre-OPEN stored-clock boundaries are executable guards.
The owner-only offline command writes bounded private non-overlapping audit
reports outside Git with fixed errors and no overwrite/network/database writes.

Media and non-media generated fixtures supply zero observed quality labels;
actual existing SQL producers feed a disposable PGlite adapter/CLI test, including
new-capture correction identity and immutable earlier replay. Source/ESM checks
preserve the independent root/ordinal graphs. This does not change SQL serving,
weights, stored metrics, rewards or promotion. Membership/commit/selection remain
historically unproven, independence unestablished, uncertainty unavailable and
learning/historical feature admission closed. STATUS owns validation/publication
and the prospective membership/prefix/consumer lineage gate that follows.
Final source passes database 101/101, engine 77/77 with real ESM graph checks,
adapter 21/21, core 12/12, combined CLI/SQL bridge 11/11 and research 19 Python +
23 Node. Final engine lint/types and independent reviews pass. Root check again
stops at Deno registry Connection refused after available earlier stages pass;
no complete local pass, measured native quality, hosted activation or main merge
is claimed. Parent application/four-export evidence and all migration/lockfile
hashes remain intact.

The owner explicitly authorized public publication on 2026-10-09 with
**"Saat julkaista"**, resolving the previous automatic review block. The validated
implementation remains `5235db39aacdca10913a13656a04c99d8199b425`; authorization/
handoff follow-ups change documentation only. Publish #232E on the existing
`Kajooja/Kajo` remote and record its exact resulting PR/source/tree/run in the
single active #229 handoff. STATUS owns the subsequent required-gate inspection
and bounded prospective evidence work; all completed validation remains unchanged.

## Isolated CI startup lifecycle — 2026-10-08 / #232

Completed #310 / CI #618 passes validate, platform/defaults, populated upgrade
and CLI history/runtime, including actual independent worker/eraser races in
both lock orders. Its first two-install stack startup fails before application
SQL with the same mixed symptoms as #617. #310 remains an unmerged source packet
with one failed required gate; its backend APK is intentionally skipped.

The narrow helper repair adds sanitized terminal/process diagnostics and bounded
owned-container/resource state, separates recovered pull warnings from exact
pinned CLI fatal templates, rejects pre-existing labelled/named project resources
before startup, verifies cleanup absence and preserves both primary and cleanup
failures. Owned workspace removal still runs if CLI stop fails. No outer startup
retry, image/version/port change or application SQL retry is introduced. Local
process fixtures pass 24/24 plus a final 2/2 assertion recheck; the complete
database sweep passes 97/97. Independent final review finds no blocker. Lint/
types, locally available non-edge suites and all four production Hermes exports
pass. Root check reaches Deno registry dependency retrieval, with no complete
local pass claimed. The native startup cause remains unconfirmed; these fixtures
are not native installation acceptance. A finite dependent-packet #619 inspection
now confirms platform, validate and two clean installs pass, with populated upgrade
failing before startup on unavailable container-list inventory and CLI still
running. A follow-up uses a bounded 30-second operational inventory budget plus
fixed process/phase/exit diagnostics; default diagnostic snapshots keep five-second
reads. It does not retry or infer a confirmed root cause from missing state. Its
required new run remains separate. Final startup/readiness tests pass 27/27 and
the complete final database sweep passes 100/100. Independent review finds no
blocker. Fresh root check stops at Deno registry Connection refused after
available gates pass. STATUS owns the single
active handoff; portable Shared ordinal evaluation follows separately without
changing serving or admitting historical features/group reward.

## Closed prediction-source preparation — 2026-10-08 / #232D

The owner's continuation starts from #309 source
`0d756feb78dfa6e7fab24108a3ec7b215d24c59b`. CI #617 passed four gates,
including native #232C visibility/replay, while two-clean-installations failed
in Supabase startup before application SQL. One failed-job rerun was requested
without changing source; a single completed verification confirms all five
#617 gates now pass. Mixed diagnostic
symptoms are not an automatic-retry rule. No progress polling or backend APK
request is added; main/hosted/device acceptance remains separate.

The bounded forward adds closed owner source preparation and exact transaction/
backend/row DELETE permissions, preserving ordinary immutability. Real page
descendants, shadow dependencies, copied comparison traces and whole affected
GLOBAL/shrunk PROFILE evaluation batches are erased atomically. Unresolved
promotion/assignment/rollback influence blocks before writes. The first-lock
lifecycle gate serializes declared source/evidence writers against preparation.
Actual User/Profile roots remain for owner deletion in the same transaction;
residual canonical Item-state restrictions are still atomic and explicit.
Automatic account lifecycle and concurrent import/bootstrap integration are
not activated. Final migration SHA-256:
`d0a2de045fccf4fb5f1413ad3c24054f5c3c7a87f6cb186829ff39d1e7aab671`.
The complete database sweep passes **90/90**, and the final combined focused
recheck passes **2/2**, including the NULL promotion-allowance escape, copied
orphan windows, all15 exact body changes, API/permit guards and residual root
restrictions. Independent final review finds no blocker. Lint/types, locally
available non-edge suites and all four production Hermes exports pass; local
root check stops at Deno registry Connection refused. Native worker/eraser proof
is in required CI, with no local native or all-writer race claim. Historical
page-forward scorer preservation is asserted before later approved lifecycle
changes, then current runtime still runs against the full chain. STATUS owns
publication and the next metric gate; source erasure does not itself improve
prediction quality or admit a joint reward.

## Frozen observed Shared outcomes — 2026-10-08 / #232C

The owner's continuation starts from exact #308 source
`70891b757dca5d01d245b9fbaf4f6cd6e0e73288`. All five #616 gates pass, including
independent-session commit visibility; its backend APK is deliberately skipped.
Separate #306/#614 also completes its labelled APK. These remain source results,
not main/hosted/device acceptance. The prior dated entries are preserved below.

The additive capture freezes the outcome JSON actually observed, selected
receipt/revision, cutoffs/maturity/versions and server observation time. Exact
ID retries replay stored JSON; new commits/exposure/corrections need new IDs.
An immutable receipt foreign key supports independent capture before a newer
response commits and cascades successful source erasure into comparisons.
The paired-support artifact freezes the same vector and common actor-specific
support mask for production/shadow under an explicit evaluation window and
strict matching frozen candidate metadata. Missing support remains diagnostic;
metrics/advantage/group reward and learning remain unavailable.

Final migration hash is
`d018d6d5901e690991e7b3bd35b5f000d8ceec79739c51cf17abbb7a1a5a793e`.
The full database sweep passes **89/89** and the final focused recheck adds
explicit REPEATABLE READ/SERIALIZABLE allocation rejection with preserved exact
retry/replay. Independent review finds no source blocker. Lint/types and all
locally available suites plus four production Hermes exports pass; root check
stops at Deno registry Connection refused. Native execution remains required CI.
Native CLI proof must complete an older-prefix capture while the final response
is still uncommitted, then show unchanged stored replay and an advancing new
capture. Populated/rollback matrices preserve every old object/row/ACL and prove
retry, correction, zero/unknown/N-member support, quotas and derived erasure.

Review identifies an inherited blocker: processed SleepLayer shadow artifacts
can prevent source User/Profile deletion through old foreign keys and immutable
DELETE triggers. The new packet tests and records the rollback boundary rather
than claiming full erasure. The next bounded source repairs that old dependency
with authorized deletion, retained ordinary immutability and populated/native
scope/rollback proof before any joint metric admission or hosted activation.
The subsequent target/metric must use real exposed outcomes and these frozen
vectors. Historical feature availability, #306 integration, Phase 16.3 UI and
MVP acceptance stay separate and open; no external-data operation is repeated.

## Receipt-prefix Shared round outcomes — 2026-10-08 / #232B

The owner asks to continue. All five #307 / CI #615 gates pass, including native
round races and the populated rehearsal; its unrequested backend APK is skipped
intentionally. Separate #306 / CI #614 also passes all five gates, with its
labelled APK still in progress at the one-time inspection. Those are source
checks, not main/hosted/device acceptance.

The next bounded source implements `shared-round-outcome-v1` over immutable
command prefixes. Participant sets and individual 0–10/unknown/cleared/missing
responses survive cutoff replay, corrections, cancellation and reconfirmation.
Maturity is a declared elapsed window; late exposure remains per response and
cannot borrow another actor's trace. Minimum/spread and coverage are descriptive;
one round is one observation unit. No scalar reward, group satisfaction or
learning activation follows from completion.

Historical membership between commands and actual commit visibility are unknown.
The reader explicitly withholds historical feature eligibility. An independent
native reader/holder proof must demonstrate that the same acceptance-time cutoff
can gain a receipt after commit, rather than falsely claim frozen replay from a
timestamp. Populated upgrades preserve all existing rows/functions/ACLs/receipts;
new matrices verify temporal and privacy boundaries without altering old readers.
STATUS owns final source hashes, validation, publication and the exact next
visible-prefix/evaluation-admission packet. Phase 16.3 UI and MVP gates stay open;
no hosted deployment, history reset, external-data operation or model promotion
is part of this packet.

Final source SHA-256 is
`2fbab2b59e796138d18895b2fe8c1213ff2c7e9cfa8df57bb8af79e85ca3a85f`.
The complete final database sweep passes **88/88**, and independent review finds
no blocker. Lint/types and all locally available dependency/mobile/catalog/
engine/research/acceptance suites plus four production Hermes exports pass.
Root check stops at Deno registry Connection refused; Docker/native visibility
execution remains required CI evidence. No complete local root/native pass or
hosted application is claimed.

## Working APK and Shared evidence continuation — 2026-10-08 / #232

CI #612 passed all five required gates and APK on #305 source `36a788d`,
including the previously pending native cancellation/rollback, populated upgrade
and concurrency checks. The owner reports the current APK works and selects
continued roadmap implementation. DEVICE_TEST records positive acceptance of
the exercised append/layout correction without inventing an installed checksum,
device/OS or unreported subcase. Broader #229 and release gates stay open.

The next distinct Phase 14.1 implementation is #232's SharedRatingRound evidence
foundation: freeze participants, preserve each actor's response and prediction
origin, and distinguish pending/completed/corrected/cancelled evidence without
inventing group reward. Legacy one-actor Shared history is retained as legacy;
no responses are backfilled. Coordinated UI belongs to Phase 16.3, while
versioned joint outcome/eligibility and learning remain Phase 14 dependencies.
STATUS owns the exact branch, validation and subsequent bounded action.

Delivered source: `20261008122349_shared_rating_round_evidence.sql`, hash
`4e80e0daadaa537e85bb14ce11fffb3f4fc263164e4db3ee7182f4be75514796`.
The final 87-test database sweep passes, including populated preservation and
the expanded participant/origin/retry/correction/deletion/capacity matrix.
Independent review found no blocker; native observed-blocker races remain
mandatory CI evidence. Lint/types and remaining locally available suites/four
exports pass; Deno registry Connection refused prevents claiming a complete
local root check. The next bounded algorithm dependency is the versioned as-of
joint outcome/replay reader, before these response vectors enter learning.
The independently found Shared overlay exclusion bypass has a separate narrow
correction in #306; preserve both sets of CLI probes when integrating.

## Shell-quote audit recovery after CI #611 — 2026-10-08 / #305

CI #611 on `da376700fc24bae894383533f11e6168da74e36d` stopped at the fresh
dependency audit: shell-quote 1.10.0 had one critical unmitigated finding,
GHSA-pqg4-j6r4-53mv. Platform and two clean installations passed; CLI, populated
upgrade and APK were skipped. The preceding timeout correction is still native
acceptance work, not a newly reproduced timeout failure.

The compatible lock leaf now uses upstream 1.11.0; React DevTools 6.1.5 accepts
it under ^1.6.1 without changing the parent or framework graph. Line-terminator
rejection after comment tokens and ordinary editor/argument parsing are covered
against the actual installed consumer. The existing verified braces/forge fixes,
raw advisory reporting and all five gates remain required. STATUS owns final
validation, the dated exact-lock audit receipt and the one-time replacement-run
handoff. No hosted migration/data reset, main merge or #229 acceptance is implied.

## CLI command deadline after CI #610 — 2026-10-07 / #305

The owner reported #610 failed on `b1c7ad`. Four mandatory jobs passed;
CLI installation/history ended with Docker ETIMEDOUT after reset 15, before the
new populated-chain upgrade completed, so APK was skipped. Unlabelled operation
errors cannot distinguish the two following Docker inspections from SQL work;
no native planner or deployed-forward cause is proven by that log.

Fixed operation/stage labels, elapsed-time reporting, bounded named SQL budgets
and server statement/lock limits now make the failure actionable. The native
deadline canary must prove server cancellation and transaction rollback.
Populated chain upgrade reuses the compact candidate-pool fixture while retaining
all old receipt/window/page and row/OID/owner/ACL/function parity checks.
Full 145/domain traversal, actual 1000 cap, provenance and real concurrency remain
required. CLI's 25-minute outer job and all five APK gates remain unchanged.
Deployed SQL bytes and existing hosted data are untouched. STATUS owns final
verification/publication and one-time replacement-run handoff; no CI polling.

## Catalog append, compact layout and later-page evidence — 2026-10-06 / #199

CI #607 on `00f0bad` passed all five mandatory jobs and produced APK, resolving the
recorded #304 transport/build failure. The owner reports phone 4–6 passed;
BOOK/MOVIE end pull/button 1–3 still fail by resetting the same bounded search.
No exact installed artifact/device identity was supplied.

The owner requested all corrections now and a bounded next repository step.
Protocol 3 adds server-owned prefix exclusion before bounded ranking admission,
fresh immutable per-page runs, scoped cursor/receipt retries and distinct
eligible-catalogue exhaustion versus reader-limit states. Legacy 1/2 and deployed
SQL bytes stay unchanged. The mobile list appends without replacing its view,
uses bottom-viewport downward gestures and keeps per-Item prediction origins.
Header controls share one row and redundant nested bottom/grid space is removed;
the actual dock/system safearea remains.

Phase 14.1/14.2 acceptance extends to 120+ eligible Items per domain and later-page
zero-rating/late exposure/frozen replay/evaluation. This is the next independent
bounded task; no new catalogue acquisition or later-phase identity/social work.
STATUS owns exact new-forward rollout, publication/check results and next APK.
Phone acceptance and remaining #229 release gaps stay separate; preserve data.

Validation/rollout: 478 mobile tests, root lint/typechecks, dependency/catalog/
engine/research/acceptance suites and main/acceptance iOS/Android exports passed.
The corrected catalogue-chain full-schema case passed after the sweep's actor
error-classification correction; independent later-page provenance passed at
both float settings. Deno registry access was refused locally; Docker/native
Supabase/CLI/concurrency still require CI. All gates remain mandatory.

Reviewed source `5089d0abb65965c669fa540de9a025e34f92f178` supplied the exact SQL
SHA-256 `8ef909c3dc1d6f933536216319978e4ae522d5db91509ec89289e977e54418e8`.
Only the new forward was applied to preflighted project `operator-reviewed-project` as
provider `20261006143148/catalog_prediction_chain`; filename now matches tracking
with unchanged bytes. Full prior function owners/ACLs and 152 unrelated bodies
survived; only the private dispatcher changed, with five owner-only helpers and
three RLS/API-denied tables added. Existing application row hashes stayed equal.
Hosted rollback probe verified 80 distinct Items/four pages for each BOOK/MOVIE;
57 old authorized receipts replay unchanged. Exact receipt:
[rollout](../catalog-chain-rollout-2026-10-06.json). Main/#229 acceptance stays open.

## CLI Data API recovery after CI #606 — 2026-10-06 / #304

CI #606 passed validate (fresh security audit, Deno and four exports), platform,
two clean installations and populated upgrade. CLI installation/history alone
failed with `fetch failed` in its local catalog RPC transport, so its dependent
APK was skipped. The old log cannot establish which RPC or transport cause;
the source and runner-allocation failures from earlier attempts are distinct.

Before each RPC, the isolated harness now requires a successful read-only Items
query. Twenty bounded readiness attempts cover recognized temporary transport
errors, owned timeouts and gateway 502/503/504; permission/schema/malformed
responses fail immediately. IPv4 loopback and closed connections avoid resolver
and pooled-socket dependencies across resets. The POST is sent exactly once,
with its original response assertions retained. Fixed reset/RPC sequence labels
and sanitized cause codes give actionable diagnostics without credentials.

The full local database suite passed 81 tests; the final targeted suite passed
15, including actual loopback socket failure and stalled-body timeout recovery.
Root lint/typechecks, dependency/mobile/catalog tests passed, then Deno lockfile
resolution failed on the local refused npm-registry connection.
Local Docker is unavailable, so GitHub still owns actual Supabase stack/runtime
verification. All five original gates remain mandatory before APK. STATUS owns
the next labelled PR head and the owner's no-polling build handoff.

## APK retry and dependency-script portability — 2026-10-06 / #304

CI #605 attempt 1 failed in hosted-runner allocation before any steps ran.
Attempt 2 passed platform and two-clean-installation gates, but validate again
acquired no runner; the remaining dependent jobs, including APK, were skipped.
GitHub's corresponding global Actions incident is resolved at this checkpoint.
STATUS owns the exact source and owner handoff.

The retry review corrected Windows postinstall path containment and direct
`npm.cmd` execution. Native path-relative containment rejects root/sibling/other-
drive escapes. npm-run audit invokes the CLI through Node without a shell;
direct Windows invocation uses a fixed command via `cmd.exe`. Portable fixtures
cover Windows/POSIX path rules and CLI filenames with spaces/metacharacters;
no native Windows runtime is claimed.

Fresh audit found two additional high advisory leaves, compression and
source-map-js. Their published fixes 1.8.2 / 1.2.2 fit the existing Expo CLI /
PostCSS ranges. Only those lock entries and compression's existing destroy edge
are refreshed. Security regressions exercise aborted compression streams and
bounded source-map offsets while preserving ordinary map use.

Local validation: clean npm installation and the fresh verified audit passed.
All 39 dependency tests, mobile/catalog suites, database/engine/research/acceptance
suites, lint, typechecks and all four Hermes exports passed. `npm run check`
stopped at the Deno registry connection refused by this local environment.
The complete CI Deno check and all five native gates remain required; this
checkpoint claims no completed CI/APK or physical-device acceptance.

The owner requested another APK build without polling after launch. Publishing
the new head of labelled PR #304 requests that run behind all five normal gates;
build completion and the six-case configured-device round remain open.

## APK audit recovery — 2026-10-05 / #238

The owner-requested terminal-refresh APK dispatch CI #603 failed in the fresh npm
audit: two upstream advisories produced 19 high-severity package findings. No APK
was built. Latest published braces 3.0.3 and node-forge 1.4.0 remain affected.
The owner requested correction and another APK run, with completion followed by
the owner. STATUS owns the active source/run identity.

The narrow correction installs hash-checked depth guards in braces parse/compile/
expand/stringify and strict RSA DigestAlgorithm element count plus empty-NULL
validation. Real negative controls reproduce both upstream defects; regression
coverage preserves normal Metro matching, standard RSA signatures and PSS.
A verified audit keeps raw upstream findings visible, verifies every locked copy
and executes the security tests before classifying only those two corrected
advisories. Unknown/new findings and verification/transport failures still block.
No package alias, framework downgrade or blanket severity exception is introduced.

The CI `build-android-apk` label explicitly requests a same-repository PR build
behind all five existing gates; its artifact is bound to the PR merge checkout.
This source leaves #301/#229 unmerged and all phone acceptance open. The six-case
owner follow-up is recorded in DEVICE_TEST. No hosted/data changes are included.

Local validation: clean installation, fresh verified audit and all 20 added
security/audit regressions pass, including both distributed forge browser bundles.
The root check passed lint, types, dependencies, mobile and catalog suites, then
stopped at Deno's refused registry connection in this environment. Database,
engine, research and acceptance suites passed separately, as did all four Hermes
smoke exports. The complete Deno and isolated platform/installation gates remain
mandatory in the new GitHub run; no completed CI or APK is claimed here.

## Phone recovery result and terminal refresh — 2026-09-30 / #199 / #240

The owner reports successful network loss/reconnection. The actual installed
run/SHA, device/OS and page were not supplied; retain this basic positive result
without claiming the remaining native/recovery/fresh-account gates. Issue #240
records its scope. The existing CI #596 APK remains the requested test source.

The BOOK end notice instructs pull-to-refresh but native refresh is only available
at the top. #199 records this new defect. The focused source branch
`fix/199-discovery-end-refresh` adds a terminal-notice downward gesture and
accessible refresh button, reusing the same reader and Shared refresh boundary.
Short/upward/sideways gestures are ignored, repeat triggers coalesce and unmounted
footer callbacks cannot act on a changed Profile/request. Six focused component
regressions cover these behaviors. Root checks/CI and physical gesture acceptance
are separate; a corrected APK is needed for the new terminal repeat. No deployed
migration, data, account or existing operation is changed. STATUS owns continuation
and DEVICE_TEST records the owner-facing repeat; broader #199 UI work stays in
its existing ROADMAP slot.

## Native document reconciliation and fixed APK source — 2026-09-30

Security PR #299 is accepted on main `1c26e0d72d30662f70c3cf061790cd2672443f43`
after all five CI #597 gates at reviewed `0f210b19e07cd06aad236c028ef70703b694105b`.
Native documentation head `9fac7ec772959465ea4b25bf8ad1b86de4fcef8e`, tree
`71a9f65489800ac2b450e1f55d104bc92df3bcd8`, incorporates that accepted main.
One STATUS conflict was deliberately resolved with accepted main's current packet
and the native historical tail; the complete sprint record is preserved.
Only those two Markdown files differ from standalone runtime source
`2cfa2f3b206cba87712f3d531a78f00e24e59791`. All executable files and APK
build inputs remain byte-identical. [CI #599](https://github.com/Kajooja/Kajo/actions/runs/36689852558)
owns the new document head's required checks.

The frozen runtime's PR CI #595 and all five standalone CI #596 gates pass,
**1,057 tests/four exports**, with zero known advisories. CI #596's actual APK
conclusion/artifact and that frozen SHA own binary identity; the document merge
does not constitute a different application build or device observation.
Configured-device #240 recovery and remaining native/fresh-account observations
remain the single next packet after these source/build checks. #229 stays draft.


## Branch cleanup and standalone audit correction — 2026-09-30 / #229 / #238

The owner-authorized cleanup deleted **57 merged development refs** and retained
**10 necessary refs**, including main, draft #229 and all eight consumed #182
requests. Fresh candidate heads, merged-PR ancestry and branch-name/file-link
references were checked first; independent readback verified retained SHAs
unchanged. Accepted #296 is already an ancestor of main and native, resolving its
old hold. The [result receipt](../retros/branch-cleanup-2026-09-30.json) records
each deleted PR/head and retained dependency. The September 28 inventory and
historical entries below remain dated evidence. All 18 issue scopes retain their
ROADMAP slots and actual acceptance gates.

Native `c6509c6e17dd02aa77f5c48d56c789be0ff2ef13` passed all five CI #593
gates, 1,049 tests/four exports. Its September 30 [standalone run #594](https://github.com/Kajooja/Kajo/actions/runs/36681309205)
failed the now-current brace-expansion audit and produced no APK. The compatible
correction refreshes four leaves to 1.1.21/5.0.12 without parent/framework changes.
Eight consumer matching/hostile-input cases join the five existing dependency
regressions. Both clean installs, 13 dependency tests and each local root check
pass; separate exact-lock main/native receipts show zero current advisories.
Normal TLS validation was retained using system CAs for local Deno.

Draft #229 now publishes `2cfa2f3b206cba87712f3d531a78f00e24e59791`, tree
`ff0b9367aa2dd5227931a839880c5b0814dcaf4f`, including correction
`9a8b951ffefcbd53671f6046f3560f5a2ee33c5d`. [PR CI #595](https://github.com/Kajooja/Kajo/actions/runs/36686521092)
and replacement [standalone run #596](https://github.com/Kajooja/Kajo/actions/runs/36686741366)
own that head's exact results and artifact. Source PR acceptance for main remains
separate. After its required checks and successful APK artifact, the current
bounded action is the configured-device #240 reconnect and remaining native /
fresh-account observations. Existing deployed forwards/data and consumed
requests are preserved; #229 remains draft and no new device acceptance is
claimed. [STATUS](../STATUS.md) owns the exact continuation.

## Repository hygiene and dependency placement — 2026-09-29

The owner permits fixing current defects, scheduling incomplete work at its proper
future phase, and retiring superseded work after dependency checks. The single
[ROADMAP disposition table](../ROADMAP.md#unfinished-work-disposition--2026-09-29)
covers all 18 audited issues and draft #229. Later UX, Shared, identity, email and
beta work retain explicit prerequisites and acceptance; no release requirement
is removed or marked complete by this cleanup.
Seven issue descriptions were reconciled on September 29; all 18 open scopes
remain, with their current disposition in ROADMAP and publication checkpoint in
STATUS.

**Delivered source:** #294 diagnostic/all-copy cleanup and #295 production/input
guards are accepted as recorded below. #296 is now accepted at main
`8525ecf32a39757a1f660d41ffa788c7276f7bcc`, reviewed
`7b0062e668bda1fb5e2b247e1225dd42175256eb`, after all five CI #585 gates.
The exact-lock audit has zero known advisories and five added routing/tooling
regressions. This supersedes the earlier pending-CI instruction for that packet.

The isolated description-acceptance workflow now explicitly selects demo mode
for its root-check step, which has no backend configuration. The production
configuration correction otherwise rejects that step by default. The focused
config reproduction fails without the mode and passes with it; production and
APK settings are unchanged. Hygiene PR #297 is accepted at main `eef40fe`.

**Native source:** draft #229 at
`e41f84475704223bb8994e0e49f3101be2d1122b` passes all five CI #584 gates,
1,044 tests/four exports. Its nine conflicts and #240 reconnect source are
resolved, preserving accepted catalog attribution/cold history and ten deployed
forward files byte-for-byte. Accepted #296 and #297 are now included in the
published native head recorded in STATUS; PR #229 records its exact CI #590
verification result, independently of the predecessor checks.
Configured-device and fresh-account observations remain explicit; no new
deployment, account reset or device run is claimed.

**Scheduled / remaining:** Phase 14 evidence/catalog/adaptive policy/SleepLayer
acceptance still precedes Taste and the later launch loop. E1/D1/D2 are complete
bounded foundations, and optional model research is not a new release gate.
ROADMAP owns the detailed future queue. #230/#231 remain required pre-MVP work;
#240 now needs acceptance of its implemented reader correction rather than a
second implementation. Source fixes do not close #160 hosted operations or #182
rights/catalog usefulness. No branch-deletion result is claimed in this record.

**Files reconciled:** STATUS, ROADMAP, MVP, FUTURE_PLAN, UX_PRINCIPLES and the
September 28 retrospective now agree on source versus runtime acceptance and
execution ownership. Historical entries below remain dated evidence; their old
next-task directives are superseded by current STATUS.

Accepted handoff PR #298 is on main
`70d78daa8d5e587f84a5802b986aefd1f9fa55ad` after all five CI #591 gates.
This documentation-only integration preserves native source and its complete
historical record. Native checkpoint `6ed685d` passed all five CI #590 gates,
1,049 tests/four exports; the latest combined PR head requires its own checks.
STATUS owns the current source/device continuation. No runtime, SQL or dependency
change and no device acceptance follows from this merge.

## Accepted dependency/native integration checkpoint — 2026-09-29 / #229

PRs #294, #295 and #296 are accepted source on main. Native draft #229 separately
passed all five CI #584 gates after reconciliation through #295 and bounded #240
recovery. This continuation integrates accepted #296 into that native source.
The combined lock has a fresh zero-advisory audit (571 production / 936 total
dependencies), recorded under SHA256
`cb30bd8bb84fb2d3dac65e751092bd10e877ea0c06cdc83c58f20f1cdc71f7b9`.
Five fetch test mocks now declare one explicit transport signature for Vitest 4
and retain SDK compatibility checks; 410 mobile and five dependency regressions
pass. Exact-head five-gate CI remains required before source acceptance. Preserve native/fresh-account/device observations and historical SQL
bytes. STATUS owns the current bounded next action; the dated deliveries below
retain their original scopes. No new device observation or hosted rollout is
inferred from the two predecessor CI runs.

## Native reconciliation and reconnect correction — 2026-09-28 / #228 / #240

Reconciled the older draft #229 against accepted main through PR #295, retaining
current catalog attribution and cold canonical detail/history tests. The nine
conflicts covered four app files, three canonical documents and two database
probe runners. Both sets of independent concurrency/upgrade probes remain;
already deployed SQL is byte-identical. Tests that previously addressed the
removed global Item cache now exercise immutable delivered slates and canonical
cold reads. Collection history keeps render-time ownership checks through rapid
A → B → A, collection revisions and ItemType changes.

#240 uses SDK-57 `expo-network` with focus and AppState lifecycle ownership.
Recovery retains exact failed request/context/cursor, accepted prefix and timeout;
coalescing and a three-attempt budget prevent a notification storm. The previous
error stays through the pending retry and clears only on success. Expiry is still
explicit new search. Focused tests cover first/next pages, backend failure, network
flapping, deadlines/late responses, scope changes, stale initial reachability and
background/unmount cancellation. No action/exposure queue is reset or synthesized.

Local lint/typecheck, 410 mobile tests, 71 database tests and four Hermes exports
pass. Root `npm run check` reached Deno dependency fetching but local registry
access there stalled. Exact native head
`e41f84475704223bb8994e0e49f3101be2d1122b`, tree
`2c9d36532c8067e681b4577297f5d7ac84a3f889`, subsequently passed all five
[CI #584 gates](https://github.com/Kajooja/Kajo/actions/runs/36481134174),
1,044 tests/four exports.

Remaining configured-device/fresh-account observations belong to #229/#240;
prior #469 APK acceptance is not attributed to the new source.

PR #295 was accepted on main `cd224d277f33b105e63cd83126d111b12b64ba10`,
reviewed `aa7c2fc61ed99ea1e4ffcc39a07aaf6aa963d979`, exact tree
`0fd3fd2e3bd5b95294799121c2730f27ea70d490`, all five CI #582 gates,
880 tests and four exports. Hosted configuration/function rollout remains
separate from that source acceptance.

## Routing and tooling advisory remediation — 2026-09-28 / #238

The fresh audit reproduced 15 moderate affected package paths from three
advisories. The malformed-percent routing regression timed out before the fix.
The safe decoder's ESM default is now unwrapped by one hash-checked import change
in its unchanged CommonJS query-string 7.1.3 parent. Bare overrides and a major
parent swap are not used as compatibility evidence. Unexpected source/version
fails installation. Vitest is coordinated at 4.1.11, Vite stays 7.3.6, and xcode's
actual v4 UUID call works with 11.1.1. Expo/RN/router versions are unchanged.

The local npm 11.9 workspace-link override defect was reproduced: root overrides
alone silently preserved vulnerable leaves. Explicit root query-string/xcode
parents (also used by the regression tests) make the override graph effective;
clean `npm ci`, `npm ls`, real parser tests and a fresh zero-advisory audit verify
it. The pinned lockfile is recorded in the dependency audit receipt. Five
regressions join root check and CI runs the current-advisory check. Lint/typecheck,
mobile/engine/companion tests and four platform exports pass. Root check's local
Deno registry transport limitation remained; all five exact-head
[CI #585 gates](https://github.com/Kajooja/Kajo/actions/runs/36483069338)
subsequently passed. PR #296 is accepted at main
`8525ecf32a39757a1f660d41ffa788c7276f7bcc`, reviewed
`7b0062e668bda1fb5e2b247e1225dd42175256eb`, tree
`cadf4fe10cfe7d8296b761e69c39b7c3497b8c97`.
Node-only URL checks do not assert installed/not-installed native link acceptance.

PR #295 is accepted at `cd224d277f33b105e63cd83126d111b12b64ba10`,
reviewed `aa7c2fc61ed99ea1e4ffcc39a07aaf6aa963d979`, tree
`0fd3fd2e3bd5b95294799121c2730f27ea70d490`, all five CI #582 gates,
880 tests/four exports including 32 Deno tests. Draft #229 was independently
reconciled at `e41f84475704223bb8994e0e49f3101be2d1122b`; CI #584 validation
and all four database gates passed, with 1,044 tests/four exports. Device gates
remain separately tracked.

## Production configuration and auth input guards — 2026-09-28 / #160

Expo and mobile now share public configuration validation. Production requires
both public settings and non-loopback HTTPS; only explicit embedded demo mode
permits an unconfigured client. Secret/service-role/session/malformed key shapes
fail closed without echoing input, with legacy anon compatibility. The standalone
Android job explicitly pins production mode; actual Expo config tests cover it.

Password-auth now validates closed action/identifier/password shapes before
privileged lookup, bounds reading to 8 KiB/8,192 chunks/five seconds and returns
no-store responses. HTTP tests cover null/arrays/types, streaming/UTF-8/JSON limits,
stalled bodies and valid password/session behavior. Enumeration and distributed
abuse policy are preserved as separate unresolved release requirements.

Local lint/typechecks, 254 mobile tests, three production-config tests and four
Hermes exports pass. Root check is attempted; unavailable npm access prevents
local Deno dependency fetch. Required remote CI/Edge and exact source acceptance
are tracked in #160. No hosted function/configuration/data change is claimed here.

The preceding #182 correction is accepted through PR #294, main
`3500f9b709e5315cb864f9bcbf9f004c76596bce`, reviewed
`dc12785c4057151d3d3bd2faf160c69b99839550`, tree
`068f975577edbbc99eaeb5e4eba80b183ffd1f16`. All five CI #580/run 36476170169
gates passed, 867 tests/four exports, including 28 Deno tests. A separate command
verified all three synthetic keys absent on the final namespace-aware source.

## Terminal diagnostic and cleanup correction — 2026-09-28 / #182

The owner broadens continuation to unfinished repository work. The
[closure audit](../retros/2026-09-28.md) enumerates 18 open issues and draft #229,
concrete fixes and external acceptance dependencies. Main is the starting truth;
the older native branch has nine source/document/runner merge conflicts.

This packet fixes terminal evidence loss with a separate collector/result schema:
one bounded selected row, original identity predicate and fatal policy reason,
cumulative retention charging and pure replay. Failed results keep no candidates;
old entrypoints/schemas remain unchanged. No provider I/O or real diagnosis occurs.

Cleanup attempts all three copies despite individual errors, flushes directory
metadata, checks absence in a fresh process and waits for live descendants after
SIGKILL. A reproduced PID-namespace mismatch makes direct /proc group comparison
unsafe; the new check translates namespaces and tests a live group. Recovery
success/failure/timeout run in a separate process before inspection. A distinct
command also verified all three synthetic key paths absent. Actual earlier key
reappearance was not reproduced; its cause is not claimed proved. Independent
post-command absence remains mandatory before any operational continuation.

Focused 26 cleanup/operator and 28 collector/replay tests passed. Root check passed
lint/typechecks/mobile/catalog, then waited on unavailable npm registry access
for Deno dependencies; it was stopped rather than misreported as success. Remaining
local suites/exports and all five remote CI gates must pass before merge. All
historical private evidence and eight consumed request branches remain unchanged.

## Framed full-collection operation — 2026-09-28 / #182

The owner continued the named operational packet after accepted
[PR #292](https://github.com/Kajooja/Kajo/pull/292), main
`bc5546eb8f8851ebd8594725b5b25141c72e3aa1`, reviewed head
`81dbf1be9c4980690361ba76a68c336ff6e86572`, tree
`c73ef76213c97e8f4c13c857eaa92318ae755268`. All five
[CI #576 gates](https://github.com/Kajooja/Kajo/actions/runs/36457191366)
passed, 852 tests/four exports. The source packet below remains historical truth.

Fresh predecessor readback verified the original private archive and all 22 inputs.
A separate private archive established custody before the accepted preparer ran
all three original inspectors at their fixed source heads. The complete source,
installed dependencies, reviewed trees and supplied receipts passed verification;
request creation followed original-source diagnosis recovery. The final private
preparation check confirmed no staged raw key copies. The original recipient,
383-pair roster, source pins, 16,644,821,648-byte compressed total, other full
limits and 8-pair/8 MiB policy stayed unchanged. All 18 retained request fields
were compared with the already public predecessor request.

The sole-file request commit `67b4a7480af41c1e664c6b80bbe7754530ec59b2`,
tree `d90ac7ccc8366fa05bc2cc838c1f881fded94600`, has accepted main as its only
parent. Actual Git validation checked all seven predecessors. The prepared
request, exact source/Git receipts and recovery chain were saved and read back
before the first push to `catalog-acquisition/ol-20260831-framed`.
[Run 36464232252](https://github.com/Kajooja/Kajo/actions/runs/36464232252)
completed its sole attempt with failure. Private original-source recovery verified
`failed` / `dump-conflict-fatal`, with Edition active. The payload asserts complete
Work/publisher-checksum verification and successful bounded unrelated Edition
discard before failure. Complete dump bytes and discarded headers/JSON were not
retained, so local recovery does not independently reproduce those assertions.
The terminal rejected row, identity predicate and policy reason are absent. Older
quarantine entries cannot establish that missing terminal cause. No candidates
survive this failed acquisition.

The actual run/artifact metadata, first-attempt ledger, chronology, exact artifact
ZIP digest/CRC/member and authenticated unseal all passed. The accepted recovery
CLI also repeated original Edition/conflict/continuation inspection. A fresh
post-run read-only catalog snapshot reconciled the original selected targets
without changes. Private inspection remains payload-consistency-only with
provenanceVerified false and separate verified-against-supplied-receipts operator
binding. The completed private archive's version 5 was saved and read back;
all 133 members and their manifest hashes matched exactly. No private runtime
counters, raw records, keys or custody commitments enter public Git.

Command-local key cleanup checks reported absence, but a later filesystem read
observed staged raw key copies after preparation/recovery. Explicit cleanup and
an independent subsequent read confirmed their absence. Two same-source local
preparation reproductions passed; the cross-command discrepancy's cause is not
established. It must be reproduced with synthetic nested processes before another
activation; command-local success alone is insufficient operational evidence.
The original canonical key and intentional private custody archives are preserved.

All eight requests are consumed permanently. No retries, reset, reuse, roster
expansion, limit widening, approvals, database writes or model admissions occurred.
This was an actual bounded acquisition/recovery, not successful full collection,
rights approval or additional catalog/MVP/device/release acceptance. The source
implementation and historical Sprint tail are unchanged.

**Next:** implement a separate bounded local terminal-conflict diagnostic/evidence
contract with synthetic fixtures. Retain the exact selected-row rejection and
original identity/policy reason under explicit limits, preserving existing rules
and historical inspectors. Include synthetic cross-command key-cleanup regression
and independent absence verification. A new provider operation needs accepted
source and its own concrete reviewed request/custody checkpoint. Complete source
collection, fresh reconciliation and individual rights review still precede a
separately bounded writer.

## Framed full-collection operator — 2026-09-28 / #182

`feat/182-framed-acquisition-operator` continues accepted full-collection core
[PR #291](https://github.com/Kajooja/Kajo/pull/291), main
`cfa36d5810c1f5e6f91c4112e4376415f2f4ced1`, tree
`71cc0279496913dc2d355daa16e6bc8e477e171c`, after all five
[CI #574 gates](https://github.com/Kajooja/Kajo/actions/runs/36450439387),
830 tests/four exports. This source packet uses synthetic inputs; the real private
Edition archive and all seven consumed requests remain untouched.

The new local preparer, first-push runner, private recovery CLI and pinned
workflow enforce the separate framed contract. The runner requires clean accepted
main with the accepted core ancestor, a sole-file main-child request, all seven
exact predecessor Git values and exactly one first-attempt workflow run. A private
output is claimed before provider I/O. Successful or failed payloads produce only
neutral authenticated ciphertext; a failed collection reports a fixed public
error after the upload marker. Frozen full-source and conflict budgets remain.

Preparation/recovery binds source files, actual ESM dependency bytes, the reviewed
tree, all five CI gates, full limits/framing source, runtime chronology and ZIP,
ciphertext and plaintext receipts. Exactly 22 predecessor inputs, including the
recipient key and both older custody archives, require durable readback. All three
original inspectors are preflighted before staging the key or launching children;
the continuation's 17-file original manifest is preserved, without its later
conflict-policy addition. Original heads stay fixed at `3d12a7f` / `2463168` /
`8a9aefb`. A 60-second POSIX process-group deadline also stops descendants after
parent failure or early exit. Three known temporary key copies are removed on all
paths; caller buffers are cleared in `finally`.

Only original-source recovery of the unrelated bounded outer-header diagnosis
permits predecessor proof and final request creation. Recovery preserves the
core's payload-consistency-only label, separately records checked operator
receipts and emits private collection, candidate, quarantine and optional fresh
reconciliation outputs. No candidate gains rights approval or write eligibility.

Twenty-two new synthetic regressions cover seven-request lineage, source/tree/run
and output races, failed-result sealing, full receipt/custody tampering, complete
source/dependency closures, historical manifest drift and private CLI failures.
Real isolated child processes exercise success, failure and timeout, verifying
all three key deletions and stopped grandchildren. Read-only preflight also
succeeded against all three actual frozen historical checkouts without reading
private custody or executing their inspectors. Local lint/typechecks, all 824
non-Edge tests and four iOS/Android exports pass, including companion isolation
guards; the focused current/historical operator suite passes 48 tests. The root
check reaches Edge validation but this environment refuses its npm registry
connection. Full root validation and all five required CI gates must pass before
merge; exact source/CI acceptance is recorded in Issue #182. Historical Sprint
entries below are preserved.

**Next:** capture accepted operator source/CI evidence and prepare the private
full-collection operation. Reconstruct all 22 inputs under their original source,
record unchanged limits, save/read back a new recovery archive and let the new
preparer write the request last. Activation uses its distinct branch and one
first push/run only after that operational checkpoint. Complete source collection,
fresh catalog reconciliation and individual rights review still precede any
bounded writer. This packet creates no request branch, provider operation,
database write, model admission or additional catalog/MVP/device acceptance.

## Framed full-collection core — 2026-09-28 / #182

`feat/182-framed-dump-acquisition` continues accepted framing source
[PR #290](https://github.com/Kajooja/Kajo/pull/290), main
`b34aca7451199e3cf78578318d8f5f151ad80c32`, after all five
[CI #572 gates](https://github.com/Kajooja/Kajo/actions/runs/36443402209),
806 tests/four exports. Original Edition diagnostic source remains fixed at
`3d12a7f69534fef305b7ca37767626ae584b688e`; its private archive was not used or
modified by this synthetic source packet.

The explicit `collectFramedDumpStreams` / `acquireFramedOpenLibraryDumps` path
now integrates full Work/Edition scanning. Only Edition enables bounded discard;
Work parsing, selected identity guards, whole-pair exclusion, full EOF/publisher
hashes and cumulative retention limits remain. One referenced deadline covers
both sources, including an uncooperative opener. Late bodies are destroyed and
late request accounting is rejected. Historical entrypoints retain their rules.

The new request reconstructs the exact consumed Edition request and retains all
seven public predecessors, original roster/pins/recipient, full-source budgets
and 8-pair/8 MiB conflict policy. Historical diagnostic limits cannot become the
new collection budget. Distinct result/encryption contracts replay retained
records, suppressed partners, quarantine, coverage and new Edition counters.
Counter validation includes decoded/LF minimums and retained-record buffer bounds.
Failed acquisitions expose no candidates or terminal raw row. Private inspection
states that absent discarded headers/JSON and full source bytes remain collector
assertions, not independently replayed source authentication or rights approval.

Twenty-four new synthetic tests cover both-source success, Work/Edition conflicts,
selected/quarantined/unknown oversized failures, EOF, all retained resource caps,
complete checksums, strict historical dispatch, tampered accounting, frozen
predecessor/request fields and authenticated ciphertext replay. Separate-process
checks verify timeout liveness for a stalled Work opener/stream; a cumulative
deadline test verifies late Edition body cleanup. The focused old/new suite
passes 62 tests. Local lint/typechecks pass with the unchanged Discovery hook
warning. All 802 non-Edge tests and four iOS/Android exports pass; the local root
check cannot finish Edge dependency retrieval in this environment. Full root
validation and all five required CI gates must pass before merge; exact current
source/CI acceptance belongs to Issue #182. Existing Sprint history is preserved.

**Next:** implement the guarded operator for this new contract. Revalidate all
seven fixed Git requests and authenticate the consumed Edition diagnosis at its
original accepted source, including original conflict/continuation recovery.
Add distinct first-push/first-run controls, complete source/dependency/CI binding
and private custody preparation/readback/recovery. No actual request belongs in
that source packet. After source acceptance, a separately bounded operation needs
a new recovery archive saved/read back before activation. All seven old requests
remain consumed. Complete collection, fresh reconciliation and individual rights
review precede any writer. This packet performs no provider, database, model or
device operation and accepts no additional catalog/MVP/release gate.

## Bounded Edition framing core — 2026-09-28 / #182

`feat/182-bounded-edition-framing` continues accepted result
[PR #289](https://github.com/Kajooja/Kajo/pull/289), main
`3c21886e142a415292f857a30e6aeeab14a67918`, after
[CI #569](https://github.com/Kajooja/Kajo/actions/runs/36436832176) passed all five
required gates with 786 tests/four exports. The prior diagnosis and its original
source/custody remain unchanged; no private result was copied into this packet.

The shared byte framer now supports the explicit local `scanEditionFramedStream`.
Only an oversized row's complete canonical outer Edition header, within 4 KiB
and outside the entire original roster, permits streaming discard until LF.
Selected and unknown headers still fail, including pairs already quarantined
during Work collection. Unknown headers include incomplete/invalid encoding,
BOM/control characters, impossible dates and future timestamps. The original
line ceiling, selected identity/metadata/Work-linkage/duplicate guards, cumulative
retention budget and complete size/checksum/gzip verification remain.

The scanner releases its pending buffer after proof and never parses or retains
the discarded body. New counters record skipped rows/non-LF bytes and the logical
buffer peak; all discarded bytes remain in compressed/decoded/checksum accounting.
An unterminated oversized tail fails. Explicit source/roster/limits are checked
and copied before stream access; a supplied conflict ledger must bind the entire
roster. Abort/timeout/errors destroy the pipeline without returning records.
Historical strict/conflict scans and both prefix diagnoses cannot opt in through
extra options; their schemas and replay rules are unchanged.

Twenty new synthetic tests passed locally, covering split headers, overflow,
CRLF, consecutive skips, the 4 KiB proof boundary, selected/quarantined/unknown
failures, preserved identity guards, full checksums/resource caps and failure
cleanup. A streamed 32 MiB row checks allocation bounds independently of the
reported logical buffer peak. The focused old/new scanner suite passed 73 tests.
Local root validation passed lint/typechecks (one unchanged Discovery hook warning)
and the first 630 tests, then remained blocked at Edge npm dependency retrieval.
The remaining groups passed 147 tests separately: **777 local tests total**.
Both main-app iOS/Android exports completed; companion export completion is not
claimed from the local logs. Full root validation/four exports and all five
required CI gates must pass before merge; exact acceptance is recorded in #182.
Initial CI #571 exposed a liveness defect: an unreferenced deadline allowed Node
to exit with the scan promise pending when a supplied stream had no active I/O
handle. The new scanner now retains its timer until completion/failure and clears
it in `finally`. A separate-process stalled-stream test verifies actual timeout,
destruction and normal process exit. The corrected catalog suite passed 380
tests locally, taking the non-Edge total to **778**. Historical timers are unchanged.
All 100 local Markdown targets resolve, whitespace checks pass and the historical
sprint tail is unchanged. No provider, database, model or device operation was
performed. All seven previous requests remain consumed permanently.

**Next:** integrate the local core into a separately versioned full-collection
successor. Preserve original roster/pins/recipient/conflict policy/full-source
budgets and the line ceiling. Add new request/result accounting and encrypted
replay; bind all seven predecessors and the accepted Edition diagnosis through
original-source recovery. Distinct one-shot controls and accepted source/CI/private
custody must precede a separately prepared request and activation. Save/read back
a new recovery archive first. Complete source verification, fresh reconciliation
and individual rights review still precede any writer. No prior request is
rerun/reset/reused and no historical discarded row is retrospectively identified.

## Edition-prefix result and framing handoff — 2026-09-28 / #182

`docs/182-edition-prefix-result` records the actual diagnosis after
[PR #288](https://github.com/Kajooja/Kajo/pull/288) accepted the guarded operator
on main `3d12a7f69534fef305b7ca37767626ae584b688e`, reviewed head
`707205d66885f110340eaa7eaebb52868b314060`, tree
`ac280ab67f56a3aaf55c55c51dba4c005d7aebb8`. All five
[CI #567 gates](https://github.com/Kajooja/Kajo/actions/runs/36401690949)
passed, with 786 tests and four exports. The owner explicitly approved source
merge, then the prepared public request and one bounded diagnosis. The historical
source and failure checkpoints below remain unchanged.

Actual preparation verified the accepted code/workflow/package/lock closure and
installed dependency bytes, all six fixed public predecessor requests, fifteen
private custody inputs and the consumed conflict result through its original
accepted recovery process. Its original continuation checkout remained fixed.
Temporary staged key copies were removed. The separate recovery package retained
the unchanged canonical key, original inputs, source/CI receipts and request;
its exact archive/member readback preceded activation. When public publication
changed the local request commit identity, the source/Git receipts and recovery
package were updated and read back again before creating the request branch.

The sole-file request is
`scripts/catalog/requests/ol-20260831-edition-prefix.json` on
`catalog-diagnostic/ol-20260831-edition-prefix`, head
`be0ec18cdc968b5643e45c57c5ab9919f885e195`, tree
`04aa72b5134bf1fa7db9a155ecabe123c7d1e5ee`, request SHA-256
`d70b1ca97038a55718dfa9bd238a694237bff12400345fbcfc0b00f92e1a09c6`.
Its sole parent is the accepted operator main. The retained fields were checked
against the already-public consumed conflict request. No private key or new
row/archive commitment was published.

Explicit caps were **512 MiB compressed / 3 GiB decoded / 2,000,000 rows /
10 minutes**, preserving the **1,049,600-byte line ceiling** and a **4 KiB maximum
outer-header prefix**. At most four redirects/five Edition HTTP requests share
the cumulative byte budget; Work, metadata and individual-record calls are zero.
The distinct branch was absent and its ledger empty before activation.
[Run 36435310394](https://github.com/Kajooja/Kajo/actions/runs/36435310394)
completed successfully, attempt 1, including the single ciphertext upload.

Private recovery checked ZIP member/CRC/digest, authenticated unseal, Git/source/
dependency/CI and runtime chronology, and original-source predecessor recovery.
The outcome is **`diagnosed` / `dump-line-limit`**. Its complete canonical outer
Edition envelope classifies the newly observed oversized row as **outside the
original roster**. This is a bounded header classification: inner JSON,
key/type/location consistency, Work linkage, full row bytes and exact size remain
unchecked. The scanner observes a line-size lower bound; the small header alone
cannot establish full-row size. The partial prefix verifies neither a complete
dump nor publisher checksums. It cannot identify the earlier discarded terminal
row, even if positions agree. Receipt provenance is operator-captured; encryption
alone does not authenticate the sender.

The complete private ciphertext, receipts, original recovery inputs and recovered
result are preserved, with an independent exact archive/member readback. No raw
header, private row identifier, private artifact/archive commitment or runtime
counter is recorded here. Candidates, approvals, database writes and model
admissions remain zero. No fresh catalog reconciliation or device/release
acceptance was performed. **All seven requests are consumed permanently.**
No retry, rerun, reset, new allowance or automatic limit expansion followed.

**Next:** implement and test a bounded local Edition framing correction that can
stream-discard an oversized unrelated row only after a complete canonical outer
header proves its key is outside the entire original roster. Keep selected and
unknown headers as failures, preserve selected-record identity guards and all
global compressed/decoded/row/time limits, include discarded bytes in checksum
accounting and preserve historical replay. Synthetic tests must prove recovery
at the next row boundary, bounded memory and correct truncation/error/abort
behavior. This is an offline source packet; any later full-collection request
requires separate source/CI, predecessor/custody and operational acceptance.
Complete-source verification, fresh reconciliation and individual rights review
still precede a writer. STATUS owns this single next packet.

Files changed by this result checkpoint: STATUS, ROADMAP and this sprint record.
No application, acquisition, parser, dependency or workflow code changes here.
Source tests remain those of the accepted operator; this documentation PR must
pass all five required CI gates before merge. Exact checkpoint acceptance is in
Issue #182.

## Guarded Edition-prefix operator — 2026-09-28 / #182

`feat/182-edition-operator` continues the local diagnostic accepted through
[PR #287](https://github.com/Kajooja/Kajo/pull/287), main
`12c1dc203a4d4e5a326c6f2a64db4c5fe49b0cb4`, reviewed head
`4278341b043671e39945b99dcb02da3a5ae5681a`, after all five
[CI #565 gates](https://github.com/Kajooja/Kajo/actions/runs/36396734170),
757 tests and four exports. Exact new PR/head/tree, CI and merge acceptance
belong to Issue #182; historical source and result checkpoints below are unchanged.

The separate Edition request preserves the exact consumed conflict request's
public roster, key, pins, policy, limits and lineage. It adds an accepted local-core
binding and six explicit diagnostic caps. Schema ceilings are 1 GiB compressed,
8 GiB decoded, 10 million rows and 20 minutes, with the original line ceiling and
at most 4 KiB retained prefix. No operational values are selected by this source
packet. The original conflict exclusions do not become a prefix-scanner skip rule.

The new collector requests only one bounded Edition byte range, with at most
four redirects and no Work, metadata or individual-record calls. Exact 206 range/
length/encoding checks precede decoding; redirect bodies share the cumulative
budget, and invalid routes, overflow, timeout or transport errors stop. The
result embeds the existing local diagnosis with truthful counters and no
complete-source, candidate, approval, write or model-admission claim. All outcomes
share one neutral encrypted payload kind; unexpected errors cannot invent a
receipt. No raw header or classification enters public runner output.

The distinct push workflow checks out clean accepted main, verifies the sole-file
request child and all six fixed historical Git objects, then enforces its own
first-run ledger. Read-only permissions, immutable actions, frozen dependencies
without lifecycle scripts, a 30-minute job and ciphertext-only upload are fixed.
The workflow/request branch is separate; every earlier ledger remains consumed.

Local preparation and recovery bind their entire code/workflow/package/lock
closure and actual ESM dependency bytes to accepted source/CI. Private custody
checks cover fifteen required inputs, including the consumed conflict result,
its original continuation and nested archive/key. The conflict result is recovered
in a fresh process with its original accepted script and original continuation
checkout. Only the authenticated Edition line-limit failure after complete Work
can support preparation. Temporary key copies are cleaned, existing outputs are
never overwritten, and request/summary files are written last. Encryption still
does not authenticate the sender independently of the operator-captured receipts.
Shared file/source/ZIP/receipt helpers retain the original conflict entrypoints'
fixed defaults and contracts.

Twenty-nine new synthetic tests cover request lineage/caps, actual curl header
framing, bounded gzip scanning, redirects/accounting, aborts, encrypted tampering,
first-run/source/tree guards, private output/custody, source/dependency drift,
receipt chronology, predecessor rejection and local CLI behavior. All 51 focused
Edition/conflict runner/recovery tests pass. A local `npm run check` attempt stopped
at Deno dependency checking in the restricted executor. Separate database, engine,
research and acceptance suites passed, as did all four platform exports. Complete
root validation and all five required CI jobs remain the merge gate. Synthetic
tests do not replace actual original-source predecessor/custody verification.

Files: five new `*-edition-prefix-diagnostic.mjs` operator modules, its dedicated
workflow, two test files and public/synthetic fixture helper; shared primitives in
`recover-conflict-dump-acquisition.mjs`; canonical ARCHITECTURE/CODEMAP/STATUS/ROADMAP.
No new request file, real provider request, actual predecessor rerun, database
write, model admission or device/release acceptance is included. The historical
terminal row remains unknown; six requests are consumed.

**Next:** use accepted source/CI to prepare the actual bounded Edition diagnosis.
Authenticate the retained conflict result through original recovery, review all
explicit caps, freeze the new sole-file request identity and save/read back a
separate private recovery archive before activation. Execute once and privately
recover its diagnosed, inconclusive or failed result. Stop there; do not retry,
expand limits or infer historical row identity from position. STATUS owns this
single next packet; further collection, reconciliation and rights gates remain.

## Local Edition line-framing diagnostic — 2026-09-28 / #182

`feat/182-edition-line-diagnostic` continues the accepted result checkpoint from
[PR #286](https://github.com/Kajooja/Kajo/pull/286), main
`2b533a29e53f9e2145e54720b6834f91a27b89be`. That documentation source passed all
five CI #563 gates with 738 tests and four exports. Issue #182 owns the exact new
PR/head/tree, required CI results and merge acceptance. Historical checkpoints
below remain unchanged.

The local diagnostic reuses the existing byte framer. Its separate evidence
contract retains an explicit prefix of at most 4 KiB, shortened at the fourth
tab, with source/roster/limit bindings, row and decoded byte position. A valid
complete outer envelope permits selected/unrelated classification; incomplete,
invalid or invalid-UTF-8 headers remain unknown. The reported line size is a
scanner-observed lower bound, never an exact size or full-row hash. The prefix
does not validate JSON, inner identity, Work linkage, description or rights.

Compressed/decoded/row/time bounds are explicit; gzip corruption, early EOF,
overflow, timeout and parser errors fail closed. Exact partial-prefix or row/byte
budget exhaustion is inconclusive. Buffered counters do not locate a row inside
compressed bytes. Result validation checks payload consistency only: publisher
checksums, full-source completion and provenance remain unverified. Existing
strict/conflict/Work-prefix scanner entrypoints cannot enable this behavior by
supplying an extra option and retain their original rejection rules.

`npm run catalog:book-descriptions:lines` accepts only local regular-file inputs,
an explicit limits document and the consumed conflict request as public context.
It blocks Actions, preserves that request's line ceiling and resource caps,
claims a new private directory under ignored catalog staging, and writes its
diagnostic last. Standard output contains only fixed outcome codes and zero
action counts. It authenticates neither the consumed private result nor the
supplied local gzip bytes. No workflow, executable request or provider default
is introduced.

Nineteen synthetic tests cover selected/unrelated/unknown oversized headers,
compressed and decoded chunk boundaries, UTF-8/CRLF byte accounting, bounded
tails, resource limits, corruption, aborts, forged errors/evidence, context
mutation, prior scanner behavior and actual local CLI permissions/non-overwrite.
The focused scanner/conflict/recovery/evidence suite passes 89 tests. Local root
check passed lint, typecheck, mobile and catalog tests, then stopped because the
Deno npm registry connection was refused in this environment. The remaining
database/engine/research/acceptance tests and all four platform exports passed
separately: 729 local tests in total, excluding the blocked 28 edge tests. The
complete root check and all five required CI jobs remain the merge gate.

Files: `dump-failure-evidence.mjs`, `open-library-dump-descriptions.mjs`, new
`inspect-edition-line-prefix.mjs` and `edition-line-diagnostic.test.mjs`, root
package script and the changed canonical STATUS/ROADMAP/ARCHITECTURE/CODEMAP.
No real provider diagnosis, private row publication, catalog reconciliation,
approval, database write, model admission or device/release acceptance occurred.
The actual failed row remains unknown and all six requests stay consumed.

**Next:** implement the separate guarded one-shot Edition-prefix operator path.
Require original-source recovery of the consumed conflict result, all six fixed
predecessor requests, accepted source/dependency/CI, strict bounded range transport,
first-run accounting, encrypted result/recovery and private custody readback.
Source acceptance comes before separately reviewed explicit caps and activation;
never reuse a consumed branch, relax the original line/identity guards or infer
historical byte identity from matching positions. STATUS owns this one packet.

## Conflict acquisition result and line-framing handoff — 2026-09-28 / #182

The guarded operator source is accepted through
[PR #285](https://github.com/Kajooja/Kajo/pull/285), main
`24631688fbbbf73b2197768d5df686e26ff361dd`, reviewed head
`6ef1ba8bf158dc80c3d1b1cf05942a1931bb198e`, tree
`b0002f6381f0dce0ff05256846d04607b3cd96dd`. All five
[CI #561 gates](https://github.com/Kajooja/Kajo/actions/runs/36388094791) passed:
738 tests and four exports. Historical source checkpoints below remain unchanged.

Actual local preparation verified the source/dependency closure, accepted CI,
original public request Git objects and retained predecessor archive readback.
The original accepted inspector authenticated the real predecessor in a fresh
process; policy replay then produced the successor request. A separate private
recovery archive was saved and read back before the request branch was created.

Operational caps were explicitly frozen at **8 conflicted original pairs and
8 MiB diagnostics**: about 2.1% of the unchanged 383-pair roster and one eighth
of the unchanged combined retention cap. Both are independent stop conditions,
not text approval. The two pinned source streams retain their original byte,
row, time and redirect limits. The sole-file request branch
`catalog-acquisition/ol-20260831-conflicts`, head
`11bada2563374616cc8d014d787039c9235ea071`, is a child of accepted main.
[Run 36391833763](https://github.com/Kajooja/Kajo/actions/runs/36391833763)
activated once on its first attempt and completed with failure on September 28.
The ciphertext upload succeeded.

Private recovery checked the actual ZIP, authenticated ciphertext, accepted
source/dependencies/CI, request Git identity, runtime receipts and predecessor
custody. It verified a consistent failed result with `dump-line-limit` in the
Edition source. Work completed with publisher checksum verification; Edition
did not complete. Full dump checksums are collector assertions checked against
the pins, not hashes recomputed from full local dumps. The failed contract
discards candidate records and retains no terminal row evidence. Its identity,
contents, exact size and selected/unrelated status cannot be inferred. All
private evidence and recovery outputs are preserved separately; no new private
row, artifact or archive commitments are published here.

Offline code review confirms that `createDumpRowParser` checks the pending byte
length before `line()` classifies the target. The fixed error code therefore
does not identify a selected row. Existing historical/core behavior is unchanged.
No fresh catalog reconciliation, rights review, description approval, database
write, model admission or device/release acceptance occurred.

**Next:** implement and test a local-only bounded Edition line-framing diagnostic
contract. Bind minimal prefix evidence to the source and truthful counters;
distinguish unknown selection from classification established by a valid bounded
envelope. Cover oversized selected/unrelated rows, chunk boundaries and existing
resource guards with synthetic inputs. Keep current parser limits, source pins
and identity rules. Any actual diagnosis requires a separate accepted request
and private recovery custody. All six requests are consumed; never rerun or
update the request branch, raise a limit or start another provider operation
from this result checkpoint. STATUS owns this single next packet.

## Guarded conflict operator path — 2026-09-28 / #182

`feat/182-guarded-conflict-acquisition` continues PR #284/main
`686ac92fe5900287c0699ba69434b743e3e2515d`, accepted with all five CI #559 gates,
716 tests and four exports. Exact operator PR/head, validation and merge acceptance
belong to Issue #182. Historical checkpoints below remain unchanged.

The distinct workflow/runner binds accepted main, policy/core ancestry, one sole
added request, all five fixed predecessor Git objects, first push/run and an
independent spent ledger. It retains frozen dependencies, read-only permissions,
exclusive private output and ciphertext-only upload. The collector's validated
failure result is sealed; unexpected exceptions cannot fabricate accounting.

Local preparation authenticates retained predecessor evidence using its original
accepted inspector in a separate process, with exact bootstrap/source/dependency
verification. Private custody checks compare actual archive bytes and every
required input member, including the key, to the operator-captured durable readback
receipt. Policy replay precedes request output. No new private archive/artifact/
row commitment enters a public request. Recovery verifies source/CI/dependencies,
request Git lineage, run/artifact/ZIP provenance, encryption and payload consistency.
Its provenance label accurately describes supplied operator receipts, not a
cryptographic sender attestation. Suppressed records never become candidates.

Synthetic tests exercise successful sealing, real tiny-gzip failure, exhausted
ledgers, edited sources/dependencies, altered receipts/ZIP/custody, CLI isolation,
private output refusal and unchanged historical/core contracts. Ordinary CI does
not fetch publisher dumps. No actual request, provider execution, language/rights
approval, catalog write, model admission or device acceptance occurs here.

Next after operator source acceptance: freeze explicit operational caps, capture
the accepted source receipt, authenticate the actual retained predecessor, prepare
one request and save/read back a separate private recovery archive. Only then
publish the sole-file child and execute once. Recover the result and stop at
failure or unreviewed collection. All five prior requests remain consumed;
STATUS owns the current next task.

## Conflict-aware acquisition core — 2026-09-28 / #182

`feat/182-conflict-acquisition-core` continues accepted PR #283/main
`1f3bd049a37f182a773a4101791f9962b87cfb99`, whose five CI #557 gates passed
678 tests and four exports. Exact core PR/head, validation and merge acceptance
belong to Issue #182. This checkpoint advances the earlier successor-contract
handoff; all historical entries below are preserved.

The separate successor request freezes original public roster/key/pins/limits
and consumed lineage, accepted policy source, implementation source and explicit
policy caps. It adds no private predecessor artifact or row commitments. The
collector reuses the official transport and complete Work-then-Edition scanner;
existing acquisition entrypoints remain strict. Tiny real gzip fixtures exercise
the same core through a mandatory injected source opener with no network default.

Complete results separate surviving pairs, suppressed valid counterpart records
and one bounded quarantine ledger. Retained suppressed raw evidence permits exact
private replay and byte accounting without becoming candidates. All diagnostics
and valid records share the cumulative cap. Failure discards both record arrays
and the whole-source manifest, preserves truthful partial counters/prior bounded
quarantine, and explicitly reports that terminal row evidence is unavailable.
New fixed error codes never disclose provider text.

Strict new seal/unseal wrappers reuse bounded encryption and reject altered
requests/results. Pure recovery checks raw records, policy evidence, source
assertions, counters and original/fresh snapshots. Its explicit payload-only scope
does not claim authenticated GitHub provenance or rehash the absent full dumps.
All surviving candidates remain unapproved; no catalog write or model admission
is delivered. Tests are synthetic and ordinary CI makes no real dump requests.

The packet delivers the reusable core, not an operational acquisition. Next
implement one distinct guarded runner/workflow, local authenticated predecessor
preparation and a source/dependency/CI/run/artifact-bound recovery inspector.
Freeze explicit operational policy caps and preserve/read back private recovery
custody before request publication. All five predecessor requests remain consumed;
no new provider budget, executable request or activation occurs here. Fresh
reconciliation and individual rights review still precede a separately bounded
writer bridge. STATUS owns the single next task.

## Offline conflict policy and hygiene — 2026-09-28 / #182

`feat/182-offline-conflict-policy` continues accepted main
`e0c26144de6270589a0e2bf8e1a4958c698f17e8`. Exact PR/head, required CI and merge
acceptance belong to Issue #182. This checkpoint supersedes the preceding
result's next-task instruction while preserving every historical entry below.

The explicit local `stage-with-conflicts` command requires a versioned policy
and positive pair/diagnostic budgets. It replays original v2 failure evidence,
checks same-kind foreign canonical location outside the roster, and independently
validates matching revision/time and Edition Work links. The immutable ledger
excludes the whole original pair; it never remaps identity or approves text.
Both sources still require full EOF/gzip/checksum verification. Duplicates,
malformed rows, unsupported conflicts and exhausted budgets abort. Quarantined
rows and suppressed counterparts remain charged to the cumulative staging cap.
Private result artifacts bind source/targets/policy/roster and distinguish
physical matches, exclusions, missing survivors and retained/consumed bytes.
The strict parser, existing cloud paths and historical recovery rules remain.
The source-bound inspector's closure now includes the imported policy module.

Synthetic policy and gzip intake tests cover both source directions, subsequent
failures, exact accounting, CLI isolation and immutable evidence. The retained
private evidence also replays against the narrow policy locally. No raw evidence,
private identifiers or diagnostic hashes are added to fixtures or public output.
Source validation results and any environment limitation are recorded in #182.
No new acquisition, description approval, catalog write or model admission occurs.

The read-only hygiene audit found no broken local Markdown links/anchors,
detected secrets, tracked raw/generated/temp outputs, empty files or exact
file duplicates. Workspace declarations, lock metadata and CI script references
agree. All five consumed request branches retain their frozen identities.
No unrelated cleanup was warranted; no release requirement was marked complete.

Next after source acceptance: specify and test the conflict-aware one-shot
acquisition request/collector/result/recovery contract and explicit operational
caps, preserving original roster/key/pins and authenticated predecessor custody.
All five prior requests remain consumed. This local policy grants no new provider
permission/budget; fresh reconciliation and individual rights review still
precede a separately bounded writer bridge. STATUS owns that single next task.

## Full-acquisition continuation result and handoff — 2026-09-27 / #182

[PR #281](https://github.com/Kajooja/Kajo/pull/281) is accepted as main
`8a9aefbf87870abd932dac53c6d4abae7fd0683d`, tree
`3f4cff0502950fe708881595b6053e97d8d46a79`. All five
[CI #553 gates](https://github.com/Kajooja/Kajo/actions/runs/36347927166) passed,
**645 tests / four exports**. This supplies source acceptance for the implementation
checkpoint below; its earlier publication/activation instructions are historical.

The public request branch `catalog-acquisition/ol-20260831-continuation` advanced
to `f2558795be45be17bd2632071cf25746e4ec82a2`, tree
`7e7e10f14a9e7342eab2bff140014bcfdcaf30f9`.
[Run 36349027698](https://github.com/Kajooja/Kajo/actions/runs/36349027698)
executed on push, attempt 1, and completed with failure on September 27.
Private recovery and authentication verification are complete. The owner retains
the private evidence separately. This packet produced zero approvals and zero
database writes.

All **five requests are consumed**. Do not rerun the continuation, alter its
request/caps or reset a ledger. The single next task is to **specify and test an
offline selected-record conflict/quarantine policy**. Preserve foreign-location
rejection and make no automatic remapping. Continuing a scan while explicitly
excluding conflicted records changes failure policy and needs its own source
packet plus a separately specified one-shot acquisition. This handoff grants no
new provider permission/budget, catalog write or model admission.

The packet stops at recovered failure and this handoff. Full-source verification,
fresh catalog reconciliation and source-specific language, origin and rights
review remain before a separately bounded writer bridge. The two existing
approved paragraphs, completed pilot and catalog/device/release gates stay intact.

## Full-acquisition continuation implementation — 2026-09-27 / #182

`feat/182-full-dump-continuation` implements the accepted PR #280 specification
from main `d05419f140ac42c99318b4788d1cf9606edb0e9a`. Exact source PR/head,
required CI and merge acceptance belong to Issue #182. No executable request,
provider access, catalog mutation or model admission is part of the source PR.

The separately named request retains the exact canonical reviewed body: original
383 pairs, recipient, both publisher pins, source evidence and limits. Local
preparation authenticates the frozen prefix ciphertext and v1 diagnosis, replays
the captured row through the corrected live identity guard, and checks its outer
revision/time. The row's rejected description remains independent from identity.
The source receipt binds the accepted Git tree, five successful CI jobs, workflow,
lockfiles, complete first-party import closure and loaded hashing dependency.

The new runner checks current accepted main, clean source, correction ancestry,
all four fixed predecessor Git objects, exact sole-request child, push/run/head
identity and its own first-run ledger. It rejects existing output before any
network use and exclusively claims a private output directory before provider
streams. Work failure prevents Edition access; Edition failure remains an
overall failure with all candidates discarded. Source bytes retain the accepted
counter meaning, not a claim to measure every redirected network byte.

A small shared pinned-result adapter fixes continuation failure validation
without broadening historical request dispatch. New continuation identity
failures require v2 evidence; archived v1 receipts preserve their original rule.
Only authenticated ciphertext leaves Actions, with sanitized public errors.
The offline inspector checks exact Git/source/dependency/CI/request/run/artifact
bindings, ZIP CRC/sole member/hash, envelope authentication, raw record and
inspection hashes, source manifests, accounting and coverage. It never turns
collected descriptions into approvals. Operator-captured GitHub evidence is
checked against Git and downloaded bytes; public-key encryption alone is not
sender authentication.

Focused tests cover strict request mutations, actual corrected-row semantics,
zero-metadata v2 failure sealing, environment/tree/ledger/output gates, failed
Work/Edition behavior and private recovery provenance. Existing collector tests
retain synthetic complete two-source EOF/checksum coverage and sparse/malformed
outcomes. A private memory-only preparation smoke authenticated the actual saved
prefix with the original key; no executable request file was emitted. All **34 new focused tests** pass after independent review. The existing
54-test envelope/reviewed/failure/prefix subset also passes. Local root validation
passed lint/typechecks, 248 mobile and 3 contract tests plus the catalog suite;
its frozen Deno dependency check timed out at restricted registry access after
240 seconds. Separate remaining database, engine, research and companion tests,
all four exports and companion isolation guards passed. All five required remote
CI gates remain mandatory. Exact source/CI acceptance belongs to Issue #182. At this checkpoint the code
is local commit `dc9588a06ba1000d02babc483fb7aca1cf1674bd`, tree
`205a51d7ff99c42a646f3f65431971a1ef9d04fa`. A real local source-binding smoke
verified 17 source and eight dependency files. The initial automatic source-upload rejection required explicit publication
consent; the owner supplied it on September 27 for public `Kajooja/Kajo` and merge
after CI. The source is ready for publication; STATUS owns current acceptance.


After source CI/merge, recover the two unchanged archives named in the planning
checkpoint below. Verify their recorded hashes, then create a **separate** private
continuation archive containing the original key/snapshot, predecessor artifacts
and receipts, accepted source/CI/dependency receipt, prepared request bytes and
inspector. Use `prepare-full-dump-continuation.mjs request` with
`--reviewed-request`, `--prefix-request`, `--prefix-input`, `--source-head`,
`--source-receipt`, `--repo`, `--key-dir` and a new `--out` file. Preparation and
recovery are local-only; retain the exact accepted checkout for inspection.

Durably verify custody before advancing the sole request branch. After one run,
record GitHub provenance, download the exact artifact and run the accepted-source
inspector. Stop at recovered failure or unreviewed collected records and update
STATUS. Fresh read-only catalog reconciliation, source-specific language/rights
review and a separately bounded writer bridge remain later gates. The completed
pilot, four predecessor ledgers and all release/device requirements stay intact.

## Full-acquisition continuation plan and handoff — 2026-09-27 / #182

The owner requested one further completed packet and a clean new-conversation
handoff. The [selected continuation specification](../../architecture/ARCHITECTURE.md#full-acquisition-after-the-self-location-correction--182)
defines one new full Work/Edition acquisition after the accepted identity fix.
This packet changes documentation only. It creates no workflow, provider request,
raw-data copy, database change, APK dispatch or model admission. #182 and all
remaining catalog/MVP/device gates stay open.

PR #279 is accepted as `8c4d8ecf65187f12bb30ed4207d03848fd87d292`, tree
`50e848ed291309c549790ebdabe91e2857abc01e`, reviewed head
`1a7f15ab0626f6c3d4ad823be72a1085578b94f1`. CI #549/run 36343239488 passed all
five gates, **611 tests / four exports**. Its 87 focused tests and independent
review include exact self-location and frozen v1 replay. The final private
`Kajo-book-work-prefix-diagnostic-20260927.zip` recovery package contains
**25 members / 101,412 bytes**, SHA-256
`a3abd65a7cf6355fd6cd0349b03ca16610526611aba8df7e80c907c50e1d5775`.
It retains the prefix source/request/run/artifact, key, captured row, replay and
accepted correction receipt. Its original inspector remains bound to PR #278
main `99ed067ba7aec9f9bbb63d806cafbafc8a0bb4d1`, not current main.

Resume from refreshed accepted main and Issue #182, then create
`feat/182-full-dump-continuation`. Reuse `acquireReviewedOpenLibraryDumps` and the
existing scanner/encryption/record validators; add the separately named request,
local preparation/recovery, one-shot runner/workflow and meaningful regression
tests defined in ARCHITECTURE. Do not add an actual request file to the source PR.
The design is selected; implementation, full CI, source merge, durable custody,
activation and real two-file result remain pending in that order.

For local preparation recover the saved prefix package above and
`Kajo-book-reviewed-acquisition-20260924.zip` (version 2, **28 members /
152,823 bytes**, SHA-256
`345bc96a22c927d58e5492c4e7ad1490ed8488233e01e82587628a126ac4166d`).
Use retained original roster/key/source pins and receipt lineage. No new key,
provider metadata lookup or re-created historical result is needed. Do not expose
private rows/UUIDs/keys in Git. A separate continuation archive must be durably
saved before the new request branch is advanced; existing archives stay intact.

Stop the implementation packet after one recovered failed or collected result
and an updated handoff. A failure keeps its spent ledger and bounded evidence;
a collection is unreviewed private input for fresh catalog reconciliation and
source-specific text/rights review. It is not an apply packet. The two existing
approved paragraphs and all earlier consumed attempts remain unchanged.
Independent contract review checked the actual collector, request/envelope
validators and current-task instructions. All **67 local Markdown targets** and
whitespace checks pass. No code changed or new local root suite was needed;
this planning PR's required CI and exact merge acceptance belong to Issue #182.
STATUS owns the next action.

## Exact self-location correction — 2026-09-27 / #182

`fix/182-self-location` supplies the offline source correction. Issue #182 owns
its exact source head and required-CI acceptance. The authenticated Work-prefix
row below establishes that the presence-only `location` guard rejects a record
whose location is its own exact canonical Work path. It does not establish why
the provider retained that field or prove that the discarded earlier row had
identical bytes.

The narrow correction accepts absent or exact self-location only after the
existing object, exact key and exact type checks. Foreign paths, null/non-string
locations and real `/type/redirect` records remain rejected; Edition Work linkage
and all text/source bounds remain mandatory. New captures use
`open-library-selected-row-failure-evidence-v2` with
`record-location-mismatch`. Historical v1 evidence retains the frozen
`record-location-present` rule, original parsing order and bounds, without
rewriting a receipt or reclassifying the prior result as success.

Independent review and **87 focused tests** pass. Actual private replay with the
new source authenticates the original v1 ciphertext and preserves its canonical
plaintext and captured-row SHA-256 values unchanged. Current `inspectRecord`
accepts the exact self identity, and revision/modified fields match the outer TSV
envelope. Its description still fails the text rule as `markup-or-url`: this
produces zero candidates, approvals or writes. This is offline fixture and actual
receipt evidence; required full CI acceptance remains separately recorded in
Issue #182.

Confirm source acceptance in Issue #182, then specify a separate bounded
full-acquisition continuation using retained source pins/roster and explicit
recovery. No new full request has been selected or activated. Consumed requests
remain consumed; full publisher EOF/checksums, fresh reconciliation and rights
review still precede any catalog write. The source correction itself performs
no provider, database, migration, APK or model-admission action.

## Bounded Work-prefix diagnosis — 2026-09-27 / #182

Implementation resumed on September 27 after interruption. [PR #278](https://github.com/Kajooja/Kajo/pull/278)
is accepted as main `99ed067ba7aec9f9bbb63d806cafbafc8a0bb4d1`, tree
`00cd5b4ff7a91ec21bafa7e6a76bd4a82267b356`. Reviewed head
`906243aadb3b7f229a6c8392f85620dfc1325a39` passed all five
[CI #547 gates](https://github.com/Kajooja/Kajo/actions/runs/36341667520),
**606 tests / four exports**. The preceding CI #546 test-environment failure was
corrected without changing production behavior. Twelve stream/transport tests,
twelve request/envelope/runner tests and ten private recovery tests cover the
new protocol and offline receipt/code/artifact bindings.

The request freezes the same Work source (full size **4,058,336,593 bytes** and
existing publisher pins), original 383-pair roster and recipient. Only bytes
**0–104,857,599** are requested. Strict HTTP 206 range/length and identity encoding,
**1 GiB decoded / 1,000,000 rows / 600 seconds / four official redirects** and
no full-download fallback remain the accepted contract. The complete request,
original private key and source receipt were retained before activation.

| Actual one-shot identity | Value |
| --- | --- |
| Request commit / tree | `6a6dc390940db1b15d68a8d850dd08bfbb88bd4a` / `f605c4f44cbcfff3d297fcfdc6cab371b60a1e90` |
| Canonical request SHA-256 | `03c4e1abf4ce3d67452239b76c5d1a0fd18d0bef0c41767c99075f88c1c26bc8` |
| Actions run | [36342443617](https://github.com/Kajooja/Kajo/actions/runs/36342443617), successful attempt 1 |
| Diagnostic interval | `2026-09-27T18:55:42.844Z`–`2026-09-27T18:55:52.033Z` |
| Artifact | `10939256706`, ZIP **14,021 bytes**, SHA-256 `d3b8c99729ea8f10f7458becff6be8f0b061aaaeaf8cdfdd0b127dde76b7e0ae` |

Authenticated recovery yields `diagnosed` / `record-location-present` at row
**804,172**, selected Work **OL82565W** / Edition **OL59004684M**. The outer key and
JSON key are both `/works/OL82565W`; the outer and JSON types are both `/type/work`.
The JSON `location` is exactly `/works/OL82565W`. Its **5,234-byte** captured row
has SHA-256 `36052131a5d776e82658e741280683eaf38b18930fcf89717af2a68b9c161752`.
Raw row bytes remain private, outside Git. The historical guard's rejection was
replayed offline against the verified accepted source.

Accounting records **78,821,206 observed body bytes / 78,690,134 accepted
compressed bytes / 456,982,528 decoded bytes**, eleven preceding matches and
804,160 unrelated rows. The two Work GETs include one HTTP 302 redirect. Buffered
counters are not exact row byte offsets. There were **zero metadata, Edition,
per-Item or database requests**, zero full-source EOF/publisher-checksum
verifications, review candidates, approvals or writes. The partial-source result
does not establish rights to the captured description.

The private inspector verified the complete fifteen-file accepted source binding,
request/run provenance, artifact ZIP CRC/hash and authenticated unseal. The
request on `catalog-diagnostic/ol-20260831-work-prefix` is now consumed. Do not
rerun it or change its request/caps. Existing recovery archives remain unchanged.
The diagnosed current row has the same position as the earlier acquisition
failure, but that failure discarded its row/hash: byte-identical historical
reproduction cannot be established. The narrow correction above follows this
new observed evidence; it does not retroactively change the old receipt.

## Offline selected-row failure evidence — 2026-09-24 / #182

`fix/182-dump-failure-evidence` implements the bounded failure-evidence forward.
The shared parser retains at most
one selected row when the unchanged identity guard fails. The versioned private
object binds the exact source, roster, expected Work/Edition pair, dump row,
fetched time, raw Base64 bytes/hash and object/key/type/location predicate.
Raw bytes exclude LF, retain any CR, and record whether LF terminated the row.
Recovery validates all bounds/bindings and replays the predicate before exposing
the private diagnosis. Historical receipts without this field remain valid.

Diagnostic bytes are separate from matched-record accounting. The public failure
code remains fixed; raw input and precise predicates stay in encrypted output.
Failed streams remain incomplete and produce no source checksum verification,
review candidates, approvals or database writes. This implementation cannot
restore the real row discarded by run 36003953876; its exact cause remains unknown.

Independent review and **86 targeted tests** pass, including all four predicates,
actual maximum-size CRLF rows, UTF-8 chunk boundaries, Work/Edition cases,
untrusted transport errors, both collector/encryption paths and a correctly
encrypted but internally forged payload. The local integrated check passed
lint/typechecks, **248 mobile and 159 catalog tests**, then reached frozen Deno
npm dependency downloads. [PR #277](https://github.com/Kajooja/Kajo/pull/277) is
accepted as `3e865ac9ecfcda427ab03d50d1592ff72b4d038d` after all five
[CI #544 gates](https://github.com/Kajooja/Kajo/actions/runs/36008368238).
The new unsealer also opened the actual prior reviewed failure and metadata
diagnostic; historical payloads and missing-evidence meaning stayed unchanged.
No source request, database change or new artifact recovery was fabricated.

After source acceptance, evaluate one separate bounded Work-source diagnosis
plan against the same release/roster/recipient. Declare byte/row/time limits and
stop at the first selected identity failure to recover one encrypted row and
replay its actual predicate offline. The patch adds no request or trigger and
activates no provider budget; all consumed requests remain consumed.

## Reviewed acquisition failure and offline handoff — 2026-09-24 / #182

After accepted PR #275/main `349c8b5e27b9a0eb88e178f19361e2bea0d7a026`,
the owner authorized the separately reviewed request
`4727b4cb3d82a7bc10d134d1c2b7e9fcdbdf22bb`.
[Run 36003953876](https://github.com/Kajooja/Kajo/actions/runs/36003953876)
failed on its only attempt at **13:11:37 UTC**, with
`provider-identity-mismatch` at Work dump row **804,172**, whose key was in the
selected roster. Collector accounting reports **78,731,116 compressed / 456,982,528 decoded bytes**, eleven preceding
matches and 40,567 transient selected-record bytes. Those counters are not row
byte offsets or full-source integrity evidence. The failed artifact contains
**zero raw records**; selected target and failing predicate remain unknown.
No Edition stream, complete EOF/checksum, review candidate, approval or database
write occurred. Authenticated private recovery bound source/request/run/artifact;
read-only comparison at **13:14:31 UTC** confirms all **383** targets unchanged.

Recovery **version 2**, `Kajo-book-reviewed-acquisition-20260924.zip`, retains
28 verified members / **152,823 bytes**, SHA-256
`345bc96a22c927d58e5492c4e7ad1490ed8488233e01e82587628a126ac4166d`.
It includes the ciphertext, run/source receipts, fresh snapshot, inspection and
offline failure proposal. The request is consumed; no retry is selected.

The next packet is source-only and offline: retain exactly one failing selected
TSV row within the existing 1,049,600-byte line bound, with raw-byte hash,
source/row/expected-roster identities and fixed private object/key/type/location
predicate codes. Forward a versioned bounded failure object only through encrypted
output; distinguish its bytes from matched-record accounting. Recovery must verify
hashes/bindings and reproduce the predicate, while accepting historical receipts.
Tests cover all predicates, `location: null`, bounds, tampering, encryption and
public-log silence. Keep the original guard fail-closed and public code fixed;
a failed stream supplies no success candidates or full-source verification.
This packet authorizes no provider calls, new acquisition, review or database write.

## Reviewed exact-source acquisition implementation — 2026-09-24 / #182

The exact-byte metadata diagnosis selects a separately reviewed request with
**16,644,821,648** compressed bytes and immutable Work/Edition size/MD5/SHA1 pins.
The old 15 GB acquisition and metadata diagnostic retain their original limits,
request bytes and consumed-run status. The new fixed request branch is
`catalog-acquisition/ol-20260831-reviewed`; its sole added path is
`scripts/catalog/requests/ol-20260831-reviewed.json`.

Local preparation first checks the known diagnostic ciphertext hash and performs
authenticated decryption with the original recipient key. It re-derives both
source pins from those exact observed bytes and preserves the original 383-pair
roster. The runner verifies both predecessor Git objects, exact source ancestry,
sole request change and separate first-run ledger. No new metadata, per-Item,
ratings or database request is possible. The shared streaming verifier still
requires complete EOF/gzip integrity, exact sizes/MD5/SHA1 and computed SHA-256;
all decoded/row/line/retained-memory bounds remain unchanged. Only ciphertext
success/failure recovery leaves the public runner. The collector deadline remains
110 minutes within a 120-minute job; no automated retry or dispatch exists.

Independent core/workflow/envelope/docs review passed with **70 targeted tests**.
Actual local preparation smoke used the retained original roster, diagnostic
ciphertext and key; altered ciphertext and wrong keys failed. It emitted no
request file and made no network calls. The integrated local check passed
lint/typechecks, 248 mobile and 143 catalog tests before the frozen Deno registry
network boundary. [PR #275](https://github.com/Kajooja/Kajo/pull/275) then merged
as `349c8b5e27b9a0eb88e178f19361e2bea0d7a026`, exact tree
`c201ff7e351e0bfaf7d02e8e4abb36e80b2f0408`, after all five
[CI #539 gates](https://github.com/Kajooja/Kajo/actions/runs/36000730750),
**566 tests / four exports**. Durable request/key recovery preceded the actual
activation recorded above; source acceptance does not imply a completed scan.

A separate publisher-documentation check also records that Open Library ratings
and reading-log dumps have no subject key, so they cannot supply individual taste
profiles. Their download/training is not part of this acquisition. The source
registry retains this limitation and the unresolved aggregate-use rights gate.

## Canonical catalog feature sensitivity — 2026-09-24 / #273

The continued MVP request selects this independent offline packet alongside
primary #182. It uses the accepted #269 snapshot/registry and byte-identical
canonical Personal bootstrap SQL in disposable PGlite, with a hash-bound fixed
clock. The three predeclared arms isolate added provider-concept coverage (C−B)
from broader tag representation changes (B−A). The local preregistration commit
`aca84fa21c02040d0ceaaa513d9a6b5e818c597a` precedes scoring; a private source
archive/receipt preserves it separately from later public publication.

Two independent processes reproduce identical result/report bytes from 840
Items, 12 distinct whole-Item anchors, 24 synthetic profiles and 144 domain-specific
top-50 queries. C−B changes all 24 BOOK memberships (600 entries and 600 exits as
Item-query occurrences), and none of the 24 MOVIE lists. The existing SQL's 0.1
FOR_YOU novelty contribution for unmatched nonempty tags explains MOVIE→BOOK
changes despite zero bootstrap transfer. A dedicated fixture regression confirms
that mechanism. B−A changes all 48 memberships: no neutral serving replacement,
real-user quality improvement or cross-domain taste transfer is established.

Protocol SHA-256 `90bfb9d250b4dfa2bb41dcd8f94d8c01fdbf401b5ca235022366f3116ab015db`;
freeze `f938a0f191b79e1016297a09223f4505d8fb54454b266bbab405c46431defbba`;
private result bytes `2039354833777359e8598d2c56b4f4ddbde3a36225350492f80e2638083c86ed`;
public aggregate bytes `ff5deac98815ecef739172dced2b78d146ec001d7d2390b2a3a040cc2139b571`.
The [full report](../../../research/reports/catalog-feature-baseline-273.md)
records selection bias, conditional top-50 metrics, exact source/runtime hashes,
clock boundary and the approximately 925 MiB observed fixture memory cost.

Independent protocol/results review passed, including direct private-result
checks of novelty and all table counts. Local lint/typechecks, 248 mobile,
128 catalog, 63 database, 44 engine, 32 research and 8 acceptance tests passed;
four exports and companion guards passed separately. The combined 180-second
check stops on frozen Deno npm-registry access in this environment.
[PR #274](https://github.com/Kajooja/Kajo/pull/274) then merged as
`15bff8ddfb4b698b367b265123de3a83488ed70a`, after all five remote CI gates,
**551 tests / four exports**; #273 is closed. No production state, SQL migration,
trained artifact, native Event, admission or #182 source budget changes here.

## Completed metadata diagnosis — 2026-09-24 / #182

PR #272 is accepted on main `d3681fcdfa9a877b0f314159d87208d0ccd0f7f8`,
exact tree `c7267e44c0c1b93ffcfa2c4c92f392e5724b6914`, after all five
[CI #536 jobs](https://github.com/Kajooja/Kajo/actions/runs/35997619768),
541 tests and four exports. The root local gate passed lint/typechecks and
248 mobile / 118 catalog tests, then hit the 150-second frozen Deno registry
network limit. Independent review and 55 targeted tests passed.

The separately prepared request `bbc351eb9fa7eee0fb25f2183be3c1a729b59191`,
canonical SHA-256 `24d82539a439fb156cab3f740beb8d2d23c55e0ca82a7b2d71db259215bed488`,
was retained before activation. [Run 35998771483](https://github.com/Kajooja/Kajo/actions/runs/35998771483)
succeeded on attempt one, 12:23:41–12:23:54 UTC. Artifact **10807770129**,
**18,243 bytes**, passed ZIP digest/CRC and authenticated recovery. ZIP SHA-256:
`b7f4da1d6e13a25e10de4864980db664df871b6dd0be281d0ded1e2fdd958f45`;
sealed JSON: `b03d6ed815c4f5d0b44dedea7cbe740b4061acad7e7679d3be8cac300a8f0a77`;
plaintext: `9190228268817d70bd113568d6eef36391d5fcec3f17d51f703454e47a0b689e`.

The recovered **4,248-byte** body exactly matches the original
`b5613fc9b54dbd4592cfd71a71571d0e17028be76c9592eb1c7152ae7df3742b`.
The original metadata validator is byte-identical and reproduces
`acquisition-compressed-byte-limit`. Exact publisher source pins:

| File | Compressed bytes | MD5 | SHA1 |
| --- | ---: | --- | --- |
| Works | 4,058,336,593 | `eda3a83f9dbc85a4d8f7cde838f070b5` | `c9362f345368cdc8bf64efcc05d6e4b590974cb6` |
| Editions | 12,586,485,055 | `da4de1cca148aa85bea0707a63ffa212` | `e09e00630797598aab877ec542596b1b58f6b87c` |

Their total **16,644,821,648** exceeds the original **15,000,000,000** cap.
Thus the historical cause is established; the prior entry's uncertainty is
superseded by this exact-byte reproduction. One metadata GET, zero dump/per-Item/
ratings requests, approvals or database writes. The diagnostic is consumed.
Recovery version **4** retains 27 verified members, **137,782 bytes**, SHA-256
`d7fc6ae44047aee30720fd9cc519aa60556e3fce54dcf3f3caabaaf1da486087`;
original run/request/source receipts remain unchanged.

The continued owner instruction now selects a distinct reviewed acquisition in
`fix/182-reviewed-dump-budget`, bound to these exact two pins and total size,
the prior diagnostic provenance, original roster/recipient and accepted source.
Old protocol ceilings and consumed requests remain unchanged. It requires no
fresh metadata GET; source CI/merge and durable custody precede activation.
No full scan, extra text, rights decision or database change is claimed here.

## First cloud acquisition and metadata diagnosis — 2026-09-24 / #182

PR #270's concept audit is accepted on main
`690268b9d7f982e1dd10e9dcf059bb8906529504` after all five CI #532 gates,
500 tests and four exports. Collector PR #271 follows as
`ec17a0738702074dedecff00e60a2e529939c8fc`, exact tree
`138067fc92a48f210a0713554b2f8aa37b20e085`; head
`d892c2d29dca3284c2fb47ad276424bb7c095369` passed all five
[CI #533 jobs](https://github.com/Kajooja/Kajo/actions/runs/35993942738),
**528 tests / four exports / companion isolation**. Its post-#270 merge tree is
identical, preserving the tested source without a squash/ancestry conflict.
The composed local check passed lint/typechecks, 248 mobile and 105 catalog tests
before its 150-second Deno registry timeout; CI supplied the complete gate.

The exact public request commit
`4308943cf0157ec6648017a0bf7a25e5b0876c5a` is one child of accepted source and
adds only the allowlisted request file. Canonical request hash:
`9ac96783138824653f8e23eb9bf47c93ed30b7f7e3db658afd25b348f16b6f50`.
It was durably retained with the key before the one activation. Actual
[run 35995362978](https://github.com/Kajooja/Kajo/actions/runs/35995362978),
attempt one, ran **2026-09-24 11:50:15–11:50:28 UTC** and failed after metadata
validation. The publisher returned **4,248 complete bytes**, SHA-256
`b5613fc9b54dbd4592cfd71a71571d0e17028be76c9592eb1c7152ae7df3742b`.
Accounting records **one metadata GET / zero Works or Editions GETs / zero dump
bytes / zero retained records / zero approvals / zero database writes**.

The failure step still uploaded only ciphertext. Artifact **10805673376** is
**2,429 bytes**, ZIP SHA-256
`a97aed35be266b0d80c7f29364ee7c693a351e876fa28b418fefb452ba884c2f`.
Its sole encrypted JSON SHA-256 is
`38becbaaa21ed5c8746b672bbd68aeb1f56f6e7c7105a3828bead2555a63fa8b`;
authenticated recovery reproduces plaintext SHA-256
`3e5754aa87644603694ed10ee58bd50df5ba3a39f9a5a9033fb0c058983e1e47`.
ZIP digest/CRC, source/request/run identity and encrypted bindings were verified.
The old wrapper reused its public error sanitizer for the private receipt, and
the core discarded raw metadata on validation failure. Only the generic
`acquisition-failed` survives; the original precise cause is **unproven**.
Do not relabel it as a connection failure, guess malformed publisher fields or
infer source sizes/checksums from approximate documentation.

A fresh read-only target snapshot at `2026-09-24T11:56:28.995884+00:00` and the
private six-test inspection helper confirm all **383** selected identities,
Item/source versions, descriptions and managed flags unchanged; the full target
inventory remains 385. The helper rechecks the accepted source and receipts and
keeps failure explicit. Recovery **version 2**,
`Kajo-book-dump-acquisition-recovery-20260924.zip`, retains eighteen verified
members: **94,201 bytes**, SHA-256
`34af941724199ca201ae75896e495337837fc70c989fc017a2b2a7594e0c51de`.
It includes the original key, request/source/run receipts, ciphertext ZIP/JSON,
recovered failure, fresh snapshot and private reconciliation. No source text or
completed dump scan exists in this archive.

The next forward source retains exact fixed private error codes and bounded
metadata bytes before parsing/validation while keeping public logs sanitized.
A distinct, purpose-bound diagnostic request on
`catalog-diagnostic/ol-20260831` can perform only **one GET / 2 MiB / 30 seconds /
zero redirects**. It binds the original run/request/artifact hashes, checks exact
accepted source and its sole request-file change, and has its own prior-run guard.
Even valid metadata cannot trigger a Work/Edition download. The old acquisition
request stays consumed; no full retry, migration, pilot reset or rights approval
is included. The recovered body hash must match the original before claiming
reproduction of that old failure; otherwise it is a separate current observation.
Actual diagnostic source acceptance/request/outcome are recorded in #182.

Independent core/workflow review passed with **55 targeted tests**. The integrated
local gate passed lint/typechecks, **248 mobile / 118 catalog tests**; the frozen
Deno registry step remained blocked by this environment. All five remote CI jobs
remain required before merge and any diagnostic activation. Actual old ciphertext
also unseals with the forward reader to its unchanged `3e5754aa…` plaintext hash.

## Bounded cloud BOOK acquisition — 2026-09-24 / #182

The continued owner request selects a concrete acquisition path after the local
Archive.org connection failed again with HTTP 502 before any dump bytes. The
separate accepted-source workflow streams the fixed **2026-08-31** Work/Edition
dumps on GitHub, retaining only the public exact-ID roster's selected records.
It is activated explicitly by one narrow request-branch push after source CI and
merge; ordinary CI uses fixture streams and cannot launch the real download.

The request binds exact current main, canonical public roster, all caps and
recipient public-key fingerprint. Its sole parent must be that main commit and
its only tree change the allowlisted request JSON. Read-only GitHub permissions,
pinned Actions, disabled persisted checkout credentials and no lifecycle scripts
prevent request-branch code or database credentials from entering the operation.
Run attempt must be one and the current run the only run on that request branch;
preflight/source failures consume the request and never retry automatically.

Publisher metadata (at most 2 MiB) pins both exact names, byte counts and MD5/SHA-1
before source GETs. The shared stream parser verifies full EOF/gzip integrity,
bytes, publisher checksums and final SHA-256, bounded by 15,000,000,000 compressed
bytes total, 128 GiB decoded/100 million rows per file, 1,049,600-byte lines,
64 MiB retained records and a 110-minute collector deadline in a 120-minute job.
Redirects remain HTTPS official hosts and exact release-file routes. Missing
records stay explicit; no per-book API call, catalog write or rights approval.

Only RSA-OAEP-SHA256/AES-256-GCM ciphertext reaches public artifacts. Failures can
retain an encrypted safe partial-accounting receipt while the step remains
failed. Private key generation and recovery are local. Envelope integrity does
not identify the sender: exact trusted run/head/request and downloaded artifact
provenance must be retained separately. Recovery does not turn partial receipts
into completed source scans or replace later target/version/rights review.

An actual existing GitHub artifact was downloaded successfully: artifact
`10802996039`, **4,659 bytes**, SHA-256
`054d3d562971ae3c841eb717a243b207709da5bd9263c9ffe545bbea4ff3fef1`;
its ZIP CRC verified. Before activation, the recipient key pair and original
private target snapshot were durably retained in the initial
`Kajo-book-dump-acquisition-recovery-20260924.zip`: **28,163 bytes**, SHA-256
`d2ed5b5c5df349473cbe5e3491e2cbcce80516b49b008f8207943e6b90ef297d`.
All six member sizes/hashes and ZIP CRC verified. This initial custody checkpoint
contains no activated request or dump records; later run recovery updates it.

Independent review and **42 core/parser/envelope/guard/CLI tests** pass, including
full-stream late corruption/duplicates, transport limits/redirects, failed partial
accounting, wrong source/tree/rerun, ciphertext tampering and exact unseal bytes.
All fourteen previous local-intake regressions remain. Full composed root/CI
acceptance and actual run/head/artifact outcome are recorded in #182. At source
publication no source dump has been downloaded, no review approved and no catalog
or native state changed. #269 is stacked source context, not an alternate next
packet or serving rollout.

## Provider-backed catalog concept audit — 2026-09-24 / #269

The continued owner request explicitly selects this independent Phase 14.3
packet while #182 remains the primary source-acquisition task. The offline
mapper and inspector use a strict allowlisted read-only catalog snapshot,
exact provider identity checks, an immutable six-concept registry, source-field
lineage and deterministic projection hashes. Exact normalized Open Library
subject labels and numeric TMDB genre IDs are supported; source topics and film
genres retain different evidence kinds. Synonyms collapse to one positive
assertion and unavailable concepts stay `null`, not fabricated negative evidence.

The actual snapshot at `2026-09-24T11:18:16.242881+00:00` contains **840 visible
Items / 415 BOOK / 425 MOVIE**. Its saved file SHA-256 is
`9391286e83d3fe4de680b8456cd83990ade46d28d5dc3ec6030849c06465c3bb`.
All 385 Open Library and 425 TMDB identity bindings match; thirty curated BOOKs
have no supported provider source. At least one mapped concept covers **244
BOOK / 280 MOVIE**. **171 BOOKs / 231 concept assertions** have mapped source
labels absent from the current matching Item-tag slugs. This is a measured
representation gap, not a causal claim about the old tag cap or evidence that
any particular new model improves preferences.

The [aggregate report](../catalog-feature-coverage-2026-09-24.json) binds input,
registry and private feature-projection hashes. Snapshot/per-Item records stay
out of Git. No catalog write, serving adapter, public tag, Memory, Shared or
Scenario interpretation changes; model admission and Phase 14 gates remain open.
Fourteen focused regressions cover identity ambiguity, neutral unknowns,
synonym collapse, provider/field separation, lineage changes, deterministic
coverage, private-output handling and CLI failure/overwrite behavior. Local
catalog validation passes **77 tests**; lint/typechecks and **248 mobile tests**
also pass. The bounded root check reaches a Deno registry connection block;
complete acceptance requires all five PR CI jobs, recorded in Issue #269.

The controlled `Kajo-catalog-feature-audit-269.zip` is **751,715 bytes**, SHA-256
`a2d42c2d1168fdbef501bc9edb8d11fd29cb6db5b6f9043186eab36458bbea7a`.
It preserves the actual input, private projection, aggregate report and recovery
instructions. Every member
size/hash and ZIP CRC was verified before saving. Source validation and exact
PR/CI/merge acceptance are recorded in Issue #269.

## Exploratory prefix study and recovery — 2026-09-24 / #265

The owner explicitly requested continued public-preference research alongside
#182. A reproduced factorization inference defect discarded durable subject
state when all visible Items lacked fitted factors. The repair uses actual
supported-prefix count, preserving the declared durable fallback with zero
component support. Empty, mixed and unknown-target regressions are included.
Native serving, fitting and historical D2 reports are unchanged.

The fixed protocol/code were locally committed as `e37f63d` before the real fit.
Source download reproduced the original 993,937-byte GroupLens Latest Small /
Kaggle v2 archive, and normalization reproduced all **84,849 observations / 500
subjects**. Freeze receipt
`e21f14b673a33161f95643d4e0eeeee4f4e1c4fffa8c61d5c41ccbf481c59aa8`
binds exact source/code/runtime, original D2 configuration and all partition hashes.

Two independent fits used the original **46,410 ratings / 299 training subjects**.
The declared exploratory target window contains **5,707 ratings / 23 held-out
subjects**. Every policy/budget scores the same complete target groups before
updating only that subject's available history. Primary recent-vs-earliest
maximum-ten durable-state RMSE is **0.807788 vs 0.850843**, difference **−0.043054**,
paired subject-bootstrap 95% **[−0.060646, −0.024471]**. The actual report records
prefix size/age, 1,218 cold-item targets, zero history, all fixed diagnostics,
coverage, resource bounds and limits. Equal maximum budgets do not ensure equal
actual information. Already inspected development data supports no fresh final,
BOOK-transfer, Shared, native or admission claim. D2 rejection stays intact.

Model SHA-256: `808283339e023db236a4dd20412cf9b873072457a5c717aa2ed969763684e3ef`.
Deterministic result SHA-256:
`1f40db237a52cff34a1ed8b7a91b048939632beaa32456dd831cb1713dd2034b`.
Both runs matched parameters, journals, metrics and prefix summaries. Each took
under four seconds, peaked below 381 MiB RSS and produced an 8,014,330-byte model.
Exact costs/runtime and scope are in the [report](../../../research/reports/movielens-small-prefix-study.md).

The controlled `/FRST/Kajo-MovieLens-prefix-study-265.zip` is **12,988,040 bytes**,
SHA-256 `ad6e93025ae88099ced717c57bc7d932cced1007f6fc3bd46818625aa223f6c1`.
Its forty member hashes/sizes and ZIP CRC verified before saving. It retains
source/rights evidence, normalization, exact source snapshot, frozen partitions,
two actual models/journals and aggregate reports outside Git. Recover it only
into private ignored paths after verifying all hashes. The old freeze binds
its original source/runtime; later package/script changes require a new freeze,
not editing that receipt. Research-only rights/withdrawal conditions remain.

Independent method/code review found one parent-configuration binding gap;
it was fixed and regression-tested before commit/freeze. Final report review
verified result hashes, support, metrics and limitations. Engine lint/typecheck
and **44 engine / 32 research / 63 database tests** passed, plus four exports and
companion isolation. Local root check was stopped at Deno registry connection
retries; no full-local-pass claim or TLS/lock change. Required PR CI supplies the
complete gate; Issue #265 records head/run/merge acceptance. Root integration
adds only the already reviewed catalog command and canonical documentation;
it does not recalculate or overwrite the historical study.

The completed pilot recovery and next primary #182 acquisition/scan remain below.
The separate `/FRST/Kajo-book-dump-targets-20260924.zip` retains real snapshot,
plan and failed acquisition evidence: **27,012 bytes**, SHA-256
`035d4a919f5033bf4561f5f6b00fe014ffe55df2c97d37fef3b44e865446a669`.
It contains no source dump or approved text and does not replace the completed
pilot archive. Broader catalog/native/MVP acceptance stays open.

## Offline BOOK dump intake — 2026-09-24 / #182

Source work implements a distinct local monthly-dump intake after the completed
pilot. `scripts/catalog/book-description-dump-targets.sql` freezes existing
provider BOOK identity/version bindings; `open-library-dump-descriptions.mjs`
and `prepare-open-library-dump-descriptions.mjs` supply the no-I/O plan and
streaming stage. Architecture/CODEMAP own the stable contract and commands.
The old pilot, importer, normalizer, consumed provider budgets and installed
migrations are unchanged. No admin/network client is introduced.

The intake requires exact same-release official source paths, full compressed
bytes/SHA-256, gzip integrity/EOF and explicit decoded-byte/row limits. It retains
only exact Work/Edition targets, rejects identity/envelope/linkage mismatches
and duplicates, caps each line and total retained records, and excludes existing
managed descriptions. New private output claims cannot be overwritten; failure
keeps evidence without exposing a completed review. Source records, source/target
hashes and per-target candidate status are private. Missing text, unknown
language and rights remain explicit; no text is autoapproved or applicable through
the old ten-Item pilot. A later guarded writer bridge is still required.

### Actual plan and acquisition boundary

The real read-only snapshot at `2026-09-24T09:56:48.39856+00:00` produced
**385 provider BOOKs / 383 selected / two excluded / 766 expected records**.
Canonical target-snapshot digest:
`4ae7a429ef64faeb82386282c594a8a5d13cf49f17adc5f54a3a07d9fd136517`.
Saved plan file SHA-256:
`804c3801735f747a5bdd39b69acaf46f1b825a1512ee92a4b357fa81b70d88f4`.
No source files were opened, provider requests made, text approved or database
rows written by that plan.

Official [Open Library dump links](https://openlibrary.org/developers/dumps)
resolved both source types to `2026-08-31` under
`https://archive.org/download/ol_dump_2026-08-31/`. Bounded metadata GET and the
redirected Work HEAD failed with proxy CONNECT timeouts. Approximate publisher
sizes (2.9G Work / 9.2G Edition) are not verified sizes for that release. Exact
bytes/external checksums/local hashes remain unknown; zero dump bytes or partials
exist and no real staging run occurred. The next task is reachable official
source acquisition, verified manifest construction and one bounded real scan.

### Validation and source acceptance

Fourteen new regressions pass, including malformed/exact identity, truncated or
concatenated gzip, complete-file hash/byte/row bounds, duplicate target, atomic
failure/no-overwrite and canonical publisher-path checks. Independent adversarial
review also verified invalid UTF-8, a late duplicate in a second gzip member and
the 64 MiB retained-record bound. It requested canonical publisher paths; the
fix and rejection test are included.

Local lint/typechecks, **452 non-edge tests**, four iOS/Android exports and both
companion isolation checks passed. `npm run check` reached frozen Deno resolution
and failed because registry.npmjs.org refused the connection. No dependency,
lockfile or TLS exception was used. Required PR CI supplies the full edge and
five-job acceptance before merge; Issue #182 records exact head/run/merge IDs.
This is source/fixture plus real-plan evidence, not additional live descriptions
or native acceptance. Completed pilot/phone/rights and independent #265 gates
remain as recorded in STATUS.

## BOOK pilot completed and next packets — 2026-09-24 / #182

The owner ran the accepted importer from PR #264/main
`51919db1ee8d5384cd724047dcf8293a27b51261` on their MacBook (Node 22.20.0,
npm 11.6.1, Apple Git 2.50.1). Server credentials stayed in the local operator
environment; none were included in the uploaded run. Both guarded batches and
their accepted CLI readbacks completed. The original twenty provider attempts,
claim, cached records, current review and two prior reviews are unchanged.

| Batch | Actual acknowledgement | Later readback |
| --- | --- | --- |
| 1 | Started `2026-09-24T09:31:59.861Z`, completed `09:32:00.439Z`; exactly the two approved UUIDs, `updated: 2`, `unchanged: 0` | Checked `2026-09-24T09:33:31.23372+00:00`; SHA-256 `61d980d1cce90b09733d31a225f27330379ba7ae7477bd3371a3af0559ef1780` |
| 2 | Started `2026-09-24T09:37:53.222Z`, completed `09:37:53.223Z`; no Item IDs, zero updates | Checked `2026-09-24T09:39:21.375188+00:00`; SHA-256 `91b21929496e2686948dc478b5b5c9d889e9c208a36015aba24381af2d2a2568` |

Both acknowledgements bind the unchanged packet SHA-256
`dd31f5b33771e59a5885d618821dbd5e0a4fda5ff4b1d59ebe15c9730ca11262`.
The two approved Items are Pieni elämä
`a7f6d2cd-e290-4bc4-97b7-cf1180ea86b9` and Romeo ja Julia
`6aa4020d-fdfa-4010-ad8d-2217c71f06f8`; their Item post-write version is
`2026-09-24T09:32:00.069894+00:00`. Exact source versions remain in private
evidence. Scope is still `kajo-internal-pilot`, with the pinned CC BY-SA 4.0
source/credit decision below; broader public-use acceptance is separate.

### Independent hosted and operator-run verification

Read-only coverage at 09:23:09 UTC and full preimages/ACL validation at 09:25:15
matched the reviewed baseline immediately before apply. After batch 1, fresh
coverage and complete Item/source/alias preimages independently confirmed exact
text, full public provenance and private permission/enrichment bindings. Full
Item/source fields outside description/provenance/enrichment and update times
are unchanged, including source `synced_at`; aliases including `last_seen_at`
are unchanged. Batch 2's coverage differs only in its check time.

BOOK is **415 visible / 427 stored / 385 images / 2 descriptions**. MOVIE is
**425 visible / 437 stored / 425 images and descriptions**. The installed
writer/validator remain postgres-owned invoker functions, with empty search
paths, service-role execution allowed and anonymous/authenticated execution
denied. No provider request, migration or model admission was performed here.

The uploaded actual operator ZIP has SHA-256
`914c602dc8d9d2b49523a210b263b112f23a9020979560732669a0be5cc93e57`.
Its thirty files include the actual completed state and both verification
objects. Independent archive review and the accepted offline validators
reconstructed the review chain and both readbacks without mutating state. All
pre-write fields other than run status and the new batch ledger match the prior
reviewed state; no active lock, symlink or environment file is present.

### Completed recovery identity

| Property | Completed value |
| --- | --- |
| Controlled archive | `/FRST/Kajo-book-description-pilot-v1.zip`, **version 11** |
| Archive size / manifest | **1,013,922 bytes / 103 entries**, all CRC/member hashes verified |
| Archive SHA-256 | `06f090f4ccf7ebc78af0a9d1ef3fee465c26511e05ec8adb33b2c2c8745db5c3` |
| Actual completed state SHA-256 | `499eb9b33159db8fb3030fd8242b94c8278a08920e1cf55bed4de81c6a51588f` |
| Current review SHA-256 | `28e81b46b3ff11cfadf8e0d5708a776c2cdd69beb6cad0a9ddac523970ce2265` |

Canonical archive `catalog-enrichment/book-pilot-v1/state.json` is now the actual
**completed** run. Restore that tree to ignored `dist/catalog-enrichment/` only
after verifying the current archive/version/hash and checking for a newer run.
Pre-write state/preview copies are explicitly historical evidence and must not
replace it. `operator-checkpoint.json` identifies the completed state and actual
upload; all earlier source evidence, fresh preimages/readbacks, acknowledgement
and independent verification evidence remain retained. Preserve the original
claim bytes/historical path, completed locks and review history. Do not replay
preview, fallback, amendment or apply. Unknown later changes require exact
state/hash/version reconciliation, never a manually reset status or budget.

### Selected continuation and remaining acceptance

The owner's new request advances the primary #182 packet to bounded exact-ID
Work/Edition dump intake (`feat/182-book-dump-intake`). Fresh read-only target
snapshot at `2026-09-24T09:56:48.39856+00:00` has **385** exact provider BOOKs,
zero identity mismatches and **383** targets after excluding the two existing
managed descriptions. This is a target inventory; real pinned monthly files,
streaming intake, rights/language review and a guarded writer bridge remain
distinct steps. The thirty curated alias gaps are not fuzzy-matched.

Independent #265 / `feat/research-prefix-evaluation` is explicitly selected for
the reproduced unsupported-latent-prefix fallback defect and one preregistered
exploratory study using the already authorized D1 MovieLens cohort. Fixed D2
training boundaries and inspected development data stay explicit. D2's rejected
challenger remains rejected; external observations never become native accounts
or Events. STATUS owns the live implementation/acceptance handoff.

Only a focused phone observation of these two real paragraphs and source/license
links remains for this apply; the accepted full-app/companion exercises need not
be repeated. Six rights holds, two exclusions, the six-description target,
curated mapping/feature quality, #229/native/fresh-account gates and broader MVP
acceptance remain open. No APK was dispatched or UI refinement implemented by
this completion packet. The older handoff below is historical and superseded.

## Pilot recovery and conversation handoff — 2026-09-24 / #182

The owner requested continuation, repository hygiene and a handoff usable from a
new conversation. The accepted starting point is PR #263, main
`4df8b519e2f4526bf458f5b64c36904b266a15a2`, tree
`3486735267c83c37d7b42a1ccfce146a97279ba8`, after all five CI #521 gates
(run `35916619070`). PR #262 already records all deferred UI notes. Only draft
PR #229 was open at the start; it remains an independent native acceptance packet.
This closes the local preparation/handoff unit, not Sprint 014 or Phase 14.3.

### Recover the exact reviewed pilot

The owner's saved artifact was verified on September 24:

| Property | Expected value |
| --- | --- |
| Saved path | `/FRST/Kajo-book-description-pilot-v1.zip` |
| Version | **7**, saved 2026-09-23 20:34:32 UTC |
| Size | **902,604 bytes** |
| Archive SHA-256 | `fe1c70bfe2f31567f048973a0184591a46d064d70cbffcfa9236da59dcdf3637` |
| Manifest | Root `manifest.json`, **87 entries** with exact paths, sizes and SHA-256 |
| State SHA-256 | `78afe993517c36bfa1eeeda543aa2b99e0ebae3b90f1a0c043d1d42fb2a6b209` |

Resolve that saved filename/path through the owner's file access and verify the
version/hash before use. If a newer version exists, reconcile its later batch
ledger and repository checkpoint; never overwrite it with this pre-apply state.
Extract into a private empty directory, validate every manifest entry, then map
archive `catalog-enrichment/` to this checkout's ignored `dist/catalog-enrichment/`.
Retain `evidence/` outside Git. Do not overwrite a newer local run. Preserve the
original `open-library-description-pilot-v1.json` claim byte-for-byte, including
its historical absolute directory; that value is not an instruction to recreate
the old scratch workspace. Keep completed-lock evidence; do not invent an active
`operation.lock`. Reconcile any actual active lock with state/process evidence.

The restored run must be `reviewed`, with **20 provider attempts, 2 prior reviews,
2 approved entries at positions 1 and 4, 6 rights holds, 2 text exclusions and
0 database batches**. Current review and packet hashes are in the
[source-review checkpoint](#pinned-book-source-review-and-apply-preparation--2026-09-23--182).
Both amendment proposals are already applied historical inputs. Do not run
`preview`, `fallback`, `review`, or either saved `amend-review` proposal again.

September 24 checks verified ZIP CRC, all 87 member hashes and byte identity of
every staged catalog file. `validateReviewHistory` and `buildDescriptionPacket`
from the accepted module reconstructed the full review chain and exact saved
two-entry RPC request with fetch disabled. All twenty record inspections and
the original record/attempt ledgers matched; state bytes did not change.

### Remaining operator sequence

The current workspace has neither `SUPABASE_URL` nor
`SUPABASE_SERVICE_ROLE_KEY` (presence-only check; no secret values read).
The two repository workflows provide CI and the synthetic description companion,
not BOOK import. No reachable configured admin runtime/location is recorded.
Continue in an operator environment that already has the project's server-side
import configuration; do not obtain a key in chat, extract a secret, substitute
SQL for the importer or create a new privileged endpoint to bypass this boundary.

1. In that environment, recover the run as above and use accepted main source.
   Immediately before apply, run `scripts/catalog/book-description-coverage.sql`
   read-only and save its **`book_description_coverage` object**, without the SQL
   row wrapper. Compare all identities, versions and preservation fingerprints
   to the reviewed baseline. Retain fresh full target preimages using the saved
   `apply-preflight.sql`. September 23 snapshots are recovery evidence, not a
   substitute for this fresh check. Drift requires review and a new amendment
   bound to the current review hash before any batch attempt; never edit state.
2. Apply batch 1 with the accepted CLI. Inspect exact acknowledgements. Obtain a
   new read-only coverage object as `after-batch-1.json`, then run `verify`.
3. Only after that verification succeeds, apply the empty batch 2. It records
   zero writes but still requires its own later coverage object and `verify`.
   Run becomes `completed` only after the second verification.

Run the following commands individually from the repository root, pausing for
the read-only snapshot and inspection described above between each command:

```bash
npm run catalog:book-descriptions -- apply --run dist/catalog-enrichment/book-pilot-v1 --batch 1
npm run catalog:book-descriptions -- verify --run dist/catalog-enrichment/book-pilot-v1 --baseline dist/catalog-enrichment/book-pilot-v1/after-batch-1.json
npm run catalog:book-descriptions -- apply --run dist/catalog-enrichment/book-pilot-v1 --batch 2
npm run catalog:book-descriptions -- verify --run dist/catalog-enrichment/book-pilot-v1 --baseline dist/catalog-enrichment/book-pilot-v1/after-batch-2.json
```

Unknown acknowledgements or failed verification stop this sequence for exact
ID/hash/version reconciliation; do not retry automatically, reset the claim or
mark a batch complete manually. Retain post-write identities/versions for guarded
restoration of managed fields only. Persist the updated run, acknowledgements,
readbacks and manifest in the same saved artifact with version-conflict checking
before leaving the operator environment, then update STATUS/#182.

Observe only these two real paragraphs and their source/license links on the
phone after successful apply. Accepted companion/full-app reports remain valid;
the six-description target, other rights holds and broader catalog/native/MVP
gates remain open. This handoff performed no hosted query/write, provider GET,
migration, APK dispatch or new device exercise. Runtime/SQL/dependencies remain
unchanged. Required PR CI and final merge identity are recorded in Issue #182.

## Pinned BOOK source review and apply preparation — 2026-09-23 / #182

The owner-requested continuation after PR #262 advances the existing pilot,
without a new provider pass. The original archive's 25 manifest entries verified;
the original claim and run files were restored byte-identically. No active
operation lock existed; historical completed-lock evidence remains untouched.
The initial reviewed state had SHA-256
`3945e504a087071839095588cbd1653f82fe775555591235a3531933d9ff118f`.

### Exact correspondence and limited permission decision

Direct primary-source retrieval resolved the two previously partial leads:

| Position / selected Item | Independently matching Wikipedia revision | Match |
| --- | --- | --- |
| 1 / Pieni elämä | [A Little Life, 995224795](https://en.wikipedia.org/w/index.php?title=A_Little_Life&oldid=995224795), 2020-12-19 22:08:22 UTC | All 199 characters; text SHA-256 `3b6b1838b911c90bab7cdefdc17eaf3f61f847df7cc1f2c1243915dd8800d0c6` |
| 4 / Romeo ja Julia | [Romeo and Juliet, 1060312455](https://en.wikipedia.org/w/index.php?title=Romeo_and_Juliet&oldid=1060312455), 2021-12-14 19:01:23 UTC | All 388 characters; text SHA-256 `0a750307e44db15765970ebd0daa5cc00b3adef8800a9ae9341b63094738113a` |

The offline comparison independently checks saved rendered HTML and revision
wikitext against the unchanged cached Work descriptions. Only formatting,
inline links and citation markers are omitted; wording and punctuation match.
This identifies an independently licensed source for identical prose, not a
proven chain through the unknown Open Library uploader. Both texts remain
English; Finnish Edition identity/title/cover and original-language data stay
unchanged. No generated replacement, translation, excerpt from the book or
publisher blurb is substituted.

The explicit operator review approves **only these two descriptions for
`kajo-internal-pilot`** with CC BY-SA 4.0, contributor credit through the exact
article/history link, a visible license link and a changes notice. The review
uses [Wikimedia reuse terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content),
[Wikipedia's copyright policy](https://en.wikipedia.org/wiki/Wikipedia:Copyrights),
the documented [2023 license update](https://meta.wikimedia.org/wiki/Wikimedia_Foundation/Legal/2023_ToU_updates/About)
and the [CC BY-SA legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en).
Pinned article text, current talk pages and twenty preceding history summaries
per revision showed no additional imported-text credit or specific copyright
notice for these leads. This is a bounded inspection, not an exhaustive audit of
every edit; generic historic-page warnings are retained. Credit names Wikipedia
contributors collectively, never the last editor as sole author. No image,
other paragraph or publisher text is covered, and no contact was made.
Public beta/store rights/use and withdrawal review remain separate gates.

`permission-review.json` retains the exact primary-response hashes, decision,
intended use, public credit and limits; its SHA-256 is
`4f6d40c93ce0bd44a8eadbf90f1c4aa5cd29441defc15a900d04573197de6681`.
The evidence and real text remain in the controlled pilot archive, outside Git.

### Actual amendment and read-only preparation

The existing `amend-review` CLI ran with fetch disabled and no database
credentials. It bound the prior review
`974f1fd812f51bde6ac1c1125e90319fafd17f830040f9600d2220dc98165056`
and preserved the entire earlier chain, all raw records, all twenty consumed
provider attempts and the other eight current decisions. The run now contains
**2 approved descriptions / 6 rights holds / 2 text exclusions / 2 prior reviews /
0 database batches**. Packet mode is `open-library-description-v2`; the private
permission digest and public credit bind the same text/record hashes.

- Current review hash: `28e81b46b3ff11cfadf8e0d5708a776c2cdd69beb6cad0a9ddac523970ce2265`.
- Current packet hash: `dd31f5b33771e59a5885d618821dbd5e0a4fda5ff4b1d59ebe15c9730ca11262`.
- Current state file hash: `78afe993517c36bfa1eeeda543aa2b99e0ebae3b90f1a0c043d1d42fb2a6b209`.

An intentional replay of the applied proposal was rejected as
`review-parent-mismatch`, leaving state bytes unchanged and releasing the lock.
Neither the old `rights-amendment.json` nor the new
`pinned-rights-amendment.json` may be replayed as a continuation.

Read-only coverage at **2026-09-23 20:18:12 UTC** confirmed all ten exact
identities, all Item/source row versions and every preservation fingerprint
unchanged from the prior review. BOOK remains **415 visible / 427 stored /
385 images / 0 descriptions**; MOVIE **425 / 437 / 425 images and descriptions**.
At **20:25:23 UTC**, the installed attribution validator accepted both real credit
objects. Full Item/source/alias preimages for the two targets were retained and
their versions matched the baseline. No catalog write or migration occurred.

The private archive now includes comparison/reproduction evidence, the applied
amendment, updated state/history, public-credit preview, two-entry batch-1
request and `apply-readiness.json`. Batch 2 has zero approved entries and must
remain an explicitly verified no-write checkpoint. The six-description usefulness
target remains unmet. The accepted importer needs the already configured admin
runtime; this workspace has no privileged importer credential. Do not obtain a
key here, bypass the importer with ad hoc SQL, or mark a batch as applied.

Next refresh coverage immediately before controlled apply, retain any newly
required preimages and use the existing guarded CLI/RPC batch/readback sequence.
If baseline versions changed, prepare a new review amendment bound to the
current hash above. Any rollback requires the actual post-write versions/hashes
and restores only the managed description/provenance/envelope. The two real
paragraphs and links require observation after a successful apply; no new native
result is claimed here. UI refinements remain queued under PR #262 / Phase 17.0.
Issue #182 owns this documentation packet's final PR/CI/merge identities.

## Full-app feedback and deferred UI notes — 2026-09-23 / #182

After the concrete full-app instructions below, the owner reports “Kaikki
toimii” and asks to record additional observations, implement them when suitable
and continue substantially along the existing roadmap. This is successful
owner-reported acceptance of the exercised application behavior. The requested
source was PR #261/main `6d8e75df4d66ce2aa209f806c09bfb5e379c560c`,
accepted after all five [CI #516 gates](https://github.com/Kajooja/Kajo/actions/runs/35861047609)
and the 466-test local check. Installed binary identity and individual timed,
accessibility or OS-refusal cases were not separately reported. The earlier
OnePlus companion result remains accepted; do not repeat either full exercise
solely to fill those metadata. This does not accept independent draft PR #229.

The report explicitly retains a Discovery entry defect and these deferred notes:

| Owner observation | Canonical destination |
| --- | --- |
| Discovery Katsotut must open the same watched history | #200; UX_PRINCIPLES browse refinements |
| Elokuvat, Löydä and Katsotut share a row; title dropdown selects Kirjat/future types | #199/#200; UX_PRINCIPLES |
| Remove unused brown space below the poster grid | #199; UX_PRINCIPLES |
| Load another batch near the bottom | #199, dependent on #228/#229 cursor/delivery acceptance |
| Show fitting descriptions in full; expand/scroll only when needed | #239; UX_PRINCIPLES detail refinements |
| Open card has arrow-only Back, including List/history entry | #239; UX_PRINCIPLES detail refinements |
| List/history heading offers list and poster-grid icons | #231; UX_PRINCIPLES collection views |
| Eventually show actors/directors and other movie credits | FUT-CAT-001, coordinated with #182 |

Source inspection confirms that Discovery currently computes consumed Items from
`ranking.items`, unlike canonical `ConsumedHistoryScreen`. `ItemListScreen`
already has LIST/GRID controls, so extend the existing presentation instead of
claiming there is no grid at all. Detail currently labels Back “Discovery” and
`ItemDescription` collapses every description to two lines. The TMDB normalizer
already stores cast names and directors; richer display does not automatically
require another provider import. These findings scope later implementation,
not a fix delivered by this documentation packet.

ROADMAP Phase 17.0 keeps the browse/detail refinements after current foundations;
future cast presentation does not create a new release blocker. The default next
packet is the two cached Wikipedia source leads for BOOK permission/attribution.
The original ten-Item pilot remains reviewed with 20 spent provider attempts,
eight rights holds, two text exclusions, zero approved descriptions and zero
database batches. General licensing research, installed forwards and completed
MOVIE expansion are not repeated.

## Consumed history scope and full-app test — 2026-09-23 / #182

After PR #260/main `a5131650ceb837ea7fc5fe640ff0798bffaa4aa8` passed all
five CI #514 gates, the owner requested continuation and concrete instructions.
Preparing those instructions exposed a separate history-screen ownership defect:
`ConsumedHistoryScreen` identified a snapshot only by Item type and retry count.
The navigation shell can switch Profile without unmounting it, so an old
Personal history/rating or error could remain under the newly selected Shared
heading until the next response. A quick A → B → A could also reuse old A data.

`fix/182-history-profile-scope` binds each request to the provider's existing
actor/Profile/environment scope, read callback, Item type and retry attempt.
The render only accepts the exact request object; every transition, including
A → B → A, creates a new identity. Old rows and errors disappear before effect
cleanup/refetch. Existing cancellation, retry and canonical Item navigation
remain in place. No service endpoint, schema, auth policy or dependency changes.
This corrects history presentation, not the independent #229 serving/session gates.

Eight controlled component regressions exercise the actual render/effect
functions, including pre-effect visibility, actor/backend/unavailable scope,
rapid return, late response, error/retry and BOOK/MOVIE Item navigation. They
do not mount native views or establish phone acceptance. Exact final source,
validation, PR/CI and merge identities belong to Issue #182.

The old accepted history reader fails six of these regressions while its late
response cancellation and domain/navigation checks still pass; the correction
passes all eight. The full local `npm run check` passes **466 tests** (248 mobile,
3 contract, 46 catalog, 28 Edge, 63 database, 43 engine, 27 research, 6 companion,
2 bundle-boundary), lint/typechecks, all four iOS/Android exports and both
companion source-graph guards. Frozen Deno npm dependencies reused the temporary
local registry with committed SHA-512 verification; no dependency/lock/gate
changed. Existing DiscoveryScreen hook and Metro dependency warnings remain.

### Concrete full-app phone check

1. Open the repository's **Actions → CI** and the **main** run for the accepted
   commit recorded at the top of Issue #182. Main pushes already run the full
   Kajo APK job after the required gates. When it succeeds, its artifact is
   `kajo-android-standalone-<full commit SHA>`; extract and install `app-release.apk`.
   This is the full Kajo application, `app.kajo.mobile`.
2. Use existing Personal/authorized Shared content. Close Kajo completely,
   reopen, then go from Room directly to a List, Luetut or Katsotut before
   opening discovery. Open an existing Item and return. Repeat for both domains
   where content exists. Title/image/available description must belong to that Item.
3. Repeat in Shared. While history is visible, switch Personal → Shared → Personal.
   Old rows/ratings/errors must disappear while the selected history loads;
   no old response may replace the new history. Note whether a delayed-read
   transition was actually observed; a fast successful switch alone is not that proof.
4. In Personal, load a List while online, then disable mobile data and Wi-Fi
   before opening an Item. A stalled detail read must show an error within
   15 seconds. Restore connectivity and press **Yritä uudelleen**; the same Item
   must open. **Takaisin** must also work during loading/error.
5. Report the CI run/commit, tested cases and any failing steps/screenshot.
   Missing Shared/history content or an unobserved timing case stays untested.

No new device observation, APK dispatch/poll, hosted operation, provider request
or pilot amendment is performed here. The successful OnePlus companion report
remains accepted. Real BOOK descriptions still require their separate exact
rights/revision review; an absent description is not by itself an entry failure.

## OnePlus feedback and canonical detail entry — 2026-09-23 / #182

The owner reports: “Toimii. Testasin oneplussalla. Kaikki tuntuvat toimivan oikein.”
This follows the companion test instructions and accepts its exercised behavior
on the owner's OnePlus phone. Model, OS, installed commit/binary identity,
screenshots and individual TalkBack/OS-refusal results were not provided; none
are inferred from chat client metadata or a possible build run. The owner then
explicitly requested continuation. Do not repeat the accepted companion test.

The companion source was merged as PR #259/main
`8e7625e8f3867fa34ca709aa10ce76e83588fe82`; all five CI #512 gates passed, with
one CLI-startup retry on unchanged source. Its native feedback does not accept
Personal/Shared/List navigation, #229 or real description permissions.

### Bounded correction

Inspection of actual List/history navigation found that `ItemListScreen` and
`ConsumedHistoryScreen` pass only `itemId` to detail. The old detail constructor
looked it up with `getMockItem`, which could only see remembered recommendation
Items and static mocks. Thus an already loaded canonical List Item could still
be missing when opened after restart; a stale recommendation could also supply
its description instead of current canonical metadata.

`fix/182-catalog-detail-entry` adds `CatalogDetailEntry` and
`catalogDetailLoad.ts`, using existing `loadCatalogItems` and the same public
attribution projection. A route without a delivered Prediction ID loads its
exact canonical Item with loading/missing/error, retry and Back states. Every
attempt has a 15-second deadline; cancellation and timeout discard late results.
The component identifies state by client, actor/Profile scope, Item and attempt
and unmounts the previous card across scope changes. A successful read opens
one Item in the existing card and never creates a remembered Prediction slate.
The original delivered-Prediction path and Shared-overlay readiness gate remain.
No production fixture, auth bypass, dependency, migration or new API is added.

Regression coverage includes the actual route selection, Personal/Shared scope
keys, canonical credit in the shared renderer with collapsed/expanded text,
missing/wrong/malformed rows, invalid attribution, stale cached descriptions,
backend failure/retry, cancellation and bounded late responses. The old accepted
route fails three new entry regressions; its delivered-Prediction/Shared gate
check still passes. Exact final validation and PR/head/merge identities belong
to Issue #182; source success is not new device evidence.

Local root-check stages pass **458 tests**: 240 mobile, 3 contract, 46 catalog,
28 Edge, 63 database, 43 engine, 27 research, 6 companion and 2 bundle-boundary
tests, plus lint/typechecks. All four iOS/Android exports and both companion
source-graph guards also pass; the complete smoke command was confirmed
separately after the initial combined log stopped at Metro startup. Deno's
registry transport stalled in this environment, so the unchanged locked npm
tarballs were served through a temporary local HTTP registry after verifying
their SHA-512 integrity against the committed lock. No dependency, lockfile or
gate changed. The existing DiscoveryScreen hook and Metro dependency-export
warnings remain. No native device/emulator is available in this workspace.

### Remaining acceptance

After source acceptance, test the configured full application by restarting and
opening a List or Luetut/Katsotut before discovery, then opening an Item and
returning. Repeat for Personal and an authorized SharedProfile and exercise
read failure/retry and a Profile change during a delayed read. Attributed
synthetic paragraphs still require isolated application test state; do not put
them in the hosted catalog or real Profile/Event history. No new device test,
APK dispatch/poll, hosted query/write, provider request, pilot amendment or model
admission is performed by this correction. BOOK/MOVIE budgets, rights holds,
#229/fresh-account gates and broader MVP/Phase 14.3 acceptance remain open.

## Isolated native description test companion — 2026-09-21 / #182

The accepted September 20 handoff required native description-credit observations,
but the hosted catalog intentionally has no approved BOOK descriptions and this
workspace has no device/emulator. `feat/182-native-description-acceptance` adds a
concrete isolated test runtime without treating synthetic paragraphs as published
catalog data or using real users/Events. Source/CI/merge identities belong to
[Issue #182](https://github.com/Kajooja/Kajo/issues/182).

**Publication approval, 2026-09-21:** after reviewing the complete Git patch,
the owner explicitly approved this packet's public publication, PR and merge
after all five required CI gates pass. This resolves the earlier automatic
approval review block; no alternate publication route followed the rejection.
Implementation commit `4907fbb9f12eb5730028b46b4a6473adfa9e55fa`, checked tree
`a888354f9a3345a214a28f72dc54bea35b4cf577`, passed all available implementation
checks; subsequent checkpoint changes are documentation only. Issue #182 owns
the final published head, CI and merge identities. Native-device observations
and the actual Personal/Shared/List entry-context gate remain open.

### Delivered source

- `apps/description-acceptance` is a small Expo workspace with a custom
  `registerRootComponent` entry. Its Android/iOS identifier is
  `app.kajo.descriptionacceptance`, distinct from `app.kajo.mobile`. It imports
  no production app/router/auth/data or Event providers and has no login or
  storage path. The launcher disables dotenv loading; no project credentials
  are required. App metadata records the Git commit and dirty state and the
  screen displays them with OS identity for manual evidence.
- `ItemDescription.tsx` extracts the existing detail paragraph, collapse
  controls and credit display. Normal detail and the companion render this same
  component with the same typography/theme and fail-closed cached Item validation.
  The original functional expand/collapse updates are retained, and the control
  now exposes its expanded accessibility state. The parent detail retains its
  existing scrolling, actions, actor/Profile and Event behavior.
- `DescriptionCredit` retains `Linking.openURL` by default and its safe URL
  check/recoverable alert. An optional opener lets only the companion inject
  a labelled one-shot failure. Retrying the same link then uses the actual
  native opener; injected failure is recorded separately from OS refusal.
- Seven synthetic cases exercise long bound credit, missing credit, unsafe
  source URL, changed cached text, text-only fallback, explicit legacy text and
  empty text. The existing contract fixture supplies the synthetic paragraph;
  `example.com` source/license test URLs are distinct and make no real licensing
  claim. Theme controls cover dawn/evening/night. The app never marks a test
  accepted automatically or simulates Personal/Shared/List identity.
- Root lint/types/tests/smokes include the workspace. The new smoke exports
  iOS/Android and checks the actual source maps for exactly one React instance,
  all shared production description modules, and an explicit first-party allow
  list. Database/auth/router/Event imports are rejected. Only the new workspace
  and a copy of the already locked React 19.2.3 entry were added to the lock;
  existing dependency versions/integrities did not change.
- `.github/workflows/description-acceptance.yml` supplies a **manual-only**
  standalone APK build with source checks, a distinct artifact name and no
  production credentials. It was not dispatched or polled in this continuation.
  The existing Kajo APK workflow and installed native/database history are unchanged.

### Validation and limits

The complete local `npm run check` passed **442 tests**: 224 mobile, 3 shared
contract, 46 catalog, 28 Edge, 63 database, 43 engine, 27 research, 6 companion
fixture and 2 bundle-boundary tests. Normal mobile and companion each passed
both iOS and Android exports. Companion source maps contain 596 iOS / 594 Android
modules, including the same description renderer, one React instance and no
production auth/data/router dependencies. The existing Discovery Hook and
`@noble/hashes/crypto.js` export-fallback warnings remain.

The first root attempt stalled requesting registry metadata and was stopped;
the successful run reused the existing local registry mirror and frozen lock
integrities. No Edge source, lock or test gate was changed. Npm validated the new
workspace lock offline. A single-process local Metro probe received running
status, the isolated Android manifest with source/dirty identity, the exact
`/apps/description-acceptance/index.ts.bundle` entry and its development bundle.
This proves the launcher and served bundle, not actual native rendering. React
Native DevTools could not open in the container; no sandbox setting was bypassed.

No device/emulator was available. No native layout/link/accessibility case,
APK installation or full Personal/Shared/List entry is accepted by this source
packet. No hosted query/write, migration, provider request, pilot amendment or
real description approval occurred. The twenty-request BOOK and completed MOVIE
budgets stay closed; #182, #229 and broader MVP/Phase 14.3 acceptance remain open.

### Run the native acceptance companion

Use a clean accepted Git checkout on a development machine with the repository's
Node version and a compatible Expo Go app on a phone connected to the same LAN:

```bash
npm ci
npm run acceptance:descriptions -- --lan
```

Scan the terminal QR code in Expo Go. `npm run acceptance:descriptions -- --offline`
also starts Metro without registry checks; it does not make external test links
available without a connection. For Android without Expo Go, an explicitly
requested manual run of **Description native acceptance APK** builds artifact
`kajo-description-acceptance-<commit>` from the selected ref. Install that distinct
test app; do not infer that it contains the Kajo application or #229. A workflow
definition/export is not evidence that an APK was built, installed or exercised.

Record the source commit/dirty state, build artifact if used, phone model, OS,
font scale, screen reader, exact case and observed result. Check the valid case
collapsed and expanded; source/license links separately; all invalid/legacy
cases; each theme; and labelled simulated failure followed by a successful retry.
Record actual browser destination/back-navigation and actual OS refusal separately.
The app's “avauspyyntö välitetty” message only means the OS accepted the request.

The [native acceptance matrix](#native-description-credit-acceptance-matrix)
remains the gate. The companion covers the shared description component;
Personal/Shared/List entry, full-card placement and configured application state
still need isolated application-level tests. Neither the fixture companion nor
an accepted device test grants permission for any real source text.

Expo's [custom root registration](https://docs.expo.dev/versions/latest/sdk/expo/#registerrootcomponentmaincomponent)
and [monorepo guidance](https://docs.expo.dev/guides/monorepos/) were checked for
the separate entry/workspace. No custom Metro resolver or dependency override
was needed. [STATUS](../STATUS.md) remains the exact continuation authority.

## Description attribution source acceptance and rollout — 2026-09-20 / #182

The owner approved public publication, PR and merge after required checks, then
immediate continuation. [PR #257](https://github.com/Kajooja/Kajo/pull/257) merged
at `a4e5bbf8d587c69a8ea3a90aecbd49c652d89df0` from final head
`f300c5adcea3cee9dc0828945add936a4bad13d6`, tree
`f528396dfd3a8796c71fc6216fe053c5b37c4c0b`. All five required
[CI #508 gates](https://github.com/Kajooja/Kajo/actions/runs/35536998176) passed:
validation, platform/defaults, two clean installs, existing-application upgrade
and native Supabase CLI/history. Initial CI #507's extra setup result row was
fixed by silent fixture seeding, with a red-before/green-after regression for a
single JSON snapshot. The strict reader and production migration were retained.
The final complete local check passed all **430 tests** and both mobile exports.
Native CI confirmed v1/v2 lock waits, guarded replay and anonymous PostgREST
denial. This is source/server evidence, not native mobile acceptance.

The exact accepted file `20260920000607_description_attribution.sql`, SHA-256
`57af455775f7f43d7cfe81fc8af887128358c3c3e056f785b4cbb3545bfab043`, was applied
as one bounded migration after fresh target/history/function/ACL verification.
The installed source/hosted version mapping and full private operational evidence
are retained in `Kajo-description-attribution-rollout-v1.zip`, SHA-256
`0787e63162ccc83cc9850c4d1dff00c3681f9b0e9496d43ec1c3c95efb31469e`.
**Do not deploy the new forward again.** The installed v1 description migration
and six independent native forwards were not replayed or changed.

Repeatable-read read-only snapshots at **21:03:16 UTC** and **21:07:40 UTC**
verified the following after the successful installation:

- All five resulting function definitions, owners, ACLs and settings exactly
  match the isolated installation of accepted source. Every function is invoker,
  has an empty search path and allows service-role execution while denying
  anonymous/authenticated execution. The two full legacy writer definitions
  remain unchanged.
- Exactly one migration was added; all 57 prior history entries retain their
  statement digests. Unrelated functions, triggers and default privileges match.
- Full Item, ItemSource and external-ID alias SHA-256 fingerprints are unchanged.
  BOOK remains **415 visible / 427 stored / 385 images / 0 descriptions**;
  MOVIE remains **425 / 437 / 425 / 425**. There are zero managed descriptions
  and zero discoverable mocks. No catalog writes were used as hosted tests.
- A service-role read-only helper probe accepts valid bound synthetic credit
  and rejects missing credit, an unsafe URL, a wrong text hash and an extra
  private field. Security advisors are unchanged: the same 23 informational
  RLS notices and pre-existing leaked-password-protection warning remain.
  The warning's [existing remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  is independent of this migration; no auth settings changed.
- The pilot archive still hashes to
  `09e6de176eca698a7db582a4f9d4e892ce2f3fe841771b251b0581dee23b91a8`.
  Staged state is byte-identical to its archived entry, SHA-256
  `3945e504a087071839095588cbd1653f82fe775555591235a3531933d9ff118f`:
  **20 spent attempts / 1 retained prior review / 0 approved entries / 0 batches**.
  No provider request, pilot amendment, real description write, APK dispatch or
  device test occurred.

The controlled evidence includes both snapshots, exact expected function
definitions, validation SQL and a rehearsed guarded rollback candidate. No
rollback was executed. That candidate refuses v2 data or drift and needs its
own quiesced-writer/history-reconciliation review before any real recovery.
This rollout does not clear the eight rights holds or two text exclusions,
accept #229, close #182/MVP/Phase 14.3, or establish native UI behavior.

### Native description-credit acceptance matrix

This matrix defines application-level native acceptance. The September 23
checkpoint above records the owner's successful isolated companion test and
the separate canonical entry correction. Record the exact configured
build/source commit, device/OS, result and visual evidence for each row. Use the
synthetic contract fixtures through canonical Item/detail and enrichment
boundaries in an isolated test runtime; do not seed the hosted catalog or
generate genuine user evidence merely to make a test description visible.
No device/emulator was available for the September 20 implementation. That
checkpoint left every row pending; the later owner report is scoped to the
companion and does not supply separate full-application observations per row.

| Case | Required observation |
| --- | --- |
| Personal, Shared and List detail entry | The same canonical attributed Item retains source, revision, credit, license and changes; order and actor/Profile scope stay unchanged |
| Collapsed and expanded text | Credit stays visible in both states, long credit wraps without clipping, and controls remain usable at increased font size |
| Source and license links | Each independently opens the exact validated HTTPS destination; back navigation retains detail state |
| External-link failure | Native refusal/failure shows the recoverable message without losing the Item; a later attempt can succeed |
| Accessibility | Source and license links have distinct labels/roles and reachable focus; expanded text and credit are read in a usable order |
| Missing, unsafe or mismatched credit | Managed text is hidden while the other Item data remain; a text-only RPC fallback does not expose an uncredited paragraph |
| Legacy and cached content | Explicit legacy metadata preserves existing content; changing cached managed text or dropping its credit hides that description |

Successful component tests, exports and server CI are insufficient for these
observations. A main build does not contain the independent #229 branch by
implication. Do not dispatch or poll an APK as a substitute for the named device
gate. After native acceptance, exact source/revision/permission evidence is still
required for any real description approval; keep the spent provider budget closed.
[STATUS](../STATUS.md) owns continuation. Entries below retain earlier states,
including their then-pending source publication and rollout preparation.

## Structured description attribution — 2026-09-20 / #182

Branch `feat/182-description-attribution` starts from accepted PR #256/main
`1d8ed155bc39a0d543df27ca4d68006910f7f755` (all five required CI #505 gates).
[Issue #182](https://github.com/Kajooja/Kajo/issues/182) owns this source packet's
exact PR/head/CI/merge outcome when published. The recovery checkpoint below
records the publication interruption and its subsequent owner approval.
This packet uses synthetic records only.

- The shared `@kajo/catalog-contracts` package defines the public credit schema,
  safe bounded text/HTTPS links and browser/native UTF-8 SHA-256 using pinned
  `@noble/hashes` 1.8.0. Root check includes its tests; no engine/domain fork.
- Offline review opts attributed approvals into v2, binds source/text hashes and
  private permission evidence to the public credit and preserves legacy review
  reconstruction/history. Mixed approved v1/v2 entries cannot silently omit
  required credit. Apply selects the packet mode and readback verifies both
  public attribution and private permission bindings.
- CLI-generated forward `20260920000607_description_attribution.sql` extends
  only the narrow catalog writers and adds a private validator. Invoker/service
  ACLs, empty search paths, deterministic locks, exact identities/versions,
  preserved core metadata and batch atomicity remain. Populated v1→v2 upgrade
  preserves all existing rows; v2→v1 and legacy overwrite attempts are rejected.
  Credit/evidence changes require current versions; identical replay is a no-op.
- Canonical Item reads select metadata and preserve explicit legacy content.
  Text-only RPC fallbacks and invalid/missing required attribution hide only the
  description. Ranking, Shared and List enrichment carry whole canonical Items
  without changing order, authorization or actor/Profile state. Detail cache
  revalidation rejects altered text or dropped/unsafe credit. The view shows
  source, revision, credit, license and changes even when the text is collapsed,
  with independently accessible links and recoverable link-opening errors.
- Tests cover shared hash/URL/plain-text behavior; v1 review-history preservation
  and v2 synthetic apply/readback; complete-schema forward/data preservation,
  ACLs, downgrade/stale-version denial and atomic batch failure; canonical
  enrichment/error fallback/cache binding; and source/license link activation.
  A Unicode-trim mismatch found by the SQL fixture was corrected to match the
  JavaScript contract. Native CI additionally exercises old-server rejection,
  PostgREST v2 resolution, anonymous denial and overlapping writers.

The complete local `npm run check` passed: **220 mobile, 3 shared-contract,
46 catalog, 28 Edge, 63 database, 43 engine and 27 research tests (430 total)**,
lint/typechecks and iOS/Android exports. Frozen Edge dependencies used existing
archives verified against their lock integrities. Only the new workspace and
pinned hashing dependency changed the npm lock. Final mobile lint retains only
the pre-existing Discovery Hook warning. Required final-head native CI/merge
identities are recorded in #182, not inferred from local PGlite tests.

No native emulator/device was available; actual layout, screen-reader navigation
and native external-link behavior are not accepted by component/bundle success.
No hosted query/write, provider request, source permission decision, pilot
amendment or APK dispatch occurred. The saved checkpoint SHA-256 remains
`09e6de176eca698a7db582a4f9d4e892ce2f3fe841771b251b0581dee23b91a8`:
**20 consumed attempts / 1 prior review / 0 approvals / 8 rights holds /
2 text exclusions / 0 database batches**. September 17 catalog counts remain
the last verified inventory. #229 and MVP/Phase 14 acceptance stay open.

After source publication and required CI/merge acceptance, continue the new
catalog-only forward rollout (source SHA-256
`57af455775f7f43d7cfe81fc8af887128358c3c3e056f785b4cbb3545bfab043`) and native
description-credit acceptance. Do not redeploy installed v1/history, broaden
budgets or repeat the general licensing search. Exact matching contribution/
revision and applicable permission are still required before approving real
text; rendering support alone grants no rights. [ARCHITECTURE](../../architecture/ARCHITECTURE.md#description-attribution--contract-182)
owns the durable schema/display rules; STATUS owns the single next packet.

### Interrupted-publication recovery and rollout preparation — 2026-09-20

Fresh repository synchronization confirms accepted main is still
`1d8ed155bc39a0d543df27ca4d68006910f7f755`. Runtime commit
`89371e094c8259c9bce73719c35e73b583dbfd0b` and its 39-file implementation were
recovered intact. No remote attribution branch or PR exists. The interrupted
chat's claim of a published PR waiting for CI was incorrect. Automatic approval
review rejected the push to public `Kajooja/Kajo`, citing insufficient explicit
publication authorization for this source packet. No alternate publication
method was attempted. The owner subsequently explicitly approved publication to
public `Kajooja/Kajo`, PR creation and merge after all five required checks, and
requested immediate continuation afterward. The publication block is resolved;
Issue #182 records the resulting exact source/CI/merge evidence.

PR #257 was actually opened at `f6e2ab325edb8bae1e99f7ac9756d8804667105b`, with
tree `1e5c74c4133f2e0220fec47341db53051d330b30` matching the local checked tree.
Initial CI #507 passed validation, platform, clean-install and existing-upgrade
gates. The native CLI job failed because the attribution upgrade fixture emitted
an intermediate UUID/outcome row into the strict JSON-line reader. Replacing
the setup `select` with `perform` preserves the seeded v1 row without emitting
it. The local full-schema regression now asserts exactly one final snapshot;
it failed with two rows before the fix and passes afterward. No parser relaxation,
gate removal or production migration change was used. Final-head CI remains
required before source acceptance or hosted rollout.

- A fresh complete `npm run check` passed all **430 tests**, lint/typechecks and
  both iOS/Android exports. Runtime source and migration bytes are unchanged.
  The existing verified frozen Edge archive cache was reused. The existing
  Discovery Hook warning and Metro's `@noble/hashes/crypto.js` export-resolution
  fallback warning remain; successful bundles do not prove native execution.
- A repeatable-read, read-only hosted snapshot at **2026-09-20 19:32 UTC** verified
  the configured target, migration history, all four catalog writers, their
  function definitions/owners/ACLs/settings, catalog fingerprints, unrelated
  functions, triggers and default privileges. The four definitions still match
  the verified September 17 readback and the locally installed accepted source.
  All remain invoker functions with empty search paths and service-role-only
  client execution. The new private attribution validator is absent.
- The fresh inventory is unchanged in count: BOOK **415 visible / 427 stored /
  385 images / 0 descriptions**; MOVIE **425 / 437 / 425 / 425**. There are zero
  managed descriptions and zero discoverable mocks. Exact full catalog hashes
  and function preimages are retained in the separate local preparation evidence;
  no raw source paragraphs or private evidence are added to Git.
- An isolated PGlite rehearsal matched all four target function definitions,
  owners, ACLs and settings before applying the unchanged new forward. V2
  binding/upgrade/downgrade/atomicity fixtures passed. A recovery candidate,
  generated from the two exact prior writer definitions, restores those writers
  and removes only the new validator. It requires quiesced catalog writers,
  bounded locks and unchanged v2 function/ACL hashes, and refuses existing v2
  data. The rehearsal restored the original function and application snapshots;
  repeating the rollback was rejected. It deliberately does not alter migration
  history; any real recovery still needs its own reviewed history reconciliation.
- The pilot archive remains SHA-256
  `09e6de176eca698a7db582a4f9d4e892ce2f3fe841771b251b0581dee23b91a8`, and the local
  pilot state matches the archived state byte for byte. No provider call, pilot
  amendment, hosted write, migration installation, APK dispatch or device test
  occurred. The new forward remains uninstalled.

After source acceptance, refresh the read-only snapshots immediately before the
bounded admin rollout and compare all catalog/unrelated metadata afterward.
Native acceptance must cover Personal, Shared and List detail entry, collapsed
and expanded credit, source/license link activation and failure, screen-reader
labels, and missing/invalid-credit fallback. Keep the device and #229 gates open.
Preparation evidence does not approve any real text or extend the spent budget.

## Cached BOOK rights audit and review amendment — 2026-09-19 / #182

Branch `feat/182-book-review-amendment` starts from accepted PR #255, main
`6257561b3f2e5a566925abe0e1b82537ebecb4d3`. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
owns this packet's exact PR/head/CI/merge result. The prior deployment and all
twenty raw provider records were reused; no fresh provider record, hosted
query/write, APK dispatch or device test belongs to this packet.

### Source findings and display gate

The saved Work records contain no explicit rights/license field. The
[Open Library licensing page](https://openlibrary.org/developers/licensing),
rechecked on September 19, still flags possible existing contribution rights.
Record availability and text eligibility do not establish display permission.
The controlled `rights-audit.json` binds these findings to each cached record
revision/hash and text hash; it contains references and conclusions, not new
replacement descriptions.

| Frozen position | New source finding | Decision |
| --- | --- | --- |
| 1 — Pieni elämä | [Wikipedia revision 686759357](https://en.wikipedia.org/w/index.php?title=A_Little_Life&oldid=686759357), October 21, 2015, matches the first two sentences; the third differs. Current prose also differs. | Hold: exact contribution/revision and attribution unresolved |
| 2 — Ei enää ihminen | [Publisher's current page](https://www.ndbooks.com/book/no-longer-human/) uses different copy; the cached text includes a critic quotation. The publisher provides a separate [permissions process](https://www.ndbooks.com/permissions/). | Hold: exact source and permission unresolved |
| 3 — Rikos ja rangaistus | Existing Markdown/URLs remain excluded. | Unchanged text-policy exclusion |
| 4 — Romeo ja Julia | [Linked Wikipedia lead](https://en.wikipedia.org/wiki/Romeo_and_Juliet) overlaps but differs; no exact matching revision was established. | Hold: origin/revision and attribution unresolved |
| 5 — Ajan lyhyt historia | The cached asterisk remains excluded. | Unchanged text-policy exclusion |
| 6 — Atomic Habits | [Publisher opening](https://www.penguinrandomhouse.com/books/543993/atomic-habits-by-james-clear/) closely matches, with punctuation differences; [site terms](https://www.penguinrandomhouse.com/terms-of-use/) do not supply a Kajo display grant. | Hold: use permission unresolved |
| 7 — It Ends With Us | [Publisher page](https://www.simonandschuster.com/books/It-Ends-with-Us/Colleen-Hoover/It-Ends-with-Us/9781501110368) matches three paragraphs, with a different closing paragraph; [site terms](https://www.simonandschuster.com/p/terms-of-use) do not establish permission for this cached copy. | Hold: use permission unresolved |
| 8 — The Subtle Art of Not Giving a Fuck | [Author page](https://markmanson.net/books/subtle-art) does not contain the cached description. | Hold: primary contribution/permission unconfirmed |
| 9 — Control Your Mind and Master Your Feelings | No primary origin or license was established. | Hold: origin/permission unconfirmed |
| 10 — Harry Potter and the Philosopher's Stone | [Author page](https://www.jkrowling.com/book/harry-potter-philosophers-stone/) differs; cached text includes a narrative excerpt. | Hold: exact contribution/permission unresolved |

These are documented matches/leads, not assertions of an exact copyright-owner
chain. Date-filtered Wikipedia history retrieval was unavailable; that limitation
does not turn a partial match into a licensed revision. No publisher/contributor
was contacted and no permission grant was obtained. **Zero display approvals;
eight rights holds and two unchanged text-policy exclusions.**

The implementation audit found `Item.description` alone in the domain contract,
no description provenance selection in `catalogItemOperations.ts`, and plain
description rendering in `ItemDetailScreen.tsx` without source/license credit.
[Wikimedia reuse terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)
and [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) therefore cannot
be satisfied by merely storing an attribution note in the private import review.
The [attribution contract](../../architecture/ARCHITECTURE.md#description-attribution--contract-182)
owns the minimum structured data and display behavior. No UI/schema extension is
claimed delivered here, and no existing publisher text is relabeled as CC-licensed.

### Delivered offline review amendment

`amend-review --run <existing-run> --amendment <proposal.json> --baseline <baseline.json>`
accepts a proposal with exactly `contract`, `expectedReviewSha256`, `reason` and
all ten `decisions`. The contract is
`open-library-description-review-amendment-v1`; the expected hash is
`digest(state.review)` using the existing canonical JSON digest. A non-older
baseline may refresh expected row versions; the original baseline stays in
the retained review. Actual apply still requires a current SQL readback and
guarded rollback preimages in the configured admin runtime.

The command requires a reviewed, non-failed run with **no database batch attempt**.
It verifies every saved record/hash and the exact consumed attempt accounting,
including skipped Work records. It validates the old and new packets, preserves
complete decisions/baselines in `reviewHistory`, links the new review to its
parent, and saves atomically under the existing lock. Replayed/stale proposals,
unchanged inputs, invalid history, failed runs and any previous attempted write
are rejected without resetting state. Apply and verify also validate review
history. The rights/text/identity rules and SQL v1 payload remain unchanged.

The actual CLI recorded the ten source-specific skip reasons in the original
run: **20 unchanged attempts / 1 prior review / 0 approved entries / 10 skips /
0 database batches**. The old raw state, applied proposal and rights audit are
retained in `Kajo-book-description-pilot-v1.zip`; the applied proposal must not
be replayed. No operation-lock recovery or global-claim replacement was needed.
Catalog totals remain the September 17 verified baseline, not a fresh readback.

Validation covers legacy behavior plus exact parent/history retention, successive
amendments, skipped-record tampering, spent budgets, stale/locked/replayed
proposals, unchanged permission/language gates and amended synthetic apply/
readback through the existing RPC contract. The actual CLI test disables fetch
and supplies no credentials. All 19 description tests and the complete root
`npm run check` passed, including both platform bundle smokes. The first root
attempt stopped at a refused npm registry connection; the successful run reused
cached package archives whose integrity matched every frozen Edge lock entry.
No dependency or lockfile was changed. All 46 local Markdown link targets and
the whitespace check passed. Exact remote CI/merge outcomes remain in #182.

Next implement the structured attribution path with synthetic fixtures and
preserve #229's independent reader/native gates. Matching source revisions and
appropriate permission evidence remain necessary before real approval; complete
general licensing research is not the next default task. The pilot and MOVIE
budgets stay closed; do not redeploy installed SQL or broaden the provider pass.

## BOOK rollout and description review — 2026-09-17 / #182

Branch `docs/182-book-description-rollout` starts from accepted PR #254,
main `dce94df96e965f26810c979cf8af550d551c8597`. Publication initially stopped
at automatic approval review. The owner explicitly authorized the public
documentation and #182 update on 2026-09-17. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
records this documentation packet's exact PR/head/CI/merge outcome.

### Completed rollout and preserved data

The exact accepted `20260914060616_book_description_refresh.sql` was applied
once. Its source bytes and filename remain unchanged. The owner-controlled
checkpoint retains the source/hosted version mapping and exact verification;
do not apply the forward again or repair previous history.

Readback verified both new function bodies, the exact intended legacy guard,
unchanged legacy batch, service-only invoker permissions and no default mode.
All previous migration rows, unrelated function definitions/ACLs, triggers and
global defaults were preserved. An anonymous empty-entry HTTP probe reached the
named overload and received permission denial, establishing hosted schema-cache
resolution without a privileged write. It is not an actual import ACK.

Before/after and final catalog comparisons are equal: BOOK **415 discoverable /
427 stored / 385 images / zero descriptions**; MOVIE **425 / 437 / 425 images and
descriptions**. All ten pilot identities, row versions and preservation hashes
match. Detailed database identifiers/fingerprints stay in controlled evidence.
Security review found no new function/search-path/permission finding; existing
private-table RLS-without-policy notices and the previously tracked
[Auth password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remain separate operations work.

### Actual frozen preview and review outcome

The unchanged CLI collected all ten selected Editions and, after hash-bound
fallback review, their ten exact Works. All twenty responses passed exact
record/Work identity checks. **20 attempted GETs / 20 found records / zero
retries / zero redirects / zero database batches.** The original request spacing,
timeouts, size cap, candidate identities and exclusive pilot claim were retained.
This provider budget is exhausted; no further candidate fetch is part of it.

| Frozen position | Edition description | Work description | Review decision |
| --- | --- | --- | --- |
| 1 — Pieni elämä | Finnish; source URL | Eligible English, 199 code points | Stage: permission/attribution unconfirmed |
| 2 — Ei enää ihminen | Missing | Eligible English, 863 | Stage: permission unconfirmed; embedded critic quotation |
| 3 — Rikos ja rangaistus | Missing | Markdown/URLs | Stage: text policy rejects it |
| 4 — Romeo ja Julia | Missing | Eligible English, 388 | Stage: origin/license and attribution need confirmation |
| 5 — Ajan lyhyt historia | Missing | Contains an asterisk | Stage: unchanged text policy rejects it |
| 6 — Atomic Habits | Missing | Eligible English, 315 | Stage: permission unconfirmed |
| 7 — It Ends With Us | Missing | Eligible English, 1,212 | Stage: permission unconfirmed |
| 8 — The Subtle Art of Not Giving a Fuck | Missing | Eligible English, 470 | Stage: contribution/permission unconfirmed |
| 9 — Control Your Mind and Master Your Feelings | Missing | Eligible English, 1,182 | Stage: permission unconfirmed |
| 10 — Harry Potter and the Philosopher's Stone | Missing | Eligible English, 683 | Stage: permission unconfirmed; narrative excerpt present |

The eight structurally eligible descriptions are all English. A Finnish Edition
did not supply an eligible Finnish description. No markup was stripped, text
rewritten/translated, notes substituted or original language changed.

The official [Open Library licensing page](https://openlibrary.org/developers/licensing)
still flags possible pre-existing rights. Actual saved records do not establish
a permission basis for these display writes. Linked encyclopedia/author pages
are origin leads, not an exact licensed revision or completed attribution plan.
The matching current encyclopedia prose is not identical to the cached text;
do not assert an exact source match without evidence. None is marked approved.

The accepted `review` command generated a **reviewed packet with zero entries
and ten skips** (eight permission holds, two text-policy exclusions). No `apply`
or `verify` batch command was run, and no empty batches were sent. The target of
six approved usable descriptions was **not met**. Preview/review completion is
not description-import or native-usefulness acceptance.

### Controlled checkpoint and continuation

`Kajo-book-description-pilot-v1.zip` is the owner-controlled checkpoint. It holds
the original claim, all twenty raw responses/record and text hashes, attempt
ledger, fallback/content/text decisions, before/final coverage and rollout
evidence. Real descriptions, raw records, database identifiers and review inputs
remain outside Git. The local run is `dist/catalog-enrichment/book-pilot-v1`.
Recover the saved run before any future action; never create another pilot to
reset its counters or fetch the same candidates again.

One local fallback invocation stopped on a stale operation lock before any
request. The completed preview's records, hashes, prepared status, zero Work
attempts/batches and process exit were reconciled before archiving that lock;
the same claim/state then completed its ten Work calls. The fallback command
reported no lock after successful exit, but a subsequent tool snapshot again
contained that lock. Its completed state was reconciled before the no-I/O review.
This observed persistence limitation is recorded without claiming a source-code
defect. Restored locks require the same explicit reconciliation; never delete
the global claim or turn a failed/uncertain operation into success.

Next complete a bounded **cached-source permission and attribution packet**.
Prioritize exact origin/revision and license evidence for the existing candidate
texts, determine required public credit/license links, and review the actual
display contract/UI before approving any text. Resolve unknown permissions with
documented evidence or keep them staged. Do not change the normalizer simply to
meet the target or begin a broad dump/API pass first.

The run is already `reviewed` with zero entries. The current CLI intentionally
does not reopen reviews. If a later decision approves cached text, use a reviewed
and tested amendment workflow retaining the original decisions, hashes, spent
attempts and zero batch history; do not edit its status back to `prepared`.
Refresh the exact SQL baseline and prepare a guarded description-only rollback
before any write. Actual apply still belongs to the configured admin runtime;
no privileged credential was available in this workspace and none was retrieved.
Do not bypass that boundary through SQL HTTP/vault or new admin endpoints.

Validation: accepted PR #254/CI #501 remains the runtime source/native proof.
This documentation PR runs the normal required CI gates; #182 owns their outcome.
Hosted readback, anonymous HTTP denial, all twenty
provider receipts, actual normalization/review and unchanged catalog comparison
are new evidence. No device test, APK dispatch, new model admission, native
forward or catalog-import v12 redeployment occurred. Documentation links and
whitespace passed separately before publication (36 local links across four
changed Markdown files). #182 / MVP-CAT-001..003 /
Phase14.3, broader dump coverage, curated mapping, rights and native usefulness
stay open; the completed MOVIE budget and #229/D2 decisions are unchanged.

## BOOK description implementation — 2026-09-14 / #182

Branch `feat/182-book-description-refresh` starts from accepted planning PR #253,
main `1ea3a8c64beff8571bde4dc39cf73c30fc68b944`. This packet implements the
[guarded contract](../../architecture/ARCHITECTURE.md#book-description-enrichment--guarded-contract-182)
and the frozen pilot below. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
owns the exact PR/head/CI/merge result. This is source acceptance; the migration,
candidate provider reads and description writes have not run against the hosted
project. Read-only SQL on 2026-09-14 confirms the earlier BOOK/MOVIE baseline.

### Delivered behavior and deliberate implementation choices

- `open-library-descriptions.mjs` accepts only typed/plain `description`, applies
  NFC/plain-text/size bounds, verifies exact Edition/Work linkage and hashes raw
  records/text. Missing notes-only records stay missing. Verified description
  language is separate from the selected Edition and original language.
- `import-open-library-descriptions.mjs` supplies `plan`, `preview`, `fallback`,
  `review`, `apply` and `verify`. The fixed manifest is tested against the SQL's
  ten UUID/Work/Edition/language tuples. `plan` has no I/O or credential need.
  Preview uses provider reads only; it collects ten Editions, then pauses for
  actual review before fetching any fallback Works. This implements the planned
  Edition-first preference without assuming description language from Edition
  metadata or spending fallback requests on already acceptable text.
- One exclusive pilot claim under ignored `dist/catalog-enrichment/`, plus an
  exclusive per-run lock and atomically replaced checkpoints, prevents parallel
  starts/reset budgets in different run directories. Every request is recorded
  before transport. There are at most twenty sequential starts spaced 1,100 ms,
  a 15-second response deadline and 1 MiB decoded limit. A 404 is sparse; a
  redirect, identity/JSON/encoding failure, 429, 5xx, timeout or network error
  fails the run. No automatic retries, replacements or counter reset.
- Review binds the actual record/text hashes, explicit fi/en text language,
  contribution/use permission basis and fresh SQL Item/source identities and
  versions. The public provenance contains the basis hash; the private source
  envelope contains its bounded explanation. Unknown language/permission stays
  skipped/staged. Raw records, real descriptions and reviewer files stay ignored.
- CLI-created forward `20260914060616_book_description_refresh.sql` adds named
  two-argument overloads at the existing canonical Item/batch boundary, with no
  default mode. The batch accepts 1–10 distinct Item/source identities and locks
  Items, sources, then aliases in deterministic order. The narrow Item overload
  also validates/locks when called directly. It changes only description, its
  provenance and the private envelope plus automatic update timestamps. Calling
  the old full writer would normalize existing arrays/title again, so the narrow
  Item overload is the canonical implementation of the preserving mode.
- Equal text/source revision/review identity returns a read-only `unchanged`,
  including an older expected row version. New fetch time/raw-record hash alone
  does not rewrite existing evidence. A changed text needs exact current Item
  and source versions. Identity/lifecycle checks still precede no-op. Legacy
  Search Work and dump Edition imports reject managed refreshes under the same
  Item lock; unmanaged imports remain supported. All signatures are invoker,
  empty-search-path and service-role-only; PostgREST receives schema reload.
- Apply rebuilds and checks the reviewed packet before transport. Positions 1–5
  and 6–10 are separate atomic requests, each with exact index/UUID/outcome ACKs.
  `verify` requires a fresh SQL report: catalog/nonpilot fingerprints, all ten
  identities/core/source fields and actual description SHA-256/provenance must
  match. Batch 2 is blocked until batch 1 readback passes. The run completes only
  after the second readback. A lost/malformed response or checkpoint after a
  possible commit consumes the batch as `unknown-write-outcome`; no auto replay.

### Operator continuation after source/rollout acceptance

Review/apply only the new catalog migration after checking the current hosted
catalog definitions/ACLs. Do not replay the six native forwards or deploy the
unchanged v12 Edge function. The Supabase connector does not expose a privileged
catalog import invocation or secret retrieval; do not work around that boundary
through SQL HTTP/vault/new endpoints. Use the already configured admin runtime
for `apply`, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; provider-only
commands need neither. No new key setup is required by this packet.

The commands below are the operational sequence, **not completed provider work**.
Run from the repository root. Run paths must be under the ignored staging root.

```bash
npm run catalog:book-descriptions -- plan
npm run catalog:book-descriptions -- preview --run dist/catalog-enrichment/book-pilot-v1
npm run catalog:book-descriptions -- fallback --run dist/catalog-enrichment/book-pilot-v1 --review dist/catalog-enrichment/book-pilot-v1/fallback-review.json
npm run catalog:book-descriptions -- review --run dist/catalog-enrichment/book-pilot-v1 --review dist/catalog-enrichment/book-pilot-v1/text-review.json --baseline dist/catalog-enrichment/book-pilot-v1/before.json
npm run catalog:book-descriptions -- apply --run dist/catalog-enrichment/book-pilot-v1 --batch 1
npm run catalog:book-descriptions -- verify --run dist/catalog-enrichment/book-pilot-v1 --baseline dist/catalog-enrichment/book-pilot-v1/after-batch-1.json
npm run catalog:book-descriptions -- apply --run dist/catalog-enrichment/book-pilot-v1 --batch 2
npm run catalog:book-descriptions -- verify --run dist/catalog-enrichment/book-pilot-v1 --baseline dist/catalog-enrichment/book-pilot-v1/after-batch-2.json
```

Inspect the saved `preview.json` and source records before writing review inputs.
Skip `fallback` entirely if no Work lookup is needed; each selected Work can be
fetched once. `fallback-review.json` is an array of positions, Edition
`recordSha256`/`textSha256` (null for missing text) and a reason from
`edition-missing`, `edition-language`, `edition-rights`, `edition-unsuitable`.
`text-review.json` contains exactly one decision for each of the ten positions:

| Decision | Required fields in addition to `position` |
| --- | --- |
| Accept reviewed text | `choice: "edition"` or `"work"`, exact chosen `recordSha256`, `textSha256`, `textLanguage: "fi"` or `"en"`, `rights: "approved-for-pilot"`, actual 20–1,000-character permission/use `basis` |
| Leave staged | `choice: "skip"`, nonblank `reason` (max 200 characters) |

Run `scripts/catalog/book-description-coverage.sql` at each named checkpoint and
save its **`book_description_coverage` object**, not the SQL client's row wrapper,
as the corresponding private JSON file. The query now exports source UUID/current
version, description SHA-256 and prior description/provenance/envelope in addition
to the unchanged preservation fingerprint definitions. Retain complete controlled
preimages for the reviewed guarded rollback procedure below. No rollback switch
clears managed fields automatically. Do not delete a failed run's pilot claim,
edit an ambiguous batch to completed, or invent a new run to reset the budget.
Read back exact identities/text hashes/versions and record reconciliation plus
the remaining-attempt decision in #182 before any further operation.

### Verification and remaining gates

Local root `npm run check` passed 411 tests, lint/typecheck and both Hermes
exports. Catalog fixtures cover bounds, notes exclusion, text/Edition languages,
hash-bound review, Work fallback, rate/timeout/budget stops, packet tampering,
exact/unknown ACKs and enforced readbacks. Full-schema PGlite fixtures cover a
populated catalog upgrade, exact preservation (including unsorted arrays/title),
stale Item/source versions, conflicting aliases/lifecycle, atomic rollback,
no-op/changed refresh, ACLs and both legacy replay paths.

Required CLI CI adds the same populated upgrade/smoke on the pinned native
Supabase stack. Independent service-role sessions must visibly wait for actual
row locks: reversed input batches update once/no-op once, while a waiting legacy
refresh is rejected. Real PostgREST must reject the mode on the older schema,
resolve the new overload with exact read-only replay ACKs and deny anonymous
access. Source/CLI migration-history/native-platform gates remain required;
Issue #182 records their actual result rather than treating PGlite as concurrency
proof. Local dependencies use the existing archive cache after all eleven frozen
Edge SHA-512 checks; CI uses its normal dependency path. The existing unrelated
mobile Hook lint warning remains.

Initial source CI #500 passed validate/platform/fresh-install/populated-upgrade
but failed in native concurrency fixture cleanup: catalog source foreign keys
restrict Item deletion. The fixture now deletes its synthetic aliases/sources
before Items, also checks committed cleanup in PGlite, and preserves any earlier
probe error if cleanup fails. The application migration is unchanged. Corrected
head/CI acceptance is recorded in #182; the failed run is not native acceptance.

The updated read-only coverage query executed at
**2026-09-14T06:34:32.501146+00:00**: BOOK 415 visible / 427 stored, 385 images,
zero descriptions; MOVIE 425 visible / 437 stored, all 425 images/descriptions.
All ten identities and source UUID/version fields match; all existing preservation
fingerprints are unchanged. Query SHA-256:
`e4803671f63815416202a733d6ca9f97ddc429880e571bdab61cc1ebc6919278`.
Catalog forward SHA-256:
`c592fd19949eb6a5484711bc9c73a35b596c163175896c60d7bcc6a654652188`.

No hosted DDL/deploy, candidate GET, description write, device test or APK
dispatch occurred. Source success does not supply a per-record rights decision,
pilot coverage, native rendering/attribution, broader dump coverage or curated
identity mapping. #182 / MVP-CAT-001..003 / Phase 14.3 stay open. The completed
MOVIE cap, #229 native gates and rejected D2 challenger admission are unchanged.

## BOOK description plan — 2026-09-13 / #182

Planning branch: `docs/182-book-description-plan`, based on accepted
`f8ed71db6186ee9f810d985462119cf7085e1f08` / PR #252. The completed diagnostic
rollout is catalog-import ACTIVE v12, with exact five-file readback and unchanged
425-movie coverage recorded in [#182](https://github.com/Kajooja/Kajo/issues/182).
Do not repeat its CI/deploy/import sequence. This packet adds a reviewed BOOK
contract and read-only coverage query; it does not implement/apply that contract.

### Observed data and source gaps

Hosted read-only audit at **2026-09-13T22:03:54.804507+00:00**, followed by the committed
final query at **2026-09-13T22:16:34.12922+00:00**, found:

- **415 discoverable / 427 stored BOOK Items**, 385 covers and zero descriptions.
- All 385 Open Library Items have one matching Work alias, a matching metadata
  mirror/source key and a selected Edition key. No saved Search payload contains
  `description` or `notes`; the Search normalizer explicitly returns null.
- Display-Edition languages are eng 336, fin 39, swe 3, spa 2, and fre/ita/por/tur/yid
  one each. These are not original-language or description-language counts.
  All 385 provider Items have unknown original language. The historical 57 Finnish
  edition-availability count is a different measure from 39 selected Finnish editions.
- All 30 original curated BOOK Items have only `kajo_curated_slug` aliases.
  They retain their original UUIDs and 2026-09-04 creation times. The query lists
  them for a later exact identity review; exclude them from this pilot.
- MOVIE remains 425 discoverable / 437 stored, all 425 with images/descriptions.
  Discoverable mocks remain zero.

The bulk importer currently consumes ratings and Editions, not Work descriptions;
its normalizer can substitute `notes` and treats Edition language as original
language. Neither behavior belongs in the new description contract. Its raw
error-body echo and unverified successful-count fallback, also present in Search
orchestration, must not be copied into new orchestration.

The deployed single-item upsert confirms full replacement of description and
metadata (definition MD5 `26418016af759bce2e580fdd7d3236a2`);
the batch wrapper is `abd9f4d40e35096d1cc1a9fa2a39e497`. A description-only entry
would clear unrelated fields. Implement the guarded overload described in
[Catalog architecture](../../architecture/ARCHITECTURE.md#book-description-enrichment--guarded-contract-182)
before any write. Current RPCs and six installed native forwards were not changed.

### Frozen first pilot — open-library-description-pilot-v1

Select five fin and five eng display Editions from existing alias-verified Items,
ordered by stored popularity descending then Work ID inside each group. This
selection was frozen from the audit; later checkpoints retain the exact identities
even after their descriptions change. It is a technical/quality pilot, not a
representative catalogue sample or evidence about original language.

| Order | Current title | Canonical Item UUID | Work ID | Selected Edition ID | Edition language |
| --- | --- | --- | --- | --- | --- |
| 1 | Pieni elämä | `a7f6d2cd-e290-4bc4-97b7-cf1180ea86b9` | `OL17370186W` | `OL26433779M` | fin |
| 2 | Ei enää ihminen | `43c6e886-0858-4f3e-b188-72cc62b6dfbc` | `OL3923952W` | `OL44944392M` | fin |
| 3 | Rikos ja rangaistus | `25fa7fee-2a4d-4b8e-9c63-f9f6f367aff9` | `OL166894W` | `OL16835710M` | fin |
| 4 | Romeo ja Julia | `6aa4020d-fdfa-4010-ad8d-2217c71f06f8` | `OL362427W` | `OL26501345M` | fin |
| 5 | Ajan lyhyt historia | `9d8a5234-5565-4f42-aa77-30422e780419` | `OL1892617W` | `OL39218444M` | fin |
| 6 | Atomic Habits | `ccbdb717-0a27-4099-8b56-64b3c5f9aaed` | `OL17930368W` | `OL27918581M` | eng |
| 7 | It Ends With Us | `b54ebb75-2e4c-48e1-8349-5f73bf0d789b` | `OL18020194W` | `OL27213498M` | eng |
| 8 | The Subtle Art of Not Giving a Fuck | `c3548ac2-ae85-4ee6-aeeb-8101fa909fb1` | `OL17590212W` | `OL27351482M` | eng |
| 9 | Control Your Mind and Master Your Feelings | `4af3c2b6-7a8a-4107-b198-ac0ed0afa2c9` | `OL25312237W` | `OL33899062M` | eng |
| 10 | Harry Potter and the Philosopher's Stone | `fad9046f-f67a-42f2-9fb8-57657035593e` | `OL82563W` | `OL59004869M` | eng |

No substitutions, title search, new Items, new aliases or Edition enumeration.
If a selected Edition now links to another/multiple Works, stop and review the
identity conflict; do not repair it inside this pilot.

| Pilot resource | Hard cap |
| --- | ---: |
| Existing canonical candidates | 10, exactly as above |
| Provider GET attempts | 20 total: at most one selected Edition + one exact Work per candidate |
| Concurrent provider requests | 1 |
| Minimum spacing | 1,100 ms between request starts; respect Retry-After before any later explicit resume |
| Per-response timeout / decoded JSON size | 15 seconds / 1 MiB |
| Automatic retries / redirect follows / replacement candidates | 0 / 0 / 0 |
| Reviewed database batches | At most 2, positions 1–5 then 6–10, each atomic |
| Entries written / new Items / alias additions | At most 10 / 0 / 0 |

These are proposed pilot limits, **not operations performed in this planning
packet**. Documentation lookups and read-only SQL are separate from the future
candidate GET ledger. Inspect the exact Edition first; fetch its Work only when
the selected description cannot be used, within the same cap. Every started
attempt consumes its slot even on failure. A resumed failure needs an explicit
revised remaining-attempt ledger; never silently reset counters. A successful
ten-candidate pass does not authorize another 375 single-book API sweep.

Use the application's honest User-Agent/contact identification and the default
one-request/second tier; do not assume a repository URL grants the provider's
higher identified tier. Collect and cache provider records before review and
before opening database transactions. Dry-run planning performs no I/O;
preview performs only the bounded provider reads and reports no writes.

### Review, apply and continuation

1. Implement/test the strict text normalizer, no-write planner/preview and
   guarded generic batch mode from the architecture contract. Keep current
   Search/dump writes from clearing managed descriptions. Old deployments must
   reject the top-level refresh mode. Accept source/CI and review the exact
   catalog-only migration/rollout before using it; no new credential setup or
   unrelated function/native rollout is part of this work.
2. Run `scripts/catalog/book-description-coverage.sql` and existing
   `catalog-coverage.sql`. Require all ten `identity_matches=true`; preserve the
   complete per-Item/source preimage in controlled admin staging for guarded
   rollback. Keep only IDs, hashes, counts and decisions in Git/#182.
3. Prepare a frozen preview with source record URLs/revisions/hashes, candidate
   text hashes, source/fallback, text-language review and actual attempted-call
   ledger. Review fitness and contribution/use rights before any display write.
   Unknown permission/language, notes, markup, absent or rejected text stays
   staged/skipped with fixed reasons. A 404 is a sparse result; transport/rate
   limit/JSON/identity errors stop. Do not fabricate Finnish copy or claim
   Edition language proves the text's language.
4. Apply only approved candidates from positions 1–5 through the guarded mode.
   Require exact returned input-index/UUID mapping for every acknowledged row.
   Compare the SQL report before proceeding to positions 6–10. A malformed/lost
   acknowledgement is an unknown write: stop and reconcile actual hashes/versions.
   Never automatically replay the batch or continue after uncertainty.
5. After each batch, require unchanged stored/discoverable counts, all ten
   identities, all `preservation` fingerprints, each pilot `core_md5` and
   `source_base_md5`. The query allows only pilot description/provenance/envelope
   plus automatic timestamps to change. Record added, unchanged, skipped and
   uncertain counts separately. Use `catalog-coverage.sql` to recheck service
   privileges. Hashes detect drift; they are not authorization tokens.
6. The pilot's working usefulness target is **at least six reviewed, usable
   Finnish/English descriptions out of ten**, with every candidate accounted for,
   exact identity preservation and no data loss. Record actual Finnish/English
   text counts and every fallback. Missing the target is a valid failed-coverage
   result; no automatic extra requests. Native rendering/attribution acceptance
   remains separate from normalized text/SQL success.
7. After pilot review, plan the remaining exact Work/Edition join from one
   pinned monthly dump release, streamed against the existing target IDs.
   Description enrichment needs no rating-history input or new popularity ranking.
   Pin source checksums/revisions and use the same guarded mode/checkpoints.
   Default to filling missing text; changed owned text is an explicit reviewed
   refresh. Missing upstream text never erases current text. No recurring
   scheduler is enabled by this plan.
8. Review the 30 curated identities separately using authoritative Work/Edition
   linkage and creator/edition evidence. Their current title/author is a search
   aid, not permission to attach an alias. No fuzzy duplicate creation.

Rollback restores only the prior description/provenance/source envelope on the
same Items, and only while current hashes/versions still equal this pilot's
writes. Retain canonical sources/aliases and all user history. A concurrent edit
or uncertain write requires reconciliation; do not restore entire old Item rows.

### Required implementation verification and remaining gates

Next source packet needs meaningful fixtures for typed/missing/markup/oversize
descriptions, Edition-vs-text language, Work fallback, notes exclusion, preserved
presentation/popularity fields, conflicting/redirected IDs, old-server rejection,
stale/concurrent source/Item versions, identical rerun/no-op, legacy BOOK refresh
preservation, atomic rollback, lost acknowledgement, call-budget exhaustion,
404/429/5xx/timeouts, strict UUID receipts and secret/error-body redaction.

Local `npm run check` passed **396 tests**, lint/typecheck and both Hermes exports.
It used the existing loopback package-archive cache after verifying all eleven
archives against the unchanged frozen Edge lock SHA-512 values; normal CI remains
required. The existing unrelated mobile Hook lint warning remains. Changed
Markdown file/anchor links and all ten SQL/Sprint identity mappings passed.
The final read-only SQL executed successfully; all ten identities match, and
inventory/provider/language/preservation values equal the first query's report.
Only the source-base fingerprint was strengthened to cover all preserved source
fields as well as its original payload; no stored value changed. Exact source
CI/merge and the full SQL checkpoint belong to #182. No Work/Edition
candidate API calls, provider imports, description writes, schema changes,
deployment, native tests or APK dispatch occurred in this packet. Broader
rights/attribution, BOOK completeness, bounded refresh and native usefulness keep
#182 / MVP-CAT-001..003 / Phase 14.3 open. #229 and rejected D2 challenger admission
are independent and unchanged.

## Catalog expansion verified and failure diagnostics — 2026-09-13 / #182

The PR #251 source is accepted on main
`f462aaa20e3a65899452be847ee9ff3af22f167d`; catalog-import v10 is ACTIVE.
The completed hosted pass has **425 discoverable MOVIE Items with complete
TMDB core metadata/images/descriptions**, all 30 original curated identities
preserved, and all eight declared expansion coverage checks passing. Coverage
was read at 20:51:19 UTC; original UUID/IMDb/creation-time identity was independently
rechecked at 20:54:38 UTC. The final documentary page added 18 Items/refreshed two;
all 20 of its posters returned HTTP 200 / image/jpeg.

English (259) and Finnish (60) are the two largest original-language groups
(75.1% together), matching the owner's catalogue emphasis. Non-English coverage
is 166; Finnish production is 60; seven languages have at least ten movies.
The five era counts are 66/55/74/79/151; sixteen genres have at least fifteen
movies; documentaries total 22. BOOK remains 415 discoverable, 385 images and
zero descriptions. Native image/Taste quality and rights/refresh remain open.

The actual bounded pass used 18 request attempts with 28 verified page fetches,
including a Korean repeat. Spanish page 1 was deferred to preserve the cap.
A subsequent science-fiction request failed without observed committed writes;
its exact fetched-page progress is unknown, so its entire two-page allowance is
reserved. The final documentary request consumed the last slot. No more imports
are authorized by this completed 18-request / 30-page plan. The exact response
ledger, original 29-gap identity table and final 30-identity check belong to
[Issue #182](https://github.com/Kajooja/Kajo/issues/182).

### Narrow diagnostic source packet

Branch `fix/182-catalog-import-diagnostics` addresses the generic failure
receipt, not a proven cause of the observed science-fiction error. The existing
HTTP 502 / `provider-import-failed` remains, with additive
`diagnostics.version=catalog-import-diagnostics-v1`. Success and authorization
contracts, fixed selection budgets, FI/EN normalization and canonical atomic
per-page upsert semantics remain unchanged.

| Diagnostic field | Meaning |
| --- | --- |
| `stage` | Fixed Discover, Find, detail, English fallback, normalization, catalog-upsert or unexpected import stage |
| `reason` | Fixed HTTP, timeout, network, JSON, response-shape, identity, metadata or unexpected-error category |
| `httpStatus` | Upstream numeric response status when observed; otherwise null |
| `completedPages` | Fully processed pages whose writes were acknowledged; an all-skipped/empty page may complete without a write |
| `failedPage` | Current page, or null for exact-IMDb enrichment |
| `confirmedImportedCount` / `confirmedSkippedCount` | Counts from the confirmed completed-page prefix; upserts are not unique growth |
| `writeOutcome` | `not-started` for the current failed unit before a write; `unknown` when its write acknowledgement failed |

A request that fails on page 2 after page 1 committed reports page 1 and its
confirmed counts. A database timeout/malformed acknowledgement on page 2 cannot
prove rollback and never reports that page complete. The CLI validates the
version, fixed fields and progress against the requested page prefix before
emitting a failed checkpoint; old generic errors remain supported. Extra/raw
server fields and unknown codes are not reflected. It stops before any later
request or retry. Progress is scoped to this request; earlier request checkpoints
remain separate. If no valid receipt arrives, progress remains unknown.

The shared module is `_shared/catalog-import-diagnostics.mjs`; both Edge and
CLI consume it. Deployment preparation now verifies all five shipped files with
a fresh Deno cache and npm/remote imports disabled. Fixtures cover stage/status
classification, secret reflection, malformed/timeout responses, all-skipped
pages, retained first failure under concurrency, and an acknowledged first page
followed by a potentially committed but unacknowledged second write.

Local `npm run check` passed **396 tests**: 212 mobile, 25 catalog, 28 Edge,
61 database, 43 engine, 19 Python research and eight Node research, plus
lint/typecheck and both Hermes exports. The existing mobile Hook lint warning
remains. Direct Deno registry access failed with connection refused; the successful
root run used the existing loopback archive cache after verifying every one of
the eleven packages against the unchanged frozen Edge lock SHA-512 values.
No dependency, lock or repository gate was weakened; normal CI must also pass.
The exact final five-file payload independently passed **26 catalog HTTP cases**
with a fresh cache and npm/remote imports disabled.

Prepared payload SHA-256:
`c5e5a4adceeebd2b87d30f1b74dc972a64d52e93ebdaddf13ee6e3aaa7ff09e5`.
Entrypoint SHA-256:
`6469138981a0a7463ad884c017519de875cd5603473894458b1503433727faa3`.
Diagnostic module SHA-256:
`48c80ec66eef1bd186ecb0b4f631eed8a5577639e2c0eb599b2f252c9d110858`.
Normalizer, selection plan and function-local configuration contents are unchanged.

The official [Supabase error-handling guide](https://supabase.com/docs/guides/functions/error-handling)
and [logging guide](https://supabase.com/docs/guides/functions/logging) were checked
on 2026-09-13. Current source fixtures and required root/CI results belong to the
PR/#182 checkpoint. Source changes do not retroactively diagnose the old failure;
hosted rollout is a separate verified step. No provider call, secret request,
account reset, schema change or unrelated native rollout is needed for this packet.

## Balanced TMDB expansion and curated enrichment — 2026-09-13 / #182

Source packet: `feat/182-tmdb-balanced-expansion`, from accepted PR #250 main
`95d2a32ecebb704bc4b7d8105dd2d7552e81accd`. This prepares the exact next catalog
unit. The old canary is complete; no new hosted import/deployment, DDL, account
reset, model admission or APK operation is implied by source acceptance.
Issue #182 records actual source CI/merge and subsequent hosted execution.

### Bounded selection and working targets

`supabase/functions/_shared/tmdb-import-plan.mjs` owns the executable versioned
selection contract. Changing bucket meaning/budget requires a new reviewed
contract version. All requests use Finnish metadata with English fallback and
FI regional release eligibility. A separate fixed `asOf` bounds release dates;
provider popularity/content may change between requests, so this is not a frozen
provider snapshot. The `finnish` bucket means original language `fi`, not an
inferred production country. Coverage reports Finnish production separately.

| Selection | Pages | Minimum votes | Provider filters |
| --- | ---: | ---: | --- |
| Finnish-language | 3 | 10 | original language fi |
| Before 1990; 1990s; 2000s; 2010s; 2020–asOf | 2 each | 40 | primary release-date ranges |
| Swedish, French, German, Japanese, Korean, Spanish | 1 each | 40 | original language sv/fr/de/ja/ko/es |
| Animation, comedy, thriller, horror, science-fiction | 2 each | 40 | fixed TMDB genre IDs |
| Documentary | 1 | 40 | fixed TMDB genre ID |
| **Total** | **30** | per bucket | **18 sequential requests; at most 600 raw candidates** |

This lower Finnish-language vote floor avoids applying the international-volume
threshold to a smaller language catalog. It is a coverage choice, not a quality
score or a recommendation-weight change. Popularity orders within each bucket;
primary-year, original-language, genre and vote filters are rechecked against
details before admission. New paths require title, description, valid poster path,
director, tags, original language, primary date, runtime, vote count, popularity
and IMDb alias. Missing/off-filter records are counted as skipped. Ambiguous IDs,
malformed pages and provider/DB errors stop the request; no fuzzy title merge.

These are **working targets for reviewing this expansion**, not preclaimed results:

- at least 300 discoverable TMDB Items with core metadata;
- at least 25 Finnish-language and 90 non-English movies;
- at least six original languages with ten complete movies each;
- at least 25 complete movies in each of the five era bins;
- at least eight normalized genres with fifteen complete movies each, plus ten documentaries;
- all 30 existing curated movies enriched with their existing canonical identity.

`tmdb-expansion-coverage.sql` reports every target and the underlying counts.
Genres overlap, while canonical Items/eras/languages are not duplicated by source
rows. The existing `catalog-coverage.sql` separately checks provider aliases,
BOOK inventory, mock suppression and privileged RPC access. Missing a target
keeps acceptance open: inspect gaps and choose a new bounded follow-up. Never
silently expand page budgets, lower thresholds or claim provider ranking is
representative of user taste. Rights/attribution and native image/quality gates
remain separate even when every inventory target passes.

### Exact execution order

1. Accept source after required CI, generate the four-file deployment packet with
   `npm run catalog:prepare-deployment`, review/read back the exact catalog-only
   rollout. Keep `verify_jwt=false` and the existing proven server-key boundary.
2. Run both read-only coverage queries. Compare with the last checkpoint before
   sending anything. The 2026-09-13 11:37:42 UTC report is 49 discoverable movies,
   20 complete TMDB movies, only English, era counts 1/1/0/0/18 and 29 curated gaps.
   Every gap has exactly one IMDb alias; zero matching ambiguity was observed.
3. Enrich the remaining curated movies first. The exact IDs below produce three
   sequential requests of 10 + 10 + 9, each fully resolved/validated before one
   atomic canonical batch upsert. Expected result: 29 enriched existing Items,
   49 discoverable movies retained, all 30 curated movies provider-backed.
   Counts and IDs must be verified; this is an expectation, not a hosted result.
4. Execute the 18 bounded discovery buckets, with before/after checkpoints.
   Start with Finnish-language, then era, other-language and genre coverage.
   A successful first bucket is an inspection checkpoint before the rest.
5. Record actual unique inventory, overlap/skips, full metadata/aliases, all
   remaining gaps, locale fallback and bounded poster checks. Require a later
   real-device catalog/Taste check; do not equate CDN success with native UX.

The CLI dry-runs below read no credentials and perform no network/DB I/O:

```bash
npm run catalog:tmdb-beta -- --imdb-ids tt2543164,tt1856101,tt1160419,tt15239678,tt0338013,tt6710474,tt0137523,tt0109830,tt0172495,tt2267998,tt1798709,tt1375666,tt0816692,tt3783958,tt1392190,tt0209144,tt15398776,tt6751668,tt1392214,tt0110912,tt0114369,tt0468569,tt0120737,tt0167260,tt0167261,tt0133093,tt0482571,tt0102926,tt2582802 --as-of 2026-09-13 --dry-run
npm run catalog:tmdb-beta -- --balanced-plan --as-of 2026-09-13 --dry-run
npm run catalog:tmdb-beta -- --bucket finnish --as-of 2026-09-13 --dry-run
```

After reviewed rollout, use the printed `batches` bodies in the already working
owner Test view, or remove `--dry-run` in an authorized admin environment.
For the first Finnish inspection, use `--bucket finnish`; then execute remaining
named buckets once rather than rerunning the whole balanced plan. `--bucket ID`
accepts `--start-page`/`--pages` within that bucket's fixed budget for recovery.
Never repeat the completed old unfiltered page-1 canary. New actions are
`tmdb-movie-bucket-v1` and `tmdb-movies-by-imdb-v1`; older hosted code returns
unsupported-action before I/O instead of silently dropping new filters.

The runner prints a safe starting/completed checkpoint with exact request and
validated response selection identity. An error/timeout stops further requests.
Earlier page/batch writes may already be committed; recheck coverage/source sync
before a manual retry. Do not claim all-or-nothing for the entire multi-request
plan. Exact source/alias upserts are repeat-safe but provider pages may move.
Invocation redirects are rejected and calls have explicit transport deadlines.
No secret values enter request logs or Git. Configuration, sign-in, initial
preflight and provider token already work and are not prerequisites to repeat.

Provider semantics were checked against the official
[TMDB Discover reference](https://developer.themoviedb.org/reference/discover-movie)
and [Find by ID reference](https://developer.themoviedb.org/reference/find-by-id).
FI localization/region is distinct from original-language selection; era buckets
use primary dates so regional rereleases cannot redefine a film's original era.
Local fixture/SQL validation and later CI are recorded in Issue #182.

### Source verification

`npm run check` passed **387 tests** (212 mobile, 21 catalog, 23 Edge,
61 database, 43 engine, 19 Python research and 8 Node research), lint/typecheck
and both Hermes exports. The existing mobile Hook lint warning remains.
The workspace's Deno registry connection failed; the successful full run used
already downloaded npm archives through a loopback registry cache, verifying all
eleven archives against the unchanged frozen Edge lock SHA-512 values first.
No dependency, lock or repository check was weakened. Ordinary hosted CI must
also pass. Actual final deployment files separately passed **21 catalog HTTP
cases** with a fresh Deno cache and npm/remote imports disabled.

Final four-file payload SHA-256:
`b6f440baf81ea326ac5c4144179a9655406cd1817ef911b18a14a8304d8e93f5`.
Entrypoint SHA-256:
`84671a86435c385f9476890a7d9f3b3d792cc4241c95517eec8926a89ac39be7`.
Plan module SHA-256:
`25447fc9e4ba9a811db552e185c3f2e78a0dff81fdade13a3e343dd58b846025`.
The existing normalizer and local deployment config are unchanged. The actual
no-I/O balanced plan is 18 requests / 30 pages; the curated plan is 3 requests /
29 identifiers. Read-only hosted coverage executed successfully. No new native
runtime acceptance or broader catalog result is claimed.

## TMDB one-page canary accepted — 2026-09-13 / #182

**The owner-authorized configuration/rollout/preflight/one-page canary unit is
complete.** The owner supplied this successful import body with a response date
of **2026-09-13 11:03:06 UTC**:

```json
{
  "status": "imported",
  "provider": "tmdb",
  "importedCount": 20,
  "skippedCount": 0,
  "pages": [1],
  "language": "fi-FI",
  "region": "FI",
  "minimumVoteCount": 40
}
```

`validateTmdbImportResponse` from the existing CLI accepts the supplied body with
the exact requested page/locale/threshold. The agent did not invoke another
provider import. The committed read-only coverage query and a bounded inspection
of all 20 provider Items independently confirm the stored result; all sources
have `synced_at = 2026-09-13T11:03:06.083766Z`. Provider-token authentication and
the matched modern-key Data API upsert have now worked in the hosted path.
Only the response/result and minimal timing evidence are recorded, not cookies,
request headers, secret values or full provider payloads.

| Measure | Before | After |
| --- | ---: | ---: |
| Discoverable MOVIE Items | 30 | 49 |
| Stored MOVIE Items | 42 | 61 |
| MOVIE Items with images | 0 | 20 |
| MOVIE Items with descriptions | 0 | 20 |
| TMDB source rows / distinct Items | 0 / 0 | 20 / 20 |
| Discoverable BOOK Items | 415 | 415 |
| Stored BOOK Items | 427 | 427 |
| BOOK Items with images / descriptions | 385 / 0 | 385 / 0 |
| Discoverable mocks | 0 | 0 |

The net increase is **19**, not 20: TMDB `278` / IMDb `tt0111161`
(*Rita Hayworth - avain pakoon*) maps to one existing curated Item. Its original
creation time remains `2026-09-04T21:30:52.825771Z`, while the new TMDB source was
created at the import time. The curated source remains attached. Each of the
other 19 Items was created at the canary time. This is observed cross-provider
identity reuse, not an inferred count discrepancy or a new duplicate.

All 20 have nonblank title/description, TMDB poster URL, directors, release year,
original language and normalized genre tags. Runtime, popularity and vote count
are present on all 20. Each provider row has exactly one matching `tmdb_movie`
alias and one matching `imdb_title` alias on the same Item; all 20 provider IDs
and Item IDs are distinct. No matching alias is missing. The source and alias
constraints remain unchanged. Batch RPC EXECUTE remains false for anon and
authenticated and true for service_role.

The agent checked **all 20 stored poster URLs** with bounded parallel HTTP HEAD
requests: every response was **200 / image/jpeg**. This verifies CDN availability,
not rendering/cache behavior on a native device. Stored description previews show
both Finnish text and the existing English fallback; no all-Finnish claim is made.
All 20 original languages are `en`; year counts are 1984: 1, 1994: 1, 2021: 1,
2026: 17. One popularity-sorted page is not a representative cold-start catalog.
Twenty of 49 discoverable movies now have images/descriptions; the other 29
curated movies still need provider metadata. BOOK description coverage is still
zero. Broad catalog, rights/attribution, native quality and MVP acceptance stay open.

Fresh hosted readback remains ACTIVE v9, bundle digest
`9e04d650a398c79c9e0a0ed8e7adefb97c4b45aebfb9b7ee3f2f2f944a01ab88`.
All three contents exactly match accepted PR #248, with `verify_jwt=false` and the
function-local import map. No source/deployment, schema, account or other-function
change was needed for this verification. PR #249's earlier preflight handoff is
accepted on `395b0bf222000377cd04322436e6f398e5f8c1e2` after all five CI #490
jobs passed at `e3aa37ad940412e30ae5f8792f14706b722fafe6`. Older dated sections
below retain what was pending then; they are not current instructions to repeat
configuration, preflight or the completed canary.

**Next bounded continuation — #182 catalog expansion:** prepare a concrete plan
for hundreds of discoverable movies with measured genre/year/original-language
diversity, Finnish/international coverage and the remaining curated metadata.
The existing orchestration can resume after the accepted page 1. This actual
dry-run performed no provider or database I/O:

```bash
npm run catalog:tmdb-beta -- --start-page 2 --pages 14 --pages-per-request 3 --dry-run
```

It yields five requests: pages 2–4, 5–7, 8–10, 11–13 and 14–15, retaining
`fi-FI` / `FI` / minimum votes 40. This is a transport proposal only; it neither
promises 280 unique new Items nor supplies diversity controls. Review the proposed
content mix and source filters before broader import. Any chosen execution stays
bounded, sequential and stop-on-error, with fresh before/after coverage and actual
metadata review. Inspect the latest Issue #182 checkpoint before sending requests
so completed work is not repeated. Source/control improvements needed by the
expansion plan do not depend on an admin key; actual calls use an authorized admin
environment or the now-proven owner Test view. No repeated key setup/sign-in is
needed, and the one-page canary must not be requested again.

Keep #182 and `MVP-CAT-001..003` open for those remaining gates. Do not substitute
native #229/device work, optional dataset research or the later pre-MVP UI packet,
and do not promote the rejected D2 challenger. STATUS names the next bounded
catalog task; Issue #182 records this documentation packet's merge/CI completion.

## Catalog privileged preflight — 2026-09-13 / #182

**The configuration repair and privileged preflight are accepted.** PR #248
merged to main `bd7a23f776e99b452404fef0393155b62d96ade0` after all five
[CI #488 jobs](https://github.com/Kajooja/Kajo/actions/runs/34726762173) passed at
`9884088099635bd60cd0b6bb929b0b5480b97c3f`; the accepted tree
`c2ec468e1359cb7fbbf637ed9eb85119411df07c` matches verified source. APK was
skipped. Root validation passed 377 tests, lint/typecheck and both Hermes exports;
the actual deployment packet replay passed 15 catalog HTTP cases. The older
source-preparation and diagnostic sections below retain their dated pending state,
not the current next task.

The agent deployed the exact three-file repair once as ACTIVE v8. Its verified
bundle digest was
`c5c781a5cbe182b7646c1cf7530afa3a9bc0b84e27d81e30e89adb56728ca3d4`.
The latest pre-canary readback now reports ACTIVE v9, digest
`9e04d650a398c79c9e0a0ed8e7adefb97c4b45aebfb9b7ee3f2f2f944a01ab88`.
All three contents still match accepted PR #248 source exactly, with
`verify_jwt=false` and the function-local import map. The agent did not redeploy
in this continuation; the metadata change's cause is not inferred. Payload and
per-file hashes remain the ones in the recovery checkpoint below.

Real negative HTTPS probes at 2026-09-13 00:07 UTC returned GET 405,
anonymous/synthetic-user/forged-legacy POST 403 and foreign-modern-fixture gateway
401. All POSTs used `invalid-preflight-only`, so no probe could start a provider
import. These synthetic JWT checks are not a real signed-in session test.

The owner subsequently used the supported Dashboard **Test > Headers > Add secret
key** route with the existing Default key. At **2026-09-13 00:23:14 UTC**, the
reported status/body for `{"action":"invalid-preflight-only"}` was exactly:

```json
{"status":"error","code":"unsupported-action"}
```

HTTP 400 here proves configured-key acceptance and reaching body validation;
provider and Data API work have not started. The owner supplied status, body and
response metadata, not the secret request header. Only this minimal result is
recorded; response cookies and unrelated headers are not part of the handoff.
No new key/rotation, repeated presence check or repeated privileged preflight is
needed. The old `invalid-legacy-service-role-key` blocker is resolved by PR #248.

The agent re-ran the committed read-only coverage query after this preflight:

| Inventory | Stored | Discoverable | Images | Descriptions |
| --- | ---: | ---: | ---: | ---: |
| BOOK | 427 | 415 | 385 | 0 |
| MOVIE | 42 | 30 | 0 | 0 |

TMDB source rows and distinct TMDB Items remain zero, and no mock is discoverable.
All 415 discoverable books and 30 movies have creators; release-year coverage is
413 BOOK / 30 MOVIE. Batch EXECUTE remains false for anon/authenticated and true
for service_role. These are dated pre-canary aggregates, not an import result.

**Exact continuation:** use the same owner Test view, keep POST and the successful
secret-key header, and send this already-authorized one-page body once:

```json
{
  "action": "tmdb-movies",
  "startPage": 1,
  "pages": 1,
  "language": "fi-FI",
  "region": "FI",
  "minimumVoteCount": 40
}
```

The owner has been given this request while the agent prepares the resumable
handoff. Check Issue #182 for a later result before sending or retrying it. The
connector cannot invoke functions or read secret values, and the local admin
environment has no privileged invocation credential; the working Dashboard route
keeps the key within Supabase. Do not restart the incomplete browser sign-in.

Require HTTP 200 with `status: imported`, `provider: tmdb`, `pages: [1]`, exact
FI locale/region and vote threshold, and inspect returned import/skip counts.
Those counts alone are not unique catalog coverage. Re-run
`scripts/catalog/catalog-coverage.sql`, inspect actual title/description/poster/
creator/year/language/tags and matching TMDB aliases, and record before/after
changes and any gaps. On an error, preserve the observed response and inspect
coverage before retrying; do not claim provider-token validity from the preflight.
The default 15-page expansion remains outside this initial canary. Keep #182 open
for catalog breadth/quality; no Phase 14/MVP closure is implied by this packet.

The owner requested completion and a handoff resumable with “jatka reposta”.
STATUS names this one active task and Issue #182 owns later owner/runtime results.
Other Edge functions, six installed forwards, accounts, #229 native/device gates,
rejected research challenger admission and the pre-MVP UI queue retain their scope.

## Catalog modern-key recovery — 2026-09-12 / #182

PR #247 accepted the diagnostic source on main
`4fbf5bd8eb0346b18395d633569efc23549c1dc4`, tree
`d4cd56ec1efa4cd92b1a4dabc19d098f1845f306`, after all five CI #486 jobs passed
at `e8125f3381b2fff7947ddb78cd87eef1ac481e35`. The deployment response reported
ACTIVE v6; subsequent readback reported ACTIVE v7 with bundle digest
`c5ce84272cb674e1c0705e03dc27a308e6c4b328be12a8014a547d128e1130ed`.
Only one diagnostic deployment call was made; the metadata difference is recorded
without inferring its cause. All three readback contents match the verified
PR #247 payload, with `verify_jwt=false` and the function-local import map.

The owner supplied a v7 private log at **2026-09-12T23:40:08.656Z**:
`catalog-import configuration failed: invalid-legacy-service-role-key`.
The failed check is now identified: the optional legacy value is not in the
accepted JWT format and blocks the entire configured-key set. Its actual value
and the platform's reason for supplying it remain unknown and are not needed for
this bounded repair. Default modern secret keys are independent of legacy JWT
compatibility, as described in the
[current API-key migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
The owner's existing Default secret key is suitable; creating or rotating keys is
not a prerequisite. Token setup, built-in variable presence and the private-log
request are complete and must not be requested again.

`fix/182-modern-key-legacy-recovery` excludes malformed optional legacy values
only when validated usable modern keys exist. Excluded legacy strings are never
accepted through apikey/Bearer or forwarded to the Data API. Without a usable
modern key, the same malformed legacy input still produces the generic 500 and
fixed private reason. Malformed modern maps and local keys still fail closed;
valid legacy exact matching, modern apikey-only matching, named rotation and
immediate revocation remain unchanged. No role claim authorizes a request.

The HTTP regression exercises named Default/rotation keys and the optional local
key against two malformed legacy values, including a modern-looking string that
is deliberately absent from the configured modern set. It checks anonymous/user,
publishable, foreign, invalid-legacy and modern-Bearer rejection before I/O, then
normalized import with only the matched modern apikey forwarded. Existing generic
configuration/redaction tests retain invalid-legacy-only and empty-modern-map
failure coverage. The catalog still has no external runtime packages.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed 377 tests, lint/typecheck and both
Hermes exports; the existing mobile Hook warning remains. Deployment preparation
passed all 15 catalog HTTP cases against the actual staged files with a fresh
cache and npm/remote imports disabled. Payload SHA-256 is
`e5e3f85dfe0e76103d7b3c66591395c30cca6ec03796b237da162050f632d4e3`;
entrypoint SHA-256 is
`774b3d3f90d240dd4db49000b00004adc212e732dd1cb7b3d80e27e5601b7157`.
The local config/normalizer hashes remain unchanged. Current-head CI must also
pass before merge and rollout. Issue #182 owns the actual post-merge commit, CI,
deployment/readback and probe checkpoint; inspect it before repeating a rollout.
The earlier diagnostic/v3 sections retain dated evidence rather than current
next-action instructions. No provider import has been performed at this source
checkpoint, and no catalog breadth/MVP gate is closed by this repair.

After configuration recovery and negative request checks, use the supported
owner Dashboard **Edge Functions > catalog-import > Test** path:

1. Choose POST, then **Headers > Add secret key**. The tester defaults to a
   publishable key; the secret-key action adds the privileged `apikey` through
   the Dashboard server proxy. Do not paste any key into chat.
2. First body: `{"action":"invalid-preflight-only"}`. Require 400
   `unsupported-action`; this proves configured-key acceptance without provider
   or database I/O. Share only status and response, not request headers.
3. After that success and fresh read-only baseline coverage, run the already
   authorized canary exactly once with the following body:

```json
{
  "action": "tmdb-movies",
  "startPage": 1,
  "pages": 1,
  "language": "fi-FI",
  "region": "FI",
  "minimumVoteCount": 40
}
```

4. Record returned counts/pages, re-run `scripts/catalog/catalog-coverage.sql`
   and inspect actual movie metadata. One page is the initial canary; the CLI's
   default 15-page expansion is not implied. Keep #182 open for breadth/quality.

The Dashboard path was verified from current official Studio
[tester source](https://github.com/supabase/supabase/blob/26585dd4a4d6db8910a595214c9f6e8fdd206768/apps/studio/components/interfaces/Functions/EdgeFunctionDetails/EdgeFunctionTesterSheet.tsx)
and [header actions](https://github.com/supabase/supabase/blob/26585dd4a4d6db8910a595214c9f6e8fdd206768/apps/studio/components/interfaces/Functions/httpHeaderAddActions.ts).
It has not yet been exercised with this project's privileged key. The connector
cannot invoke functions or read secrets; no local privileged credentials exist.
Use the supported owner path instead of repeating the unfinished browser sign-in.
Other functions, six installed forwards, accounts and the #229 device ledger are
outside this catalog-only packet.

## Catalog configuration diagnostics — 2026-09-12 / #182

PR #246 accepted the v3 rollout handoff on main
`65317c03fde0ee85ce560f61489d3434a79a843f` after all five required CI #484 jobs
passed at `27bd5999da67fc16622a86251f93532528ec6af4`. The owner subsequently added
`TMDB_READ_ACCESS_TOKEN` and confirmed `SUPABASE_URL` and plural
`SUPABASE_SECRET_KEYS` are visible under Edge Functions > Secrets. API Keys shows
a Default secret key. Legacy anon/service-role variables show Deprecated; the
optional singular local-development key is absent. Those setup/presence questions
are resolved. Token validity and runtime key parsing are still unverified.

A bounded anonymous unsupported-action POST after token setup returned the same
500 `server-not-configured`. Fresh pre-diagnostic metadata reports ACTIVE v5,
`verify_jwt=false`, import map enabled, bundle digest
`574dd2d7e2f45f5affddc0a88eec0ce3bf98e036b636fe0880ef3cf57bc26a18`.
All three downloaded source files still exactly match PR #245. No provider call
or new source deployment was performed during that recheck. The earlier v3 hashes
below remain historical deployment evidence, not the latest version number.

`fix/182-catalog-config-diagnostics` makes the existing failure diagnosable through
fixed private-log reason codes. It does not accept previously rejected keys, add
a public diagnostic endpoint or return configuration details in HTTP responses.
Malformed JSON exceptions, key values/names and request data must never be logged.
The real HTTP fixtures verify the unchanged generic 500, no provider/Data API I/O,
and exact redacted log output, including environment-read exceptions containing
synthetic secrets. The catalog still has no external runtime packages.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed 376 tests, lint/typecheck and both
Hermes exports; the existing mobile Hook warning remains. Preparation replayed
all 14 catalog HTTP cases against the actual staged files with a fresh cache and
npm/remote imports disabled. The diagnostic payload SHA-256 is
`0176a96a151103235ef71066556ed32ed7168b5a60c6d1792d4004ebe714787a`;
its entrypoint SHA-256 is
`9e4a6dcdcd332a69124b69c01d095d7b8812930452b1cd00e90091429d6d1b9e`.
The function-local config and normalizer hashes match the earlier packet. These
source checks do not identify or resolve the hosted configuration failure.

The log prefix is `catalog-import configuration failed:`:

| Reason | Failed check |
| --- | --- |
| `missing-supabase-url` | `SUPABASE_URL` is absent or empty in the function runtime |
| `invalid-secret-keys-json` | `SUPABASE_SECRET_KEYS` cannot be parsed as JSON |
| `invalid-secret-keys-object` | Parsed named keys are null, an array or a scalar |
| `invalid-secret-keys-value` | A named key is not a supported secret-key string |
| `invalid-local-secret-key` | Optional singular `SUPABASE_SECRET_KEY` has an invalid format |
| `invalid-legacy-service-role-key` | Configured legacy value is not in the accepted JWT format |
| `missing-server-key` | No modern or legacy server key is available |
| `unreadable-server-key-configuration` | Another environment/key-read operation threw; its exception is suppressed |

After root/current-head checks, publish the verified three-file catalog payload
and verify source readback. Inspect Issue #182 first for a completed deployment.
Trigger only an unsupported-action probe, then open **Edge Functions >
catalog-import > Logs** and filter for the prefix above. **Logs**, not the request
headers/body under Invocations, contains this diagnostic. The connected tool has
no log-read capability, so the owner may send the fixed reason line alone. Do not
ask for environment dumps, screenshots showing key values or credentials in chat.
[Supabase's logging guide](https://supabase.com/docs/guides/functions/logging)
documents the private custom-log view.

Use the observed reason to select the next configuration/source correction. A
Dashboard presence report is not a reason to relax validation speculatively.
Verify anonymous/ordinary-user denial and a privileged unsupported-action request
before the already-authorized `--pages 1 --pages-per-request 1` canary. The owner
has completed token setup; do not repeat it or confuse the preceding Supabase
configuration error with the later `tmdb-not-configured` check. Keep #182 open;
#229, installed forwards, APK/device work and other deployments remain separate.

## Catalog v3 hosted checkpoint — 2026-09-12 / #182

The owner requested completion of the reviewed PR #245/Edge/one-page canary packet
and a resumable repository handoff. PR #245 was merged after rechecking all five
required CI #482 jobs at `9214a268d84281663a728ea055dd4b4dd073a262` and unchanged
base `969c1195700dfc67b3787eb4a51eb70fda8c6ee9`. Accepted source is now
`ad75fc00b100099af4986abfc9955afe308eb6e6`. No repeat approval is needed for these
completed actions or the same bounded canary once its credential prerequisites hold.

The three-file deployment was regenerated from accepted main and replayed all
13 catalog HTTP cases with a fresh cache and npm/remote imports disabled. Its
payload SHA-256 remains
`3533d2bf02ebe02be9f8bb30c8ea7ccbd8b8090f455aaa5fcd8f357efd74f010`.
It was deployed only to `catalog-import` on `operator-reviewed-project`:

| Deployed property | Verified value |
| --- | --- |
| Function ID | `852f5604-48d0-4fad-8868-1f276feb4621` |
| Version / status | 3 / ACTIVE |
| JWT gateway check / import map | `false` / `true` |
| ESZIP SHA-256 | `a0ec5d55a2cf61737b11f6a2191d2778f3121e438827e2d141dd9c493a8690b7` |
| Source readback | All three file contents exactly match the approved payload |

**The hosted configuration acceptance gate failed.** Real HTTPS probes after
deployment used the deliberately unsupported action `invalid-preflight-only`,
so no successful authorization could accidentally start a provider import:

| Probe | Observed response | Evidence limit |
| --- | --- | --- |
| GET, no credentials | 405 `method-not-allowed` | Handler boots and method guard runs |
| POST, no credentials | 500 `server-not-configured` | Environment validation stops before caller/provider work |
| POST, foreign modern fixture apikey | 401 `Invalid API key` | Gateway rejection; not the handler's exact-key test |
| POST, forged legacy fixture Bearer | 500 `server-not-configured` | Same configuration gate; hosted key acceptance unverified |

A later bounded anonymous POST recheck returned the same 500 response; the gate
did not clear during this session.

The exact missing or rejected environment input has not been identified.
`SUPABASE_URL` and `readServerKeys()` are checked before request authentication;
the latter rejects malformed named/local keys or legacy configuration. This error
does not establish that TMDB_READ_ACCESS_TOKEN is absent, nor justify changing
key validation speculatively. The source/test success cannot be reported as
successful hosted authorization or import.

The read-only coverage query passed again after deployment and matches the baseline:
415 visible BOOK / 30 MOVIE, 385 book images, no movie images or visible descriptions,
zero TMDB source rows and zero visible mocks. Batch EXECUTE remains false for
anon/authenticated and true for service_role. No provider data, secret value,
account state or installed migration was changed by the deployment/probes.

The Supabase connector is connected but has no secret-listing or function-invocation
capability. No privileged invocation credentials are configured in the local admin
environment. Browser inspection of the Secrets page led to sign-in; the secure
GitHub choice/manual continuation did not produce a verified signed-in Supabase
page. No secret values were requested or printed. The owner offered to retrieve
settings instead and was asked for the five relevant secret names' presence plus
active secret/legacy-key status, with values concealed. Wait for/use that report
instead of repeating the uncompleted browser flow or requesting values in chat.

Recovery remains within #182: resolve the configuration cause through a supported
authorized administration path, keep the exact-key boundary, verify anonymous/user
denial and an authorized unsupported-action request, then run the already-authorized
one-page canary and before/after coverage. Stop before broader pages. Do not restore
unlocked v2 or delete Items to hide this failure. Any needed source correction uses
its own bounded branch/PR and root/current-head gates; the six #229 forwards,
password/auth callback deployments, APKs and native/device work remain separate.

## Catalog rollout preparation — 2026-09-12 / #182

PR #244 was owner-approved and merged to `969c1195700dfc67b3787eb4a51eb70fda8c6ee9`
after all five required CI #480 jobs passed. The successor branch
`fix/182-catalog-rollout-packet` starts there. This checkpoint records read-only
hosted evidence and a source deployment candidate; it does not record a deployment.

### Hosted comparison

Project `operator-reviewed-project` (Kajo, eu-west-1) is ACTIVE_HEALTHY. The deployed
`catalog-import` is ACTIVE v2, `verify_jwt=false`, `import_map=false`, with ESZIP
SHA-256 `8a85347f51f02dec066495263919f2d575d1b6b60e31d7faaf830c589c7cd2d1`.
Its entrypoint still imports floating `npm:@supabase/supabase-js@2` and uses the old
single-selected-key boundary. It does not contain the PR #244 source fixes.
Downloaded entrypoint SHA-256:
`230c5e5a90a58392a7a7081599f986c2c4009cc93617f744e8526373bee46b83`.
The shared normalizer matches accepted source exactly:
`c45821528593b64763d83860975d979d6466cd9cd01d3e440462402afeaa4283`.

Real unauthenticated HTTPS probes returned GET 405 `method-not-allowed` and POST
403 `forbidden`. The POST deliberately used an unsupported action as an additional
guard against provider work. These verify the deployed rejection path only.

The available Supabase connector has no secret-name listing tool. The local admin
environment has no Supabase access token, URL/server invocation key or TMDB token;
there is no authenticated CLI setup verified here. Consequently the hosted names
`TMDB_READ_ACCESS_TOKEN`, `SUPABASE_SECRET_KEYS` and any configured legacy key remain
**unverified**, rather than asserted absent. Do not infer TMDB availability from a
403, zero inventory or the existence of an Edge function. A supported authenticated
`supabase secrets list` can supply names/digests only; discover its flags with CLI
help first, avoid debug output and retain no values in Git/chat. Provider-token
setup and an authorized server invocation environment are still required for import.

The committed `scripts/catalog/catalog-coverage.sql` ran successfully as a read-only
hosted transaction. Counts below exclude hidden Items in the presentation columns:

| Item type | Stored | Discoverable | Image | Description | Creators | Year |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOOK | 427 | 415 | 385 | 0 | 415 | 413 |
| MOVIE | 42 | 30 | 0 | 0 | 30 | 30 |

Providers remain 385 Open Library BOOK, 30 curated BOOK and 30 curated MOVIE;
24 historical mock Items are stored but hidden. TMDB source rows/distinct Items
and discoverable mocks are all zero. The canonical batch RPC's EXECUTE is false
for anon/authenticated and true for service_role. This refreshes catalog evidence
only; it is not a native/account/migration acceptance check.

### Reproducible deployment candidate

The catalog function's sole SDK operation is now a native HTTPS POST to the same
`upsert_catalog_batch_v1` RPC. Modern matched keys use apikey; only a matched legacy
key adds Bearer. Incoming user Authorization is never forwarded, redirects fail,
and incomplete/malformed RPC success fails instead of assuming the batch succeeded.
The database still owns atomic validation/upsert/dedup. FI/EN behavior and request
bounds remain. Password auth and its pinned SDK/lock are outside this rollout.

There are exactly three deployment files: `catalog-import/index.ts`, its local
`deno.json`, and `_shared/catalog-normalizers.mjs`. Runtime imports are those local
sources plus `node:crypto`; there are no registry packages to resolve during deploy.
The local configuration therefore has `lock:false` and empty imports. The existing
root frozen Deno graph remains the source/type/other-entrypoint gate.

`npm run catalog:prepare-deployment` stages exactly those files, checks their Deno
module graph, and replays all 13 catalog HTTP cases against the staged entrypoint
with Deno 2.1.4, a fresh cache, and `--no-npm --no-remote --cached-only`. Output is
created only after verification. A regression test proves that adding a registry
import prevents payload publication. Preparation never reads credentials or sends
real provider/database requests. Output is regenerated from Git, not committed.

```sh
npm run catalog:prepare-deployment -- --project-ref operator-reviewed-project --output dist/catalog-deployment-182
npm run catalog:tmdb-beta -- --pages 1 --pages-per-request 1 --dry-run
```

Use a new output directory on a repeat run. The tested candidate manifest is:

| Content | SHA-256 |
| --- | --- |
| Entry point | `db9beae8159f4527ab70af04506669072d81f532ad857832ab0877e07e32cd49` |
| Function-local configuration | `fdacae7775337096157bc6921a7e19eec4e59fbf865549dff8d9f9f4199062a7` |
| Shared normalizer | `c45821528593b64763d83860975d979d6466cd9cd01d3e440462402afeaa4283` |
| Exact serialized deployment payload | `3533d2bf02ebe02be9f8bb30c8ea7ccbd8b8090f455aaa5fcd8f357efd74f010` |

`deploy-payload.json` is the complete `deploy_edge_function` argument, including
project, function name, relative entrypoint/import-map paths, `verify_jwt:false`
and file contents. `manifest.json` records byte hashes; `verification.txt` records
the packet tests. This verifies the source closure, not hosted ESZIP/runtime parity.

### Authorized rollout and canary sequence

1. Finish the successor PR's five required current-head CI gates and source merge.
   Record separate authorization for this exact Edge update and initial provider
   canary. PR #244's completed merge approval is not a hosted change approval.
2. Resolve provider-token availability and an authorized server invocation key
   through supported secret administration. Do not print/copy values into chat.
   Refresh hosted v2/config and baseline coverage before any authorized change;
   unexpected drift requires comparing the changed source/config first.
3. Regenerate/verify the payload hash and pass that exact JSON to the Supabase
   deployment tool. Deploy only `catalog-import`; no auth-function or database
   migration deployment, account reset or APK build belongs to this packet.
4. Read back the new function version/config and downloaded source hashes. Repeat
   rejection probes and an authorized unsupported-action request (400, no import).
   Local fixture success does not replace this real gateway/key verification.
5. In the authorized admin environment, run the single-page canary:
   `npm run catalog:tmdb-beta -- --pages 1 --pages-per-request 1`.
   Defaults are start page 1, fi-FI, FI and minimum vote count 40. The preparatory
   dry-run above was executed; it made no TMDB call. Do not run the default 15-page
   import before inspecting the canary.
6. Re-run `catalog-coverage.sql`. Require positive TMDB source/distinct counts,
   matching external aliases, useful posters/descriptions, and zero discoverable
   mocks. Report actual metadata gaps and unique inventory separately from upsert
   counts. Inspect a small real metadata sample before authorizing broader pages.

Stop immediately on failed preflight, deployment/readback mismatch, import error
or unacceptable coverage. This importer is an admin operation, not a mobile serving
path, so stopping invocations contains a failed rollout. Completed batches may
already be committed even if a later request fails: do not delete Items or restore
database history. Reconcile source identities and retry the bounded idempotent
upsert after repair. Do not automatically restore floating v2 code; any code
recovery must use reviewed captured source with explicit dependency verification.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **375 tests** and the additional
13-case packaged replay, lint/typecheck and both Hermes exports. Only the previously
recorded mobile Hook warning remains. CI/merge status belongs to the PR/Issue handoff.
No hosted write, secret change, real TMDB call or native/device operation occurred.
#182 remains open for useful catalog breadth, presentation/attribution and quality.

Current primary sources checked after the Supabase changelog scan:
[function dependencies](https://supabase.com/docs/guides/functions/dependencies),
[CLI v2.117.0 deployment implementation](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/shared/functions/deploy.ts),
[API key behavior](https://supabase.com/docs/guides/getting-started/api-keys),
[PostgREST RPC](https://docs.postgrest.org/en/v13/references/api/functions.html) and
[secret-name listing](https://supabase.com/docs/reference/cli/supabase-secrets-list).
Function-local config is the supported deployment boundary; the inspected bundler
does not expose a frozen-lock guarantee. Removing the single catalog SDK operation
avoids relying on that unverified guarantee or adding a separate bundling toolchain.

## Catalog Edge source checkpoint — 2026-09-12 / #182

Branch `fix/182-catalog-edge-boundary` starts from accepted D2 main
`3658d1c78b19c6f9c391c14e8e2d66bf814cdcd9`. It closes the bounded source-audit
gap from #182 once the PR's five required current-head CI jobs pass and it merges.
The broader catalog issue and Phase14.3/MVP-CAT requirements remain open.

- `catalog-import` explicitly disables gateway JWT verification and independently
  matches modern named/local apikeys or the exact configured legacy service-role
  apikey/Bearer. Malformed configuration, foreign/publishable/user credentials and
  a modern key supplied only as Bearer fail closed before provider/database work.
  The matched key scopes the admin client; a supplied user JWT is never forwarded.
- The admin CLI sends apikey only. Non-object JSON, invalid explicit parameters
  and requested pages beyond 500 return bounded errors. Provider/RPC failures stop
  the import without exposing upstream messages in logs or responses.
- Both SDK imports are exactly 2.112.4. `deno.json`/`deno.lock` pin their transitive
  graph and Node types; npm locks the Deno 2.1.4 validation tool. Deno's implicit
  `npm:@types/node@*` compiler alias is locked to the same explicit 22.5.4 types.
- `npm run test:edge`, included in root check and CI `validate`, checks all three
  deployment entrypoints and runs 14 local HTTP tests using real handlers/SDK and
  fixture keys/TMDB/Data API responses. Password auth has dependency pinning and
  resolution smoke coverage only; its input/enumeration/abuse work stays with #160.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **372 tests**, lint/typecheck and
both Hermes exports. The existing `DiscoveryScreen.tsx:83` Hook warning remains.
This workspace's HTTP/2 proxy stalled Deno registry reads; local verification used
a temporary loopback registry cache fetching unchanged official npm tarballs over
certificate-verified HTTPS/HTTP1.1. Deno checked upstream integrity hashes. That
temporary transport is not committed; CI uses the normal registry and frozen lock.

Current official documentation checked 2026-09-12:
[auth patterns](https://supabase.com/docs/guides/functions/auth),
[authorization headers](https://supabase.com/docs/guides/functions/auth-headers),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Edge dependency locking](https://supabase.com/docs/guides/security/npm-security#edge-functions-specifics)
and the [Deno 2.1 platform announcement](https://supabase.com/changelog/37941-all-regions-now-run-deno-2-1-compatible-release),
after scanning the changelog. The live authorization page describes transitional
API-key passthrough by the gateway; its indexed search copy still says such keys
are rejected. Both prescribe apikey plus independent service authentication. This
implementation declares its boundary explicitly and does not rely on either
transitional gateway behavior or a key prefix/JWT claim as authorization.

No hosted configuration, secret value, provider inventory or deployed Edge version
was inspected/changed here. No SQL, native model, APK, device or account-reset
operation was performed. STATUS owns the next hosted comparison/import preparation;
the six installed #229 forwards remain immutable and need no repeat deployment.

## D2 development checkpoint — 2026-09-12

E1 #235 / PR #241 and D1 #236 / PR #242 are accepted. D2 #237 now has a measured,
independently reproduced eight-variant temporal/cold-start report, with rejected
challenger admission and tested native-only/unavailable artifact fallback.
[SPRINT-014-D2](SPRINT-014-D2.md) owns this source/evaluation checkpoint;
STATUS owns its required CI/merge and subsequent #182 catalog source-audit task.
Native #229 and full Phase14/MVP/device acceptance remain separate and open.
The audit and 14A–14D records below retain their dated historical meaning.

## Current audit/handoff — 2026-09-12 / #233 / PR #234

The [repository audit](../retros/2026-09-12.md) reconciles the independent
51-part engine, public data and previously staged owner decisions. Preserve the
historical evidence below; the large #229 implementation/device ledger remains
on its named branch and PR until accepted, rather than copied here as main delivery.

- Accepted runtime source remains `6dd1fec` / PR #227. Audit cleanup removes only
  a proven-unused catalog hook/wrapper; no runtime endpoint or SQL changes.
- #229 head `44b11b4` now has all five required jobs passed in CI #458
  (`34582041579`). Its old request to wait for the corrected first-page race CI is
  resolved. Complete atomic next-page delivery plus window concurrency/populated
  upgrade, page replay and captured-session client tests next. Keep continuation
  disabled until accepted; hosted/device gates remain separate.
- E1 #235 → D1 #236 → D2 #237 is the next engine sequence. D1 supplies real
  isolated research data after executable contracts; it does not wait for native
  population volume. D3/D4/D5 are optional experiments after D2, and E2 serving
  integration has separate native/rights/quality/fallback gates.
- #232 joint rating/rewatch is mandatory first release: Phase14 evidence/policy,
  Phase15 Personal setup, Phase16.3 complete joint flow. #230/#231 and joint-list
  choice remain scoped later candidates in FUTURE_PLAN, not invented acceptance.
- Migration protection expands from the original 47 files to 50 by appending
  three accepted-main hashes; no original SQL/hash or source-baseline cutoff changes.
- This scoped audit does not close Sprint014, DATA/ALG/ENG requirements, device
  tests or the Share Link Gate. STATUS is the sole current next-task authority.

## 14A — Real provider-backed catalog — #182 / device follow-up #199

Implemented/hosted/main:

- one canonical `public.items` catalog,
- provider provenance + namespaced external-ID dedup,
- generic discoverability/presentation lifecycle,
- service-only atomic and bounded batch import,
- ACTIVE TMDB Edge importer with server-side secrets/localization fallback,
- Open Library monthly bulk-dump importer as the long-term broad import path,
- mobile poster/cover/creator/year enrichment without changing Prediction rank/ID,
- hosted detail/swipe uses remembered catalog Items; exact delivered-slate identity now requires MVP-DATA-004 regression/fix,
- first guarded seed: **30 real MOVIE + 30 real BOOK Items** with `KAJO_CURATED_BETA` provenance,
- historical 24 `KAJO_MOCK` rows remain stored but are `discoverable=false`,
- hosted Prediction V1 acceptance returned real BOOK/MOVIE Items with **0 mock deliveries**,
- all 930 historical Event references to old mock Item IDs still resolve,
- forward fix `20260905003500_fix_resurfacing_null_bootstrap.sql` corrected bootstrap NULL propagation that had incorrectly classified untouched Items as `SAVED_SUPPRESSED` and caused mobile to fall back to mock cards,
- PR #192 merged to `main` at `c08513a3b00cda764004ed8c295466f26dc61e32` after final CI passed,
- bounded Open Library Search beta bootstrap used **13** explicit genre/language buckets and normalized **650 raw rows -> 385 new Work-ID/title-deduplicated BOOK Items**,
- current discoverable BOOK total is **415** (`385 open_library + 30 kajo_curated`),
- Open Library quality gate passed with **385/385 covers, 385/385 creators, 383/385 release years, 57 Items with Finnish editions, 65 with Swedish editions, 0 duplicate discoverable BOOK title groups and 0 discoverable mocks**,
- language-preferred Open Library Edition enrichment matched all 385 provider Items, changed 159 display titles and selected 385 display covers without introducing title collisions,
- provider `readinglog_count`/`ratings_count` normalize into generic `popularity`/`voteCount`, so the existing `ColdStartPrior` uses `PROVIDER_POPULARITY` without a provider-specific ranker,
- `metadata.openLibraryWorkId` mirrors the provider Work ID for repeat-safe admin refresh while private external-ID aliases remain authoritative,
- repeatable beta tooling is `scripts/catalog/open-library-search-beta.mjs` + `import-open-library-search-beta.mjs`: fixed bucket contract, fi/sv language-preferred editions, Work/title dedup, fail-closed coverage gate, provider-friendly request spacing and writes only through `upsert_catalog_batch_v1`,
- PR #196 passed final-head lint/typecheck/catalog tests/iOS+Android bundle smoke and squash-merged to `main` at `d3fe79865f855b8b3df5f42ae1027ed006169687`,
- PR #198 removed initial fallback-to-hosted reorder flash, kept the 600 ms delay only for interaction-driven reranking, virtualized the discovery grid, mounted only near-visible remote images, used Open Library `-M.jpg` grid thumbnails, preserved full detail images, added hero covers/posters, compacted detail metadata and corrected the bottom Profile control contract,
- main run **#346** passed and produced the configured standalone Android APK used for the 2026-09-06 device follow-up,
- hosted catalog recheck on 2026-09-06 confirmed **BOOK 415 discoverable / 385 images** and **MOVIE 30 discoverable / 0 images**.

Still open:

- configured-device acceptance of #199 dense-grid + warm-image-cache follow-up,
- configure `TMDB_READ_ACCESS_TOKEN` and expand MOVIE coverage beyond the 30-title seed with real posters/descriptions,
- enrich BOOK descriptions and stronger ISBN/Edition matching through the monthly Open Library dump path,
- optional Finnish bibliographic enrichment through Finna while respecting separate cover rights,
- provider attribution/licensing review before external/store release.

The bounded Search API importer is a beta seed/refresh mechanism, not Kajo's runtime book backend. The monthly Open Library dumps remain the intended large-scale persisted catalog path. Historical mock rows are never deleted because Events/Lists/Prediction traces may reference them.

### Configured-device follow-up 2026-09-06 — #199

The run #346 APK proved that real BOOK covers arrive, but the current presentation/perceived-loading quality is not yet accepted:

- BOOK scrolling still feels image-limited under continuous downward movement,
- the small image mount window intentionally allowed already-browsed covers to revert to placeholders once outside that window,
- the two-column surface still reads as separated cards instead of a dense visual browse grid,
- MOVIE has no posters because hosted canonical MOVIE image metadata is **0/30**, not because the generic mobile image renderer is missing.

#199 is the bounded follow-up and must preserve the existing Prediction/Event/Profile architecture:

- nearly edge-to-edge two-column rectangular tiles,
- minimal outer margin/gutter and sharp/minimal corners,
- `cover` image fill across the whole tile,
- restrained title/creator presentation as an image overlay instead of large text blocks between cards,
- bounded FlatList virtualization remains,
- once a discovery image URL is loaded/prefetched during the app session it may stay warm for later rows/revisits; this is UI cache only and must not become Prediction evidence,
- prefetch farther ahead than the mounted image window without mounting/downloading the whole 415-item catalog at once,
- add deterministic tests around image-window planning,
- device acceptance is required before #199 is closed.

Do not solve MOVIE posters by scraping or an unofficial image source. Configure the existing server-side TMDB credential/import path.

## 14B — PersonalProfile bootstrap/import + no-import profiling — #185

### History import — implemented/hosted/main

Repository migrations:

- `20260904203000_profile_bootstrap_import_foundation.sql`
- `20260904203200_harden_bootstrap_rating_constraints.sql`
- `20260904210000_expand_profile_import_stage_limit.sql`
- `20260904211000_profile_bootstrap_actor_index.sql`
- `20260904212000_list_profile_import_jobs.sql`

Data contract:

- history import belongs only to the authenticated owner's PersonalProfile,
- SharedProfile is never a direct import target,
- imported provider history is not appended as native Kajo Events,
- private import jobs/staged rows/bootstrap evidence retain source provenance,
- re-import is idempotent snapshot replacement for the provider/dataset,
- import effects can be removed without deleting native Kajo behavior,
- external-ID match is preferred; safe title/year fallback comes second,
- ambiguous/unmatched rows remain explicit until the user chooses or skips,
- across active imports one strongest state per Item wins: `RATED > CONSUMED > SAVED`,
- imported evidence contributes only to LongTerm taste,
- imported evidence does not enter Working/ShortTerm/ScenarioMemory,
- stale bootstrap evidence decays slowly and native Kajo Events progressively dominate it,
- imported RATED/CONSUMED participates in existing reacted-item suppression,
- imported SAVED remains saved intent and uses the existing reminder policy,
- one staged dataset supports up to 5,000 normalized rows.

Parser contract:

- robust quoted CSV parsing,
- Letterboxd ratings/watched/diary/watchlist CSV,
- IMDb ratings/check-ins/watchlist/list CSV with canonical `imdb_title` matching,
- Goodreads-style library CSV,
- StoryGraph CSV,
- generic Kajo CSV fallback,
- IMDb 1–10 remains unchanged,
- Letterboxd/Goodreads/StoryGraph 0.5/1–5 style ratings normalize deterministically to Kajo 1–10,
- watched/read with no rating becomes CONSUMED with no fabricated rating,
- watchlist/to-read becomes SAVED.

Settings UX:

- `Asetukset` is second from bottom in the side drawer above `Kirjaudu ulos`,
- import controls and instructions are shown only for active PersonalProfile,
- SharedProfile state explains the boundary and offers `Vaihda omaan Kajoon`,
- Letterboxd export ZIP is currently unzipped by the user and its CSV selected,
- flow: file picker -> local parse -> hosted stage/match -> summary -> resolve/skip ambiguous/unmatched -> commit,
- persisted imports reload after app restart under `Aiemmat tuonnit`,
- imports can later be removed independently of native Kajo interactions.

Hosted import verification:

- sample stage returned 3 matched / 1 ambiguous / 1 unmatched,
- ambiguous resolution and commit passed,
- SharedProfile import denied,
- PersonalProfile isolation passed,
- imported rating suppression passed,
- aged imported saved reminder eligibility passed,
- import removal deactivated active bootstrap evidence,
- empty/cold-start profile gained imported LongTerm taste while ShortTerm stayed empty,
- 5,000-row function guard verified hosted,
- persistent import listing is PersonalProfile-owner-only and rejects Shared targets,
- bootstrap actor FK advisor finding was fixed with a forward index,
- PR #190 merged to `main` at `d140cab3151530e40688fd95164997ece9de1009` after lint, TypeScript, tests and iOS/Android bundle smoke passed.

### No-import cold start — merged PR #191 / `cold-start-v1`

PR #191 was rebuilt cleanly on #192 main rather than carrying the old random/image-gated implementation forward, passed final-head lint/typecheck/tests/iOS+Android bundle smoke, and merged to `main` at `0cfa9e73d14f66e309bae937d66124b88c0477c2`. Hosted migration:

- `20260905010000_profile_cold_start_calibration.sql` / hosted `profile_cold_start_calibration`.

Product contract:

- import and profiling are the two intended sparse-PersonalProfile bootstrap paths,
- `ProfileBootstrapGate` allows the user to open Settings/import; returning without enough strong import/native evidence brings profiling back,
- no normal “skip everything” action is offered while sufficient real calibration candidates exist,
- completion requires **6 ratings of known Items**, not 20 mandatory ratings,
- first slate contains **12** deterministic candidates,
- unknown Items are skipped without negative evidence,
- if needed the same ordered slate extends to at most **24** candidates,
- finish is enabled immediately after six ratings; remaining cards are optional,
- after the bounded maximum or technical catalog insufficiency, fail open rather than trap the user,
- only real discoverable non-mock Items are eligible,
- images are optional presentation enrichment and do not gate calibration,
- no demographic input is required,
- calibration is source-tagged `KAJO_CALIBRATION` bootstrap LongTerm evidence; it is not a native Event and never enters Working/ShortTerm/ScenarioMemory.

`ColdStartPrior` / `cold-start-prior-v1` candidate order:

1. provider/catalog trend or popularity when available,
2. provider/catalog recognition when available,
3. explicit recognition-only fallback for the temporary curated beta seed,
4. weak freshness component.

Curated fallback is deliberately inspectable as `KAJO_CURATED_RECOGNITION` with `trend=0`; it must not masquerade as live trend. Provider aggregate popularity/trend is permitted catalog metadata. TMDB and the bounded Open Library beta adapter both normalize provider popularity/recognition into generic metadata, so real provider imports feed the same prior automatically. Kajo-derived cross-Profile trend belongs to future privacy-gated `PopulationMemory`, not this MVP prior.

Hosted cold-start verification:

- status sees 30 real MOVIE + **415 real BOOK** Items; 385 BOOK Items now also have provider covers,
- calibration is available without image dependency,
- first 12 candidates are deterministic, balanced and high-prior,
- requesting 24 preserves the first 12 as an exact prefix and extends the slate,
- curated fallback reports recognition rather than fake trend; Open Library Items report `PROVIDER_POPULARITY`,
- controlled 6-rating commit executes through the real RPC without producing native calibration Events,
- rollback leaves zero active calibration test rows,
- no `KAJO_MOCK` path exists in calibration eligibility,
- merged-main validate passed on CI #324.

### Remaining 14B gate

- configured-device Settings/drawer/file-picker/import acceptance,
- real CSV acceptance against canonical real Items,
- configured-device 6-of-12-to-24 cold-start acceptance with recognizable BOOK/MOVIE Items,
- first-session recommendation check after imported bootstrap and after calibration bootstrap,
- then mark `MVP-BOOT-001..004` accepted.

## 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Implemented/hosted/main; configured-device acceptance still open.

The implementation extends the existing `private.rank_items_v1_internal` / `public.rank_items_v1` path. Prediction target remains SharedProfile and no second recommender exists.

Current `shared-common-fit-v1.1` contract:

- sparse/new SharedProfile receives a small neutral `ColdStartPrior` component,
- accepted members are resolved through `profile_members` and each member's canonical PersonalProfile,
- Personal fit uses source-tagged bootstrap/native LongTerm plus native ShortTerm summaries without copying Personal rows into Shared history,
- sparse member estimates shrink toward the neutral catalog prior using evidence-strength reliability,
- aggregate mean/member-minimum fit contributes positively only when it exceeds the neutral prior,
- agreement above the prior earns a consensus component,
- member-fit range produces a bounded disagreement penalty,
- neutral prior contribution decays as SharedProfile's own evidence count grows,
- Shared joint state and same-Profile ScenarioMemory remain first-class existing V1 inputs,
- PersonalProfile ranking is an explicit no-op: old `scenario-memory-v1+resurfacing-v1` policy remains and common-fit contribution is zero,
- Shared PredictionRun policy version is `scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1`,
- PredictionCandidate explanation exposes only safe aggregates (`memberCount`, coverage, mean/min fit, consensus, disagreement, neutral prior, contribution), never member IDs, PersonalProfile IDs or raw history,
- private helper functions have no authenticated/anon execute grants; mobile continues through `public.rank_items_v1` only.

Hosted implementation history is immutable:

- `20260905113000_shared_common_fit_v1.sql` — first hosted common-fit version,
- `20260905114500_harden_shared_common_fit_v1_1.sql` — v1.1 context/reliability/ShortTerm/prior-decay hardening,
- `20260905115500_fix_shared_common_fit_personal_policy.sql` — forward fix preserving the PersonalProfile policy-version/no-op branch.

Hosted/repository acceptance evidence:

- deterministic agreement control: contribution **+4.088**,
- deterministic sparse control: neutral-prior-only contribution **+0.0675**,
- deterministic disagreement control: contribution **−2.5945**, including **2.5** disagreement penalty,
- real hosted two-member SharedProfile run returns `shared-common-fit-v1.1` inside the canonical Prediction V1 trace,
- real run shows item-specific disagreement penalties and positive consensus components,
- candidate explanations contain no actor User ID or PersonalProfile ID and declare `AGGREGATE_ONLY`,
- PersonalProfile control returns `sharedCommonFit.applicable=false`, contribution `0`, and preserves `scenario-memory-v1+resurfacing-v1`,
- authenticated/anon cannot execute private common-fit config/context/candidate helpers; authenticated can still execute `public.rank_items_v1`,
- 10-result Shared hosted smoke measured about **136 ms** in the current development environment; this is a development baseline, not a production SLO,
- test PredictionRuns/candidates were removed after acceptance; zero tagged test-run residue remains,
- advisor pass introduced no new #177 WARN-level findings; existing leaked-password WARN remains separate #160/#184 release scope,
- PR #194 final-head CI #327 passed lint, TypeScript, tests and iOS/Android bundle smoke,
- PR #194 squash-merged to `main` at `5e1dc9cc993887ab19b943ac0f2a5943d53aa908`.

### Remaining 14C gate

- configured Android SharedProfile acceptance with real Items and a persisted V1 trace,
- only then mark `MVP-PRED-005` complete and close #177.

## 14D — External beta gate — #186

Target roughly 10 external testers.

Required flows:

- clean install/account entry,
- useful first-session import or profiling,
- real BOOK/MOVIE discovery/detail/swipe/rating/not-interested/save/List/history,
- Shared create/invite/join/switch/common-fit/Endorsement/List,
- Profile messaging where already in MVP scope,
- repeated-session suppression/reminder behavior,
- backend/runtime failures diagnosable without developer access to tester phones.

## Product decisions

- MVP 0.1 is a complete store-downloadable BOOK/MOVIE product, not a mock prototype.
- No monetization is required yet.
- Demographics are not required for recommendation quality; import/content choices/behavior dominate.
- Letterboxd/IMDb import is user-authorized file import, not scraping.
- Personal import/calibration evidence remains Personal. Shared common-fit reads authorized Personal taste rather than copying evidence.
- Provider aggregate popularity/trend may seed sparse profiles; Kajo-wide aggregate behaviour remains PopulationMemory-gated.
- Open Library Search beta bootstrap is bounded/cached admin ingestion; the app never uses Open Library Search as its runtime backend.
- Do not judge common-fit quality on the historical mock catalog.
- Product decision 2026-09-07 promotes #200 contextual Lists, #201 catalog search/filters and #203 authorized Profile-name search into MVP; see current ROADMAP 17.0.

## Dependencies

- #182 + #199 configured-device real-card/dense-grid acceptance and **TMDB MOVIE provider expansion** remain required for beta; BOOK beta already has 415 discoverable Items.
- #102 Lists, #138 messaging and Room/shell refreshed device gates remain before beta acceptance.
- #127 owns production email; #184 owns Google/Apple identity linking and taste-preserving conversion in Phase 15.1. Both precede the complete-flow beta in Phase 18.
- #160 production security hardening remains release scope unless a blocking beta-safety issue appears. Repository/hosted migration parity for `harden_production_function_boundaries` was restored through PR #162; leaked-password protection remains the known release WARN.

## Current acceptance

Phase 14 exits only when its ROADMAP 14.0–14.5 gates have evidence, including the following still-open work:

- [-] `MVP-ALG-001..009`: bootstrap/replay foundations are implemented in part; serving/shadow, candidates, adaptive state/features/modes/cold start and operating evaluation acceptance remain open. Individual statuses are in MVP.md.
- [ ] `MVP-DATA-003..004`: atomic actions, durable outbox and exact delivery provenance.
- [-] `MVP-PRED-006`: trace foundation exists; complete delivery/evidence acceptance remains open.

- [-] `MVP-CAT-001..003`: BOOK beta coverage now has 415 real Items with 385 provider covers; MOVIE remains 30-title seed with 0 images, #199 device presentation/cache acceptance and provider expansion are open.
- [-] `MVP-BOOT-001..002`: parser/backend/Settings implemented; real-data device acceptance open.
- [-] `MVP-BOOT-003`: bounded popularity-led no-import profiling implemented/hosted/main; configured-device acceptance open.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted/main; device acceptance open.
- [-] `MVP-PRED-005`: Shared common-fit v1.1 implemented/hosted/main; configured-Android acceptance open.
- [x] hosted normal Prediction delivery contains no `KAJO_MOCK` Items; configured-device confirmation of current product presentation remains open.
- [ ] import and no-import users both receive useful first-session recommendations on device.
- [ ] deterministic handoff to Phase 15 Taste acquisition after Phase 14 acceptance.

Deferred release gates retain their own owners: refreshed List/messaging/Room acceptance in Phase 17; #186 full-flow closed beta in Phase 18. They are not claimed complete here.

## Immediate next action

Finish the current #208 operational PR according to [STATUS.md](../STATUS.md), then implement ROADMAP 14.1 atomic actions, persistent outbox and exact delivery origin. ADR-0006 explicitly adopts the local/CI lineage and the replacement clean-install criterion. #207/#208 technical closure does not close #199/#182, device, catalog or algorithm-quality gates.

## Continuation checkpoint — 2026-09-06

PR #205 delivered the bounded TMDB beta orchestrator (`scripts/catalog/import-tmdb-beta.mjs`, `npm run catalog:tmdb-beta`) at `41c537eb`. Main #352 validation passed including both bundle smoke checks; its APK job was still running at the check. Hosted import has not run in this continuation. Current coverage, credential prerequisites and the executable next step are maintained in `../STATUS.md`. The SQL recheck also found zero nonblank BOOK descriptions. #182 and #199 were reopened because their actual catalog/device acceptance remains pending. Partial PRs must not auto-close these parent gates. No MVP requirement was marked complete.


## Scope and reliability checkpoint — 2026-09-07

The owner made algorithm correctness/adaptation and production completeness the priority. At that checkpoint ROADMAP 14.0–14.8 owned the order; the later Taste-first decision superseded those phase numbers with the current Phase 14–20 sequence. Earlier 14A–14D sections record delivered foundations; they do not waive the newly required ALG/DATA/OPS/UX and browse acceptance in MVP.md.

Before external beta, additionally require bootstrap-driven serving, exact/atomic evidence, serving-shadow parity, refill/continuation, adaptive state/common features, running bounded SleepLayer evaluation, promoted browse suggestions and safe-beta lifecycle/operations. Documentation-only changes have not fixed these code gaps or provisioned services. Current findings and the exact active handoff live in STATUS.md.


## Pre-APK verification — 2026-09-07

- Main APK #352 is now confirmed successful and available; current build link and acceptance state are in STATUS.md.
- `fix/pre-apk-import-dependency` declares the existing Expo-compatible `expo-file-system` 57.0.5 directly in mobile/package-lock because Settings imports it directly. No dependency upgrade, algorithm change or migration is included.
- `npm run check` passed on the final dependency change: lint, TypeScript, all 187 mobile tests, catalog tests and both iOS/Android bundle smoke exports. No Android emulator/phone runtime is available in this workspace, so file-picker and grid/cache device acceptance stay open.
- Public-source migration filter whitespace mismatch is tracked in #208 as a prerequisite of #207 SQL replay coverage. Both algorithm/bootstrap acceptance and full database replay remain open; no deployed migration was rewritten.
- PR #206 remains pending merge approval. This continuation is a dependent branch; resolve the documentation PR before retargeting/merging its follow-up. Do not mark Sprint 014 or any new MVP requirement complete.


## Bootstrap serving checkpoint — 2026-09-07, pending branch

- `fix/207-bootstrap-personal-ranking` depends on #209/#206. #207 stays open.
- Forward migration `20260907155201_bootstrap_personal_ranking.sql` reuses bootstrap selection/strength/decay for memory and direct Personal base ranking. It writes `prediction-v0.4-bootstrap` in base/V1 version metadata and preserves the existing V1 policy/trace body otherwise.
- CSV/calibration successes and import removal notify mounted rankings, including authorized Shared common-fit, through a bounded session-only revision; no scoring runs on the client.
- SQL fixtures reproduce the old missing-bootstrap effect and verify opposite tastes, removal/replacement, neutral/future/duplicate sources, BOOK-to-MOVIE shared tags, native/undo controls, Shared isolation, authorization, private function privileges and unchanged V1 policy definition apart from base version. These are function unit tests, not full migration replay or hosted public V1 execution.
- Final `npm run check` passed: lint/typecheck, 191 mobile tests, 14 catalog tests, 15 SQL runner tests (including the enclosing test) and iOS/Android bundle exports. SQL tests join the canonical npm test/CI gate. No deployed migration was edited, no hosted change was applied, and no new requirement is marked complete. Full replay (#208), hosted V1 acceptance and device acceptance remain open.
- Expo Metro was started offline successfully; React Native DevTools could not launch in this root container (Electron sandbox restriction). No device/emulator interaction was tested. Main CI produces the next APK only after approved merges; do not poll its completion.

### Next configured APK checklist

Use the next APK that includes the pending mobile changes **after** the forward migration passes deployment verification. The existing #352 APK is suitable for earlier grid/cache checks but lacks the new refresh behavior.

1. Existing account: sign in, open BOOK/MOVIE, open/close a card, switch Personal/Shared and confirm the right Profile and content remain active.
2. BOOK grid: scroll down and back; check dense two-column layout, cover fill and already-viewed covers. Movie posters remain a separate catalog gate until official provider enrichment is configured.
3. History import: first open discovery, then Settings. Cancel the picker once; then import a real supported CSV, review uncertain matches and commit. Return to discovery without restarting: a fresh hosted ranking must arrive, and imported consumed/rated Items must not appear as unseen.
4. Import removal: remove that source, return without restarting and confirm a fresh ranking. Native Kajo ratings/Lists must remain. Exact ordering need not revert after intervening native behavior.
5. No-import account: rate six known Items; unknown skips are neutral, the 12-to-24 bound/fail-open remains, and discovery works immediately after completion.
6. Compare personalization using enough matched, contrasting tastes: explainable changes in similar unseen Items, including risk-mode switching. A single pair of real-world lists is not a statistical quality guarantee.
7. Shared Profile: after Personal import/removal, switch back and verify authorized shared recommendations still work, without exposing or copying Personal history. Exercise pending List approval and consensus once.
8. Failed import/network interruption: show a recoverable error, do not falsely report success, and retry after reconnecting. Check ordinary rating, save and undo still advance/restore the intended card.

Report the APK/run identifier, Profile type, exact steps and screenshot for any failure. This checklist does not close the separate production, retention, SleepLayer or full-beta gates.


## Authorized deployment checkpoint — 2026-09-07

- Owner approved merges/deployment; #206 and #209 are merged. PR #210 is the remaining active branch.
- Hosted forward migration `20260907155201_bootstrap_personal_ranking.sql` applied successfully. Git filename was synchronized to the recorded hosted version without changing its SQL payload.
- `scripts/database/bootstrap-ranking.hosted-smoke.sql` passed authenticated public V1 bootstrap contribution, import-removal refresh of backend scores, outsider denial and persisted base version. The transaction rolled back all synthetic accounts, catalog/evidence rows and prediction traces. This is a bounded integration smoke, not full replay, Shared/Auth lifecycle or device acceptance.
- Earlier pending-deployment statements above describe the prior checkpoint. Current truth is in STATUS. #208 replay and #207 remaining acceptance stay open. APK testing is deferred; do not poll builds.


## Replay diagnostic checkpoint — 2026-09-07

- PR #210 merged at `dd53c0c371132efaff1efc196ba81ce7369102d6` after CI #359 passed. No APK polling or device acceptance.
- Branch `test/208-migration-replay-diagnostic` adds `npm run diagnose:database-replay`: complete unmodified files, per-file transactions, immediate error/exit 1. PGlite 0.3.14 uses explicit minimal platform fixtures; no new dependency.
- Reproduced #208 after 33 successful migrations at catalog provider foundation (`P0001`, expected candidate filter missing). This command intentionally remains failing until replay is actually repaired. It is separate from green function-unit checks, and no failed migration is skipped.
- No deployed migrations changed. Next document/validate a clean-install baseline strategy with archived immutable history and parity checks; a later forward migration cannot repair an earlier fresh-install failure. Full Supabase stack validation requires another execution environment because Docker/Postgres are unavailable here. #208/#207 acceptance stays open.


## Historical integrity checkpoint — 2026-09-07

- PR #211 merged at `ece70f5aa8ba5ae46b3f8481987be455f44c794f` after CI #361 passed.
- `test/208-migration-history-integrity` protects the 47 current migration files with a repository-provenance SHA-256 manifest. Two automatic tests reject changed/deleted history, duplicate versions and backdated new migrations. Future forward migrations remain allowed.
- Proposed ADR-0006 defines the separate empty-install baseline proof: schema/ACL/system-seed provenance and parity, repeatable pinned Supabase installation, synthetic Personal/Shared tests and independent existing-database upgrade verification. No baseline SQL or hosted/history change is included.
- The old chronological replay remains blocked at #208; passing history-integrity/unit tests does not satisfy it. Next schema-only capture and difference review. No APK polling or device acceptance.


## Migration tracking comparison — 2026-09-07

- PR #212 remains open: earlier CI #363 passed, but automatic approval review rejected its merge pending explicit approval for this PR. Parity additions stay on the same branch.
- Read-only metadata comparison: 47 repository files, 44 hosted rows, 5 exact version/name matches, 38 same-name/different-version repository entries, 4 repository names absent from hosted tracking and one repeated hosted name. Tracking mismatch does not establish missing schema. No history repair or hosted mutation.
- Added `migration-parity.mjs` and four regression tests; actual metadata returns MISMATCH/exit 1. No raw hosted snapshot is committed. This checker complements the immutable-file manifest and does not assert equivalent SQL from matching names.
- Schema-only export remains uncompleted: pg_dump/Docker and a direct export connection are unavailable. Next establish pinned export tooling and reconcile tracking with schema definitions. Baseline/replay acceptance remains open. No APK polling.

## Function parity checkpoint — 2026-09-07 / #208

- Continued accepted `main` `32a3a3f` on `test/208-function-schema-parity`; #212 and #216 are merged. Historical open-PR statements above are superseded.
- Added read-only function fingerprint SQL and a strict comparator with deterministic PGlite regressions for body literals, SECURITY DEFINER/search path, owners, grants/grant options, overload removal, malformed/empty inputs and major-version differences.
- Hosted PostgreSQL 17.6 query returned 123 function/procedure fingerprints (40 public / 83 private). Four functions defined by the latest bootstrap migration matched the existing repository SQL fixtures exactly in definition, owner and direct ACL. Optional fixture snapshot makes this limited comparison repeatable; ADR-0006 owns usage and exclusions.
- No hosted schema/data/history mutations, migration rewrites, new dependencies or APK build requests. Full schema-only export and Supabase installation/upgrade proof remain open; this diagnostic does not close #207/#208 or MVP-ALG-009.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. Final empty-ACL regression also passed. No device acceptance was performed.

## V1 definition parity checkpoint — 2026-09-08 / #208

- PR #217 merged at `42d605a` after owner approval and green CI #371.
- Follow-up `test/208-v1-definition-parity` extends the existing optional fixture snapshot to the complete `private.rank_items_v1_internal`. All five scoped definitions, owners and direct ACLs matched hosted PostgreSQL 17.6, including the V1 policy/trace function reconstructed from canonical patches.
- No runtime defect was found in this comparison; no hosted schema/history/data changes. Full installation proof remains open. Docker/pg_dump/psql/Supabase CLI are absent and no separate Supabase development branch exists. STATUS now names the environment prerequisite instead of sending a fresh agent back to merged PR #217.

- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. The optional five-function export and hosted comparison also passed. No device test or APK polling.

## Supplied export checkpoint — 2026-09-08 / #208

- #218 merged at `2d1b0d5`; owner supplied `kajo-schema.sql` from the pinned CLI export workflow. STATUS/ADR-0006 retain its checksum and exact next steps.
- Whole export loads unchanged into two disposable PGlite databases: 30 empty RLS-enabled tables, 205 constraints, 19 policies, 123 functions. All 123 function definitions/owners/direct ACLs match fresh hosted metadata. This comparison does not establish canonical repository equivalence for the remaining objects.
- Confirmed missing Auth provisioning trigger (present hosted), event triggers and model/policy system seeds. No hosted changes or migration rewrites. The uploaded DDL remains unaccepted source material, not a committed installation baseline.
- Added checksum-gated offline export diagnostic. Wrong checksum and an export containing an application row are rejected. Actual Supabase/Auth/Shared runtime, seed reconstruction and forward-upgrade acceptance remain open.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. Two export installations, full hosted function comparison and negative checksum/data checks passed separately. No device/APK acceptance or hosted write.

### Local rollback-only probe continuation

- Owner confirmed CLI 2.117.0 local Supabase starts on Mac. Same #219 branch now includes a Mac-only local Docker runner and exact-export probe builder; no additional dependency.
- Temporarily loads schema, canonical Auth trigger and three SleepLayer seed statements, verifies automatic PersonalProfile membership, runs authenticated bootstrap V1/import-removal/outsider/trace smoke, then rolls back the entire experiment. Existing Auth/application tables prevent execution.
- Full probe passed twice in PGlite; rollback restored empty state. Nonempty-database guard preserved an existing test table/row. Mac/platform execution is pending. Probe seeds are not a deterministic baseline bundle; Shared/platform/upgrade/replay gates remain open.

### Owner Mac result and Shared probe extension — 2026-09-08

- Owner reported original #219 probe PASS on local Supabase Postgres 17.6.1.167;
  all changes rolled back. ADR-0006 retains exact image ID and scope. This
  supersedes the preceding pending-Mac statement for the original probe only.
- Expanded rollback-only probe covers both accepted Shared members, aggregate-only
  explanation without member/PersonalProfile IDs, outsider and revoked-member
  denial, and exactly two versioned Shared traces. Synthetic membership setup does
  not validate invitations/consent or recommendation quality.
- Expanded full export + Auth + Shared + Personal probe passed twice in PGlite;
  expanded Mac run remains pending. No historical migration or hosted data changed.
- Next continue export/source reconciliation and deterministic seed supplements;
  complete pinned installs/platform/forward-upgrade gates remain open under #208.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database
  tests and iOS/Android bundle smoke. Expanded export probe passed separately twice.

### System-seed source checkpoint — 2026-09-08

- Added a checksum-verified source reconstruction for the initial four
  PredictorGenomes, four promotion decisions and baseline PolicyAssignment. It
  reads only the immutable SleepLayer migration and refuses to overwrite output.
- Source/model identities are deterministic; the initial policy's effective time
  remains installation time by design. No hosted data or learning rows are used.
- Validation: 24 database tests passed, including source-boundary, semantic-key
  and no-overwrite regressions. Pinned full-install/platform/upgrade gates remain
  open.

### Prior-change audit — 2026-09-08 / #219

- Restored STATUS and this checkpoint after truncated API payloads corrupted the
  remote documentation. Future uploads must match the entire tested Git tree SHA.
- Fixed seed source verification: changed source/weight now fails on checksum.
- Removed the CI test's hard-coded conversation attachment. The explicit offline
  export diagnostic now checks all 21 application-table trigger definitions and
  enabled states against protected migration source; both export installs pass.
- Preserved immutable history, public/privileged boundaries and #208's open gates.
- Correction: promotion/policy seed IDs are also random, not only timestamps;
  the deterministic metadata gate was never completed by the extraction tool.
- Added proposed deterministic empty-install seeds with explicit audit/assignment
  identities and schema-cutoff epoch. Two independent seed installs match every
  field and preserve original genome/policy semantics. Nonempty reinstall fails
  without changing rows. Full Auth/Personal/Shared probe passes twice with these
  seeds. Revised Mac/full-platform/forward-upgrade gates remain pending.
- Final validation: `npm run check` passed lint, TypeScript, mobile/catalog tests,
  29 database tests and iOS/Android bundles. Exact export trigger parity passed in
  two disposable databases; the expanded rollback probe passed twice separately.
- Added read-only table-definition/direct-ACL fingerprints and same-count drift
  regressions. Exact export fingerprints match across two independent installs
  for all 30 tables. This strengthens export repeatability only; remaining
  canonical schema/platform/upgrade gates remain open (ADR-0006).

### 2026-09-09 — Canonical function source discrepancies

- Reconstructed all 122 application function definitions from the immutable
  checkpoint. Both export installs show 96 exact matches, 26 definition differences
  and no missing/unexpected application functions; platform RLS function excluded.
- Reproduced two additional source-patch failures: import stage-limit expansion
  and null-bootstrap resurfacing both expect compact text absent from the earlier
  repository definitions. Catalog upsert's conflict patch applies unchanged.
- Six public import wrappers and two Shared functions have inspected formatting/
  comment-only diffs. ADR-0006 owns the complete difference ledger and remaining
  18-function semantic review. No historical bytes or serving logic were changed.
- Export diagnostic now exits 1 with `REQUIRES_RECONCILIATION` while preserving
  separate successful export-repeatability evidence. Added repository-only
  regressions for both defects, drift detection, checksum guards and rollback.
- Validation: `npm run check` passed (191 mobile, 14 catalog and 36 database
  tests, lint/typecheck, iOS/Android bundles). The exact export loaded twice with
  repeatability PASS and source status REQUIRES_RECONCILIATION as documented.

### 2026-09-09 — Source-derived function resolutions

- Completed all 26 definition reviews: 19 formatting/comments, five alias-only
  changes and two intended import-stage/null-bootstrap corrections. ADR-0006 owns
  the resolution and provenance; the previous remaining-18 statement is superseded.
- Added the deterministic 122-function supplement and connected it to the guarded
  rollback-only probe. Original historical files and hosted runtime are unchanged.
- Two independent installations match all post-supplement fingerprints; exactly
  26 definitions change and all owners/direct ACL remain unchanged. The expanded
  Auth/Personal/Shared plus 5000-row import probe passes twice with rollback.
- Added repository-only behavior tests for boundary rejection without data loss,
  row correction, repeated commit, removal/eligibility and unauthorized access.
  The same smoke rejects both original broken definitions.
- Next: source owner/ACL and remaining non-function/platform reconciliation,
  revised Mac probe, repeated pinned full installation and independent upgrade.
- Validation: `npm run check` passed after the interrupted run was restarted:
  191 mobile, 14 catalog and 39 database tests, lint/typecheck and both bundles.

### 2026-09-09 — Source table definitions and privilege reference

- CI #382 for the previous published head passed; development continued on #219.
- Reconstructed 188 literal DDL statements from the protected source checkpoint.
  Both unchanged export installations match all 30 source table structures,
  including 205 constraints, 112 indexes and 19 RLS policies. No structural fix
  was needed; ownership/ACL are checked separately and not silently normalized.
- Added a plain-PostgreSQL source privilege reference from 296 literal statements.
  It exposes additional exported `service_role` rights on 12 tables and 18 public
  functions. Platform default/history provenance remains unresolved; there is no
  direct anon/authenticated grant difference in the compared objects.
- Reproduced the source future-function default gap: per-schema REVOKE does not
  remove the global PUBLIC EXECUTE default. Current explicit function ACLs are a
  separate matter. ADR-0006 owns the finding, correction boundary and remaining
  platform/default/installation/upgrade gates; no historical or hosted SQL changed.
- Source-only regressions enforce real membership isolation, unique/FK/check
  constraints and explicit grants, and detect an altered policy that really leaks
  the other synthetic Profile. Existing same-count fingerprint regressions also
  verify that only the explicit structural mode excludes ownership/ACL.
- Validation: `npm run check` completed all stages: 191 mobile, 14 catalog and 41
  database tests, TypeScript, lint (zero errors; one existing DiscoveryScreen Hook
  warning) and both iOS/Android bundles. The exact export diagnostic completed two
  installs with structural MATCH and explicitly unresolved privilege/source status.

### 2026-09-09 — Explicit compatibility/default contract and pause checkpoint

- CI #383 passed the preceding published head. Owner requested a pause after this
  checkpoint; resume from STATUS and the existing #219 branch, not a new workstream.
- Proposed compatibility SQL preserves only the exported service_role rights on
  12 named tables and 18 functions. Both export installations now match reviewed
  source owner/direct ACLs for all 30 tables and 122 application functions. Raw
  historical differences stay visible; exact platform provenance is not invented.
- Prepared CLI-generated forward migration to close future postgres-created
  function defaults globally and clear public/private additions. Existing function
  ACLs and other creators remain unchanged. Global scope includes future platform
  functions; real-platform and independent upgrade verification remain pending.
- Read-only hosted catalogs confirmed the global PUBLIC default gap. Corrected an
  earlier audit error: six platform event triggers have supabase_admin ownership,
  and none of the seven triggers is extension-owned. Hosted objects are unchanged.
- Full revised rollback probe passed twice in PGlite, including compatibility,
  defaults, Auth/Personal/Shared and import checks; application tables and default
  privileges were restored. New regressions verify execution boundaries,
  idempotence, unchanged existing rights and OID-independent platform metadata.
- Mac runner now saves image/probe hash and read-only platform metadata after
  checking before/after equality. Next run the revised probe on the owner's pinned
  local stack and collect `kajo-install-report-*.json`; ADR-0006 has exact commands.
  Prior Mac PASS covers only the original probe. Repeated full installations,
  platform reconciliation and independent forward upgrade still gate #208.
- Validation: `npm run check` passed 191 mobile, 14 catalog and 45 database tests,
  TypeScript, lint (zero errors; one existing Hook warning) and both bundles.
  No historical migration was edited and no hosted change or APK build was made.

### 2026-09-09 — Automated platform runtime continuation

- Owner resumed work after the pause request. Default/compatibility checkpoint
  `d98e652` is published in #219; CI #384 passed.
- Added a separate GitHub Ubuntu job that starts an unlinked Supabase CLI 2.117.0
  stack, requires Postgres 17.6.1.167 and reports actual image/config/commit metadata.
  This removes the need for a manual Mac capture before platform discovery.
- Shared SQL probe tests actual future-function execution, repeat migration,
  unchanged existing platform functions and unaffected schema/role/event/default
  metadata. All changes roll back; only the newly created stack is stopped/deleted.
- `npm run check` passed 191 mobile, 14 catalog and 47 database tests, TypeScript,
  lint with one existing Hook warning and both bundles. CI #385 passed the same
  validation and the real Supabase job at `533cc54`, retaining 99 native function
  definitions/owners/ACLs and verifying execution, rollback and cleanup.
- Retrieved report and compared hosted catalogs: four shared schema owner/ACL sets
  and selected role flags match. Differences are private schema/ensure_rls absence,
  native function callback hashes, initial public defaults and native
  supabase_functions role/default additions. ADR-0006 preserves the exact ledger,
  image/report hashes and boundaries; do not repeat platform discovery on Mac.
- Next build the candidate application installation from reviewed source with
  source default REVOKEs applied before object creation and explicit source RLS.
  Repeated full installs and independent existing-application upgrade still gate
  #208; no hosted write or native platform callback replacement.

### 2026-09-09 — Source-only installation candidate and CI transport correction

- Added the proposed full application candidate from reviewed source, with source
  default REVOKEs applied before object creation. All 30 tables, 122 functions,
  22 triggers and deterministic seed rows match the independent source reference.
- Two committed PGlite installations match exactly; full Auth/Personal/Shared and
  import smokes pass with rollback, and reinstall preserves the existing state.
  `npm run check` passed 191 mobile, 14 catalog and 49 database tests, TypeScript,
  lint with the existing Hook warning and both bundles.
- Added two distinct real Supabase installation runs to CI. Shared lifecycle pins
  the actual Linux Postgres image ID and owns/cleans only each new unlinked stack.
- CI #387 passed validation/platform. The first application run reached the
  negative reinstall check after its source/runtime comparisons, but Docker stdin
  EPIPE masked psql's early error. The full repeated-install gate remains pending.
- Added buffered SQL transport for CI/Mac with a regression for large Unicode
  input, real child exit status and private temporary-file cleanup. The SQL guard
  remains strict. The complete check passed with 191 mobile, 14 catalog and 50
  database tests plus both bundles; record the corrected real CI result next.
- Independent existing-application upgrade and accepted installer/history
  procedure are still open; no hosted write or migration-history change.

### Repeated native installation accepted as test evidence; independent upgrade prepared — 2026-09-09

- CI #388 at `0c9a480` passed validation, platform/default checks and both real
  application installations after the buffered SQL transport correction.
  All 30 tables, 122 functions, 22 triggers, seed rows, runtime behavior and
  rollback/reinstall/cleanup checks matched. ADR-0006 records verified report and
  image identities. This supersedes CI #387's EPIPE-blocked experiment.
- The tested checkpoint passed 191 mobile + 14 catalog + 50 database tests,
  TypeScript/lint and both bundles. The expanded Mac run is distinct and unrun;
  the repeated Linux CI gate no longer needs another manual Mac capture.
- Added a separate populated pre-upgrade fixture/probe and CI job. Existing
  Auth/Profile/membership, native/imported evidence, committed predictions and
  system seeds must survive the unchanged forward migration exactly. It checks
  complete row hashes, schema/function/trigger metadata, native defaults/platform
  and runtime before/after, with repeated commit and negative regressions.
- The local workspace disconnected while preparing the new upgrade package;
  its CI result is pending. No independent upgrade PASS is inferred from the
  installation job. Historical and hosted SQL/history remain unchanged; canonical
  installer/history transition, #208 and MVP-ALG-009 remain open.

### Populated upgrade and rollback local proof — 2026-09-09

- CI #389 caught an invalid synthetic import fingerprint; the fixture now meets
  the existing minimum length and includes a matched staging row/counts.
  Four local upgrade regressions passed, including exact restoration of global/
  per-schema default grants and their grant options, followed by reapplication.
- Optional checksum-gated unchanged-export upgrade passed in PGlite with all
  123 original function bodies/owners/ACLs, populated row hashes and runtime
  preserved. It applies no function/compatibility supplement. ADR-0006 records
  the command, final report hashes and exact provider/fixture scope.
- The workspace connection recovered. Full `npm run check` passed 191 mobile, 14 catalog and 54 database tests,
  TypeScript/lint and both bundles. Corrected native CI is the next evidence; canonical CLI/history activation is
  still separately gated and is not inferred from these SQL experiments.

### Native upgrade PASS; CLI lineage experiment prepared — 2026-09-09

- CI #390 at `7507d35` passed validation, platform/default checks, both application
  installations and the separate populated upgrade/rollback/reapplication job.
  Its downloaded report preserves 221 existing functions and all synthetic row
  hashes; ZIP/report/source/runtime identities are recorded in ADR-0006.
- Added a restricted CI-only CLI reset experiment. A generated source baseline
  plus unchanged forward files must yield matching clean installs and exact CLI
  history. A deliberately failed extra test migration must leave no table/history
  entry. Repository history and hosted state remain untouched.
- Full local `npm run check` passed 191 mobile, 14 catalog and 54 database tests,
  lint/typecheck and both bundles. The first real CLI job is pending. Proposed
  lineage adoption and existing hosted-history procedure remain separate gates.

### CLI lineage PASS and identical-image registry correction — 2026-09-09

- The actual CLI job in CI #391 passed two resets, source/runtime/seed/default
  parity and failure atomicity: the deliberately failed migration left no table
  or history row. Its verified report and exact two-row history are in ADR-0006.
- The same run's upgrade job stopped before application SQL because Supabase
  used its GHCR reference with the exact reviewed ECR image content ID. The check
  now accepts those two observed references only, retaining the exact tag/digest
  requirement. Changed image content/version/registry regression passes.
- Full local check passed 191 mobile, 14 catalog and 55 database tests plus
  lint/typecheck and both bundles. CI #392 at `bbe4dd5` then passed all five
  required jobs, including the repeated installs, populated upgrade/rollback and
  CLI history/atomicity. APK was skipped for the PR event.
- #208's literal unmodified-replay criterion is still unsatisfied. Fresh-lineage
  adoption/acceptance is explicit; no historical or hosted mutation is inferred.

### Verification package completion and pause — 2026-09-09

PR #219's verification implementation is complete. Its code head `9fcbbb4` passed
all five required jobs in CI #393. The final closeout updates documentation only:
STATUS now separates completed evidence from the adoption decision, ADR-0006
states the concrete proposed fresh lineage, and CODEMAP reflects the populated
upgrade and five CI gates. Resolve #219's current publication state from GitHub;
a merged PR is continued from `main`, not from an obsolete local branch.

The next work is the explicit acceptance/installation-procedure decision and its
operational wiring, as specified in STATUS and ADR-0006. #208's literal original
replay criterion remains unsatisfied. #207/#208/MVP-ALG-009 and Sprint 014 remain
open; no hosted schema/data/history change or new device acceptance occurred.
Do not restart completed export/fingerprint/platform/install/upgrade/CLI discovery
or create another docs-only commit merely to record this closeout's own CI or
merge number. Complete publication, then pause as requested by the owner.


### Operational local lineage adoption — 2026-09-09 / #208

- Added `npm run database:install` for a new, unlinked local workspace. Reuses the
  reviewed builder and pinned stack lifecycle; checks image/source/empty-state,
  actual CLI history, independent source-plus-forward snapshots and runtime smoke.
- Success retains the owned local stack with a metadata manifest; failure cleans
  only that stack/workspace. Existing containers/volumes and application/Auth state
  are refused. CI runs the same install boundary before its reset/atomicity checks.
- Forward-added tables/functions participate in full snapshots. Regressions reject
  changed source bytes, duplicate versions/unsafe ordering, unexpected new rows,
  missing RLS and reuse of an existing application even if CLI history could skip it.
- ADR-0006 explicitly replaces #208's impossible unchanged-history success criterion
  with accepted fresh-lineage installation. The original failing diagnostic and
  protected bytes remain intact; existing hosted forward deployment is separate.
- No hosted migration, HTTP Auth, device or quality acceptance is inferred. Finish
  required CI/merge, then proceed to 14.1; GitHub owns exact run/merge identities.
- Local `npm run check` passed: 191 mobile, 14 catalog and 59 database tests
  (264 total), lint/typecheck and both bundles. The existing Hook warning remains;
  native operational installation is verified by the required PR CI gate.


### Atomic rating/not-interest/undo and durable outbox — 2026-09-09 / #224

- The CLI-created `*_atomic_item_actions.sql` forward adds the public invoker/private
  authorized command, private receipt/head tables with RLS and an undo-invalidation
  trigger. Current state, session, canonical Event and receipt are transactional.
  Cached replies still require current actor/Profile authorization; altered payloads
  cannot reuse an ID. Server-recorded undo predecessors prevent intervening/legacy
  updates from being erased, including changes back to the same values.
- Mobile rating/not-interest/undo enters one persisted command path before optimistic
  feedback. SQLite keys include environment/actor/Profile; FIFO retry, immutable
  payloads, restart recovery, storage failure and stale-scope callback/dispatch guards
  have deterministic tests. A rejected stale undo has an explicit discard/reload
  action; uncertain acknowledgements and permission failures remain queued.
- SQL acceptance runs on the complete source-plus-forward schema and in the required
  native CLI job. A populated old-schema rehearsal applies the exact new file with
  hosted-style global defaults and requires unchanged hashes for every existing
  application/Auth table. Rolled-back command smoke covers retry, failure after
  projection write, ordered undo, actor/member denial and trace guards.
- Correlation validates existing selected candidate + actor/Profile/session/mode +
  prior impression. Unverified IDs yield unattributed native Events; undo keeps its
  original accepted trace. This does not complete frozen client slate provenance.
- Lists/Endorsement atomicity and durable exposure delivery remain the next 14.1
  package. Their legacy detail List projection cannot overtake pending atomic
  commands. Full DATA-003/004 and real-device process-death acceptance remain open.
- Verification: local `npm run check` passed 207 mobile, 14 catalog and 61 database
  tests (282 total), lint/typecheck and both bundles. All five required jobs in
  [CI #403](https://github.com/Kajooja/Kajo/actions/runs/34402219263) passed at
  `55b025a0805e65a639295132026461a18057b020`, including the native populated forward
  rehearsal and full command smoke on the pinned Supabase stack.
- Hosted rollout: Kajo `operator-reviewed-project` accepted only the new forward under
  actual version `20260909204512_atomic_item_actions.sql`. The CLI-created filename
  was synchronized to that provider identity without changing SQL bytes; SHA-256
  `81bc4304d24dc063b04fdd567b1b1c3cc8c2a0bda4ecaff286395701b84f1cdb`.
  All 31 existing application/Auth table hashes, 123 function fingerprints, 21
  triggers, defaults and 44 old migration rows remained unchanged. All three new
  function definitions/owners/ACLs match the reviewed source; the two private RLS
  tables deny all API-role table access and only authenticated can call the command.
- Hosted command acceptance passed using rollback-only fixture DML: retry, ordered
  undo, legacy invalidation, authorization and accepted/fabricated trace cases.
  It selected an actual ranked Item for the synthetic Profile. Forced late Event
  failure was exercised only in isolated native CI, avoiding a hosted test trigger.
  The complete post-smoke snapshot matched pre-smoke state and left zero receipts
  or heads. Security advisors added only the two expected private RLS-without-policy
  INFO notices; the pre-existing [Auth password-protection WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is unchanged.
- The separate global-default forward and old tracking remain untouched. Rollback
  preserves accepted commands/evidence and uses the previous client or narrowly
  disables the new endpoint. PR #225 / #224 own final-head CI and merge evidence;
  filename/documentation synchronization is subject to those same required gates.
- No emulator/phone interaction or physical process-kill/SQLite recovery test was
  available in this workspace. Type/JS/SQL/bundle checks do not claim that acceptance.


### Atomic List/Shared commands and durable mobile integration — 2026-09-09 / #226

- Branch `feat/226-atomic-collection-actions` starts from accepted `e0d7610` (#225).
  The new CLI-created collection forward extends existing private Item receipts and
  undo heads; no old deployed file is edited. Nullable List metadata supports
  no-op/deleted-List replay without fabricating Events. The only old function change
  restricts Item undo to Item command kinds; List undo also restores membership.
- List create/rename/delete/membership and Shared proposal/endorsement/unanimity/
  pending withdrawal commit state, all transition Events and receipt atomically.
  Mixed List/rating undo and legacy membership ABA are protected. Undo corrects
  every Event of a List+Like action; withdrawal/cancelled proposals also cancel
  original Endorsement outcome reward with exact correction references.
- Mobile uses one SQLite actor/Profile/environment FIFO. List/Shared screens and
  picker show pending/errors with explicit safe rejection recovery. Confirmed
  receipts drive state, refreshes and Undo; uncertain actions cannot launch dependent
  creation/messaging or report success. Hung calls have a 20-second reply deadline.
  Old whole-state mobile writes and duplicate mutation Event calls are removed.
  After the queue drains, a guarded current-state read reconciles replayed receipts
  without overwriting newer pending actions, a newer read or another scope.
- Targeted mobile tests cover old payload compatibility, mixed FIFO/restart,
  acknowledgements, timeouts/late replies, scopes/environments, malformed receipts,
  shared consensus counts and discard authorization. SQL smoke additionally covers
  exact Entry actor/time restoration, no-op evidence, consensus late failure rollback,
  membership loss, pending cancellation, complete undo evidence and valid/fake traces.
  Actual Memory returns to zero native evidence after the mixed undone sequence.
- Populated forward rehearsal preserves every existing application/Auth/receipt/head
  column, exact old cached replies and undo. It verifies all unrelated function
  bodies/ACLs and the single intended Item guard replacement. Both rehearsals and
  collection smoke are wired into native CLI CI; all fixtures/DDL/grants roll back.
- Publication checkpoint: local full check passed 212 mobile + 14 catalog + 61
  database tests (287 total), lint/typecheck and iOS/Android bundles; the existing
  Discovery Hook warning remains. The final correction SQL also passed the full
  schema/rehearsal smoke. Required native CI and scoped hosted deployment are still
  pending at this checkpoint; the PR will own final-head run and merge identities.
- No phone/emulator or physical process-kill/SQLite test was available. Full
  DATA-003/004, late-outcome/frozen delivery and exposure acceptance remain open.
  Next after #226: exact delivered provenance plus durable exposure, then device
  acceptance and 14.2. The separate hosted global-default forward is still excluded.
- PR #227 initial CI #406 reached a CLI startup failure before application SQL
  (bounded signals: image-download/port-binding; exact cause unproven). General
  validation, platform/defaults and existing-application upgrade passed. The next
  head includes the receipt replay reconciliation and must pass all required jobs;
  no database failure is waived and no hosted DDL has been applied at this point.

- Implementation head `0d299d5157cee2d8c20b2db64405b23ff646655d` passed all five
  required [CI #407](https://github.com/Kajooja/Kajo/actions/runs/34410390133) jobs.
  Its merge-check tree exactly equals `97949e3823e2364f21054703fecab3ade3556771`;
  native CLI logs confirm reset/history/atomicity/runtime verification. The artifact
  was published by CI; a workspace download returned HTTP 403, so no local artifact
  digest inspection is claimed. Native job success/logs and exact tested tree were
  verified through GitHub. Local final check is 287 tests and both bundles.
- Hosted preflight: Kajo `operator-reviewed-project`, PostgreSQL 17.6; all 33 old
  application/Auth/receipt/head table hashes, 126 functions, 22 triggers, defaults
  and 45 tracking rows were stable. Object-key order was normalized when comparing
  connector JSON; the SQL fingerprints were identical. Existing receipt/head counts
  were zero. Security advisors remain 18 intended RLS-without-policy INFO findings
  and the existing Auth leaked-password-protection WARN.
- **Deployment was not executed:** automatic approval review rejected
  `apply_migration(atomic_collection_actions)` because it did not find explicit
  authorization for the hosted target/DDL side effect. STATUS records the exact
  source/hash/target to approve; no alternative write path was attempted. Main merge
  and current branch retirement wait for that approval plus successful deployment.
- On approval, preserve SQL SHA-256
  `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`, synchronize only
  the filename to the actual provider version, verify all old columns/125 unrelated
  functions/22 old triggers/defaults/history, the one intended Item undo guard,
  three new functions and two new triggers. Hosted smoke must omit isolated-only
  failure-injection DDL and choose an actual delivered Item for trace acceptance;
  that rollback-only variant was rehearsed locally without residue.
- Rollback must preserve accepted receipts/Events/List data and device queues. A
  narrow forward can disable the collection entrypoints while retaining pending
  commands for a corrected deployment. Do not blindly reinstall #225 over devices
  with collection commands: its old queue validator cannot interpret those entries.
  No rollback or separate global-default migration is part of this pending action.


### Approved collection deployment — 2026-09-10 / #226 / PR #227

- Owner explicitly approved the exact hosted migration and subsequent verification/
  merge. `apply_migration` succeeded on Kajo `operator-reviewed-project` with actual
  version `20260910071110_atomic_collection_actions.sql`. SQL SHA-256 remains
  `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`;
  the repository filename alone was synchronized. Do not deploy it again.
- Fresh metadata comparison preserved all 125 unrelated function definitions and
  all 126 old owners/ACLs, the exact intended Item undo guard replacement, all
  23 inventoried noninternal public/private/Auth-user triggers, global defaults,
  and all 45 previous tracking rows. Three functions, two triggers and one tracking
  row were added. Function/table API access checks passed.
- The approval reviewer rejected export of table-wide counts/data hashes during
  this fresh preflight. A safer metadata-only check succeeded. No fresh hosted
  whole-data fingerprint comparison is claimed; the earlier isolated populated
  forward rehearsal remains the data-preservation proof. No alternative path
  exported the rejected private/Auth row-derived snapshot.
- Hosted rollback-only collection smoke passed List lifecycle/membership, exact
  membership undo, mixed Item/List undo and Memory correction, repeat/no-op/denial,
  real delivered-item trace versus fabricated attribution, Shared consensus and
  pending cancellation. It selected an actual ranked MOVIE and omitted isolated-only
  failure-injection DDL. The transaction rolled back its synthetic data.
- Security advisors retain the same 18 intended RLS-without-policy INFO findings
  and existing Auth leaked-password-protection WARN. The unrelated global-default
  migration and historical tracking are untouched. No physical-device acceptance.
- CI #408 passed the prior handoff head. PR #227 owns the final filename/docs CI
  and merge result. Next is exact delivered provenance and durable exposure in
  14.1; DATA-003/004 and Sprint 014 remain open. Work continues in short checkpoints.


### Delivered navigation first checkpoint — 2026-09-10 / #228

- Continues merged #227 (`6dd1fec`), whose final CI #409 passed all five gates.
- Grid captures the visible, already overlaid sequence and source/mode/run with
  environment/actor/Profile scope and Event session. Detail pins the snapshot and
  refuses mismatched scope/session or evicted navigation tokens. Ambient visuals
  still follow global mode; event/action origin keeps the delivered mode.
- Removed the latest-media-ranking cache fallback. Direct entries remain one Item
  with fallback origin; query prediction IDs alone cannot establish correlation.
- Six deterministic regressions cover reranking, source mutation, cross-scope/
  session/Item rejection, missing hosted identity, eviction and token reuse.
- The PR owns local/full CI validation results. No emulator/phone/runtime acceptance
  is claimed. Shared item-specific overlay origin, async callback boundaries,
  durable exposure and delayed action reconciliation remain open on #228. Keep
  DATA-003/004 and the Issue open; resume this branch in the next short work period.


### Durable Event queue checkpoint — 2026-09-10 / #228 / draft PR #229

- Replaced the disposable memory Event map with the existing bounded SQLite outbox
  mechanism under a separate environment/actor/Profile key. Each entry retains the
  complete original Event and session; new sessions never rewrite older entries.
- recordEvent acknowledges only successful durable enqueue. Impression dedup occurs
  afterward, so a failed disk write can be retried. Provider layout lifecycle stops
  old coordinators and rejects stale callbacks; delayed session completion checks
  scope before starting Event delivery. No hosted schema/API change.
- Seven queue regressions replace two old memory-coordinator tests: session ordering,
  restart/lost reply, scope change during session persistence, namespace separation,
  storage failure/recovery, payload/corruption checks and timeout/late acknowledgement.
- PR owns full check/CI evidence. Physical process-death/device testing remains open.
  Exposure/action queue coordination and late outcomes are explicitly not solved
  by persisting a separate queue. Continue the same draft branch; do not merge or
  close #228 until the remaining provenance/delivery gates are met.


### Exposure/action ordering checkpoint — 2026-09-10 / #228 / draft PR #229

- Prior durable Event head `2e0c068` passed all required CI #412 jobs.
- Both Item and collection senders now check durable matching impressions before
  RPC dispatch. The exact queued command remains pending until acknowledgement;
  a restarted action can wait for its original older session's exposure.
- Five regressions add delayed acknowledgement, both-queue restart/lost reply,
  exact matching/no invented evidence, unreadable storage and stale coordinator
  coverage. Unrelated/non-predicted actions are not globally blocked.
- No hosted migration. Missing impressions and already-committed unattributed
  outcomes are not retroactively manufactured/fixed. Next: Shared per-Item origin,
  remaining async callback review and server late-outcome/runtime acceptance.
  Keep #228 and PR #229 in progress; PR owns current full-check/CI evidence.


### Shared per-Item origin checkpoint — 2026-09-10 / #228 / draft PR #229

- Prior head `dd6d86b` passed CI #413. The snapshot now captures each Item's
  ranking membership and Shared tier without private member/history payloads.
  Overlay-injected Items carry no ranking Prediction; ranked Items preserve
  the run even when the overlay changes their order.
- Grid/detail evidence and Item/collection action origins use those descriptors.
  Detail remains frozen through Shared updates. Dwell keeps its start-time
  callback/mode/origin, and undo navigation no longer borrows an unrelated run.
- Six new origin regressions cover injected pending/history, ranked reordering,
  Shared mutation/reranking, unknown origins, fallback and defensive copying.
  PR owns full-check/current CI evidence. No hosted migration or physical-device
  acceptance. Remaining: async/session boundary review, late-outcome/server
  verification and runtime acceptance. Keep #228/#229 in progress.


### Async session admission checkpoint — 2026-09-10 / #228 / draft PR #229

- Detail/picker origins capture a client-only session admission token. Event and
  explicit Item/collection admission reject mismatched sessions; explicit actions
  also reject another Item. Actual persisted session envelopes remain unchanged.
- Action dispatch, hydration and receipt projection check layout-time session
  identity. Lists/Shared completion tokens include session and unmount cleanup.
  Direct Detail remounts on session change. Destination loading/saving belongs to
  one open request, fixing close-during-save/reopen state leakage.
- Five admission regressions cover session/Item mismatch, a deferred destination
  completed through a new session, local-to-auth transition, fresh non-delivered
  actions and omission of the guard token from persisted Events. PR owns the full
  check/CI evidence. Interactive session switch, reopen and process-death checks
  remain untested. No hosted migration or server reconciliation is claimed.
- Next: missing/already-committed exposure and delayed outcome verification at
  the server boundary, then representative runtime acceptance. Keep #228/#229 open.


### Server delivery matrix / next APK checkpoint — 2026-09-10 / #228 / draft PR #229

- Added `delivery-order-smoke.sql` to PGlite and required native CLI installation
  acceptance. Fourteen cases exercise authenticated Item and collection RPCs with
  old-session delayed-valid, absent, late-arriving, post-action, wrong-session,
  wrong-mode and unselected exposure. Secondary collection Events agree with the
  receipt, and retries/undo preserve accepted attribution.
- Existing server behavior passes the targeted matrix. Late-arriving exposure
  does not rewrite an immutable unattributed receipt. No new reconciliation or
  schema migration is claimed. PR owns full-check/current native CI evidence.
- Owner is ready to download and test the next APK when explicitly notified.
  Next: exact-head native CI + standalone APK, then the checklist below. Do not
  wait in a build-poll loop. Record build SHA, artifact URL and results here/PR.

#### #228 device acceptance checklist (pending)

Use the next explicitly identified #228 APK; bundle exports and older main APKs
are not this acceptance build. Record phone/Android version, build SHA and test
time. Use a few recognizable test Items/Lists. Report each row PASS/FAIL and any
screenshots or exact unexpected behavior. The developer checks server evidence
for these operations afterward; the owner need not inspect Event IDs or SQL.

| Test | Actions | Expected visible behavior |
|---|---|---|
| Grid/detail/mode | Open a card, swipe forward/back, change global mode and reopen from grid | Stable opened sequence; the next newly opened sequence follows the new grid; no flash of another cached sequence |
| Item action/undo | Rate an Item, mark another not interested, undo in order | State and undo target remain correct; no duplicate operations |
| Lists | Create a test List, add/remove an Item and undo | One intended transition each time; consistent state on reopening |
| Close while saving | Select a List, close promptly, reopen the same Item's picker | Picker recovers and responds; no stuck saving indicator or duplicate addition |
| Offline/restart | Open online, disable network, make one action, force-close, reopen and restore network | Pending action remains visible and completes once; correct state after reload |
| Profile switch with pending action | Queue an offline action in Profile A, switch to B, reconnect, then return to A | B never receives A's action; A's pending state eventually resolves correctly |
| Shared | With an existing Shared Profile, inspect a pending suggestion, endorse, then complete consensus with the other member | Correct pending/consensus state and destination; no Personal Profile state leakage |
| Background/session | Open Detail/picker, background/foreground; also sign out/in and switch Profiles while a picker is open | Old screen either recovers explicitly or reloads correctly; stale callbacks do not advance or save into the new context |

The exact APK and all results remain pending. Dispatch limitation: the GitHub
connector has no workflow-dispatch capability and the cloud browser is signed
out. The owner can start CI using Run workflow on `feat/228-delivered-origin`.
Its APK job already depends on all five validation jobs; do not bypass those
gates or change workflow triggers merely to start a build. Keep #228/#229 and
DATA-003/004 open.


### Owner APK feedback and correction checkpoint — 2026-09-10 / #228

Expected candidate: run #417 / `e7c84a7`. The owner reported results after receiving
that download target; phone/Android/build confirmation was not supplied.

| Report | Acceptance interpretation |
|---|---|
| Cards/order worked | Owner-observed pass |
| Recommendations seemed to change after actions/undo, then did not change on repeat | Non-reproducible observation; do not invent a cause or close ranking quality |
| List addition did not remove the Item from Discovery | Confirmed product failure; named List membership must suppress ordinary delivery |
| Undo appeared to do nothing | Open; List-removal undo is not required, but retained undo must work |
| Closing while saving worked | Owner-observed pass |
| Offline/restart “seems to work” | Tentative pass; retain server evidence/device follow-up |
| Rejection showed exposure-wait error; a new choice eventually worked despite it | Normal queue wait was incorrectly presented as failure; correcting below |
| Background/login worked | Owner-observed pass |

Correction in this checkpoint: `waitingForExposure` distinguishes a local queue
dependency from an actual persistence error. The action remains pending with
normal automatic backoff; no error snapshot prematurely settles collection
waiters. Real network/storage/authorization failures remain visible. Tests verify
silent pending state, automatic retry after exposure acknowledgement, and a real
subsequent error. PR owns complete validation. No hosted migration in this part.

Next bounded package: active named-list membership in resurfacing and immediate
Discovery refresh; last-list removal/reappearance, multiple Lists, deletion and
Shared behavior; review ineffective undo and omit List-removal undo from required
UX. Preserve the existing bounded reminder interval/caps, without treating an
Item still in another List as new. Do not mark device acceptance complete yet.

Owner idea: “Mitä tänään” chooses from a saved List using the active Personal or
Shared Profile and current context, with an explicitly distinct List-card browsing
surface. Captured in FUTURE_PLAN; it is a product idea, not another reported defect.


### Named List eligibility candidate — 2026-09-10 / #228 / draft PR #229

- New forward `20260910110344_list_membership_resurfacing.sql` changes only the
  existing private resurfacing decision. It includes current target-Profile List
  entries in saved-like suppression and their latest added_at in reminder age.
  Existing native/bootstrap/terminal precedence, reminder limits and ranking
  order remain. Historical Events, receipts, tables and migration history are not
  rewritten. Policy metadata gains `listMembershipPolicyVersion: active-list-v1`.
- A collection revision changes the mobile grid request identity and forces a
  current ranking even when LIKED/interaction fields are unchanged by removal.
  Loading cannot reuse the prior grid; its late visible tokens cannot create new
  impressions. Opened Detail retains its frozen delivery snapshot as before.
- `list-membership-smoke.sql` runs in PGlite and required native CLI acceptance:
  authenticated Personal add and public ranking suppression, two memberships,
  last removal and public ranking return, List deletion, older reminder eligibility,
  terminal precedence, Profile isolation and two-member Shared consensus.
  PGlite also verifies the forward preserves function identity/ACL/security
  metadata and every unrelated definition.
- Shared nuance verified: deleting the named consensus destination leaves the
  separate SYSTEM_SAVED membership, so suppression continues. Direct Personal-style
  removal from Shared Tallennetut is rejected by existing consent rules. Do not
  relabel that as a successful final Shared removal test; withdrawal/removal UX
  still needs review together with the owner's ineffective undo report.
- No hosted deployment, hosted advisor run or new-device acceptance yet. PR owns
  current full-check/native CI. Next: exact-forward hosted rollout/verification,
  remaining undo/Shared UX correction, then a focused replacement APK.


### Hosted List eligibility rollout — 2026-09-10 / #228 / draft PR #229

- Supersedes the preceding pending-hosted checkpoint. Exact candidate SQL SHA-256
  `889e424c3ebefa4145534e2cca0a531d107947b187d7c225f6d355dcc9f26711`
  deployed to `operator-reviewed-project` as provider version `20260910110344` /
  `list_membership_resurfacing`. Repository filename aligned; SQL bytes unchanged.
- Captured the actual prior function and rehearsed its replacement in the full
  isolated PGlite schema. The manual recovery file restores its original function
  fingerprint `06da0244916a790932288371e71686a9`; recovery is a new forward migration,
  not deletion of deployed history. No recovery was applied hosted.
- Hosted metadata comparison: only the intended function definition changed;
  its owner/ACL/security/search path, 128 unrelated functions, 21 application
  triggers, default ACLs and all 46 old version/name rows remained unchanged.
  No application records were exported or whole-data parity asserted.
- The first hosted smoke rolled back on a fixture assumption: an eligible
  synthetic book need not reach the top 20 of the populated catalog. Corrected
  the probe to require exact return only with at most 20 discoverable books;
  eligibility restoration is unconditional. The corrected rollback-only hosted
  probe passed all Personal/List/reminder/terminal/isolation/Shared assertions,
  with top20ReturnRequired=false and top20ReturnObserved=false.
- Security advisors unchanged: 18 existing RLS-without-policy INFO findings and
  existing leaked-password-protection WARN. No permissions or Auth setting changed.
- Next: ineffective undo and Shared withdrawal/removal UX, then replacement APK
  and owner device tests. Keep the PR draft and DATA-003/004 open.
- Validation: full `npm run check` passed (241 mobile, 14 catalog, 61 database
  tests; both platform exports). Separate captured-prior upgrade/recovery rehearsal
  passed. Latest native CI and new device acceptance remain separate gates.


### Undo availability and Shared removal review — 2026-09-10 / #228 / #229

- Confirmed UI bug: canUndo used only stack length while the dispatch boundary
  could refuse pending collection work. Availability now uses current-session
  outbox readiness and zero pending commands; the handler also checks the current
  queue synchronously. A refused start shows feedback. The original phone symptom
  has not yet been reproduced/accepted on the replacement build.
- No List-removal undo affordance: a changed removal discards same-Item undo entries
  now behind its server head, while retaining other Items. List deletion clears
  session history because the receipt does not enumerate affected Item IDs.
  No-op receipts preserve history, and successful undo receipts do not repush it.
  Added five deterministic history/readiness regressions; server RPC semantics
  and immutable receipts are unchanged.
- Reviewed Shared withdrawal: existing REVERSE_ENDORSEMENT only handles a pending
  proposal. Completed consensus raises an explicit refusal. The Shared Saved view
  now explains that completed removal is unavailable and omits the invalid direct
  remove action. Custom Shared Lists retain direct removal; consent Saved survives.
  This is honest UI, not implementation/acceptance of completed-consensus removal.
- Next: required CI and a manually dispatched replacement APK from this branch;
  focused owner device acceptance, without build polling. Keep PR draft. Full
  completed-consensus removal needs a scoped lifecycle decision; keep it visible.
- Validation: `npm run check` passed all 321 tests (246 mobile, 14 catalog,
  61 database), TypeScript/lint and both exports. No emulator/phone test was
  available in this workspace; native CI and owner device acceptance are pending.


### Second owner device report and collection-source correction — 2026-09-10

- Owner reports b51f962 List behavior, undo (List/rating/rejection) and reconnect
  working; old choices still failed with “item not found”. This does not accept
  historical navigation or close all DATA-003/004 gates.
- Root causes found: Discovery's history tab filtered the serving recommendation
  pool that intentionally excludes consumed Items; Lists/history opened only an
  ID and Detail fell back to the mock catalog. History now uses the existing real
  collection route; collection navigation carries loaded Item snapshots into Detail.
- Collection transport is bound to Profile/session, has explicit COLLECTION origin
  and no Prediction ID, keeps consumed Items in swipe browsing, and labels the
  destination. History scope/revision keys prevent reuse across Profiles; interaction
  changes reload current history. Added two transport/order regressions.
- Pull refresh now works on Discovery, Lists and history. Green RYHMÄTILA appears
  beneath the global mode selector only for a Shared Profile.
- Remaining owner scope: multi-List addition before card advance; common cover
  grid/card selector on all Lists/history; visible rating and explicit history
  removal via atomic evidence; finish replacing ordinary retry UI. Completed Shared
  consensus removal remains a distinct unresolved lifecycle boundary.
- Owner authorizes all-Profile choice and Shared-group reset before the next test.
  Preserve accounts/catalog, review derived evidence and local outbox handling;
  reset has NOT run and no new APK is requested at this partial checkpoint.
  STATUS owns exact order and all requirements. Continue short saved work periods.
- Validation: full `npm run check` passed 323 tests (248 mobile, 14 catalog,
  61 database), TypeScript/lint and iOS/Android exports. No new device or visual
  runtime acceptance claimed; the next test waits for the remaining owner scope.


### Personal multi-destination picker — 2026-09-10 / #228 / #229

- A successful Personal List addition keeps the picker open, marks the membership,
  and allows another destination. Valmis advances once and sends no duplicate
  command/message. Each List addition is independently durable; failure on the
  second destination does not reverse the first. Close keeps committed/queued work.
- In-flight guards block repeated same-render taps. A new open request has distinct
  saved/progress identity, and stale completions cannot close it. Collection revision
  reloads no longer reset the user's message/create/expanded state. Optional messages
  attach to acknowledged additions; Done does not send them again.
- New-list creation also stays in the Personal picker after saving. Existing
  memberships are marked and cannot be added twice through the same open picker.
  Shared endorsement/proposal remains the existing single destination consent flow.
- Added a durable regression: first destination acknowledges, second fails offline,
  restart retries only the unchanged second command and preserves the first receipt.
- Next: common cover-grid/swipe selector on Lists/history, canonical history-clear
  action and remaining refresh UI. Then the already authorized all-Profile choice /
  Shared-group reset and combined device test. No reset or new APK in this step.
- Validation: full `npm run check` passed 324 tests (249 mobile, 14 catalog,
  61 database), TypeScript/lint and both platform exports. New picker interaction
  still needs the planned combined device test; no emulator/device was available.


### Shared collection cover grid — 2026-09-10 / #228 / #229

- Published the explicitly approved Personal multi-destination correction as
  `4e8e301`; remote/local publication handoff is resolved.
- Extracted DiscoveryItemCard without copying a parallel card design. Discovery,
  named Lists, Saved and Luetut/Katsotut now reuse the cover presentation. Rating
  badges render numeric zero as well as other ratings; consumed labels remain for
  unrated entries. Collection dates and original Shared provenance remain visible.
- CollectionGrid replaces ScrollView row maps with a bounded FlatList: six-cell
  initial/batch rendering, two columns and near-visible image mounting. Both List
  and history headers offer Ruudukko / Kortit; card mode opens the loaded collection
  and preserves its Profile/session/collection origin. Return goes back to that grid.
- List filters/sort, rename/delete and permitted entry removal remain available;
  completed Shared Saved removal is still explicitly unavailable. Removed obsolete
  row styles and the unused old LIST/GRID view type.
- Next: canonical atomic history-clear action, final ordinary retry/refresh UX,
  then the authorized choice/group reset and combined device test. No reset or new
  APK here; new card layout has not been accepted on a phone/emulator.
- Validation: `npm run check` passed all 324 tests, TypeScript/lint and both
  platform exports. Existing collection-origin/order tests remain passing; visual
  and gesture acceptance stays with the planned combined device checkpoint.


### History-clear server candidate — 2026-09-10 / #228 / #229

- Added atomic non-undoable CLEAR_HISTORY to the existing collection RPC; native
  rating/consumed and terminal import evidence clear together with corrective
  Events and the immutable receipt. Saved/List/interest/rejection state survives.
- Exact corrections remove every active old rating/consumption Event from Memory
  and outcome readers. No fabricated current-view attribution is attached.
- Rollback-only full-schema acceptance covers actual Memory, retry after rerating,
  no-op, stale undo, authorization, independent state and injected write failure.
  Forward metadata checks preserve all function identities/ACLs and unrelated bodies.
- Next: mobile durable command/UI wiring and reviewed hosted rollout, final
  refresh UX, authorized choice/group reset immediately before combined device test.
  Hosted database and accounts are unchanged; no APK/device acceptance claimed.
- Validation: full `npm run check` passed all 324 tests, lint/TypeScript and
  both platform exports (exit 0). Native CLI acceptance is wired for CI but was
  not executed locally; no device/emulator was available.


### History-clear mobile wiring — 2026-09-10 / #228 / #229

- Luetut/Katsotut grid exposes Poista historiasta through the existing durable
  collection action queue. Saved lists remain independent; copy explains this.
- Synchronous duplicate-tap guard, acknowledgement-driven refresh and content
  keyed by Profile/Event session protect against stale completion feedback.
- Command/receipt validation requires uncorrelated, fully cleared history state.
  Offline/restart regression verifies the exact persisted command reaches the RPC.
- Next: reviewed hosted history-clear rollout, final refresh UX, then authorized
  choice/group reset and combined device checkpoint. No hosted writes/reset/APK here.
- Validation: `npm run check` passed 325 tests, lint/TypeScript and both platform
  exports (exit 0). Phone/emulator interaction remains untested.


### History-clear hosted rollout — 2026-09-10 / #228 / #229

- Applied unchanged reviewed SQL as provider version 20260910134428; aligned the
  candidate filename without editing SQL bytes or historical tracking.
- Preflight matched the old function exactly; postflight matched the new body and
  preserved all function identities/ACLs plus 128 unrelated definitions.
- Rollback-only hosted acceptance passed Memory cancellation, import/state
  preservation, retry/rerating and authorization. Failure injection stays isolated.
- Security findings are unchanged. STATUS records hashes, recovery and exact
  next task: final refresh UX, authorized reset, combined real-device acceptance.
- Validation after filename alignment: full `npm run check` passed all 325 tests,
  lint/TypeScript and both platform exports (exit 0). Device acceptance remains open.


### Ordinary pull-refresh completion — 2026-09-10 / #228 / #229

- Added native pull refresh to the List index and vertical overscroll support to
  Discovery/collection grids. Shared refresh reflects both read requests.
- Replaced ordinary load retry buttons with pull guidance in Discovery, Lists
  and consumed history. Durable command recovery remains intact.
- Next: authorized all-Profile choices/Shared-group reset with stale-client queue
  protection, then combined device acceptance. No reset/APK performed here.
- Validation: full `npm run check` passed 325 tests, lint/TypeScript and both
  platform exports (exit 0); actual pull gestures remain device acceptance.


### Reset rehearsal and portable device handoff — 2026-09-10 / #228 / #229

- Runtime head 2cb204f passed CI #429. Prepared DEVICE_TEST.md with manual branch
  APK instructions, reset prerequisite and eight owner scenarios; linked in docs map.
- Rehearsed owner-device-reset.sql twice on hosted with ROLLBACK. Fresh Personal
  IDs reject old rating/collection/Event-session writes while preserving accounts,
  catalog and Personal custom List names; empty new Profiles can rate normally.
- Permanent COMMIT was rejected by automatic approval review as broader than the
  prior choices/groups permission. No data was reset. STATUS records exact scope
  and next approval/action so another conversation can continue without chat.
- No schema change, new app code, APK dispatch or device acceptance in this step.
- Final handoff validation: full `npm run check` passed 325 tests, lint/TypeScript
  and both platform exports (exit 0).


### Approved reset committed — 2026-09-10 / #228 / #229

- Owner explicitly approved the full identity/history/group reset; the earlier
  automatic-review block is resolved. Ran the reviewed transaction with COMMIT.
- Independent post-commit verification at 14:19:19 UTC: 2 Users, 2 new Personal
  Profiles, no Shared groups/Events/interactions/List entries/imports/receipts/
  Predictions. Accounts/catalog/Personal List names were preserved.
- Old Profile-bound replay was denied and new Profile writes succeeded in the
  transaction's rolled-back probe. No repeat reset; DEVICE_TEST.md and STATUS
  now direct the next conversation to the manual branch APK and owner tests.
- No app changes, APK dispatch/polling, merge or device acceptance in this step.


### Owner device feedback, documentation only — 2026-09-10 / #228 / #229

- Recorded numbered results in DEVICE_TEST.md; installed APK SHA/run unspecified.
  Core flows work, including multi-list saving, history removal, refresh, durability
  and scope switching. Initial-profiling ratings are missing from history and
  appear in Shared cards; determine the actual tier/evidence semantics before fixes.
- OnePlus destination picker overlaps bottom navigation. Fix after evidence parity;
  preserve accepted list/history behavior and new test data (no additional reset).
- Longer profiling proposal (~10 movies + 10 books with transition card) is recorded
  in LAUNCH_LOOP/Phase 15.0, with current calibration impact to be evaluated.
- Deferred invitation reveal/copy-link idea belongs to Phase 16, not this sprint fix.
- User explicitly requested no implementation now. STATUS gives the next
  “jatka reposta” order. No code/database changes, APK build, tests or merge performed
  for this documentation-only feedback update; prior checks remain historical.

### Initial-history and OnePlus correction — 2026-09-10 / #228 / #229

- Continued the explicit next-conversation handoff. Both consumed history and
  Shared member overlay omitted bootstrap evidence; a read-only hosted check
  confirmed the missing-history case without resetting or altering user data.
- Added one private native/terminal-bootstrap read projection and authorized
  hydration RPC; reused it for history, List badges and accepted-member Shared
  attribution. Native edits take display precedence, zero remains valid, and
  reads never synthesize Events or Shared state. Existing clear/undo/Memory and
  suppression contracts remain intact.
- Added full-schema calibration/import/native/Shared/privacy/clear regression
  and unchanged populated-forward rehearsal. Both are in required native CLI CI.
  Hosted preflight matches all three old target definitions/owners/ACLs.
- Fixed picker safe-area/dock clearance and keyboard/scroll behavior through a
  shared dock constant; book member-history labels now say lukenut/lukeneet.
- Evaluated the longer profiling request in LAUNCH_LOOP: current server supports
  20 balanced opportunities, but progression/order/stop behavior needs its own
  versioned Taste change in Phase 15.0. No forced repeat or higher known-rating
  minimum is introduced in this correction.
- `npm run check` passed 326 tests (251 mobile, 14 catalog, 61 database), lint,
  TypeScript and both platform exports. No local phone/emulator; focused device
  cases are in DEVICE_TEST. Publication, new-head native CI and hosted rollout
  are pending at this checkpoint; STATUS owns their current state. Keep draft,
  preserve new test data, and do not infer DATA-003/004 or phase acceptance.


### Initial-history rollout verified — 2026-09-10 / #228 / #229

- Published implementation `b8ff101` has the exact locally tested tree
  `00c5872bc4b82580f8fa1f682f1b8042f46e405f`. All five required CI #434 jobs passed,
  including native CLI calibration/history behavior and populated-forward checks.
- Applied only the reviewed read-functions forward as actual provider version
  `20260910153737`; SQL SHA-256 remains
  `40a6e3b32fe6e1555acb2ac85293b8235484f737c08d50172ddf6d19272b24b9`.
  Aligned the filename using the same SQL bytes; historical migration files remain
  unchanged. The new mobile hydration RPC is now available.
- Postflight preserved all 129 old function identities/owners/ACLs, 126 unrelated
  definitions, inventoried triggers/defaults and 48 previous migration identities.
  Three new functions and three replacement definitions match the source exactly.
- Unmodified rollback-only hosted history probe passed; a separate read confirmed
  initial history coverage and no fixture Item/Shared residue. Security advisor
  findings are unchanged. Real user data was not reset; no whole-data parity claim.
- STATUS owns the exact recovery procedure and next APK checkpoint. CI #434 skipped
  APK building by design; no new APK was dispatched or polled. Draft/owner device
  acceptance and full DATA-003/004 remain open.

### Owner-requested repeat test reset — 2026-09-10 / #228 / #229

- After the correction rollout, the owner explicitly requested the same full
  reset again to rerun the tests. This supersedes the earlier preservation
  instruction; it is not a reset caused automatically by the new app version.
- Scoped the retained operational script to the current Profile identity digest,
  added Auth-record preservation and both accounts' real calibration-API checks,
  rehearsed with ROLLBACK, and committed the exact reviewed transaction.
  The published script uses a blocking placeholder instead of the private digest;
  any future authorized use requires an independently reviewed current scope.
- Independent verification at 15:54:09 UTC: 2 accounts, 2 new PersonalProfiles,
  zero choices/bootstrap evidence/Events/List entries/imports/receipts/Predictions/
  Shared groups/invitations/messages. Both accounts can start calibration again.
  Auth/nicknames/catalog and 2 Personal custom List names survive. Old Profile-bound
  replay is denied; a new-Profile rating succeeds only in a rolled-back probe.
- STATUS and DEVICE_TEST now start from this second reset. Preserve subsequent
  legitimate test data unless the owner asks again. No schema/app change, APK
  dispatch/polling, merge or additional device acceptance in this checkpoint.
- Validation: `npm run check` logs confirm 326 passing tests, lint/TypeScript and
  both platform exports; hosted reset rehearsal and independent app-API checks
  passed. The two existing duplicate-import lint warnings remain unchanged.

### Second device feedback and destination correction — 2026-09-10 / #228 / #229

- Owner reports initial profiling/reset, initial history/edit/undo, history removal
  and Shared attribution working. The requested source was `621a03c`; the installed
  APK/run remains unspecified. OnePlus picker alignment and first-destination
  creation remained failing cases; record the next exact build during retest.
- Replaced the destination picker's separate native Modal with an overlay inside
  the shell content bounds above the dock, matching Inbox's bottom gap. Retained
  keyboard avoidance, scrolling and Back/close/confirmation controls.
- Read-only action inspection confirmed create-List immediately triggered Shared
  endorsement. Creation/selection now prepares a draft; sole/new destinations
  select automatically, optional message requires a usable target, and explicit
  Add/Propose is the only Item mutation. Shared failures keep the Item and draft;
  acknowledgement precedes advancement. Personal multi-List addition remains
  available; a message error is reported without undoing the successful List add.
- Owner accepts equal-score variation. Existing 30-minute exposure cooldown also
  explains refresh rotation; a bounded hosted trace read found expected descending
  unequal-score order. Added SQL regressions for unchanged taste priorities,
  exposure rotation/expiry and Profile isolation; serving SQL remains unchanged.
- Added draft-selection regressions for no destination, sole/new selection,
  refreshed ordering, already-saved Personal choices and creation/refresh races.
- Added the always-available unknown action after wheel movement to LAUNCH_LOOP
  and Phase 15.0 alongside longer Taste progression. Current calibration remains
  unchanged. No reset, migration, APK dispatch/polling or merge in this correction.
- STATUS/DEVICE_TEST own the next narrow APK gate. Physical layout/keyboard and
  the full device create→message→proposal flow still need owner acceptance.
- Local validation: `npm run check` passed 333 tests (256 mobile, 14 catalog,
  63 database), lint/TypeScript and both platform exports. Existing duplicate-import
  lint warnings remain unchanged. Publication/final-head CI belong to the PR.

### Owner ideas and rating-position report — 2026-09-10 / #228 / #229

- The owner reports the next APK is building and will test it when ready.
  Runtime remains `07b12ea86f3952844d475de9e8f02670a8381ffb`; this entry and its
  related canonical updates are documentation only.
- Recorded personal category statistics as FUT-UX-001 / #230: drawer/Profile
  destination, independent unlock, rated/mean/not-interest/List totals, working
  thresholds of 30 initial reactions and five new reactions per category/week,
  Monday countdown/snapshots, source deduplication and conditional comparisons.
  The earlier suggested 50 remains a tunable alternative.
- Recorded long-press multi-select as FUT-UX-002 / #231: upper-left checkbox,
  Discovery reject/List-add and List move/remove, accessible selection, preserved
  per-Item origin, atomic moves and partial/durable/Shared permission semantics.
- ROADMAP places both as separately scoped Phase 17.0 candidates, with weekly
  stats/comparisons dependent on 17.1/17.2. No new MVP blocker, future feature
  implementation or change to the current Phase 14 dependency order.
- Added the owner's current Katsotut card report to STATUS/DEVICE_TEST/UX: start
  the rating handle at the saved value, including 8 and 0. Existing control/prop
  initialization already expresses that rule; history versus Detail hydration
  needs reproduction before asserting a root cause. The report remains open.
- Local execution became unavailable (environment disconnected). Source inspection
  and document consistency checks used the exact GitHub branch snapshot; no new
  runtime test or npm check was run. The prior 333 tests apply to the unchanged
  runtime only. No APK dispatch/polling, merge, migration or reset.

## Third APK result and multi-destination correction — 2026-09-10 / #228

The owner reports the APK tested with only multi-List selection missing; exact
installed SHA/run was not supplied. Both Profile types now expose checkboxes and
one confirmation. Personal uses existing durable per-List commands with retained
unresolved choices. Shared binds the exact reviewed set, displays every target to
approvers and atomically commits all memberships/Events at unanimity. Creating a
List preserves earlier checks and never advances the card. Remaining messages
stop if the scoped view unmounts.

The new forward adds a private destination relation and six functions; four old
function definitions are intentionally replaced with identities/owners/ACLs kept.
Both legacy endorsement RPCs reject hidden multi-List consent. Full-schema tests
cover second-List Event failure rollback, exact replay, unchanged old receipts,
foreign/duplicate targets and whole pending cancellation when any target is deleted.
The populated-upgrade rehearsal preserves existing data/old function boundaries.
`npm run check`: 338 tests (261 mobile, 14 catalog, 63 database), lint/TypeScript
and both exports. Native CI and hosted rollout belong to the live STATUS checkpoint;
no local Docker/device runtime is claimed. DEVICE_TEST owns the next manual APK
cases; preserve current test data and let the owner start its workflow.

Issue #232 records required SharedRatingRound/rewatch semantics in the canonical
domain, evidence, prediction, UX and launch documents and `MVP-SOCIAL-007..009`.
Personal setup precedes joint responses; A’s rating is pending until the required
others answer; only completion enters joint history. Individual responses and
Personal history remain separate, and new experiences preserve earlier history.
Strong member-seen recommendations and controlled rewatch require a versioned,
validated policy. Phase 14 establishes correctness; Phase 16.3 delivers the full
flow before beta. No round API/schema/UI or rewatch-policy change is implemented
in this multi-List correction. Optional #230 statistics and #231 multi-Item actions
retain their Phase 17 candidate status.

### Publication gate — CI passed, hosted approval blocked

Implementation `e4a28bfae6e9edaa507242e4374d4d9ca0dd971a`, exact locally tested tree
`cd71b7035b31be4cac1daba1e8860fb3341bb573`, passed all five required jobs in
[CI #442](https://github.com/Kajooja/Kajo/actions/runs/34515831721); APK skipped.
Automatic approval review then rejected the exact hosted `shared_list_destinations`
forward: it classified the table/security-sensitive function changes as a shared
database mutation without explicit owner authorization, despite code publication
being authorized. No alternative mutation path is allowed. The forward remains
undeployed and needs a direct owner approval; the new app’s overlay v2 depends on
it. Keep the PR draft, preserve current data and complete no new APK acceptance
claim. STATUS records the exact SQL hash/target and post-approval continuation.

### Owner approval and hosted multi-destination rollout — 2026-09-10

The owner explicitly approved the previously blocked hosted migration. Applied the
unchanged reviewed SQL on `operator-reviewed-project`; provider version/name is
`20260910190243_shared_list_destinations`, SHA-256
`c6196e699b3720755652f6b61c7dc8776333be0ebce1df592e6487d828757b4f`.
Aligned only this new filename to the provider record, without altering SQL or old
history. Native CI #442 already passed the identical implementation/forward.
After alignment, npm run check again passes all 338 tests, lint/TypeScript and
both iOS/Android exports.

Postflight preserves all 132 old function identities/owners/ACLs/security settings,
128 unrelated definitions, 32 old table identities/ACLs/RLS and creator defaults.
Four intended replacements plus six new bodies match source. Sixteen existing
application/Auth/history/List data fingerprints and counts are identical before,
after and after the rolled-back authenticated command probe. That probe passes
exact consent, two-List atomic consensus, forced second-List Event failure/retry,
old receipt replay, whole pending cancellation and outsider/legacy rejection.
No fixture trigger or destination rows remain; new private data/internal-core
access is denied and authorized overlay v2 works. Advisors report expected
private-table RLS-without-policy INFO; the existing Auth password warning/old FK
notices do not change this rollout’s access contract.

The earlier approval block is resolved. The owner may start the manual APK workflow
on the active branch and test the four DEVICE_TEST cases with both accounts on the
new build. No reset or local Docker is required. No APK was dispatched/polled and
no phone or merge acceptance is claimed. Retain server consent guards if reverting
the client; prefer a narrow corrective forward over erasing pending/history data.

### Late Outcome continuation while owner APK runs — 2026-09-10

The owner started manual APK CI after the multi-destination deployment. Its
requested source is `50bd1a8dd20f6ab617c266599be185d8b8d42412`; actual run/installed
SHA and four-case device result have not been supplied. No APK dispatch/poll,
account reset, hosted mutation, mobile edit or merge was performed in this step.

Closed the next bounded Phase 14.1 source gap: already committed unattributed
actions previously stayed absent from ScenarioMemory/SleepLayer even after their
exact pre-action impression arrived. The new CLI-generated forward is
`20260910192630_late_outcome_attribution.sql`, SHA-256
`36cffca7490bc46ba94882de52def69c1d0618cea0e4a33175d70bccb5256d9b`.
It adds one private invoker read helper and replaces only the serving/evaluation
readers, preserving existing function identities/owners/ACLs. Exact private
receipt ownership, original actor/Profile/Item/session/mode, selected run and
actual impression are required. Raw Events/receipts and old evaluations stay
unchanged. Both consumers use the same versioned attribution rule and existing
reward/priority/undo semantics; evaluation records its separate evidence-read
cutoff without modifying frozen prediction inputs.

Validation: `npm run check` exits 0 with **338 tests** (261 mobile, 14 catalog,
63 database), lint/TypeScript and both iOS/Android exports. Extended the existing
14-case full-schema delivery matrix to verify effective attribution. The new
`late-outcome-smoke.sql` exercises actual Shared serving and frozen-shadow labels
before proof, after proof and after undo, including zero rating, occurrence/read
cutoffs, wrong member/Profile/Item, duplicate impressions, forged receipt IDs and
unchanged historical results. `late-outcome-upgrade.mjs` applies the unchanged
forward over populated synthetic data including a real prior receipt, checks data
and old function boundaries and rolls back. Open creator defaults do not expose
the helper; a missing installed source anchor fails and rolls back partial DDL.
Both full-schema acceptance and populated upgrade are wired into required native
CLI CI. There is no local Docker, emulator or phone; native CI for this new source
and its separate hosted rollout remain pending at publication.

Continue the same #228/#229 handoff. Hosted stays on the accepted multi-destination
forward while the owner completes that APK test. Then verify required native CI
and prepare a separately reviewed exact-SQL rollout. Keep physical recovery and
remaining Phase 14.1 gates open before Phase 14.2; no SharedRatingRound, Stats or
multi-Item feature starts ahead of those dependencies.

### One-confirmation Personal Lists and queue latency — 2026-09-10

The fourth owner APK report says the rest is good but adding to two Lists feels
frozen and Personal Add must save the entire selection and open the next card
without Valmis. Requested prior source was `50bd1a8`; actual installed SHA/run and
timed device measurements were not supplied. Preserve that distinction and the
existing profiles/data; do not repeat account resets or dispatch/poll APK CI.

`commitPersonalListDestinations` now freezes the user's choice, awaits the existing
durable per-List acknowledgements and invokes completion once. The sheet removes
Done, displays confirmed progress/activity and suppresses intermediate destination
reloads. A partial failure keeps acknowledged saves and unresolved choices; only
newly acknowledged destinations receive optional messages, and scope changes stop
old callbacks/later commands. Shared continues through its existing exact-set
proposal/consent path.

The Event coordinator reuses a session only after its actual server acknowledgement,
with a fresh confirmation after restart/new scope. Six impressions need seven
session/Event writes instead of twelve. A scoped acknowledgement subscription wakes
only actions waiting for exposure, including acknowledgement while the waiting
result is still in flight. The guard rereads durable dependencies; network failures
keep backoff and rejected/stopped actions do not resume. No Event/command identity,
server API, migration or hosted data changed in this step.

Validation: 44 focused tests pass; `npm run check` exits 0 with **347 tests**
(270 mobile, 14 catalog, 63 database), clean lint, TypeScript and both platform exports. No
Docker/phone/emulator or measured physical timing is claimed. DEVICE_TEST records
the short one-confirmation/responsiveness/recovery/Shared regression for the next
owner-started APK. Native CI for this client source remains a publication gate.

Separately verified all five required CI jobs for algorithm commit
`316bd0858972e2e7bc4abc2d3e2360c89c83a97f` at
[run 34521599718](https://github.com/Kajooja/Kajo/actions/runs/34521599718), including
the native CLI late-outcome serving/evaluation and populated-forward probes.
That forward's tested SQL/hash is unchanged and still undeployed. Continue its
own reviewed hosted rollout plus remaining Phase 14.1 device recovery gates
before Phase 14.2. No merge, automatic APK action or distant feature work occurred.

### Frozen serving/shadow replay while APK acceptance is deferred — 2026-09-10

The owner explicitly deferred the Personal Add/latency APK regression and asked
continued development. Required client CI is now verified on
`1102d92e25ac973909b073fdcdaa8f2cdc9fcf22`,
[run 34524399404](https://github.com/Kajooja/Kajo/actions/runs/34524399404), all five
jobs successful. No APK dispatch/poll, reset, hosted mutation or merge occurred.
This checkpoint prepares the independent Phase 14.2 correctness slice; Phase 14.1
rollout and physical recovery gates remain open, and neither phase is accepted.

The full-schema reproduction gave the baseline Shared candidate −1.0406 in
serving and 0.1 in shadow because common-fit was omitted. Shadow also scored from
rounded display features and ignored resurfacing eligibility/tier ordering. The
CLI-generated forward `20260910202244_frozen_prediction_replay.sql` (SHA-256
`4ff3feab61d522d4763a63c23c7da8454d32322c7326c5b833b4db52f768dd7a`)
adds three private pure helpers and replaces five installed bodies with guarded
anchors. It changes no table data, existing identities/ACLs or immutable genomes.
The baseline generator, assigned scalar scorer, final serving and shadow share
full-precision scoring, including frozen Scenario/common-fit inputs. The run's
recorded genome controls both scalar and Scenario weights. Shared reminder-cap
and delivery-tier helpers preserve ordinary-before-reminder order and suppress
ineligible cards. The challenger recalculates its reminder choice from frozen
pre-cap input and its scalar weights.

Versioning is explicit: new raw inputs `prediction-features-v2`, serving policy
`+frozen-replay-v2`, shadow/evaluation `shadow-replay-v2`, comparison scope
`FROZEN_SOURCE_POOL`. Original traces/evaluations remain intact; pending legacy
jobs fail diagnostically and new comparisons exclude incompatible old shadows.
They are never reconstructed from later catalog/taste/member state. No automatic
promotion or accuracy claim is introduced.

The new full-schema `frozen-replay-smoke.sql` checks 18 Personal/Shared × three
modes × three page sizes with exact score/rank/policy/selection equality, nonzero
Scenario/common-fit, raw precision boundaries, deterministic ties, suppression,
one-reminder cap, an actual challenger reminder flip and later-state isolation.
An independent accepted-formula check uses 1e-12 arithmetic tolerance. The
`frozen-replay-upgrade.mjs` rehearsal preserves populated data, durable receipts,
old frozen shadows/evaluations, raw baseline scores across modes and all existing
function identities/ACLs/unrelated bodies. It verifies closed helper access even
with open creator defaults, diagnostic legacy-job failure and exclusion from a
new evaluation. A divergent source anchor rolls back all changes. Both probes
are wired into required native CLI CI; the prior late-attribution smoke accepts
its version token with the added replay suffix.

Repository gate: `EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **348 tests**
(270 mobile, 14 catalog, 64 database), clean lint/TypeScript and both platform
exports. New-head native CLI CI and the separate hosted rollout remain open gates.
There is no local Docker, emulator or phone. Hosted remains on multi-destination
`20260910190243`; the unchanged late-outcome forward must precede this new forward.

Next source work is the bounded baseline-top-50 starvation/eligibility/refill
reproduction and correction (`MVP-ALG-003`). This slice only proves parity on the
frozen source pool; empty/refilled pools, zero-result worker behavior and rollout
acceptance keep `MVP-ALG-002` open. Preserve Phase 14.1 recovery gates, the deferred
APK cases and the same draft #228/#229 handoff.

### Native replay precision correction — 2026-09-10

CI on `99bdecc` passed four required gates but failed native populated-upgrade
baseline-score equality in run 34527872429. The same failure is reproducible in
PGlite with `extra_float_digits=0` or -1: JSON construction rounds float inputs,
although the old direct scorer retains the binary value. V0 now pins
`extra_float_digits=3` in its own function configuration, restoring the caller's
setting on return. Existing identities/owners/ACLs and every other configuration
remain unchanged. Exact baseline equality is retained, not replaced by tolerance.
The complete upgrade/replay tests run with both rounded and precise callers;
native CLI acceptance explicitly exercises a rounded caller as well.

The still-undeployed replay migration was corrected in place; its current SHA-256
is `22d42dce06240092faec75550adcf70de75846079ac48ade0a80231671511f4a`.
The preceding checkpoint's hash identifies the earlier undeployed revision.
`EXPO_OFFLINE=1 CI=1 npm run check` passes all **348 tests**, lint/TypeScript and
both platform exports. Native CI for this correction is still required. No
hosted mutation, APK action or phase acceptance is implied; candidate availability
remains the active continuation.

### Candidate admission and empty replay — 2026-09-10

Owner instruction remains to continue development while the Personal Add/latency
APK regression is deferred. Same branch `feat/228-delivered-origin`, draft #229 /
Issue #228; accepted main `6dd1fec` and all hosted/device acceptance gates remain.

The new full-schema fixture first reproduces the defect on preceding source:
70 consumed high-fit Items fill raw baseline top-50 and public ranking returns
zero although 24 ordinary alternatives exist. This occurs in all 12 Personal/
Shared × BOOK/MOVIE × DiscoveryMode requests. The forward moves canonical
admission before retention and reuses that decision during scalar scoring; all
12 requests then deliver 20. Ordinary Items precede reminders and suppression;
the genome still chooses at most one reminder from its frozen retained pool.

CLI-created forward `20260910210520_eligibility_first_candidate_pool.sql` is
**undeployed**, SHA-256
`92bf98666e22c62873d54a74c586b4deddbc0cc0daff168c8dcd0e65a40b7b46`.
It replaces five existing bodies through guarded anchors and permits zero in the
shadow result-count constraint. It adds no tables/functions and preserves public
signatures, genome weights and historical data. New source policy and admission metadata use
`eligibility-first-v1`; counts/ranks identify the baseline-admission stage.
V0 retains at most 50 and expensive Scenario/common-fit plus persisted traces
retain at most `min(50, 3 × requested limit)`. All-suppressed and explicit empty
source controls complete with zero hypothetical selections. Automatic challenger
queueing still omits an empty pool. Pre-admission frozen v2 sources remain replayable.

`candidate-pool-smoke.sql` checks 36 Profile/domain/mode/limit combinations, two
mixed-domain pools, four exhausted and four empty controls. It verifies available
Items below the old top-50, member-Personal consumption versus Shared eligibility,
one-reminder limits, bounded traces, exact baseline scores/ranks/selection after
later consumption/catalog changes and denied outsider/missing-actor calls. No
synthetic Events or historical trace rewrites occur. The populated upgrade keeps
application/Auth/receipt rows and old frozen results, every existing function
identity/owner/ACL/configuration and unrelated constraint; old v2 replay remains
exact. Unexpected source rolls back the constraint and all prior replacements.
Both runtime and populated probes are wired into required native CLI CI.

CI for the preceding precision correction `5b9efd3` passed four required gates;
run 34529961511's native job completed the populated SQL but failed parsing a bare
UUID emitted by fixture `SELECT set_config`. Setup now uses `DO` / `PERFORM` with
no output. Both local probe adapters reject non-snapshot rows, closing the gap
where PGlite silently filtered output that native CI rejected. The precise replay
migration bytes and exact-score assertions remain unchanged.

`EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **349 tests** (270 mobile,
14 catalog, 65 database), clean lint/TypeScript and both platform exports.
New-head required CI remains to be observed. No local Docker/phone/emulator,
hosted mutation, reset, APK dispatch/poll or merge occurred. Hosted stays on
`20260910190243`; rollout dependencies are late Outcome attribution → precise
frozen replay → candidate admission, each still subject to its reviewed rollout.

This is a suppression-admission correction, not completion of `MVP-ALG-002..003`.
The existing full-catalog feature scan remains and admission now runs before the
cutoff; bounded indexed retrieval, independent Shared/novelty/Scenario sources,
cost/quality evidence and duplicate-free continuation remain open. Next source
slice is the versioned server/client continuation and empty-result contract:
the client currently treats an empty array as failure. Keep Phase 14.1 recovery
and deferred Personal two-List APK gates; no release checkbox is closed here.

A bounded local cost diagnostic also compared unchanged versus admitted full-schema
Personal `FOR_YOU` calls with 100, 1,000 and 5,000 ordinary MOVIE Items and no taste
history. Median of three warm PGlite samples after one warm-up: **50 → 47 ms**,
**115 → 144 ms**, **387 → 609 ms**, respectively. Each returned 20 and rolled back
its trace. This is a WASM fixture measurement, not hosted/device latency or a scale
acceptance result. It confirms that evaluating admission across the entire catalog
has a growing cost; indexed bounded sources remain necessary.

### Native candidate/replay acceptance — 2026-09-10

Implementation head `9fb48c286ecbcd6c706427819fadb61500dccb5c`, tested tree
`06691e988bff49a51a5913410be9941c22dbd461`, passed all five required jobs in
[CI run 34531767919](https://github.com/Kajooja/Kajo/actions/runs/34531767919).
The native CLI job 103054841812 reports `KAJO CI CLI INSTALL PASS` on pinned
Supabase Postgres `17.6.1.167`, image
`sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f`.
This includes rounded-caller replay precision, populated replay/admission upgrades,
runtime parity/admission/empty controls, repeated fresh installs, failed-migration
atomicity, defaults and unchanged native platform boundaries. The two preceding
native failures are resolved; no tolerance or gate was weakened.

This follow-up changes documentation only. Source/SQL bytes match the accepted
implementation head. Hosted rollout, physical device acceptance and the remaining
`MVP-ALG-002..003` retrieval/continuation gates remain open. Continue from STATUS's
versioned server/client continuation and empty-result slice on the same draft PR.


### Owner acceptance update and continuation contract — 2026-09-11

- Owner reports exercised tests working. Fresh/empty-account state could not be
  tested because additional accounts are unavailable; no cause or exact APK SHA
  is inferred. Future small-group reset/testing stays deferred; preserve data now.
- Extended planned #231 to history long-press/multi-select/trash, replacing the
  permanent removal label only after implementation. No selection code changed.
- Specified the next Phase 14.2 result/continuation contract in PREDICTION_MODEL:
  identifiable empty runs, immutable retry identity, bounded scoped cursors,
  distinct source-window exhaustion and per-page Prediction origins. Acceptance
  matrix is explicit; server/client implementation remains the next source task.
- Documentation-only checkpoint; no new runtime tests, hosted rollout, reset, APK
  polling or merge. Prior source 9fb48c2 passed 349 tests and all five CI gates.


### Identified first-page source boundary — 2026-09-11

Continued #228 / draft #229 on `feat/228-delivered-origin` after the owner’s
positive report for exercised device cases. Fresh-account/empty-state device
acceptance remains untested; current data is preserved.

CLI-created, undeployed `20260911070959_identified_prediction_page.sql`, SHA-256
`caf66c1e5558632e9dab78a538237d3e99594b41fa703b87f237b560445c4e08`,
adds a versioned first-page RPC. The prior scoring body is reused unchanged except
for its server-supplied run identity; legacy public row responses remain unchanged.
Private request receipts make exact retries immutable and reject changed payloads;
current membership is checked and locked even for cached responses. Request-ID
advisory locking serializes retries, and trace/receipt writes share a transaction.
Empty results retain actual PredictionRun identity and distinguish suppression
from a domain-empty catalog. Explicit `continuationSupported: false` advertises
that this slice does not implement cursors or switch the mobile reader.

Full-schema checks cover exact old scoring/public-wrapper preservation, guarded
source rejection, ordered unique origins, retry after catalog mutation, malformed
requests and changed payloads, six mode/domain suppressed empty runs, empty catalog,
revoked/outsider authorization, private ACLs and rollback after an injected receipt
write failure. `prediction-page.mjs` supplies the same rollback-only SQL probe to
PGlite and required native CLI CI. `EXPO_OFFLINE=1 CI=1 npm run check` exits 0:
**350 tests** (270 mobile, 14 catalog, 66 database), lint/TypeScript and iOS/Android
exports. Native CI for this new source, a populated upgrade preservation probe
and real multi-connection race validation remain open. No hosted deployment,
reset, APK dispatch/poll, device test or merge occurred.

Next: validate those native/populated gates, then implement the bounded immutable
continuation window and captured-scope client contract in PREDICTION_MODEL. Deploy
this fourth pending forward only after late Outcome attribution → frozen replay
→ candidate admission. Keep Phase 14.1 recovery/device gates and scalable retrieval
open. STATUS owns current branch/next action; CODEMAP includes the new paths.


### First-page upgrade and concurrency verification — 2026-09-11

Prior source `c7a4dddad31b54305a24fb0a71111d134e2ed191` passed all five required
jobs in [CI run 34573673279](https://github.com/Kajooja/Kajo/actions/runs/34573673279),
including native first-page behavior and CLI migration history. APK was skipped
as expected; no device or hosted acceptance is inferred.

This bounded follow-up changes test infrastructure only. The populated upgrade
probe in `prediction-page.mjs` fingerprints every existing application/Auth-user
table and preserves old function identities/owners/ACLs/configuration, unrelated
bodies and constraints. It permits exactly three added function identities,
checks no unsolicited receipts, and executes both public ranking contracts after
upgrade. It runs in the existing full-schema PGlite test and in native CLI CI.

`prediction-page-concurrency.mjs` uses independent native sessions through a new
asynchronous SQL adapter in the already owned, image-verified CI stack. The adapter
has 10-second statement and 30-second process timeouts, bounded output and no
external database URL. Each of two cases requires observing an actual ungranted
advisory lock for the waiting request: identical retry must return the same response;
changed-payload reuse must reject. Two accepted requests must create exactly two
receipts and two new runs. Synthetic committed fixture data is removed by the
next existing CLI reset; the normal complete-snapshot comparison follows it.

`EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **350 tests** (270 mobile,
14 catalog, 66 database), lint/TypeScript and both exports. The expanded populated
upgrade probe passes locally. New native concurrency and populated upgrade CI
results remain pending; PGlite is not evidence of concurrent execution. No runtime
migration bytes, hosted data, app behavior or APK were changed. All four pending
forwards keep their existing order and hashes.

Next: inspect this head’s required CI, fix any native probe failure, then continue
bounded immutable continuation windows and the captured-scope mobile contract.
Keep #229 draft; no merge, reset of hosted users or APK polling. STATUS remains
the continuation authority.


### Client first-page response validation — 2026-09-11

The new verification source `1a07dd5` reached CI run 34574927760, but its platform
stack failed at startup with `image-download,port-binding` diagnostic labels before
application SQL. These are observed symptoms only. Native populated-upgrade and
concurrent-retry acceptance remains pending; skipped downstream jobs are not passes.

Continued the independent client boundary while preserving the undeployed server
contract. `predictionPageOperations.ts` creates an immutable captured request/context
for reuse across transport retries, normalizes UUID scope and consumes the server's
identified first-page envelope. It verifies Profile/session/mode/domain/request/run,
ordered unique Item origins, source counts, size, availability and explicit unsupported
continuation. Valid empty responses preserve the server run ID; transport, auth and
malformed responses remain errors. The helper does not fabricate Predictions or
silently call another endpoint. The active legacy reader also now rejects duplicate
Items/ranks, wrong-domain responses and over-limit results, and copies Item tags.

Twenty-four new boundary tests cover normal/empty results, captured scope mismatches,
malformed/ambiguous rows, counts/capabilities, immutable requests after caller mutation,
exact retry and errors. Two legacy regressions cover duplicate origins/ranks and
wrong scope/size. `EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **376 tests**
(296 mobile, 14 catalog, 66 database), lint/TypeScript and both exports.

No server migration bytes or hosted data changed. The new reader is not activated
in `usePredictionRanking`; bare-empty legacy responses still error. No live runtime,
phone/emulator, hosted rollout, APK dispatch/poll or merge occurred. This is client
response parsing, not delivered pagination or empty-state UI. Next: clear native
upgrade/race gates, implement bounded immutable server continuation windows and
per-page runs, then activate captured-scope append/empty rendering and validate
per-Item origins on device. STATUS owns exact continuation; #229 remains draft.


### Bounded frozen continuation source — 2026-09-11

Prepared CLI-created forward `20260911074543_prediction_continuation_windows.sql`,
SHA-256 `1dad709b42d2072ea93166dccd846f01a91f6435763f1687c95d0b676358e415`.
It is the fifth undeployed forward, after the identified first-page boundary.
Source `91d07ee` has four passed jobs in CI 34575684407; the CLI/native-race job was
still running at this checkpoint. The preceding platform-start symptom did not
recur, but the pending job must still be inspected before claiming acceptance.

The new private derived cache retains a committed first-page source's exact run,
ordered candidate rows, scope and initial seen Item IDs. Owner-only open/read
helpers check actor and current Profile membership, reject expired/drifted sources,
and reuse the same window without reranking or fabricating Events/PredictionRuns.
No API grants, public endpoint, first-page receipt changes or mobile activation.

Bounds: 50 candidates/seen IDs, 2 MiB snapshot, 15 minutes from source ranking and
16 windows per actor/Profile. Scope advisory locking serializes creation. New
requests reclaim expired cache rows only; receipt/run/Event history stays intact.
Parent actor/Profile/run/receipt deletion cascades. No background cleanup job is
claimed; dormant scopes retain at most 16 expired rows until reopen/parent removal.

The rollback-only full-schema probe checks exact first-page seen IDs and source,
idempotence, later catalog/taste state, historical trace drift, empty sources,
expiry, capacity/reclamation, outsider/missing/revoked actor and API-role denial.
The same SQL is wired into native CLI CI. `EXPO_OFFLINE=1 CI=1 npm run check` exits
0 with **377 tests** (296 mobile, 14 catalog, 67 database), lint/TypeScript and both
platform exports. New native CI, real concurrent window-cap behavior and populated
window-forward acceptance remain open. No hosted mutation, reset, device test,
APK dispatch/poll or merge occurred.

Next: atomic page delivery against this frozen ledger, with current eligibility,
captured-scope/cursor validation, seen-set advancement, independent page run/ranks
and page-aware frozen/shadow replay. Raw cached candidates include suppressed and
already selected alternatives: they are not a deliverable page. Keep the public
first-page capability false until the whole page boundary is implemented and
verified; then activate the prepared client. STATUS owns the continuation.


## Active branch reconciliation — 2026-09-12

The independent-engine architecture and repository audit from #233/#234 are
reconciled into #229 while preserving every dated implementation/device record
below the original sprint checkpoint. Current STATUS supersedes historical next
actions: the corrected source `44b11b4` passed all five CI #458 jobs, so earlier
pending or failed first-page CI notes are historical. Atomic next-page delivery,
concurrent window-cap and populated-window upgrade tests, captured-session reader
activation, five undeployed forwards and device acceptance remain open. This
reconciliation changes documentation and carries the validated main hygiene fixes;
it does not complete those feature gates or change hosted data.

Reconciled local validation: `EXPO_OFFLINE=1 CI=1 npm run check` passed 377 tests
(296 mobile, 14 catalog, 67 database), lint/TypeScript and iOS/Android exports.
All 53 Markdown files passed local-target/heading-anchor checks. An independent
310-file source/tooling comparison found no feature implementation or migration
loss; differences are only the approved unused hook/wrapper removal, js-yaml patch
and migration-history manifest extension. The entire feature sprint appendix and
DEVICE_TEST are retained. Current published-head CI remains a separate gate.


## Atomic next-page source — 2026-09-12

Resume base: `e0eacb5` / PR #229; all five CI #462 jobs passed. Added CLI-created
forward `20260912105528_atomic_prediction_pages.sql`, SHA-256
`594e293f91a8ec4493bcbac4f68e30e64e33bf2611d8c6d37b3801ba38a1c7a1`. This is the sixth undeployed forward, after the
private continuation window. Existing SQL history is unchanged.

Numeric request protocol 2 opts into bounded pages through the existing public
endpoint; protocol 1 is preserved by an exact private first-page implementation.
Each next page owns its immutable run, ranks, frozen feature/state/genome inputs,
current eligibility snapshot and exact receipt. Request/scope locks serialize
cursor consumption and cache capacity. Later pages exclude the observed seen
prefix and enforce one reminder per window; the original source is unchanged.
Expiry/reclamation removes cache/cursors but retains authorized retry receipts
and historical page context. No arbitrary live candidate refill is introduced.

Page shadow uses `shadow-page-replay-v1`; evaluation declares
`FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX`. Comparisons remain conditional on
actual preceding production pages, not hypothetical whole-session outcomes.
The matching version reaches mature evaluation, including a native 0 rating
attributed to the page that delivered the Item.

Local full check: **378 tests** (296 mobile, 14 catalog, 68 database), lint,
TypeScript and iOS/Android exports. The focused page test additionally verifies
12 Personal/Shared/domain/mode windows with 48 page runs, exact baseline replay,
zero-rating evaluation, current state/catalog eligibility, actor/scope rejection,
rollback, expiry/reclamation and protocol-1 retries. A populated pre-window
upgrade preserves old data, first-page receipts, window snapshots and ACLs;
source-anchor mismatch rolls the forward back without partial DDL.

The required CLI CI runner now observes genuine native lock contention for
same-request retries, competing cursor consumers and concurrent 16-window
capacity, and runs the populated upgrade plus both page probes. Published-head
CI is the native acceptance record; inspect it before advancing the client.

First published head `19247e0` passed four jobs in
[CI](https://github.com/Kajooja/Kajo/actions/runs/34690842376); the CLI job reached
the final page-boundary probe and rejected its owner-side snapshot comparison.
The probe used native `extra_float_digits=0` to compare with a snapshot produced
inside protocol 2 at precision 3. The same failure was reproduced locally at 0.
The corrected probe compares at the snapshot's full precision and restores the
caller setting. Both page probes now run locally at 0 and 3, including caller-GUC
restoration; no migration or stored-row behavior changed. The follow-up head's
five CI jobs remain the acceptance gate.

No hosted database change, user-data reset, manual APK dispatch or device
acceptance is part of this source packet. PR #229 remains draft.

Next: captured-scope protocol-2 validation/reader/cache/append, per-page grid and
detail origins, then exact reviewed forward rollout and configured-device
acceptance. STATUS owns this next unit; E1 → D1 → D2 remains the subsequent
independent-engine research sequence.


## Captured-scope mobile pages — 2026-09-12

Resume source: `0a184a7` / PR #229, all five jobs accepted in
[CI #464](https://github.com/Kajooja/Kajo/actions/runs/34691537142). This resolves
the preceding atomic-page/native precision checkpoint. No SQL, migration history,
package version or lockfile changed in this client packet.

The active client now requests protocol 2. `predictionPageOperations.ts` validates
first/next lineage, exact scoped envelopes, genuine empty identity and contiguous
unique ranks; explicit protocol-1 compatibility remains. Requests and primitive
Context attributes are frozen, with a conservative 8,000-byte client bound.

`predictionPageReader.ts` owns one captured environment/actor/Profile/session/
domain/mode/limit/evidence-revision controller. Retry keeps its exact request;
refresh replaces the window. Later pages require the original source/time/count,
next index/cursor and unseen Item/run/request identities. Accepted prefixes are
immutable, including their per-Item page IDs and terminal empty-run identity.
Scope/focus cleanup invalidates pending requests and catalog enrichment. Context
is captured when the focused fetch begins; hidden feedback does not repeatedly
open unused windows. First scope entry is immediate; subsequent evidence updates
retain the 600 ms delay only after an earlier page was actually loaded.

Discovery exposes initial/next loading, scoped failures/retry, explicit fresh
search, empty catalog and bounded exhaustion. A request/view token keys the native
list and guards its retained visibility/open callbacks with the captured session.
Shared reordering, clicked detail/swipe and durable actions keep each Item's actual
page origin. Appending/prefetching creates no impression. The eight-slate navigation
handoff remains; the old global Item cache and unused row-RPC client were removed.
Catalog enrichment cannot change a delivered Item's domain.

Validation: `EXPO_OFFLINE=1 CI=1 npm run check` passed **420 tests** (338 mobile,
14 catalog, 68 database), lint/TypeScript and iOS/Android Hermes exports. Focused
regressions cover A → B → A, actor/environment/session/revision changes, delayed
enrichment/error replies, hidden/cancelled activation, exact first/next retries,
duplicate taps, interrupted/resumed delivery, refresh versus late append,
lineage/cursor/duplicate rejection, terminal empty runs and mixed-page captured
origins. Published-head CI remains the required independent gate.

No native emulator/`adb` or React Native web renderer is available in this workspace;
no configured-device/visual acceptance is claimed. Hosted state was not queried or
changed, and no APK was dispatched or polled. This client requires all six pending
forwards; it intentionally fails closed against an older endpoint. DEVICE_TEST
contains the next configured flow checks. PR #229 and Sprint014 remain open.

Next: exact existing-database six-forward preflight/rehearsal/rollout, then the
identified configured client/device checks. STATUS is the authoritative next task;
E1 → D1 → D2 retains its separate engine/public-data order.


## Hosted Prediction preflight and compatibility — 2026-09-12

Resume source: `8a1936c69e8f2dd2f0bd5b770177dcfb50aee9de` / PR #229,
all five required jobs passed in [CI #465](https://github.com/Kajooja/Kajo/actions/runs/34693634630).
The next packet was existing-target rollout preparation. No hosted DDL, data,
migration-history repair, reset, APK dispatch or device acceptance was performed.
The reviewed deployment below is the concrete next hosted action for owner approval.

Read-only target: **Kajo `operator-reviewed-project`**, PostgreSQL 17.6,
ACTIVE_HEALTHY, eu-west-1. Actual tracking has 50 version/name rows, ending at
`20260910190243_shared_list_destinations`. Metadata capture covers 138
public/private functions, 33 table definition fingerprints, 25 application/Auth-user
triggers, seven event triggers and 24 creator-default entries. It exports neither
application/Auth rows nor row-derived counts/hashes. Raw metadata stays outside Git.

Against the independently reconstructed source at that checkpoint, 112 of 137
application functions match definition/owner/ACL exactly; all 137 owners/ACLs
match. The 25 known definition differences fall within ADR-0006's previously
reviewed formatting/alias/staging ledger. Hosted-only `private.rls_auto_enable()`
is the existing platform trigger helper and must be preserved. This is not full
hosted-to-source equivalence or migration-history equivalence.

Three of the five functions touched by this packet match source exactly. The two
SleepLayer functions retain their known compact bodies. Full source-body lexical
review (strings/operators preserved, whitespace/comments ignored only as a review
aid) found identical 1,329 evaluator and 669 worker tokens. Exact stored hashes
remain distinct and are not normalized in metadata comparisons.

Preflight fingerprints (`function-schema-snapshot.sql`, `search_path=pg_catalog`):

| Function (existing exact signature in source) | Full definition SHA-256 |
| --- | --- |
| `private.rank_items_v0` | `a67bef2ff700c51831161bc16fb64b844e5480ec457b88e3c5a7276d19630aba` |
| `private.rank_items_scalar_v1` | `50dca3c127be1fccf1abc611cfdc8f42997b4c5ea7abf97f2df631b02813e6d7` |
| `private.rank_items_v1_internal` | `21b01bc3b8df88331e337bd127192d2a2d3ad9ff735553844bcfbf7e9326ab98` |
| `private.process_shadow_prediction_jobs_v1` | `d8545db8c44201b67eb479d7a2595c194ee9baaa2acf87940a901fbaa01cce1c` |
| `private.evaluate_shadow_genome_v1` | `50a6ba3ce029e6a1a4f2451f4f97c43455ed879136441e74e2d91b4a82426532` |

**Reproduced blocker:** installing the unchanged first forward into an isolated
populated source checkpoint containing those exact captured function bodies failed
with `Late outcome forward: unexpected source anchor ... evaluate_shadow_genome_v1
(expected 1, found 0)`. Fresh-lineage CI alone had not covered this hosted variant.

Only the two still-undeployed late Outcome/replay files were corrected. Each
recognizes its one exact compact full-definition SHA-256, places the already
reviewed canonical function into the migration's local text variable, then applies
the existing guarded feature patches. CREATE OR REPLACE preserves function
identity/owner/ACL. No global text normalization, broad source replacement,
additional migration or deployed-history edit is involved. The prior recorded
hashes `36cffca7490bc46ba94882de52def69c1d0618cea0e4a33175d70bccb5256d9b`
and `22d42dce06240092faec75550adcf70de75846079ac48ade0a80231671511f4a`
are historical and must not be used for this deployment.

Exact reviewed files, in dependency order:

| Migration | Current SQL SHA-256 |
| --- | --- |
| `20260910192630_late_outcome_attribution.sql` | `6c724f941bd475f409a151841464f3e56d7a69023aaf72d521279f8c64586337` |
| `20260910202244_frozen_prediction_replay.sql` | `1b471f7c894035a6154fbc98499ca7ee3dd499c9f4e6902cb72c35fdb7801d1c` |
| `20260910210520_eligibility_first_candidate_pool.sql` | `92bf98666e22c62873d54a74c586b4deddbc0cc0daff168c8dcd0e65a40b7b46` |
| `20260911070959_identified_prediction_page.sql` | `caf66c1e5558632e9dab78a538237d3e99594b41fa703b87f237b560445c4e08` |
| `20260911074543_prediction_continuation_windows.sql` | `1dad709b42d2072ea93166dccd846f01a91f6435763f1687c95d0b676358e415` |
| `20260912105528_atomic_prediction_pages.sql` | `594e293f91a8ec4493bcbac4f68e30e64e33bf2611d8c6d37b3801ba38a1c7a1` |

Validation: `EXPO_OFFLINE=1 CI=1 npm run check` passed **421 tests** (338 mobile,
14 catalog, 69 database), lint/TypeScript and iOS/Android exports.
`prediction-hosted-source-fixture.sql` contains only the two checksum-pinned schema
bodies. `prediction-hosted-upgrade.mjs` rehearses all six forwards with synthetic
existing data, preserving every prior row, function identity/ACL, unrelated
function body and unrelated constraint; private storage/helper checks also run
under the open factory function default. A second rolled-back transaction runs
the full 12-window/48-page Personal/Shared/domain/mode and frozen replay probe.
The regression mutates a compact semantic token in either function and confirms
rejection with no leftover DDL or fixture users. The same preservation/runtime SQL
is now part of required native CLI CI and its metadata report. Inspect the
published head's five jobs before any hosted mutation.

Security advisor baseline: 19 `rls_enabled_no_policy` INFO findings for intentionally
private, denied-direct-access tables, plus the existing Auth leaked-password
protection WARN. See the [RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No broad policy grants or Auth configuration changes are part of this packet.

Deployment and partial-failure procedure:

1. Confirm applicable owner authorization for this exact existing target and six
   SQL files, refresh refs/current CI, actual version/name tracking and metadata.
   Re-read the five fingerprints above; fail on unreviewed drift. Preserve the
   full before function/table/trigger/default snapshots without exporting user data.
2. Apply each reviewed file through `apply_migration` in the listed order, using
   its exact SQL bytes. Verify provider success and the resulting function/ACL/
   storage boundary before proceeding. Record actual provider version/name and
   unchanged SQL hash. Never replay a migration whose commit already succeeded.
3. Expected total change: twelve new private/public functions, four private RLS
   tables and one immutable-context trigger; only the five old function bodies
   above change. Existing identities/owners/ACLs, unrelated definitions/triggers,
   defaults and the previous 50 tracking rows must remain. The one existing
   `shadow_prediction_runs_counts_check` is deliberately relaxed to allow zero.
   Metadata parity and isolated preservation proof are separate from live data checks.
4. If an individual call fails or its result is ambiguous, stop the sequence and
   re-read provider history/definitions. The migration transaction must either
   commit completely or leave no partial DDL. Record the actual successful prefix
   and prepare a narrow reviewed correction; never reset, drop historical evidence,
   overwrite receipts or run whole-history `db push`/name-only repair. Preserve
   source/provider identity mapping if execution pauses; once the chain is complete,
   synchronize filenames/references in provider dependency order without changing SQL.
5. Once protocol 2 is deployed, reverting the schema wholesale is not a safe
   rollback: page receipts/runs/context may already exist. If service restoration
   is needed, prepare a narrow forward that disables the affected public page
   endpoint while retaining evidence and the existing row endpoint. No such
   emergency write is implicitly executed by this preparation packet.
6. Recheck final definitions/ACLs, private RLS/storage boundaries, unauthenticated
   denial and advisors. Then perform the configured-client checklist in DEVICE_TEST
   with the exact identified build. Existing data and fresh-account limitations
   remain; no account reset or automatic APK dispatch is authorized here.

Next: approval and refreshed preflight for this six-forward hosted rollout,
then configured-device acceptance. PR #229 remains draft, full DATA/ALG and
Sprint014 remain open, and E1 → D1 → D2 retains its independent engine order.


## Approved hosted Prediction rollout — 2026-09-12

The owner explicitly approved the exact six-forward packet on existing **Kajo
`operator-reviewed-project`**, preserving current data. This completes the preceding
preflight's requested action; its old pending/approval instructions are historical.
Do not repeat these migrations or request that same authorization again.

Deployment source: `78217135897cbfe10c85a0b6610989272bdc87c8` / draft PR #229.
All five required jobs passed in [CI #466](https://github.com/Kajooja/Kajo/actions/runs/34695947055):
pinned platform, source validation, clean installations, native CLI lineage and
populated upgrade. The native CLI log includes the compact-source six-forward
preservation/runtime probe and ends with its install/rollback/runtime PASS.
The initial read-only refresh matched the reviewed target, 50 migration rows and
all captured function/table/trigger/default metadata exactly.

Each approved SQL file was applied separately, in dependency order, with provider
success and function/owner/ACL/history/private-storage checks before the next.
All six committed successfully. The provider assigned these actual versions:

| Reviewed source filename | Installed filename | Unchanged SQL SHA-256 |
| --- | --- | --- |
| `20260910192630_late_outcome_attribution.sql` | `20260912133402_late_outcome_attribution.sql` | `6c724f941bd475f409a151841464f3e56d7a69023aaf72d521279f8c64586337` |
| `20260910202244_frozen_prediction_replay.sql` | `20260912133832_frozen_prediction_replay.sql` | `1b471f7c894035a6154fbc98499ca7ee3dd499c9f4e6902cb72c35fdb7801d1c` |
| `20260910210520_eligibility_first_candidate_pool.sql` | `20260912133941_eligibility_first_candidate_pool.sql` | `92bf98666e22c62873d54a74c586b4deddbc0cc0daff168c8dcd0e65a40b7b46` |
| `20260911070959_identified_prediction_page.sql` | `20260912134056_identified_prediction_page.sql` | `caf66c1e5558632e9dab78a538237d3e99594b41fa703b87f237b560445c4e08` |
| `20260911074543_prediction_continuation_windows.sql` | `20260912134141_prediction_continuation_windows.sql` | `1dad709b42d2072ea93166dccd846f01a91f6435763f1687c95d0b676358e415` |
| `20260912105528_atomic_prediction_pages.sql` | `20260912134224_atomic_prediction_pages.sql` | `594e293f91a8ec4493bcbac4f68e30e64e33bf2611d8c6d37b3801ba38a1c7a1` |

The repository filenames and current canonical references now match those
provider identities. Only the names changed; every SQL byte still matches the
approved hash. Earlier dated sprint entries retain their original source names,
with this mapping as the continuation authority. Previously protected source
hashes and the accepted fresh-install baseline cutoff remain unchanged. These
six deployed bodies are immutable; any subsequent correction requires a new
reviewed forward.

Final metadata verification:

- Migration tracking: **50 → 56** rows, all original version/name pairs unchanged;
  the exact six names appear in the approved sequence.
- Public/private functions: **138 → 150**. Every stage's changed/new definition
  matches the independently reconstructed source fingerprint. All 138 original
  OIDs/signatures, owners and ACLs are preserved; only the five reviewed existing
  ranking/evaluator/worker bodies changed. All unrelated definitions are unchanged.
- Application tables: **33 → 37**. Four new private page receipt/window/context/
  cursor tables have RLS and deny direct SELECT to anon, authenticated and
  service_role. All 33 prior complete definition/structure fingerprints match
  when the one changed `shadow_prediction_runs_counts_check` is virtually
  substituted with its prior expression inside a read-only metadata query.
  This isolates the intended zero-count relaxation without changing the database.
- All **25** prior application/Auth-user triggers are identical; the one new
  immutable page-context trigger brings the count to **26**. All **7** event
  triggers, **24** creator-default entries, schemas, roles and memberships are
  unchanged.
- In an explicitly read-only transaction with empty JWT claims, both anon and
  authenticated-without-actor calls to `public.rank_items_page_v1` reject with
  `42501`. The probe rolls back and creates no users, fixtures or page data.
- Security advisors: **23 RLS/no-policy INFO** findings, the prior 19 plus the four
  intentionally private page tables; no new warnings. The existing Auth
  leaked-password-protection WARN remains outside this packet. See the
  [RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  and [Auth protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No application/Auth rows or row-derived counts/hashes were exported. Hosted
metadata checks and the isolated populated-data preservation/runtime proof are
separate evidence; this is not a live full-row equality claim. No reset,
whole-history push, historical tracking repair, global-default migration,
automatic promotion or Auth configuration change ran.
`20260909131913_close_postgres_function_defaults.sql` remains undeployed.

Before deployment and after filename alignment, local
`EXPO_OFFLINE=1 CI=1 npm run check` passed **421 tests** (338 mobile, 14 catalog,
69 database), lint/TypeScript and iOS/Android Hermes exports. All 53 Markdown files
and 134 relative file/heading links were checked; none were broken. The PR owns
verification of the published head. Neither filenames nor documentation change
mobile behavior.

Next bounded unit: record the exact configured client build/environment against
server checkpoint `20260912134224_atomic_prediction_pages`, then execute the
[protocol-2 device/recovery checklist](../DEVICE_TEST.md#protocol-2-configured-client-check--prepared-2026-09-12).
No emulator/adb or React Native web renderer is available here; no exact newly
installed build, device result or fresh-account acceptance is claimed. No APK was
dispatched or polled, and existing account/test history was retained. Keep PR #229
draft and DATA/ALG/Sprint014 gates open until their actual evidence is accepted.
STATUS retains this single continuation; E1 → D1 → D2 remains the separately
selected independent-engine/research sequence.

## Bounded client recovery — 2026-09-12

Resumed draft PR #229 at `7d47e44bb55ee7c5e5544fa92b0bcdc6f44a2401`; all five
required jobs passed in [CI #467](https://github.com/Kajooja/Kajo/actions/runs/34697784410).
A read-only migration-history query reconfirmed the six installed versions ending
at `20260912134224_atomic_prediction_pages`. No deployment or data mutation ran.

A new regression reproduced an unresolved first-page load remaining `loading`
after 15 seconds. The reader now bounds each first/next attempt to 15 seconds
across the ranking RPC and catalog enrichment. It sends one AbortSignal through
both SDK requests and races cancellation even if the transport never settles.
Scope/focus changes and explicit refresh cancel old attempts; timers/listeners
are released on settlement. A failed append preserves the immutable prefix and
its page origins; timeout/transport retry retains the original request/context/
cursor, since client cancellation does not prove a server rollback.

The configured loader preserves server error codes. Exact unusable-cursor errors
select a fresh search, while capacity errors ask the user to wait and retry.
Unknown/permission/transport errors use generic copy without exposing server
details. Buttons and pull recovery follow the same action; no automatic refresh,
mock downgrade, Event creation or SQL change is introduced. The injected SDK
transport checks follow the documented
[AbortSignal boundary](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal).

Validation: the formerly failing regression passes; **91** focused page/reader/
catalog tests pass. `EXPO_OFFLINE=1 CI=1 npm run check` passed **439 tests**
(356 mobile, 14 catalog, 69 database), lint/TypeScript and iOS/Android Hermes
exports. New cases cover hanging first/next loads, exact retry, late completion,
blur/reactivation, replaced-attempt deadlines, immutable prefixes, expired cursor
recovery, capacity and actual SDK signal/error-code propagation with injected HTTP
fixtures. The published head still requires its own five CI jobs; CI #467 proves
the resume baseline only.

No native emulator/adb or web renderer is available here, and no new configured
APK was installed, built or polled. DEVICE_TEST includes the new stalled-request
and expiry checks; exact build identity, native callbacks, process-death/reconnect
and fresh-account acceptance remain open. Preserve current test data and keep
#229 draft. STATUS retains configured-device recovery as the default continuation;
E1 → D1 → D2 can be explicitly selected while those device gates wait.

## Owner device feedback and E1 selection — 2026-09-12

The owner reports the protocol-2 test flows working, including Profile changes,
expired cursor → new search and the reported persistence/restart checks. Manual
CI #469 passed at `900dc2653e428bb1cbd27e4bdaa7ea0141e47b31` and produced its
matching APK artifact; DEVICE_TEST records the verified artifact identity and
limits of the self-reported device evidence. The remaining network-recovery
button defect is #240 / MVP-UX-003 and stays open for a device-verified correction.

Owner direction explicitly places application UI changes in a later required
pre-MVP packet. #230 private statistics/progress/weekly tracking and #231 grid
selection/List/history actions now map to MVP-UX-004/005. New #239 / MVP-UX-006
covers star → default Tykätyt, header overflow → other Lists, bottom slider/actions
and explicit Next after saving. UX_PRINCIPLES distinguishes this planned successor
from today’s accepted automatic advancement; DATA_EVENTS retains existing Saved,
Shared consent and no-implied-rating/Next semantics. No UI source was changed.

The selected independent source packet is E1 #235 on
`feat/235-portable-engine-contracts`, starting from accepted main. It supplies
executable generic contracts and media/non-media fixtures before D1/D2. #229
retains its native/remaining acceptance record, and no missing test or requirement
is marked complete just to begin E1. No new DDL, APK dispatch/polling or reset ran.


## Sequential adaptive Taste source foundation — 2026-10-14 / #336

The new product contract requests one-question-at-a-time learning and evaluation
from the updated committed prefix, numeric-sensitive selection and variable
readiness rather than fixed response/holdout quotas. [STATUS](../STATUS.md) owns
the one active `feat/adaptive-taste-reference` handoff; [the Prediction model](../../domain/PREDICTION_MODEL.md#sequential-adaptive-taste)
owns chronology, same-prefix evaluation, insufficiency and native boundaries.
The portable reference/control packet covers EB-03/EB-08 and architecture
sections 30, 32, 33, 40–42. Existing v1 sessions and accepted foundations are retained.

Source publication/integration and final CI are recorded in #336 and its PR.
Canonical domain-aware evaluation scoring/committed cutoffs, persistent projection
and erasure, mobile consumption, real usefulness and all anonymous/release gates
remain open. No private account/device observations or operator receipts, native
rollout, reset, trained-model admission or Working/cohort activation are supplied
by this source packet. Sprint 014 is not closed.


## Recovered sequential reference and continuous-learning clarification — 2026-10-15

Recovered the uncommitted #336 work on `feat/adaptive-taste-reference` from the
prior interrupted session; its base still matches accepted main `419f385`.
The reference and media/non-media tests now also reject missing overlapping
features as apparent separation and prevent feature support from crossing changed
schema/representation versions. Original responses and forecasts remain retained.
The full engine suite passes 284 tests, including 39 adaptive reference cases.

The owner's clarification is recorded in PREDICTION_MODEL, LAUNCH_LOOP, MVP,
ROADMAP and AGENTS: Taste can end before sufficient support; the same Profile
continues learning in Discovery. Per-action freshness, immutable prior origins,
recent/durable/context/world/group composition and local/privacy-gated global
scenario retrieval retain distinct implementation and acceptance scopes.
The current source is a pure reference; native sequential SQL/mobile/Discovery
integration is the next packet, not a delivered result of these fixtures.

Local lint/typecheck, mobile/catalogue and engine checks pass. The root check
stops at refused Deno npm-registry access; final GitHub CI owns the complete
required gate. The PR records remaining suite/build results and exact integration.
No hosted change, device observation, reset, population activation or measured
quality is claimed. Existing v1 remains preserved and Sprint 014 stays open.


## Discovery committed-action refresh — #338 / 2026-10-15

Continuous-learning inspection found that ordinary Item acknowledgements did not
advance the collection/ranking revision. An earlier optimistic value could have
already triggered a pre-commit fetch, leaving the exact same visible value after
acknowledgement and no subsequent ranking request. The bounded source fix moves
the existing revision increment to every current-scope successful receipt.
It preserves collection completion, durable queues and immutable delivery origins.

Three delayed-acknowledgement regressions for ratings 0/5/10 fail on the predecessor
and pass with the fix. Actual provider/outbox tests also retain rejection and
old-Profile safety; 76 focused tests and all 522 mobile tests pass. Lint/typecheck
and iOS/Android exports pass. Local root reaches refused Deno registry access;
the successor PR owns required final-source CI/merge acceptance. DEVICE_TEST adds
the matching-build slow-write/reconnect cases; no device or hosted result is claimed.
After acceptance, #336's canonical scoring/committed-prefix and sequential native
Taste/Discovery work remains the next engine packet. #337's pure reference is a
separate source foundation, not full native integration.


## Canonical explicit-candidate evaluation — 2026-10-15 / #336

After accepted #337 and #339, `feat/taste-evaluation-scoring` extracts common
base/scalar/identity scoring and supplies an internal owned-Personal capture for
1–50 requested canonical Items. Whole-function guards precede extraction; old
identities/defaults/owners/ACLs and rows are preserved. Normal request owners call
the shared implementation directly to retain serving depth. Existing public/v1
behavior remains covered by ordinary/catalogue and long-chain regressions.

The panel uses the assigned production genome, source fusion/decay, state,
ScenarioMemory and eligibility. It freezes actual Item type/tags and scoring
features, records requested IDs plus the receipt lower bound/transaction cutoff,
and marks every candidate non-delivered. Missing or ineligible Items remain
unavailable. Genuine committed Taste ratings 10/0/5 change subsequent forecasts;
ANSWER followed by NEXT in the same transaction rejects. Global top-50 movie
starvation no longer determines book evaluation coverage. Native CLI smoke is
part of the five required final-source gates; the PR owns final test/merge evidence.

This is an EB-03/EB-08 source prerequisite for architecture sections 30/32/33 and
40–42. It does not close #336, those complete capabilities or any release gate.
Durable v2 commands still own revision/first-measurement/pending-pair/projected
prefix/retry/withdrawal semantics, followed by mobile partial-readiness continuation
into Discovery. No hosted migration, account reset, new model/Working/population
activation or device observation is supplied. STATUS remains the one handoff.


## Durable sequential Taste v2 — 2026-10-15 / #336

Accepted predecessor #340 merged as `baf190fed5350e0323844518f483960dd5b2f73c`
after all five final-source CI #663 gates (run `38714352914`); source
`587ce886bb9fa5e7e987e5e208a56536f7b7a788`, tree
`9b8606fe0ff4058f311fbbd9dc915c2452bf0656`. This closes the canonical explicit-pool
scoring prerequisite, not #336 or native/mobile acceptance.

`feat/durable-sequential-taste` adds the owned v2 session/panel/command boundary.
Its separate committed forecast → measured first answer → evidence → NEXT loop
consumes the accepted canonical evaluator. Receipt timestamp plus transaction
identity closes same-transaction and older waiting-transaction leakage. Selection
matches the portable numeric reference over actual canonical panels. Original
measurements are immutable; later same-domain labels complete comparisons from
one common earlier unseen pool. Exact retry/CAS, correction and source-withdrawal
closure retain auditable learning without relabelling prior evaluations.

Numeric ratings and explicit not-interest update canonical priors. Negative
interest has its own null-rating kind restricted to this source and uses the
existing bootstrap/native trust ratio; UNKNOWN remains recognition only. Three
whole-body guarded helper extensions preserve all existing kind values and
function metadata. Selective external bootstrap removal, Event reversal/erasure,
import removal and Prediction erasure invalidate copied panels/replies. Whole
removal is terminal; stale retries cannot restore it. Old v1/completed setup
remains intact and a competing old writer is rejected.

Readiness deliberately remains INSUFFICIENT in this continuous-learning source
stage. Finite opportunity/command budgets prevent endless required testing;
PAUSE/CONTINUE preserves the same Profile. Full readiness admission, mobile v2
queue/navigation, anonymous entry and matching hosted/device/quality observations
are not delivered by this packet. The owner's October 15 attention clarification
is recorded in DATA_EVENTS/PREDICTION_MODEL: existing detail dwell is weak evidence;
complete visible-item/stop/foreground timing and Scenario consumption remain
separate work. The immediate priority is an evolving per-choice forecast.

All 256 database tests (17 focused sequential tests), 522 mobile tests, 284 engine
tests, lint/typecheck, catalog/research/acceptance suites and four native exports
pass locally. The native CLI gate adds independent connection/observed-lock probes
and exact fixture cleanup. Final-source CI is tracked in the successor PR; local
Deno registry refusal is an environment limitation, not a passing gate. Updated canonical owners are STATUS,
ROADMAP, MVP, DATA_EVENTS, PREDICTION_MODEL and CODEMAP. No release ID or complete
EB-03/EB-08 capability closes, and no hosted/account/model activation occurs.
STATUS owns the one continuation: finish this source acceptance, then mobile v2.


## Sequential Taste mobile consumer — 2026-10-15 / #336

The #341 predecessor is accepted with the owner's explicit approval: source
`e1451ba28745704efeb6d429a25a84f8e9e69e0e`, tree
`84f2d319124b7a18d991141e8a40f5707a9ffcff`, merge
`b55990d3a3f6b007b5c62a674022129d7a74d2b1`. All five CI #666 gates
(run `38724558470`) passed, including native independent-connection probes.

`feat/sequential-taste-mobile` extends the existing service/queue/screen/gate.
New sessions use v2, with separate committed START/ANSWER/NEXT RPCs and a fresh
RESUME after acknowledgement. Exact command IDs survive missing replies and
SQLite acknowledgement failure. The next command is persisted only after a
confirmed current state; conflicts do not rebase answers. A bounded automatic
NEXT and explicit later retry prevent unbounded cross-device command loops.
V1 local records upgrade in place while preserving pending payloads, sessions,
frozen challenges and completed setup; only a missing first RPC or explicit
legacy-preservation receipt permits the older protocol.

The sequential screen uses saved-answer progress and honest initial support.
**Jatka selaamaan** commits PAUSE and persists dismissal before releasing the
same Profile's app, without a fixed quota or a required v1 challenge. A remote
pause offers explicit continuation. Pending writes cannot escape through the
old fail-open callback. Acknowledged evidence invalidates mounted predictions;
server withdrawal/removal supersedes cached replies. No forecasts, histories or
private evidence are copied to SQLite.

Validation includes actual current-schema SQL/mobile RPC round trips with separate
transactions, 0/5/10/unknown/not-interest, increasing committed forecast prefixes,
exact retry, pause/continue, source withdrawal and terminal removal. Controlled
component tests execute actual gate callbacks, including delayed PAUSE and the
same-Profile handoff. Native gesture/layout/network round trips are unobserved;
no emulator or real device is available. Local checks pass: 544 mobile, 257 database and 284 engine tests, full lint/typecheck,
dependency/catalog/research/acceptance suites, and all four iOS/Android exports
with non-live public-shaped fixture configuration. The PR owns the exact
source/tree/final-CI receipt.

Changed canonical owners: STATUS, ROADMAP, MVP, LAUNCH_LOOP, PREDICTION_MODEL and
CODEMAP. No release ID or full EB capability closes. No schema/dependency change,
hosted migration, account reset, model admission or attention sweep is included.
Next after source acceptance: matching guarded backend/build/device continuation
for acknowledged actions, offline retry, restart and partial Discovery freshness;
full readiness and measured usefulness remain open before release acceptance.


## Matching sequential Taste rollout preparation — 2026-10-15 / #336

The interrupted conversation's #342 mobile packet is already accepted as main
`c776de5fcdb62c72216b25a955a8c4b8685b2580`, identical to source tree
`8ece8e164dfb4691737286340606e4ecd66de398`. All five final-source CI #668
and accepted-main CI #669 gates passed; #669 also built the standalone APK.
STATUS now records its source/run/artifact identity instead of directing a fresh
agent to recreate or republish the completed mobile consumer.

A new read-only actual-target metadata check finds owned v1 endpoints present and
v2 absent. The earlier 16-forward chain and immutable-guard bridge are installed;
their reviewed files remain immutable. The separate
`personal-sequential-taste-hosted-upgrade.*` packet binds the accepted application
to only the canonical-evaluation and durable-v2 delta, validates the observed
installed prefix/history/function bodies/security and supplies a disposable
populated-v1/frozen-challenge preservation rehearsal. It does not apply hosted SQL.
The native CLI probe includes the same rehearsal before its fresh full install.
The observed checkpoint also exposes an exact compact historical bootstrap
helper body: its behavior is unchanged but the v2 source guard refuses it.
CLI-created append-only `20261015192129_sequential_bootstrap_compatibility.sql`
repairs only that exact body before the unchanged forwards, preserves complete
function metadata, and is a no-op for canonical pre-v2/final-v2 fresh lineage.
Unknown bodies/permissions remain rejected; the preparation records the bridge
separately from the immutable two-forward delta.

DEVICE_TEST leads with a matching v2 matrix: numeric and unknown/negative meaning,
slow/lost acknowledgements, exact restart/current-state recovery, committed pause,
partial Taste → same-Profile Discovery freshness, conflicts/scope, source removal
and honest insufficient support. Existing device observations retain their scope;
no new emulator, phone, gesture, installation or post-commit reply-loss observation
is claimed. No account reset, model admission or release requirement closes.

All five focused preparation tests pass, including full canonical/compact
rehearsals, exact bridge semantics/metadata, provider-history drift and lifecycle
trigger checks. Independent review exercises bridge source/security rejection.
The real read-only preflight reports BRIDGE_REQUIRED and two missing forwards.
No hosted mutation occurs. Existing lint/typecheck, 544 mobile and 284 engine
checks pass; the successor PR owns final source/tree/full CI verification. Next is target-specific
rollout authorization with a refreshed private checkpoint, only still-missing
forwards and backend role/preservation verification, then the matching device
matrix. Full readiness, quality, anonymous entry and remaining release gates stay
open; canonical preview follows consumer acceptance. Sprint 014 remains open.

## Accepted sequential Taste hosted rollout — 2026-10-15 / #336 / #343

The owner explicitly approved merging [#343](https://github.com/Kajooja/Kajo/pull/343)
and applying its three reviewed hosted operations. All five final-source CI #671
gates passed. Accepted merge is `799f1c850b989d1cfeef450946689224d9727359`,
tested tree `211686d70bf33fe86c83191622e8b303a2d86ddc`.
The preceding preparation-stage BRIDGE_REQUIRED/undeployed statements record that
earlier checkpoint; the completed rollout below supersedes them.

Exactly three new operations were acknowledged, in this dependency order:
`20261015192129_sequential_bootstrap_compatibility.sql`,
`20261015090018_personal_evaluation_scoring.sql`, then
`20261015101752_durable_sequential_taste.sql`. The exact compact helper was
canonicalized before the unchanged evaluation/v2 forwards, preserving function
identity/security. The original 16-forward manifest and earlier guard bridge
remain unchanged and installed. None of these operations should be replayed.

The final actual-target read-only preflight passes the exact installed two-forward
prefix/provider receipts, all 41 function snapshots and nine lifecycle triggers.
V2 role denial and closed private storage checks pass. All 60 preexisting
Auth/public/private tables retain identical row counts and full-row digests before
and after deployment. A genuine existing owner's rolled-back catalogue smoke
returned 80 distinct BOOK and 80 distinct MOVIE Items, with exact retries; the
preservation check passed again afterward. The three new v2 tables remain empty.
Target identity, provider-generated versions, history digests, row fingerprints
and detailed operator receipts remain private.

The #669 APK from `c776de5fcdb62c72216b25a955a8c4b8685b2580` remains the matching
compiled app: #343 changes no compiled mobile inputs. STATUS owns its artifact
and expiry; DEVICE_TEST owns the next actual phone observations. Install as an
update preserving accounts, v1 sessions/pending commands and completed setup.
Existing owners can verify preservation and committed Discovery behavior. A new
v2 session requires an authorized eligible PersonalProfile without a prior v1
session or completed setup; there is no app action to restart those preserved
Profiles into v2. Do not reset an account to force this test.

No genuine first-v2-session result, phone/emulator observation, account reset,
model/Working activation, measured usefulness or release acceptance is claimed.
Next is the matching device matrix, including slow/lost acknowledgement,
restart/current-question recovery and partial Taste → same-Profile Discovery
freshness. Canonical preview follows consumer acceptance; #336, full readiness,
quality, anonymous entry and Sprint 014 remain open.

## Required shared feed and first-answer personalization — 2026-10-15 / #336 / #239

The owner reports the same Taste films as another Profile and requests the same
artwork/card experience as Discovery, with vertical swipe-away instead of separate
En tunne / Ei kiinnosta controls. This is scoped device feedback, not a verified
installed-protocol diagnosis or completion of the existing acceptance matrix.

The required successor uses deliberate **Ohita** as neutral contextual skipping,
with accessible first-use guidance, temporary suppression and a versioned eligible
return. It cannot infer a rating, recognition, consumption or permanent dislike.
Partial scrolling/reflow is not an answer. Retained UNKNOWN/NOT_INTERESTED and
v1/v2 commands/forecasts keep their original meaning. Ratings, save/List/Shared
actions and exact origins remain distinct.

Source inspection confirms that first answers already update bootstrap and the
canonical forecast, while next-question selection gives domain progress priority
over utility and does not rank by forecast magnitude. START freezes 25 candidates
per domain. Taste's payload/card is title-only; Discovery has artwork but a
separate horizontal pager. The first required source successor must consume the
updated supported forecast for next selection; then supply the neutral protocol
and shared vertical feed with versioned candidate refresh/refill. Previously
frozen evaluations and delivered origins must not be rewritten. Identical empty
Profiles may share an opener; supported opposite-answer prefixes must be capable
of changing the next choice without promising a change after every answer.

ROADMAP advances this card/feed subset from 17.0 into the near-term #336
continuation before preview/usefulness acceptance. Open `MVP-UX-007` and
`MVP-ALG-010/011` require shared feed/artwork, first-answer/continuous supported
personalization and a defensible recent cold-start prior. Highest current-scenario
satisfaction (ultimately ten) is the target, with honest ordinal/calibrated
boundaries and explicit Taste information tradeoffs. Recent full-distribution,
support, recency, uncertainty and source/exposure checks precede any NPS-like
policy admission. No title pair, new dataset or native population model is
automatically activated by this plan.

Canonical UX/acquisition/evidence/prediction/glossary owners and the agent rule
are reconciled in the existing #344 documentation PR. DEVICE_TEST separates
reported feedback, the planned successor matrix and the older actual-source
matrix. The #673 CI failure on the earlier docs head exposed an existing reset
fixture's tied wall-clock readings: the fixture successor defines strictly
post-reset occurrence times and a matching cutoff without changing production
SQL, boundary rules or expected results. Its focused suite passes 9/9.

The full local database suite passes 262/262. Lint, typecheck, mobile and catalogue
checks pass. The full `npm run check` attempt stops at Deno's registry fetch with
connection refused, before the remaining stages; it is not a complete local
check or a native CI/device receipt. Final-source CI remains required.

This packet changes requirements and that deterministic test fixture, not the
APK, deployed migration bytes, recommendation policy or user data. Full feed
implementation, actual v2/device observations and measured usefulness remain open.

## Canonical-forecast first-answer selector source — 2026-10-16 / #336

The requirement/hosted-receipt packet #344 is merged as
`63682dab9e87094c43a50c05616b89acc5bc7079`, tree
`01323436604411b7bf8526aaad107e8324bf2644`, after all five final-source CI #674
gates passed. The prior #343 hosted operations remain installed and must not be
replayed. No account reset or new hosted operation occurred in this packet.

`feat/forecast-aware-taste-selection` proposes the bounded selector correction
before the shared feed successor. The CLI-created append-only
`20261016073549_forecast_aware_taste_selection.sql` adds a denied private helper,
new-session `CANONICAL_FORECAST_V3` default and exact source/security-guarded
dispatch/evidence-version patches. Existing ADAPTIVE/PRIOR_ONLY policies remain
immutable, with original catalogs, questions, panels, first measurements and
cached command replies. Existing migration bytes and v2 wire/mobile queue stay
unchanged.

Actual current-panel within-domain tied midrank replaces the local similarity
preference proxy. Utility now leads selection, with a traced two-presentation
domain-lead guard preserving supported domain coverage. Equal scores stay neutral;
missing/uninformative choices never manufacture support. Extreme finite scores
use overflow-safe tie comparisons. The portable engine supplies the same optional
`adaptiveTasteCanonicalDefaults`; old reference states retain their old path.
Selection traces remain private and protected by existing immutable-history guards.

New SQL fixtures pass 9/9, including genuine separate-commit first 10/0/5 answers:
the supported fixture chooses a matching MOVIE, a contrasting MOVIE and a neutral
BOOK respectively. Score inversion/affine and wide-finite controls prove actual
forecast consumption. Populated upgrade, old paused/pending/lost-ack sessions,
function metadata and source/ACL/search-path/definer drift rejection pass. The
existing native sequential suite passes 17/17 against current SQL/portable parity;
48 adaptive-reference cases, engine typecheck/lint/build and export smoke pass.
Final-source full checks and native CI belong to the source PR; this is not a
hosted, phone or measured-quality acceptance receipt.

The START-time 25-per-domain pool still needs versioned refresh/refill. Neutral
Ohita, shared vertical feed/artwork, recent supported prior, full readiness,
anonymous entry and remaining release/quality gates remain mandatory. Complete
this selector's source integration and guarded actual-target acceptance before
claiming the new policy in a real session; preserve old sessions throughout.

## Accepted canonical-forecast selector and hosted forward — 2026-10-16 / #336 / #345

[#345](https://github.com/Kajooja/Kajo/pull/345) is merged as
`8cd67af54765a2876f37e5db0deb66235ee3f0e9`. Reviewed source head
`743951ac1f69e3edf36f205e281c53d401ab8821` and accepted merge share tested tree
`a9a48b7dd37ce37538bc36e0cae7d0da856a9f90`. All five required final-source
[CI #676](https://github.com/Kajooja/Kajo/actions/runs/38878872616) gates succeeded.
The preceding proposed/source-only statements describe that earlier checkpoint;
this receipt records the completed source and hosted acceptance.

Exactly one new forward was applied:
`20261016073549_forecast_aware_taste_selection.sql`, SHA-256
`ffaa9ba15a9836b879936480d8a4c3abbaf22132db62da041c148a81bad71a0d`.
The prior migration-history prefix is exact and installed operations must not be
replayed. Actual-target verification preserves all 63 existing ordinary
Auth/public/private tables, all 228 existing function identities/non-body
metadata and every body except the two reviewed exact replacements, all 57
noninternal app-trigger attachments and all 62 app-table ACL/RLS snapshots.
Exactly one new denied helper, the source policy default/check, seven security
probes and four read-only selector cases pass. Detailed target/provider/history,
function and row fingerprints remain private. Known advisors remain unchanged,
including the existing Auth password warning tracked in #160/#184.

Only new sessions receive immutable `CANONICAL_FORECAST_V3`; retained ADAPTIVE
and PRIOR_ONLY sessions keep their policies, original evidence and exact replies.
The v2 RPC/mobile queue is unchanged; #669 remains compatible with that boundary.
This receipt includes no positive eligible-owner new-session or
phone result, reset, fixture account, model/Working activation or quality claim.

Next bounded source packet is the neutral contextual skip command/Event and
durable idempotency/Scenario-eligibility contract, before shared presentation
reuse. Preserve exact shown origins, retries/restart/conflict/undo-withdrawal/
lifecycle and historical UNKNOWN/NOT_INTERESTED meanings. Shared vertical
feed/artwork, versioned START-pool refresh, recent supported prior, full readiness,
anonymous entry and actual device/measured-quality gates remain open. STATUS owns
the exact current receipt branch and next task; Sprint 014 and #336 remain open.

## Repository hygiene reconciliation — 2026-10-16

The interrupted conversation's #345 selector and #346 receipt are already
accepted. #346 retains reviewed tree `bdc98cc28c44ebfbc6f18be5388898cd6c142e36`
after five successful CI #678 gates. Configured #677 also passed all five gates
and its APK build; STATUS now records its available artifact separately from the
earlier #669 build. No new device observation is inferred.

The dated [branch audit](../retros/branch-audit-2026-10-16.json) records all 51
original remote refs: forty merged development heads, two accepted superseded
paths, main and eight consumed operation identities. All original remote refs
remain unchanged because Git write authentication is unavailable and the browser
fallback timed out; the connector has no delete-ref action. The 42 exact retirement
candidates remain explicitly tracked. No deletion is claimed.

Two obsolete local change sets match accepted work, seven orphaned worktrees
have their metadata repaired after full tracked-content comparisons, all twelve
historical worktrees are clean and six local feature refs are retired. No unique
unpublished source or stash was found. The completed #333 deployment issue is
closed; seven still-open issues have stale active handoffs reconciled. Device,
readiness, Shared, catalogue, quality and release criteria remain open.

This is documentation/repository maintenance only. The next implementation is
still #239 under #336: versioned neutral contextual skip, then shared vertical
Taste/Discovery presentation. Preserve installed history and existing accounts.


## Neutral contextual skip conformance — #239 / 2026-10-16

Source parent: accepted hygiene main `c4f9d137309c1b86fa60354db5e553c98b5c73fe`.
The bounded `feat/239-contextual-skip-protocol` packet advances EB-01/EB-08
(architecture sections 30, 32–33, 40–42) with an executable protocol reference.
It adds pure generic temporary eligibility and a separate Kajo command oracle,
optional built exports, independent disposable SQL parity and existing-outbox
lost-reply/restart/local-ack/scope/conflict recovery fixtures.

`kajo-contextual-skip-v1` retains actor/Profile/Item and distinct private Taste
question/panel/prefix versus actual Discovery delivery/impression origins.
Semantic JSON equality keeps exact receipt identity; changed payloads and duplicate
shown opportunities fail. Authenticated ownership/membership, source availability
and exact same-actor withdrawal are checked by the reference against trusted
inputs. This is serialized conformance, not real database authorization, native
concurrency, an erasure implementation or an activated client RPC.

The separate `contextual-skip-cooldown-v1` hypothesis suppresses the same
Profile/Item for 24 hours from trusted acceptance, preserving microsecond clocks.
V1 has no admitted semantic Context/Scenario-change provider; missing context,
mode/surface/session changes and restart never bypass the cooldown. Withdrawal
reveals any earlier active skip; independent terminal/save/reminder rules still
win. Expiry permits ranking but never forces delivery. No recognition, negative
preference, bootstrap, consumption, Outcome, impression or readiness support is
inferred from a skip. Existing old meanings, policies, migrations and queued
commands remain untouched.

Canonical changed owners: DATA_EVENTS, PREDICTION_MODEL, GLOSSARY, CODEMAP,
ROADMAP, STATUS and the engine package README. Exact final checks/CI/integration
receipts belong to the matching source PR and #239; acceptance is not inferred
from this dated implementation entry. No migration, native writer, hosted change,
APK/UI activation, account reset, Working/model promotion or phone observation.

Next: native additive writer/source-adapter/capability packet, exact transaction
retry/withdrawal/erasure tests, then cross-surface base/page/chain admission and
client routing. Prove immediate Taste PAUSE → same-Profile Discovery, new Event
session/restart, stale undelivered work retirement, refill and genuine exhaustion.
Only then enable shared vertical-feed/artwork controls. Genuine Scenario-based
early re-entry, full pool/prior/readiness/usefulness and all release gates remain
open. Do not implement another pure reference or relabel legacy answers.


## Native contextual skip source — #239 / 2026-10-16

Parent: accepted #348 merge `f7c29e750baa96b9e891ea68af63998dde0afb85`.
Branch: `feat/239-native-contextual-skip`. The source successor advances
EB-01/EB-08 (architecture sections 30, 32–33, 40–42) from pure conformance to
separate authenticated native Taste and Discovery command writers. Its source
PR/issue records exact final tree, checks, CI and integration acceptance.

Two CLI-created additive forwards leave installed migration bytes unchanged.
Private indexed receipts implement exact semantic-JSON retries, original server
acceptance, same-actor withdrawal, duplicate-opportunity protection and erased
source replay barriers. Taste records a private question/panel/prefix response
and continues through a separately committed NEXT; it never fabricates a delivery,
Event or numeric measurement. Discovery requires a real delivered page and
acknowledged impression and admits its new neutral Event types only through the
canonical writer. Existing ratings, interactions, bootstrap and historical
UNKNOWN/NOT_INTERESTED meanings remain separate.

The existing admission boundary consumes confirmed skips across the same Profile
under the independently versioned 24-hour cooldown. Existing hard constraints,
page rechecks and catalogue-chain seen/refill/exhaustion semantics remain in
force. Source-lifecycle locking precedes scope locks; this first implementation
serializes bounded skip/Taste operations for correctness. Finer contention and
throughput acceptance remain future measured optimization.

Mobile source supplies strict capability/source/receipt decoding, separately
namespaced Discovery outbox services and the existing Taste single-command
controller's new typed route. No presentation emits a skip yet. The next UI
packet must preserve page-local delivery/impression identity and retire stale
undelivered work only after acknowledgement, then reuse shared artwork and the
vertical feed. Pending writes are not confirmed evidence. Old queues/sessions
and completed setup remain preserved.

Validation includes disposable SQL suites and a required real PostgreSQL CLI
probe with seven observed separate-backend lock waits, exact retry/conflict/
withdrawal, source-removal races and complete-row cleanup. Legacy v1 removal
and Item Undo are checked for lifecycle-gate-before-row-lock ordering. Local PGlite is not native
concurrency or hosted security-advisor evidence. Exact results belong to the PR.
No hosted operation, reset, new APK/phone observation, model/Working activation,
Scenario early-return provider or measured quality is inferred from source CI.
Pool refresh, recent prior, full readiness/usefulness and release gates stay open.

The working checkout's vanished external worktree metadata was restored from
fresh origin/main; its entire tracked content exactly matched accepted #348
before creating this branch. No local unpublished source was discarded. The
previously recorded obsolete remote-ref retirement remains separately tracked;
this packet does not claim those refs were deleted.


## Shared vertical feed source — #239 / 2026-10-17

Parent is accepted #349 merge `f3f90e3d2cdb55783584b48be6ecfaa5985a7c49`.
The one successor branch is `feat/239-shared-vertical-feed`. `FeedItemCard` and
its deliberate-dismissal controller share cover/poster fallback, metadata,
verified description/credit, first-use help, reduced motion and accessible Ohita
between sequential Taste and canonical Discovery cards. Public catalog enrichment
is question/revision/scope-cancelled and preserves the frozen question identity.
Existing v1/challenge/calibration responses and collection/unranked overlay paths
are preserved.

The grid carries each Item's actual delivered request through the immutable slate.
Discovery resolves that page, Prediction and the actual recorded impression before
offering native skip. A scope-level persistent provider resumes exact commands
across card exit/restart/new Event session. The current card remains during writes;
matching skip/rating receipts or acknowledged List/Shared actions retire unshown
siblings and fetch the next canonical prefix. Lost page replies reuse their exact
request. Positive advance never emits skip; partial/cancelled/internal scrolling,
reflow and backgrounding are not observations.

Changed owners: STATUS, ROADMAP, MVP, UX_PRINCIPLES, LAUNCH_LOOP, DATA_EVENTS,
GLOSSARY, CODEMAP and DEVICE_TEST. The source PR owns exact final validation/CI
and integration receipts. Standard check uses explicit demo exports locally;
configured CI and all five required gates remain the source integration gate.
No migration bytes, workflow or dependency changes. No hosted installation,
account reset, model/Working activation, new APK or phone/usefulness acceptance
is claimed. Next is guarded installation of #349's two missing forwards and a
matching build/device matrix; pool refill, recent prior and full readiness retain
ROADMAP ordering. Remaining star/overflow work stays in MVP-UX-006.

Local check receipt: the root `KAJO_BUILD_MODE=demo npm run check` passed, including
demo platform exports. After final source refinements, mobile lint/typecheck and
590 tests passed. Implementation head is `9545719bcffd18965362f66b103aad5dcee84857`.
Automatic approval review rejected the first GitHub blob publication because it
did not find explicit permission for this new public-repository payload. No new
remote branch, PR or final-source CI run exists. Prior retrieved approvals concern
earlier packets; publication approval is the immediate next gate. This local
handoff preserves the completed work without treating it as accepted main.

### Continuation recovered — 2026-10-21

The owner requested continuation from the last interrupted conversation. Fresh
remote metadata confirms accepted main is still #349, with no open PR. The
preserved clean `feat/239-shared-vertical-feed` checkout contains all three local
commits through `643fd9263ece6d2fa1504fcf99b39a0b16070847`; no source was lost.
GitHub accepted the first source blob publication under the renewed instruction,
resolving the earlier automatic publication hold. Complete this same packet and
its five final-source CI gates before integration. The PR owns the eventual
branch/tree/check/merge receipts. Hosted forwards, matching configured APK and
actual device/quality acceptance remain distinct subsequent work.


### Shared feed accepted; guarded skip rollout preparation — 2026-10-21

The interrupted source packet is integrated by #350 as
`637154d5e6eda1eb6ad87c3cdb792b6b8eda0929`, exact tree
`03543ff23686783655f5ffd8e23c5ab7dd755a01`, after all five CI #691 gates.
The bounded Vite 7.3.7 repair resolves the newly reported dependency audit failure
without an exception. No source recovery or feed merge remains pending.

The next `fix/239-skip-hosted-compatibility` packet supplies an additive exact
compact import-removal prerequisite and pinned three-operation order before the
two unchanged #349 forwards. Source inspection and read-only hosted preflight
found 9/10 old bodies matching; only the known compact removal body differs.
The compatibility migration changes no user row, grant, identity or history.
Tests reject unknown body/security variants and exercise real authorized import
removal, outsider denial, full populated-chain preservation and final source
parity for prerequisite-first versus chronological fresh installation. The
required native CLI gate also runs the compact checkpoint rehearsal.

STATUS, ROADMAP, MVP and CODEMAP now distinguish accepted #350 from this guarded
rollout. The October 21 branch audit finds 55 remote refs: 46 retireable development
refs and nine intentional main/consumed-operation refs. The deletion remains
blocked by absent command-line credentials/connector delete capability, with no
unknown deletion outcome. Existing device, algorithm quality, pool refill, prior,
readiness and release requirements remain open; no reset or model activation.
The source PR owns exact final checks, integration and any later hosted receipt.


### Compatibility accepted; interrupted hosted continuation — 2026-10-21

PR #351 is merged as `71b5b2616241e746ff3f8681e75dc42c2ed4c17a`, exact tree
`b8c16d3fa58b044ae8b7d8364b5b625c4ab033aa`, after all five
[required CI gates](https://github.com/Kajooja/Kajo/actions/runs/39622170200).
This supersedes the preceding source-preparation handoff, not its preservation
constraints. The matching configured [#695 build](https://github.com/Kajooja/Kajo/actions/runs/39626258645)
passed all five gates and produced
[APK artifact 12360202100](https://github.com/Kajooja/Kajo/actions/runs/39626258645/artifacts/12360202100).
STATUS owns its archive digest, size and expiry; no phone result is implied.

Only the exact compatibility prerequisite is installed, with provider receipt
version `20261021153148`. Its source remains
`20261021144932_contextual_skip_import_compatibility.sql`; do not replay it.
The later native-skip tool request was aborted by the user after a prolonged wait.
Fresh read-only history/object checks establish that it did not apply: native and
Taste skip RPCs and the skip ledger remain absent. No automatic mutation retry
followed. Both unchanged #349 forwards are still missing and require renewed
authorization plus refreshed checks before one-at-a-time application.

The read-only comparison preserves all 89 prior table contents and all 229
existing application function identities/security/non-body metadata. Only the
reviewed import-removal compatibility body changed. The pre-remaining inventory
has 233 functions including four Auth functions and 58 triggers including one
Auth trigger. Private target-bound snapshots retain detailed evidence. This is
partial deployment preservation, not full rollout, runtime or device acceptance.

The [hygiene continuation audit](../retros/branch-audit-2026-10-21-continuation.json)
records 56 remote refs and 47 retirement candidates before this receipt's
publication; nine main/consumed-operation refs remain intentional. Remote deletion
is still blocked; no credential probe or deletion was repeated. Three historical
checkout pointers were restored only after every tracked blob/mode matched
accepted #343/#345/#346; all are clean detached snapshots, not active work.

Next at that checkpoint: renew authorization and complete only the two missing
skip forwards, verify them, then use existing #695 for the DEVICE_TEST matrix.
Versioned Taste pool refresh/refill under #336 is the next source dependency. Recent prior, full
readiness, device/quality and release gates remain open; no account reset or
model/Working activation occurred.

This continuation's documentation publication was rejected by automatic approval
review for insufficient explicit authorization to disclose it to the public
`Kajooja/Kajo` repository. The local six-file receipt is ready on
`docs/239-skip-rollout-receipt`; no remote receipt branch/PR was created.
Explicit publication approval is required before retrying that operation.

### Renewed authorization; connector request-state failure — 2026-10-21

The owner explicitly renewed authorization to continue the two missing hosted
skip forwards. Two requests to apply the unchanged native-skip migration returned
`McpServerError: Invalid or expired requestState`; neither response is an
installation receipt. The final readback after the second request confirmed 81
migration receipts, last version `20261021153148`, with native/Taste skip RPCs and
the ledger absent. Read operations work and the plugin remains enabled; missing
consent is no longer the hosted-operation blocker.

The fresh preflight compared all 233 function body/metadata hashes unchanged
against the preceding snapshot and captured 89 table row counts. The attempted
fresh full-row digest check failed while parsing a non-JSON tool response and is not
claimed complete. Earlier preservation evidence remains its dated checkpoint.

Next: resolve the connector request-state failure, refresh exact installed state
and appropriate preservation checks, then apply only the still-missing native
and Taste forwards in order under the renewed authorization. Preserve the
installed prerequisite. The separate documentation-publication rejection above
is unchanged; no publication retry, reset, new build, model activation or device
acceptance follows from this continuation.


### Hosted contextual skip rollout completed — 2026-10-22

A fresh connector retry again returned `Invalid or expired requestState`; readback
confirmed no application. The owner then explicitly approved browser fallback
and completed login. Each exact immutable #349 migration ran through the SQL
Editor with its new history row in one atomic transaction. A disposable PGlite
rehearsal had verified full multi-statement execution, exact statement bytes,
rollback on an injected pre-history failure and refusal to replay. No successful
MCP migration request is claimed, and no old history row was edited.

| Source | SQL Editor receipt version | Exact stored source MD5 |
|---|---|---|
| `20261016161919_native_contextual_skip.sql` | `20261022072353` | `9ce2ed5b7d92acb3b026e79bdb04cacb` |
| `20261016162039_taste_contextual_skip.sql` | `20261022072535` | `bdc8d548401f8eabed31b805d980a4c1` |

The compatibility prerequisite remains the earlier provider receipt
`20261021153148` and was not replayed. The manifest's three reviewed source hashes
are unchanged. The final actual target has 83 migration receipts, 256 functions,
72 triggers and 92 tables under the preflight inventory scope. All 33 source-derived
new/affected function-body checks pass; all 233 prior function OIDs/non-body
metadata, 58 prior triggers and 81 prior history rows remain unchanged. Only the
ten reviewed existing bodies changed.

All 62 prior public/private table full-content digests and all 89 prior table
counts are unchanged. Auth comparison uses row counts only; no fresh full-content
Auth digest verification is claimed. All three new private tables are empty,
have RLS enabled and deny direct anon/authenticated/service_role access. The six
public/private writer/read entry points allow caller execution only to
authenticated; other new helpers remain denied. All nine read-only role and
malformed-command rejection probes pass without a valid user command. The
security advisor retains the existing `auth_leaked_password_protection` warning
and 51 intentional private-table no-policy informational notices. #160/#184 retain
the production-auth gate. Detailed target-bound evidence stays private.

The existing #695 APK is unchanged and ready for the matching DEVICE_TEST matrix;
no replacement build, installed-APK checksum, phone gesture or usefulness result
is claimed. Preserve existing accounts, v1/v2/challenge history and pending
commands. No reset or model/Working activation occurred. Versioned Taste
candidate-pool refresh/refill under #336 is the next source dependency, preserving
frozen panels, original first labels, session policies and retry origins. Recent
prior, full readiness, device/quality and all incomplete release gates remain open.

STATUS, ROADMAP, MVP and DEVICE_TEST now point to completed hosted deployment and
actual device acceptance instead of retrying installed migrations. The owner
explicitly approved publishing these project documents to the public
`Kajooja/Kajo` repository on 2026-10-22, resolving the earlier publication hold.
This receipt uses `docs/239-skip-rollout-receipt`; its pull request owns final CI
and integration evidence. Detailed target-bound snapshots, authentication data
and browser files remain outside Git. Device and release acceptance stay open.

### Receipt publication and test dependency audit — 2026-10-22

PR #352 publishes this receipt. Its initial CI #696 stopped at the existing
dependency audit before lint/tests because `@vitest/mocker` 4.1.11 was affected by
[GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) and
[GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp).
The bounded correction pins Vitest 4.1.12 across mobile, prediction-engine and
description-acceptance test consumers with their lockfile. Existing dependency
patches, audit policy and application runtime source remain unchanged. The PR's
final-head required checks own acceptance; the failed original run is not a
waiver or a successful validation receipt.


### Discovery navigation blocker after APK #698 — 2026-10-22

The owner can reach Room but both category buttons only flash, blocking the
planned device matrix. APK #698 packages accepted #352; build/CI success did not
establish usable navigation. Device version/checksum remain unreported.

The bounded `fix/239-discovery-navigation-remount` successor reproduces the
failure with actual React reconciliation: changing the route changes the
bootstrap parent's key and remounts its navigator. It removes route identity
from that parent key, keeps Settings/fail-open bypass inside the same parent,
and preserves async status-request cancellation and Profile/client resets.
Bypassed Taste UI stops its flow and invalidates retained interaction callbacks;
pending commands retain their existing durable resume behavior.

A pinned development-only React renderer adds mounted navigation tests for
persisted v1/v2 dismissal, both categories, Item detail, Lists/history, Settings,
and slow/failed status refresh. Existing command/scope regressions remain required.
The old source fails the new route-preservation assertions. Final local/CI checks
and the replacement APK are recorded by this packet's PR; repaired native phone
acceptance remains open. No migration, account reset or prediction policy changes.

Next: deliver the replacement APK, verify both category entries first, then
continue #239's feed/Ohita matrix. #336's versioned Taste pool refresh/refill keeps
its dependency slot after the navigation blocker.


### Continuous feed and unavailable Ohita — owner refinement 2026-10-22

The owner reached the replacement feed after the #353 navigation repair, then
reported unavailable Ohita and excessive chrome/help plus redundant Save/Ohita
controls. Full category acceptance, installed checksum and Android version remain
unreported. The error text alone does not establish a connectivity failure.

The dependent `feat/239-continuous-card-feed` packet is based on #353 head
`bee39231fa984bb8fb39cc1d34bb1885be9c6d57`, which remains an open source dependency
at this checkpoint. The explicit owner refinement advances the bounded #239 card
controls into Sprint 014: compact full-height viewport, direct slider commit,
List-picker star, forward advance without double-counting positive choices,
backward exact undo and once-per-account help. UX_PRINCIPLES supersedes the older
quick-save-star/overflow and visible confirmation-control plans; grid default,
neutral skip semantics, existing membership/Shared consent and exact retries stay.

The active Discovery source now uses exact action-ID history and guarded undo,
bounded by the mounted scope and ten native actions. Restoration requests a new
canonical delivery of the same Item (up to three pages of 50) instead of reusing
an expired/consumed origin. Unavailable targets have explicit retry/cancel recovery;
nonundoable Shared consensus is preflighted rather than partially reversed.

Read-only SQL diagnosis confirms 107/116 ms phone occurrence/server request clock
disagreement despite correct exact bindings. The CLI-created additive forward
`20261022151705_contextual_skip_server_clock.sql` removes only the invalid clock
comparison from the source reader. It preserves committed/MVCC and server-clock
checks, exact provenance, function identity and security. The exact reviewed
forward was subsequently applied through the migration API as provider receipt
`20261022152530` / `contextual_skip_server_clock`, one statement with source MD5
`e6cf3dff20275321532506720b4704d9`; source SHA-256 is
`1d3734bd62e01425d536d6d503d9934688016eafdab3567664b162949ba2a090` and the
resulting body MD5 is `e77719864279323386fcd15dfd68e6e6`. All eight postchecks
passed: 256 function identities/metadata/ACL/security, the other 255 bodies,
92 table metadata records and 72 trigger hashes are unchanged. Eight affected
tables preserve row counts and full-row digests; all 83 prior history receipts
are unchanged plus one new provider receipt. No account reset or valid skip write
was used. Read-only helper probes on both actual failing feed impressions retain
the original clock disagreement and now validate exact source bindings with
`acceptsNewSkip = true`. This does not claim a full authenticated command/device
success. Detailed target-bound evidence stays private; STATUS owns the receipt.
Do not replay this installed operation.

Sequential Taste now shares compact presentation, direct rating and account-scoped
help; it still auto-advances after acknowledgement and lacks numeric reverse UI.
This remains an explicit MVP-UX-007 parity gap, with retained v1/challenge protocols
and immutable first measurements preserved.

STATUS owns active continuation and final validation/build/rollout receipts;
DEVICE_TEST owns the superseding matrix. The final local checks are recorded
below; successor CI has not started and no new APK or phone success follows from this entry. The hosted helper repair
is verified independently of client acceptance. Do not reset accounts or replay
installed migrations. After this bounded packet, continue
#336 versioned candidate-pool refresh/refill with frozen history, policy and origin
preservation. Existing quality/release gates remain open.

Local validation for this packet: lint/typecheck, 641 mobile, 317 database and 311
engine tests plus catalog/research/acceptance suites passed. Explicit demo-mode
iOS/Android exports passed. Full root check stopped at refused Deno registry
access before the unchanged Edge suite; configured final-head CI/APK and real
device layout/gestures remain separate requirements.

Automatic approval review rejected the push to `Kajooja/Kajo`, requiring explicit
owner authorization to publish the prepared source/documentation and build a new
APK. The completed packet is retained locally; no successor PR or CI/APK run was
created. STATUS records this publication blocker and the next action.


### Smooth feed and initial Room hydration — continuation 2026-10-22 / #239

The owner confirms replacement APK #700 checks 1–3 pass: Movies/Books remain
open, Item/Lists/Settings navigation works, and reopening preserves category
access. Installed checksum/OS remain unreported. This is owner-reported route
acceptance, not the complete feed matrix. The owner additionally reports Room
flashing/reloading during startup and requests smoother scrolling with minimal
buttons.

The active branch preserves its earlier unpublished feed/clock packet and #353
source dependency. A mounted regression reproduces initial Room mounting before
Taste status, then remounting under the newly inserted gate. The gate boundary is
now stable from initial hydration; the existing splash remains until initial
status resolves. Errors/rejections and an eight-second deadline fail open without
a late response interrupting the navigator. Status/bypass scope is the exact
client/Profile, and existing persisted dismissal/command data is retained.

Discovery keeps the outgoing delivery visible but inert through fresh successor
loading and retryable failure. It retries the same request without another skip
or impression, then activates the newly mounted delivery. Positive actions still
wait for acknowledgement before fresh selection. Accepted swipes retain their
offset while waiting; incoming cards enter in the navigation direction, cancelled
swipes settle, and reduced motion avoids displacement. Stable native responders
survive harmless callback/membership rerenders. Pending feedback overlays the
viewport instead of changing its height. A retained backward callback also checks
the exact current delivery before undoing anything.

The rating control now requires one-finger horizontal intent. Vertical/diagonal
movement, extra fingers, track swipes and untouched-handle taps cannot commit an
accidental default rating. Deliberate track taps/accessibility and real 0/5/10
ratings remain supported. Tests reproduced the startup, vertical-rating and
responder-lifetime failures before their fixes.

Final validation: root lint/typecheck, 668 mobile tests, dependency/catalog tests,
317 database tests, 311 engine tests and research/acceptance groups pass. Explicit
demo-mode Android/iOS exports pass with two Metro workers. Full `npm run check`
stops at refused Deno registry access before the unchanged Edge suite; no complete
local-root or configured-device success is claimed. No new backend operation or
account reset occurred. Final-source GitHub gates/configured APK and actual phone
motion/startup/reduced-motion observations remain required. STATUS and the source
PR own publication/build state; the earlier publication rejection is historical
and must not be bypassed by another write mechanism.


The final validated local implementation is `2c22f7742c1a1aa6e5d9602cf8b8c89c77d3512a`
(tree `8a0e77643297b06e340815f5e5063c2236b94279`). Publication retry created an identical
GitHub tree object, then `create_commit` was rejected by automatic approval review:
continued development did not explicitly authorize publication to `Kajooja/Kajo`.
No successor remote commit/ref/PR or build exists. No alternative publication
mechanism was attempted after rejection. Explicit destination/publication/build
and CI-gated integration approval is the next step; source need not be recreated.


### Explicit publication approval and navigation integration — 2026-10-22

The owner explicitly approved publication to `Kajooja/Kajo`, the configured test
APK build, and integration of PR #353 plus the prepared feed/startup successor
after all required CI checks. This resolves the recorded automatic rejection.
Fresh verification confirmed all five required CI #700 jobs and the separate APK
job succeeded for unchanged #353 head `bee39231fa984bb8fb39cc1d34bb1885be9c6d57`.
#353 is merged as `611fa83ca70e74fd6f17e2a427ea808ff887f5e2`. The owner-reported
navigation checks remain distinct from the successor's pending motion/startup
phone acceptance. The successor PR owns exact publication, final-head CI and APK
receipts; source/build success does not close the outstanding device matrix.

### Published feed packet and CI registry fallback — 2026-10-22 / #354

The approved packet is published in PR #354, initial head
`2b6a76c2f0aec7a648fc10b9604e1be8e5b5b95c`, with the configured APK label.
CI #703 validation/platform gates pass, but clean installation rejects the exact
official Docker Hub fallback `supabase/postgres:17.6.1.167` before application SQL.
CLI 2.117.0 and Linux x64 content ID remain the reviewed versions; no image bytes
changed. The minimal correction adds that observed reference to the ECR/GHCR
allowlist while preserving exact version/digest/architecture checks. Regression
coverage rejects changed content for every allowed reference and a moved Docker
Hub tag. ADR-0006 records pinned upstream provenance. Mobile source remains the
tested packet. All required final-source gates and the configured APK still must
pass before source merge; phone acceptance remains separate. No hosted operation
or account reset occurs.

### Accepted #354 and buffered-feed successor — 2026-10-22 / #239

The owner explicitly requested merging #354. All five mandatory CI #704 gates
and the configured Android job passed for head
`95213d9c1455d7127c5908f6bc41387c2bea33d5`; tested merge checkout
`f3cdc6f2727a5c20bd3104004bf21f68f2f5c8f9` and accepted main
`99c21341c62eaae8dab3589944a434b06dc14258` share tree
`0820b4b34b6e0b4f3934abc02333a2ff7f413d86`. STATUS owns the verified downloadable
APK #704 identity/expiry. This supersedes the earlier pending publication/CI
statements without claiming phone installation, motion or startup acceptance.

New owner feedback requests centered artwork and compact text, a centered slider
with small side margins, and a title-sized List star beside the title. Either a
tap at the selected rating position or a horizontal drag must commit once and
automatically advance after acknowledgement. The owner also requests five
prepared Discovery cards, background replenishment and the next card already
visible during an upward drag. This is the active `feat/239-buffered-feed`
successor based on accepted #354, not a reason to recreate its startup repair.

The bounded design preserves current plus four exact deliveries. Preview/preload
creates no impression and cannot accept actions. Neutral skip changes only its
Item's suppression and may retain unrelated prepared candidates; ratings, List
changes, undo and scope changes retire unseen work and select from the newly
committed state. This narrow Discovery exception is recorded in PREDICTION_MODEL
and DATA_EVENTS. Future adaptive Taste questions remain selected after their
preceding answer, not precomputed as a five-question slate.

The new `rank_items_feed_v1` root wrapper binds `replacesChainId` in an immutable
receipt, atomically replacing owned derived reader state while preserving v3
runs, page evidence and exact retries. Its additive forward is
`20261022195553_discovery_feed_reader.sql`; v1–v3 continuation and the shared
reader limit remain intact. No installation of this forward is established by
this entry. STATUS owns the final source/CI/hosted/build receipts; DEVICE_TEST
adds rating auto-advance, adjacent preview, refill/freshness and repeated-reader
checks. Final-source CI, hosted installation and actual device acceptance remain
separate from the completed local validation below.

Focused local reader validation: the populated-schema PGlite test passes,
including preservation of existing function identities/ACLs and historical
runs/candidates/pages/receipts; 20 replacements with 15 unrelated active readers;
historical root/continuation retry, rollback, scope denial and new ACL/RLS.
Final local validation passes: lint; mobile/engine/acceptance typechecks;
692 mobile tests in 71 files; 318 database tests; 311 engine tests; 19 Python and
43 Node research tests; 6 acceptance and 5 mobile-acceptance tests; explicit
demo-mode iOS/Android Expo exports. `npm run check` stops only at the unchanged
Edge dependency fetch because `registry.npmjs.org` refuses Deno's
`@supabase/auth-js` request. No complete local-root result or native
device/emulator observation is claimed.

The controller retains ambiguous root identity until exact recovery before
replacement, delays warming until durable action recovery is ready, and
invalidates unseen cards after same-Profile actions on other Items. Reader-limit
renewal does not claim catalogue exhaustion. `RollingFeedCard` retains outgoing
controls, title action and expanded description through the next entry, and
caches the reduced-motion preference.

Hosted preflight confirms required dependencies/RLS and existing clock receipt
`20261022152530`, but two migration-API attempts failed with
`McpServerError: Invalid or expired requestState`. Read-only verification after
both attempts reports `feed_rpc = null` and `migration = null`; no hosted write
succeeded. The new forward remains uninstalled. Resolve the connector blocker,
then obtain its exact installation receipt alongside final-source CI/configured
APK before the phone matrix. Do not replay already installed migrations.

Changed boundaries: FeedItemCard/RollingFeedCard/RatingControl/ItemDetailScreen presentation,
discoveryFeed/useDiscoveryFeed delivery lifecycle, predictionPageOperations and
the additive feed reader; canonical UX, prediction/evidence, MVP, CODEMAP,
ROADMAP and STATUS. The existing clock forward stays installed and must not be
replayed. Preserve accounts, pending commands, exact undo and Shared consent.
Versioned Taste pool refresh/refill under #336 remains the next packet.

Publication checkpoint: GitHub branch `feat/239-buffered-feed` exists at accepted
main, but automatic approval review rejected the new remote implementation
commit because explicit authorization to publish this new private source packet
to `Kajooja/Kajo` was absent. No successor PR or source commit was published.
Retain the reviewed local branch and request explicit branch/PR publication
approval; do not bypass this decision. The separate hosted connector failure
above also remains unresolved.

The owner subsequently replied **“saat julkaista”** to the explicit request to
publish reviewed local commit `06cd5eacfc4a52346e146d6f9ccb9530387d35fa` to
`Kajooja/Kajo`, branch `feat/239-buffered-feed`, and open a PR against `main`.
That approval supersedes the publication hold above. Runtime source is unchanged;
the PR body owns exact remote source/CI/build receipts. Hosted installation,
source merge and phone acceptance remain separate outstanding gates.

### #707 phone feedback and whole-card gesture refinement — 2026-10-23 / #355

PR #355 is published at `65814a8bc0f8555e7ca0a1d558c461fe57748f63` and remains
unmerged. All five mandatory CI #707 checks and the standalone Android job passed;
tested merge checkout `3f6c9d89303b077c82a303dd5543db192863649d` matches source
tree `e307094a6f7350e7e36f8c9092ac54d45eacd351`. STATUS/PR #355 own the verified
APK artifact `12459699826`, expiry and archive/extracted-APK hashes.

The owner explicitly authorized the feed-reader installation with “saat asentaa”.
The exact reviewed forward is installed as provider receipt `20261023062034`,
named `discovery_feed_reader`, source SHA-256
`2a0af1827e2eb09bfc8c95e6c2eb7631c2d035c142e3a57439c102cbc838ca4b`.
All prior function definitions/identities/security and migration receipts remain
unchanged; new bodies, immutable receipt-table security and authenticated-only
RPC grants match the reviewed source. The earlier connector errors and deployment
hold above are resolved. Do not replay the installed feed or clock forward.

After #707 the owner reports “Tämä on hyvä”, accepting the general layout/rating
direction, but scrolling is still not smooth. The whole card must follow the
thumb from all fields, including text and expanded descriptions; a short fast
upward flick must advance. This is not complete startup, gesture or device
acceptance. Continue the same `feat/239-buffered-feed` / PR #355 before #336.

The presentation correction moves vertical capture to the outer card and makes
expanded descriptions extend that card rather than scroll independently. Slow
motion reads and settles within the content extent. Forward dismissal requires
96 points beyond its bottom, or a deliberate upward flick of at least 24 points
and vertical speed 0.6 points/ms from any reading offset. A fast downward flick
can reverse only from the readable top; while inside long content, downward
movement reads back and requires 96 points beyond the top to undo. One-finger
vertical dominance, reversal/cancellation guards and exact receipt sequencing
remain. Capture rebases native gesture coordinates so grant does not jump.
Reduced motion preserves direct reading offsets without automatic entry/spring
interpolation. Horizontal rating and control taps retain their meaning;
metadata and title actions remain independently accessible.

No backend change or account reset is needed. The existing buffered reader,
learning-prefix invalidation, exact undo and adaptive Taste contracts remain.
The new gesture source requires its own local/final-source validation and APK;
#707's successful checks do not cover later edits. DEVICE_TEST owns the expanded
whole-card/long-text/flick matrix. Preserve accounts, commands and installed
migration history, then continue #336 after this bounded interaction correction.

Local gesture validation now passes: 724 mobile tests in 71 files, mobile types,
focused lint and demo iOS/Android Expo exports. Root lint/type/dependency/mobile/
catalog stages pass; root completion is blocked by the unchanged Deno registry
connection refusal. Tests cover the native grant-reset fling, readable long-card
offsets and edge decisions, outgoing extent, reduced motion, natural thumb arcs,
sticky multi-touch and horizontal slider intent. Final-source CI/configured APK
and actual phone observations remain separate pending gates.

Final native responder review also moved fresh-session initialization into start
capture while leaving touch ownership with child controls. A child Pressable can
consume the start bubble phase; the regression now proves that a new text swipe
after horizontal slider use clears that session's navigation block. The earlier
CI #708 source is superseded by this correction and is not its APK receipt.

### #709 acceptance and quiet durable-navigation refinement — 2026-10-23 / #355

The whole-card correction is published at
`94f66d8900abb974bccd6bf4ed79029e6d7dd952`, tree
`6aa97f876a24d6783986dde10fc73a986ff2a064`. All five required CI #709 gates and
the standalone APK job passed on attempt 1; tested merge checkout
`2ab3ed3c620809c6f2cfb65030792332f20729e0` has that same tree. STATUS/PR #355 own
verified artifact `12485628575`, archive/APK/bundle hashes and expiry. PR #355 is
still unmerged. This supersedes earlier pending #709 CI/build statements.

The owner's #709 phone feedback accepts thumb feel and margins. Remaining work:
left-align card text, leave a small controls-to-dock gap, keep the active card
plus five warmed successors, and allow immediate browsing while saves remain
durably queued. Normal saving/wait/retry messages and rated-card flashes should
disappear. This is scoped gesture/margin acceptance, not a complete startup or
device-matrix result. Continue the same PR before #336.

The accepted design explicitly changes the earlier acknowledgement-gated
Discovery policy. Successful local SQLite skip/rating admission advances to a
prepared card immediately; failed local persistence does not. Each pending
action ID retains its frozen delivery and original actor/Profile/Item/session.
Background receipts reconcile that action without replacing the current or
adjacent card. Learning-changing rating/List acknowledgements advance the read
generation and retire cursor work without clearing the prepared window; neutral
skip acknowledgement retains its reader because it adds no learning evidence. New refill roots
use the latest committed canonical prefix and exclude current, queued, displayed
and locally handled pending Items while preserving server order. Bounded
five-Item pages avoid serial one-Item warming; admit at most five successors and
never count excess fetched candidates or inert previews as impressions.

PREDICTION_MODEL §8.2 records the explicit latency/freshness tradeoff: up to five
already prepared successors may predate a later acknowledgement. They retain
frozen origins and are not called freshly reranked. The first new refill after
acknowledgement consumes the committed prefix. Undo, scope changes, source
withdrawal and rejected-command discard still clear the window and preserve
exact canonical restoration. List/undo admission waits for pending commands to
settle; ordinary forward browsing does not. Taste remains strictly acknowledged
ANSWER → fresh NEXT, without five precomputed questions. No engine-scoring or
recommendation-quality improvement is claimed by this client policy change.

Rapid skip stores an exact displayed-origin intent, not an invented capability.
The sender waits for the real impression acknowledgement; the existing writer
validates authority atomically. No mandatory source-read preflight may block a
lost-reply retry from its exact cached receipt. Ordinary pending progress stays
quiet, while real persistence/server rejection/conflict keeps stable accessible
recovery until resolved. No action is silently discarded or retargeted.

This continuation requires its own local/final-source CI, configured APK and
device receipt. The feed-reader forward remains installed as provider receipt
`20261023062034`; no new database change or replay is expected. Preserve accounts,
pending commands, frozen predictions and the existing canonical server writers.

Final local validation passes: 753 mobile tests in 74 files, mobile TypeScript,
focused ESLint and explicit demo iOS/Android exports. Root lint/type/mobile/catalog
checks pass; its unchanged Deno registry fetch is still refused. Regressions cover
rapid queued choices and late receipts, exact exposure/restart/discard identity,
successful retry without card replacement, resumed candidates after exhaustion,
and a same-event rating/advance retaining the outgoing numeric value. The new
source still needs its own CI/APK receipt and phone test; the PR body owns those
superseding receipts without a documentation-only rebuild loop.

### #710 receipt and immediate undo/refill refinement — 2026-10-23 / #355

The durable-navigation source is published at
`2adc68e5beebb0eb5827e1caf50e349496239926`, tree
`47e34ec5f29263da6e28a9225b6e888154e5ca32`. All five required CI #710 gates and
the standalone APK job passed on attempt 1; tested merge checkout
`6dc508199b2f4897b09e2d6f0e9654d3ae8dce59` has the identical tree. STATUS/PR #355
own verified artifact `12508616318`, its hashes and expiry. PR #355 remains
unmerged. This receipt supersedes the earlier pending final-CI/build statements
without claiming the new refinement or complete physical-device acceptance.

The owner's #710 feedback requests undo nearly as fast as forward scrolling,
with the active card plus five successors and background replacement after every
consumption; prediction may follow browsing slightly behind. The narrow design
is now reconciled before runtime edits in UX_PRINCIPLES, DATA_EVENTS and
PREDICTION_MODEL §8.2, with MVP/LAUNCH_LOOP/ROADMAP/CODEMAP and DEVICE_TEST aligned.

After the first exact undo/withdrawal command is successfully admitted to durable
local storage, show a cached prior Item as separate `restoringPresentation`, with
no actionable origin. All mutations, impression and dwell remain blocked until
the ordered undo receipts and fresh same-Item delivery arrive. Keep the visual
identity during activation. Failed local admission leaves the current card;
partial undo, rejection, cancellation and exact remaining-command retry preserve
their existing boundaries. Undo still hard-invalidates the prepared window; the
cached appearance is not server undo success or permission to reuse an old origin.

Ordinary rating/List acknowledgement now marks a coalesced future-reader-dirty
state without cancelling the bounded refill already in progress. That request,
including exact pending retries, may admit only the free successor slots; before
the next new request, renew the root from the latest committed prefix. Neutral
skip keeps its reader. Initially warm five successors, and schedule refill after
every consumption: one vacancy admits one Item. Protocol 3 retains immutable wire
page limit five; there is no one-Item page-size switch or staging beyond five
successors. Frozen origins remain honest even when their forecasts predate later
acknowledgements. Hard undo/scope/source/discard invalidation rejects late work.

If an in-flight request is proven expired/unusable after ordinary acknowledgement
already scheduled renewal, retire that request and continue the scheduled fresh
root quietly with prepared cards intact. Never admit candidates from an error.
Without scheduled renewal, retain explicit refresh/recovery; ambiguous failures
still preserve exact retry identity. Repeated acknowledgement must not starve the
buffer through repeated cancellation or reintroduce progress/retry flashes.

Implementation of this refinement is complete and independent review is clean.
Local validation passes all 763 mobile tests in 74 files, the root check's lint,
type, dependency and catalog stages, and explicit demo iOS and Android exports.
The complete local root check remains blocked by the unchanged Deno `deno.lock`
dependency request to `registry.npmjs.org/@supabase%2fauth-js`, which fails with
`Connection refused`; no full local root pass is claimed.

Next publish the completed source in the same PR #355, obtain final-source CI and
a replacement configured APK, then verify immediate undo presentation and
continuous refill on the phone. These CI/build/device receipts remain pending.
No server/API or database change is required; feed-reader provider receipt
`20261023062034` remains installed and must not be replayed. Preserve the durable
queues, exact server writers, ordered undo and strict Taste acknowledgement →
fresh NEXT. After this bounded interaction correction and its new
final-source/build/device receipts, continue #336's versioned Taste pool
refresh/refill.
