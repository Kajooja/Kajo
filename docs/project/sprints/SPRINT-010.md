# Sprint 010 — Navigation & Profile lifecycle

Status: **ACTIVE — IMPLEMENTATION COMPLETE, DEVICE ACCEPTANCE PENDING**

## Goal

Make Kajo navigation quiet and predictable before named lists are introduced. The Room remains the visual home of the active Profile, while global navigation lives in a restrained bottom dock and side drawer. Tighten Profile identity boundaries and make SharedProfile membership safely reversible.

## Scope completed

### Navigation shell — #136 / PR #142

- Top Kajo brand always returns to the Room of the currently active Profile.
- Persistent profile/inbox controls were removed from the top header.
- Small bottom dock:
  - left: three-line menu opens the side drawer,
  - center: restrained active PersonalProfile/SharedProfile name,
  - right: mailbox opens Inbox and shows a numbered invitation badge.
- Side drawer sections:
  - **Profiili** — PersonalProfile and active Profile context,
  - **Listat** — visible as `TULOSSA` until Sprint 011 provides a real destination; no dead route,
  - **Ryhmät** — opens full SharedProfile management and shows up to five ready SharedProfiles for direct switching.
- Personal ↔ Shared switching stays in the current view and keeps the shell mounted.
- SharedProfile invitation Accept/Reject and contextual `ITEM_SUGGESTED` remain intact.

Main navigation commit: `646999330758cf15a4cef6b929fef2b76990048d`.

### Profile lifecycle — #137 / PR #141

- Nickname maximum: **24 characters**.
- SharedProfile name maximum: **32 characters**.
- PostgreSQL, provisioning/onboarding and typed mobile validation enforce the limits.
- `leave_shared_profile` requires authenticated existing membership.
- `Poistu ryhmästä` requires destructive **Oletko varma?** confirmation.
- Leaving the active SharedProfile immediately falls back to PersonalProfile.
- Leaving removes pending invitations involving the departing member for that group.
- If one member remains, SharedProfile/history stays but the Profile becomes provisional and is not selectable as a ready SharedProfile.
- If the final member leaves, the zero-member SharedProfile is deleted.
- Privileged `complete_personal_profile` logic lives in `private`; public RPC is a SECURITY INVOKER wrapper.

Hosted migration: `20260901082902_profile_lifecycle_limits_and_leave`.

A later duplicate lifecycle merge produced commit `0db2ec37ef2b9d90585ec21c7614d1083cde88d6` with the same tree as its parent and no runtime changes. **PR #141 remains the canonical lifecycle implementation.**

### Nickname input consistency — #143 / PR #147

- Onboarding nickname input `maxLength = 24`.
- Sign-up nickname input `maxLength = 24`.
- No auth/backend behavior change.

Final Sprint 010 runtime main commit: `60db8aae63bd1f86e8cc1cabb132294643b17a4b`.

## Verification completed

### Hosted database

- Existing production data required no nickname/group-name truncation.
- Pre-migration lifecycle/leave rollback suite: **11/11 passed**.
- Personal-profile public/private wrapper suite: **3/3 passed**.
- Post-migration production leave smoke: **5/5 passed** in rollback with no QA residue.
- Security advisor no longer reports `public.complete_personal_profile` as an exposed SECURITY DEFINER function.

### Mobile CI

PR #141:
- lint: pass
- typecheck: pass
- tests: pass
- iOS + Android bundle smoke: pass

PR #142:
- lint: pass
- typecheck: pass
- tests: pass
- iOS + Android bundle smoke: pass

PR #147:
- lint: pass
- typecheck: pass
- tests: pass
- iOS + Android bundle smoke: pass

Final-main workflow `33496770667`:
- lint: pass,
- typecheck: pass,
- tests: pass,
- iOS + Android bundle smoke: pass,
- standalone Android APK build/upload: pending at the time of this document update.

## Device acceptance

Use only a fresh standalone Android APK built from final Sprint 010 runtime main `60db8aae63bd1f86e8cc1cabb132294643b17a4b`.

Check:

1. Top Kajo mark always returns to the active Profile Room.
2. Top header remains clean; no duplicated profile/inbox controls.
3. Bottom-left three-line button opens the side drawer.
4. Drawer shows the correct active identity and sections `Profiili`, `Listat`, `Ryhmät`.
5. `Listat` has no dead navigation before Sprint 011.
6. Up to five ready SharedProfiles are directly selectable.
7. Personal ↔ Shared switching does not show the auth/startup loading screen.
8. Bottom-right mailbox opens invitation Inbox; badge count is correct.
9. Accept/Reject invitation still works.
10. SharedProfile management shows `Poistu ryhmästä`.
11. Cancelling the confirmation changes nothing.
12. Confirming leave removes membership; if that SharedProfile was active, Kajo falls back to PersonalProfile.
13. Remaining one-member SharedProfile is provisional; zero-member orphan is deleted.
14. Nickname input stops at 24 characters and SharedProfile name input stops at 32.
15. Normal BOOK/MOVIE discovery, rating, save, DiscoveryMode and Room navigation still work.
16. While a ready SharedProfile is active, open an Item and press **Ehdota yhteiseen** once.

## Sprint 009 residual gate

Sprint 009 issue #125 remains open only because real-device `ITEM_SUGGESTED` evidence has not yet appeared in hosted Events.

Other corrected-device evidence is already verified in hosted data:

- SharedProfile interactions and Events now persist where the failed build had 0/0,
- both real members appear as their own actors,
- Personal/Shared Item state is isolated,
- 53/53 inspected Shared impression Events were prediction-traced across 9 predictions.

After device step 16, inspect the resulting hosted `ITEM_SUGGESTED` Event (`profile_id`, actual `actor_user_id`, Item/type, DiscoveryMode and `properties.source = ITEM_DETAIL`). Then close #125 if correct.

## Next sprint

After Sprint 010 device acceptance and #125 residual evidence:

- **Sprint 011 / #102 — Named Lists & Collaborative Curation**
- Lists are Profile-owned generic `ItemList` records and can mix Item types.
- Save chooses/creates a target List.
- List/card views, sorting/filtering and Shared added-by metadata are built without duplicating canonical interaction/rating state.

Do not start Profile chat (#138) before the list model is stable. ScenarioMemory follows list/chat MVP work.