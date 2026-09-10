# Collection device checkpoint — #228 / #229

Status: **prepared; reset approval pending, device acceptance not started**.
`STATUS.md` owns the live reset/publication state. Do not infer acceptance from this plan.

## Version and build

- Active branch: `feat/228-delivered-origin`; draft PR #229, Issue #228.
- Runtime code checkpoint: `2cb204f1666229c3391d9e467c47c33e00c16c12`.
  Later handoff/reset-script commits do not change the app code.
- CI #429 / run 34485606516 succeeded for that runtime checkpoint. Required native
  database checks belong to that CI run; local `npm run check` passed 325 tests.
- Hosted history-clear migration: `20260910134428_clear_consumed_history`, verified.
- After reset approval/execution, select **Actions → CI → Run workflow**, choose
  **feat/228-delivered-origin** and run it once. Download the artifact
  `kajo-android-standalone-<run commit SHA>` containing `app-release.apk`.
- Ordinary PR runs skip the APK job by design. Manual workflow_dispatch builds it
  after the five required jobs succeed. Do not poll the build or claim an APK exists
  before its artifact is actually available. The owner can download when ready.
- Record the actual run/commit and installation result with the device feedback.
  Keep the PR draft and main unchanged until the required gates and owner tests pass.

## Reset prerequisite

`scripts/database/owner-device-reset.sql` is a one-time operational script, not a
migration. Its default final statement is ROLLBACK. It was rehearsed on hosted
Postgres, but the committed form was rejected by automatic approval review.
**No permanent reset has occurred.**

The reviewed scope is both current accounts: preserve Auth/accounts/nicknames,
catalog and Personal List names; replace PersonalProfile IDs, empty their list
contents and choices, and remove all Shared groups and their invitations/messages.
Old Events/sessions, receipts/undo heads, imports/bootstrap evidence, Predictions
and dependent shadow state are cleared. Global baseline/model configuration is
preserved; the script refuses unexpected learned Profile assignments/evaluations.

New Profile IDs are the stale-client boundary. The rehearsal verifies a real old
rating envelope, an old collection command and an old Event session cannot write;
a new Profile can rate through the real API. No queue namespace or schema change
is needed. The identity/count guard prevents an accidental immediate second reset.
After explicit approval of this scope, recheck scope, execute the same reviewed
transaction with only its final ROLLBACK changed to COMMIT, and verify the result.
Then update this status and STATUS before asking for device testing.

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
