# Sprint 010 — Navigation & Profile lifecycle

Status: **ACTIVE — IMPLEMENTATION MERGED, DEVICE ACCEPTANCE PENDING**

## Goal

Make Kajo navigation quiet and predictable before named lists are introduced. The Room remains the visual home of the active Profile, while global navigation lives in a restrained bottom dock and side drawer. Tighten Profile identity boundaries and make SharedProfile membership safely reversible.

## Scope

### Navigation shell — #136 / PR #142

- Top Kajo brand always returns to the Room of the currently active Profile.
- Remove persistent profile/inbox controls from the top header.
- Add a small bottom dock:
  - left: three-line menu opens the side drawer
  - center: restrained active Profile/SharedProfile name
  - right: mailbox opens Inbox and shows a numbered invitation badge
- Side drawer sections:
  - **Profiili** — PersonalProfile and active Profile context
  - **Listat** — visible as `TULOSSA` until Sprint 011 provides a real destination; no dead route
  - **Ryhmät** — opens full SharedProfile management and shows up to five ready SharedProfiles for direct switching
- Personal ↔ Shared switching stays in the current view and keeps the shell mounted.
- Existing SharedProfile invitation Accept/Reject and `ITEM_SUGGESTED` Item-detail action remain intact.

### Profile lifecycle — #137 / PR #141

- Nickname maximum: **24 characters**.
- SharedProfile name maximum: **32 characters**.
- Enforce limits in PostgreSQL, provisioning/onboarding and typed mobile validation.
- Add `leave_shared_profile` with authenticated membership checks.
- `Poistu ryhmästä` requires destructive **Oletko varma?** confirmation.
- Leaving the active SharedProfile immediately falls back to PersonalProfile.
- Leaving removes pending invitations involving the departing member for that group.
- If one member remains, SharedProfile/history stays but the Profile becomes provisional and is not selectable as a ready SharedProfile.
- If the final member leaves, the zero-member SharedProfile is deleted.
- Move privileged `complete_personal_profile` logic to `private`; public RPC is a SECURITY INVOKER wrapper.

### Follow-up — #143

- Align the two AuthGate nickname input `maxLength` values with the canonical 24-character limit. Backend and typed validation are already correct; this is UI consistency before Sprint 010 acceptance.

## Verification completed

### Hosted database

- Existing production data required no nickname/group-name truncation.
- Pre-migration lifecycle/leave rollback suite: **11/11 passed**.
- Personal-profile public/private wrapper suite: **3/3 passed**.
- Production migration: `20260901082902_profile_lifecycle_limits_and_leave`.
- Post-migration production leave smoke: **5/5 passed** in rollback with no QA residue.
- Security advisor no longer reports `public.complete_personal_profile` as an exposed SECURITY DEFINER function.

### Mobile CI

PR #141:
- lint: pass
- typecheck: pass
- tests: pass
- iOS + Android bundle smoke: pass

PR #142 after clean rebuild on current main:
- lint: pass
- typecheck: pass
- tests: pass
- iOS + Android bundle smoke: pass

Main navigation commit: `646999330758cf15a4cef6b929fef2b76990048d`.

## Device acceptance

Use a fresh standalone Android APK built from final Sprint 010 main after #143 is merged.

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

## Sprint 009 residual gate

Sprint 009 issue #125 remains open only because real-device `ITEM_SUGGESTED` evidence has not yet appeared in hosted Events. Other current SharedProfile device evidence is strong: Shared interactions/events persist under the SharedProfile, actor identity remains separate, Personal/Shared state is isolated, and prediction impressions are traceable.

During device acceptance, open an Item while a ready SharedProfile is active and press **Ehdota yhteiseen** once. Then verify hosted Event fields before closing #125.

## Next sprint

After Sprint 010 device acceptance and #125 residual evidence:

- **Sprint 011 / #102 — Named lists**
- Lists are Profile-owned and can mix Item types.
- Save chooses/creates a target list.
- List/card views, sorting/filtering and Shared added-by metadata are built without duplicating interaction/rating state.

Do not start Profile chat (#138) before the list model is stable. ScenarioMemory follows list/chat MVP work.