# Sprint 010 — Navigation & Profile lifecycle

Status: **ACTIVE — RUNTIME COMPLETE, FINAL DEVICE ACCEPTANCE PENDING**
Milestone: **MVP 0.1**

## Goal

Make Kajo navigation quiet and predictable before collaborative curation and named Lists. The Room remains the visual home of the active Profile; global navigation lives in a restrained top/bottom shell and side drawer.

## Delivered core

### Navigation shell — #136 / PR #142

- top Kajo mark returns to the currently active Profile Room,
- top header stays visually minimal,
- bottom dock contains:
  - left three-line menu,
  - center active Profile identity,
  - right Inbox/mail control with invitation badge,
- menu opens a Profile-aware side drawer,
- drawer contains Profile context, Lists placeholder and Groups navigation,
- up to five ready SharedProfiles can be switched directly,
- Personal ↔ Shared switching keeps the current route mounted.

Main navigation commit: `646999330758cf15a4cef6b929fef2b76990048d`.

### Profile lifecycle — #137 / PR #141

- nickname maximum **24**,
- SharedProfile name maximum **32**,
- PostgreSQL + typed mobile validation enforce limits,
- `leave_shared_profile` requires accepted membership,
- `Poistu ryhmästä` requires destructive `Oletko varma?` confirmation,
- leaving active SharedProfile falls back to PersonalProfile,
- one remaining member keeps provisional SharedProfile/history,
- final member leaving deletes zero-member SharedProfile,
- pending invitations involving departing member are cleaned,
- privileged PersonalProfile completion logic lives in `private` behind a public SECURITY INVOKER wrapper.

Hosted migration: `20260901082902_profile_lifecycle_limits_and_leave`.

Verification:

- lifecycle/leave rollback suite **11/11 pass**,
- PersonalProfile wrapper suite **3/3 pass**,
- production leave smoke **5/5 pass** with rollback/no QA residue.

### Nickname input consistency — #143 / PR #147

Both AuthGate nickname inputs stop at 24 characters.

Runtime main before final polish: `60db8aae63bd1f86e8cc1cabb132294643b17a4b`.
Its main workflow passed lint, typecheck, tests, iOS/Android bundle smoke, standalone release APK and embedded JavaScript bundle verification. Configured Android review reported this build working.

## Final polish — #149 / PR #150 — MERGED

Merged main commit: **`c10a4edc736965f3184cca3e477e2e4ccb9210ca`**.

PR #150 CI passed lint, TypeScript, tests and iOS/Android bundle smoke.

Delivered after configured Android review:

1. bottom-center active Profile name is another Home action and returns to the active Profile Room,
2. `Kirjaudu ulos` moved from Room to the bottom of the side drawer,
3. standalone `Huone` heading removed,
4. `Huone on Kajo. Valitse kirjat tai elokuvat.` helper copy removed,
5. home content between global bars is only the visual Room/navigation objects,
6. obsolete separate `Ehdota yhteiseen` panel/helper/tests removed before Sprint 011's Shared Endorsement model.

## Sprint 009 dependency resolved

Sprint 009/#125 is closed and accepted. The old residual `ITEM_SUGGESTED` requirement was intentionally superseded rather than force-tested because the separate suggestion UI is no longer part of the product.

## Final device acceptance

Use a standalone Android build from current main containing `c10a4ed` and verify:

- top Kajo mark returns Home,
- center active Profile identity also returns Home,
- Room shows no standalone title/helper/sign-out chrome,
- drawer opens from bottom-left,
- `Kirjaudu ulos` is at drawer bottom and works,
- Inbox still opens from bottom-right,
- Personal/Shared switching remains seamless,
- Groups management/leave confirmation still works,
- BOOK/MOVIE navigation and DiscoveryMode remain intact,
- no `Ehdota yhteiseen` panel remains.

No new runtime architecture should be added to Sprint 010 after this check. If this passes, close Sprint 010 and start #151.

## Next sprint

Sprint 011 starts with **#151 Shared discovery member-history suppression + Endorsement consensus** before **#102 named Lists**.

Do not implement #102 first: Shared `Tallennetut` system-list semantics depend on #151 unanimity/pending-Endorsement behavior.

After #151:

- #102 builds system/custom Lists and list browsing,
- #138 Profile messaging comes only after Lists are stable,
- ScenarioMemory remains after those MVP foundations.