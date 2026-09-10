# Collection device checkpoint — #228 / #229

Status: **owner results recorded; follow-up defects open**.
`STATUS.md` owns the live reset/publication state. Do not infer acceptance from this plan.

## Version and build

- Active branch: `feat/228-delivered-origin`; draft PR #229, Issue #228.
- Runtime code checkpoint: `2cb204f1666229c3391d9e467c47c33e00c16c12`.
  Later handoff/reset-script commits do not change the app code.
- CI #429 / run 34485606516 succeeded for that runtime checkpoint. Required native
  database checks belong to that CI run; local `npm run check` passed 325 tests.
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

`scripts/database/owner-device-reset.sql` is a one-time operational script, not a
migration. After explicit owner approval, its reviewed transaction was executed
with final COMMIT. Separate verification at **2026-09-10 14:19:19 UTC** confirmed
2 accounts, 2 fresh PersonalProfiles and zero Shared groups, Events, interactions,
List entries, imports, receipts and Predictions. **Do not execute the reset again.**
The retained script defaults to ROLLBACK and rejects the now-changed reset scope.

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
2. **Two Lists.** Add one Item to two Personal Lists in the same picker. Each List
   shows its saved state and Done closes once. It disappears from ordinary
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
member-rated Item. Record which tier the reported cards use. Do not reset the
new test data again: it is useful evidence for reproducing these defects.
