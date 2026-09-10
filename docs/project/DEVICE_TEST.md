# Collection device checkpoint — #228 / #229

Status: **third owner APK result recorded: only multi-List selection reported missing; correction awaits its own APK acceptance**.
`STATUS.md` owns the live reset/publication state. Do not infer acceptance from this plan.

## Version and build

- Active branch: `feat/228-delivered-origin`; draft PR #229, Issue #228.
- Previous device-plan runtime: `2cb204f1666229c3391d9e467c47c33e00c16c12`.
  The current PR adds initial-history and picker corrections. Use the new PR
  head for the follow-up and record the actual artifact SHA before testing.
- Historical CI #429 / run 34485606516 succeeded for the previous runtime.
  New-head CI/rollout truth belongs to STATUS. The earlier runtime passed 333
  local tests; never treat its CI as the new correction’s CI.
- First history-correction runtime: `b8ff101d5284f23cc90b42fd94cd5d24ca4de7df`, all five required
  CI #434 / run 34496017165 jobs passed. Later filename/docs changes retain its
  app code. This PR CI run did not build an APK; use the manual workflow below.
- The second destination-picker runtime is `07b12ea86f3952844d475de9e8f02670a8381ffb`.
  The owner now reports the APK tested, with only multi-List selection missing.
  Installed run/SHA was not supplied. The multi-destination correction changes app
  and server code; use the latest branch build on both accounts for its next test.
- Hydration forward `20260910153737_bootstrap_history_projection` is deployed;
  hosted behavior and access checks passed. No repeat deployment needed; the
  owner's subsequent repeat reset is recorded below.
- Hosted history-clear migration: `20260910134428_clear_consumed_history`, verified.
- Select **Actions → CI → Run workflow**, choose
  **feat/228-delivered-origin** and run it once. Download the artifact
  `kajo-android-standalone-<run commit SHA>` containing `app-release.apk`.
- Ordinary PR runs skip the APK job by design. Manual workflow_dispatch builds it
  after the five required jobs succeed. Do not poll the build or claim an APK exists
  before its artifact is actually available. The owner can download when ready.
- Record the actual run/commit and installation result with the device feedback.
  Keep the PR draft and main unchanged until the required gates and owner tests pass.

## Reset prerequisite

`scripts/database/owner-device-reset.sql` is a scoped operational script, not a
migration. The first explicitly approved reset was verified at 14:19:19 UTC.
After the correction rollout the owner explicitly requested the same full reset
again to repeat testing. The second reviewed transaction was rehearsed with
ROLLBACK, then executed with final COMMIT. Separate verification at
**2026-09-10 15:54:09 UTC** confirmed 2 accounts, 2 fresh PersonalProfiles and zero
Shared groups, Events, interactions, bootstrap evidence, List entries, imports,
receipts, Predictions, invitations and messages. Both authenticated app API checks
report available/required calibration with zero strong evidence.
The retained script defaults to ROLLBACK and requires a separately reviewed scope
digest, deliberately omitted from version control; the saved script cannot run.
Preserve subsequent test data unless the owner explicitly requests another reset.

Auth/accounts/nicknames, catalog and Personal custom List names were preserved.
PersonalProfile IDs were replaced; old choices/history/import evidence and group
invitations/messages were removed. Global baseline/model configuration survives.
The reset verified rejection of real old rating/collection/Event-session writes
and successful new-Profile rating in a rolled-back probe. No new schema or queue
namespace was needed. Current legitimate testing will increase the zero counts.

On the phone, fully close the old app and open the new APK; sign out/in if the
old profile remains displayed. Existing login accounts remain valid. Old selections
must not return. Test-only choices should be made only after the reset checkpoint.

## Owner test sequence

1. **Initial state and modes.** Open books and movies after login. No old ratings,
   list contents or Shared groups remain; Personal List names may remain. Cards
   load, and opening/swiping preserves the delivered collection order. Switch all
   three risk modes; judge stability, not a requirement that every order differ.
2. **Two Lists.** Select a Personal List and press Add; repeat for a second List
   in the same picker, then press Done. The saved Item disappears from ordinary
   Discovery. Remove it from one List: the remaining List still suppresses it.
   Remove its final membership: it can return unless another reaction suppresses it.
3. **History.** Rate an Item (also test 0/10). Open Luetut/Katsotut from both
   Discovery and Lists. Both show the same Item, cover and given rating. Open its
   card, edit the rating and save to another List. No mock-only "item not found".
4. **History removal.** Poista historiasta clears the rating/consumed marker after
   acknowledgement. A saved Item remains on its Lists and stays suppressed there.
   An otherwise unreacted Item becomes recommendation-eligible; it need not appear
   immediately within a ranked top subset. Re-rate it and verify the new rating.
5. **Layouts and refresh.** Use Ruudukko/Kortit on named Lists, Saved and history.
   Pull down on Discovery, the List index, individual Lists and history, including
   empty/short views. Repeat offline → reconnect. Ordinary load recovery uses the
   gesture. Separate pending-mutation recovery controls remain intentional.
6. **Durability and undo.** Save/rate/reject, background or fully close during saving,
   reopen and reconnect. No duplicate reaction or false exposure-save failure.
   Undo the latest supported rating/rejection/List addition; List removal and
   history removal are deliberately not undoable. A past-version undo is not valid.
7. **Shared isolation.** Create a new Shared group, join with the second account,
   and verify the green RYHMÄTILA flag below the risk selector. Personal mode lacks
   the flag. Shared proposals/approvals still require the existing consent flow;
   completed Shared Saved removal remains unavailable and must say so honestly.
8. **Scope changes.** Switch Personal/Shared/account while a save or read is pending.
   No other Profile's cards, messages or completion feedback may leak into the
   current view. Return to verify each action in its original Profile.

Report each number as pass/fail plus exact error text/screenshot and the APK SHA.
After results, record them in Sprint 014 and STATUS, fix failures first, and only
then consider merge/branch cleanup. This checkpoint does not close DATA-003/004,
all algorithm quality gates, or the Share Link Gate automatically.


## Owner results — 2026-09-10

Owner requested documentation only; fixes will start in the next conversation
with “jatka reposta”. The actual installed APK SHA/run was not supplied, so these
are owner-reported device results, not verified exact-build acceptance. The planned
branch/runtime remains the one above. OnePlus system navigation was explicitly
reported; OS/model details are not yet known.

| Test | Owner result | Follow-up |
| --- | --- | --- |
| 1 | Works | Initial profiling feels too short. Suggested approximately 10 movies then 10 books, with a clear transition card before the book section. Product proposal, not an implemented fixed limit. |
| 2 | Multi-list saving works | On OnePlus, the destination picker opens under the system bottom navigation and buttons are hard to press. It should rise above Kajo's bottom navigation like other panels. |
| 3 | History flow works | Ratings entered during initial profiling are missing from Luetut/Katsotut. |
| 4 | History removal works exactly as requested | Retain this accepted behavior. |
| 5 | Layouts/pull refresh work | No new defect reported. |
| 6 | Durability/undo works | No new defect reported. |
| 7 | Future invitation UX idea | Add small “lähetä linkki” text below Send invitation, revealing a link with one-tap copy. Implement only in the appropriate future link phase. Do not infer acceptance of every group subcase from this answer alone. |
| 8 | Scope switching works | Shared views still contain Items rated by a member during initial profiling. Investigate bootstrap/native eligibility and provenance; not a cross-account data leak claim. |

Next regression focus: picker bottom clearance with gesture and three-button
navigation; initial-profile ratings visible/editable/removable in history; equivalent
initial-profile evidence respected in Shared eligibility. Preserve the explicit
attributed member-history tier where intended rather than blindly hiding every
member-rated Item. Record which tier the reported cards use. At this feedback
checkpoint the owner asked to preserve test data for reproduction; the later
explicit repeat-reset request above supersedes that instruction.

## Focused follow-up after correction rollout

The owner-requested repeat reset is complete. Fully restart the app, sign out/in
if needed, and complete initial profiling again. Recreate a Shared group with the
second account for the Shared cases. This reset does not change the current
six-known-rating completion rule or implement the planned longer Taste flow.

1. Open Luetut/Katsotut: initial ratings now appear alongside native ratings.
   Open an initial Item from history and from a named List; both show the same
   rating. Edit it, undo the native edit, and confirm the initial rating returns.
   Check a zero rating and an imported consumed-only Item if available.
2. Remove an initial-rated Item from history. It disappears from consumed views,
   its rating disappears on Lists, and List memberships survive. After the final
   List membership is removed it becomes eligible if otherwise unreacted; a top
   ranked return is not guaranteed. Re-rate and verify the new rating.
3. Switch to Shared. Initial-rated member Items are marked “name nähnyt/lukenut”
   in the lower member-history tier, after ordinary unseen candidates. A pending
   proposal may still take priority under the accepted rules. Such Items must
   not appear in Shared's own consumed history merely because a member rated them.
   Clearing one member's history must preserve the other member's attribution.
4. On OnePlus, test the destination picker with both gesture and three-button
   navigation. All buttons sit above Kajo's dock and the system bar. Open “Uusi
   lista” and the message field: keyboard, scrolling, close, creation, multiple
   saves and Done remain usable, including a short screen/larger text setting.

Record device/OS, exact installed APK SHA, and pass/fail for each item. The local
environment has no phone/emulator, so layout and keyboard acceptance are still open.

## Second owner results — 2026-09-10 / after the requested repeat reset

The owner ran the manual APK workflow and reported these six cases; the actual
run/installed SHA was not supplied. The requested branch checkpoint was `621a03c`;
do not infer exact-build acceptance from that expected source alone.

| Case | Owner result | Current follow-up |
| --- | --- | --- |
| 1 — reset/initial profiling | Works | With the planned longer Taste flow, keep unknown/skip usable after accidental rating-wheel movement; LAUNCH_LOOP owns this requirement. |
| 2 — initial history/edit/undo | Works | Preserve accepted behavior. |
| 3 — history removal/re-rating | Works | Preserve accepted behavior. |
| 4 — picker bottom alignment | Fails | The panel is still too low; align its lower edge with the other panels above the Kajo dock. |
| 5 — Shared attribution/isolation | Works | Preserve accepted behavior. |
| 6 — create destination while adding an Item | Fails | Creating the first List immediately endorsed the Item and advanced the card. Require create/select → optional message → explicit Add/Propose. |

A read-only action check confirmed that List creation was followed immediately by
a Shared endorsement from the picker. This case concerns the destination List
inside an already active SharedProfile; it does not redefine group membership.
The Item was hidden from the endorser's Discovery by the accepted pending-choice
policy, not deleted from the catalog. Do not undo/reset the owner's test actions.

Additional owner observation: refresh changes the order. The owner explicitly
welcomes variation for ties; investigate only unexpected scored ordering. Current
SQL applies a decaying 30-minute impression cooldown, and the client uses server
rank. A bounded read of recent delivered ordinary candidates found no descending
score violations and did find cooldown effects. Isolated regression must cover
unequal taste priority with unchanged evidence, exposure-driven rotation, cooldown
expiry and Profile isolation. This is not a broad algorithm-quality acceptance.

## Next focused APK check

Use the latest branch APK and existing test data; the owner starts its CI manually.

1. On OnePlus, the picker sits above the Kajo dock like Inbox. Check gesture and
   three-button navigation, larger text, scrolling, keyboard, Back and close.
2. In a SharedProfile with no custom Lists, message and Propose are unavailable.
   Create its first List: it is selected, the same Item stays open and no proposal
   has been made. Write a message and press Propose; only success advances the card.
   Verify the proposal and message from the other accepted member's account.
3. Disconnect before Propose: retain the Item/draft and show failure. Reconnect
   and retry without losing the intended destination; distinguish pending delivery
   recovery from a new command. Changing account/Profile must not reuse the draft.
4. Personal mode: select → Add for two Lists, then Done. Both memberships survive.
   Creating a third List alone never saves/hides the current Item. Check the
   preserved initial-history edit/clear and Shared attribution as a brief regression.
5. Katsotut/Luetut → Kortit: an Item saved as 8 starts with the handle at 8 and
   the rating badge agrees before touching the control. Repeat with 0 and 10,
   native and initial/import ratings where available, adjacent cards, reopening
   and pull refresh. Edit 8→6, reopen to 6, Undo and confirm the saved predecessor
   reappears. Opening/browsing must not submit a new rating. A consumed-only Item
   has no fabricated rating. Check Personal/Shared isolation. This newly reported
   case is open; no correction is claimed by the planning update.

Report the run/installed SHA, device/OS and pass/fail. Longer Taste/unknown control
work remains planned; no new reset is needed for these picker corrections.

## Additional owner report — saved rating start position

Reported **2026-09-10** while the next APK is still building; the owner will test
when ready. In Katsotut card browsing, the rating handle should initially sit at
the last saved score, for example 8. The installed version for this report is
unknown. This is a current history correctness follow-up under #228/#229,
not part of the future statistics or multi-select feature.

Source inspection at runtime `07b12ea`: RatingControl initializes its animated
position with getRatingPosition(rating); ItemDetailScreen passes
interaction.rating and keys the control by Item/rating. ConsumedHistoryScreen
renders ratings returned by loadConsumed, but useCollectionNavigation carries only
Items and collection identity; Detail reads the independently hydrated
ItemInteractionContext. A stale/missing map entry is a plausible investigation
path, not a reproduced root cause. Verify both data values and the actual visual
position before adding a targeted regression/fix.

The execution environment disconnected during this follow-up. No local runtime,
npm check or real-device reproduction was possible, and no speculative code fix
was published. Preserve the report and existing test data; the five cases above
are the next owner acceptance checkpoint.

## Third owner results — 2026-09-10 / APK tested

The owner reports the APK tested and names only inability to choose multiple
Lists as remaining. Treat the earlier picker placement/create→message interaction
as working per this report, without inventing an installed SHA or comprehensive
termination/offline/slider test evidence. The earlier saved-rating-position report
is no longer separately reported as failing; no speculative slider fix was made.

The requested Shared rating-round/rewatch flow is recorded in Issue #232 and
first-release canonical requirements. It is not part of this picker APK.

### Next multi-destination APK check

The owner starts the CI workflow. Install the latest branch artifact on both test
accounts/devices; earlier versions cannot approve a multi-List proposal. Preserve
current profiles and test data; no reset or local Docker is needed for a standalone
APK using the hosted backend.

1. Personal: check two Lists before pressing Add. Both retain the Item. Create a
   third List while checks exist: earlier checks stay selected and creation alone
   keeps the card open. Add, then Done. Optional message references the chosen Lists.
2. Shared: A chooses two Lists, optionally writes a message and proposes once.
   B sees both names, then approves; both memberships appear together with A’s
   provenance. A’s pending proposal alone must not put the Item in either List.
3. Disconnect during the decision: recover the original pending command, without
   duplicates or a half-completed Shared approval. Personal completed destinations
   remain confirmed while unresolved choices stay selected. Changing Profile
   discards the old draft and never sends it under the new Profile.
4. Briefly recheck picker/dock/keyboard placement, new-List→message→confirm and a
   saved 8/0 history card’s initial rating position. Record exact build/device and
   pass/fail; automated checks do not replace this device acceptance.
