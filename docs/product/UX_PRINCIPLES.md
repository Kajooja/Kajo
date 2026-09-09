# Kajo UX Principles

## Core feeling

Kajo should feel calm, personal, atmospheric and intelligent. It should not feel like a dashboard, analytics tool, casino UI, futuristic control panel, 3D game or registration funnel disguised as a product.

The first-time experience has one additional rule:

> **Show value before asking for commitment.**

A person opening a Kajo link should be able to begin using Kajo immediately, build an initial taste state and see credible personalized value before being asked to continue with Google or Apple.

## Core product principles

1. **The Room is home after activation.** The Room is the authenticated product's primary navigation metaphor. It stays visually clean rather than accumulating account/settings controls.
2. **Taste-first is the public front door.** External Taste/Friend links open directly into the Taste experience, not a login screen, marketing landing page or empty Room.
3. **Registration is continuation, not reset.** Google/Apple conversion happens only after useful Taste/challenge/preview value is visible, and the user enters the app with cold start already completed.
4. **Do not fake intelligence.** Taste challenge scores, explanations and confidence language must reflect actual frozen predictions and documented metrics. Prefer understandable low-sample wording to false precision.
5. **Taste Test is interaction, not a questionnaire.** Show recognizable real Items one at a time. Unknown must be easy to skip. Do not require genre forms, demographics or long preference surveys.
6. **The test adapts quietly.** The next Item may be chosen for information gain/recognition, but UI should remain simple. Do not expose algorithm machinery unless it helps trust.
7. **Preview before CTA.** After the challenge, show a small unseen recommendation preview before the primary Apple/Google continuation action.
8. **Personal invites feel personal but remain consent-based.** An invite may identify the inviter in restrained copy after server authorization. Receiver explicitly accepts Friendship; opening a link never silently creates a social relationship.
9. **Friendship is lightweight.** Accepted Friends appear on a simple Friends surface. Friendship does not create a joint Room/Profile automatically and does not expose private taste history.
10. **Shared Kajo is intentional.** From Friends, creating `yhteinen Kajo` should be one short explicit flow. SharedProfile is a learned place/context, not a hidden side effect of a referral.

## Authenticated Kajo principles

11. **Navigation stays compact.** Domain discovery begins from Room objects. Account/Profile/Lists/Friends/Groups management belongs in restrained persistent navigation rather than Room clutter.
12. **Minimal persistent shell.** Top: Kajo Home mark + global DiscoveryMode curtain. Bottom: menu + active Profile identity/SharedProfile quick switcher + Inbox. Do not add a conventional multi-tab bar without explicit product decision.
13. **Profile switching starts at home.** Top Kajo mark returns to the active Profile Room. Bottom-center identity also returns home from other routes; when already home, it opens the lightweight Profile quick switcher. Full management remains on canonical Groups surfaces; the planned Friends surface follows the launch contract.
14. **Sign out is secondary account navigation.** `Kirjaudu ulos` belongs in account/drawer navigation, not the Room.
15. **Illustrated 2D first.** The Room may use restrained 2.5D depth through overlap/light/blur/shadow but remains a fixed illustrated mobile surface. No free camera, virtual walking or game-like 3D world.
16. **Content is more important than chrome.** Posters/covers and atmosphere carry visual interest.
17. **Kajo brings the light.** Product identity is expressed through light and atmosphere rather than many colored controls.
18. **Theme identity persists.** Active Profile theme is the base visual layer. Secondary authenticated routes may blur/dim the same Room background instead of replacing it with opaque generic screens.
19. **Context transitions are smooth.** Moving from Room to discovery/detail should feel like moving deeper into the same Kajo.
20. **Curtain is the single global DiscoveryMode control.** Exactly `FOR_YOU`, `SURPRISE`, `RISK`; downstream screens inherit it rather than introducing duplicates.
21. **DiscoveryMode is visible as restrained atmosphere.** FOR_YOU → dawn/day, SURPRISE → evening, RISK → night. AmbientPhase is presentation; DiscoveryMode is prediction policy.
22. **Visual preference is not risk preference.** Dark aesthetic choice does not imply risky recommendations.
23. **Grid first, swipe optional.** Grid is default discovery. Swipe is calibration/browsing tooling, not the product itself.
24. **Committed choices behave consistently.** Rating/not-interest/List actions give restrained confirmation and advance appropriately. List addition remains the positive/like action; no duplicate Like control.
25. **Recent choices are reversible.** Undo restores prior state and exact Item/card when deterministic reversal exists.
26. **Copy is presentation, not domain semantics.** User-facing labels may change while canonical Event/state meanings remain stable.

## Shared Kajo principles

27. **Shared Kajo feels like a place.** Switching to SharedProfile changes Profile context, theme and joint recommendation behavior, not merely a filter.
28. **Shared recommendations are already shared.** Do not create a parallel `Ehdota yhteiseen` recommender surface.
29. **Shared positive action is collaborative.** Choosing a custom List in Shared discovery creates actor-specific Endorsement/pending proposal, not immediate membership or Saved state.
30. **Pending and consensus are visually distinct.** Pending proposer/List provenance and explicit approval remain readable without relying on color alone. Only unanimity produces durable consensus and Shared Saved/list commit.
31. **Lists and discovery are different surfaces.** Consumed/saved/List history persists even when ordinary discovery suppresses an Item.
32. **Shared provenance is truthful.** List membership retains original proposer/added time where defined; UI does not invent actor provenance.
33. **List choice stays lightweight.** Compact single-destination picker shows bounded recent choices with expansion/new-list creation on demand.
34. **Messaging stays Profile-scoped and quiet.** Inbox combines relevant invitation/message activity. Message failure must not roll back successful List action.

## Motion and accessibility

35. **Motion communicates state.** Animation explains transitions/atmosphere, not attention capture.
36. **Reduced motion is first-class.** Continuous Kajo glow/fire/window motion settles or disables according to user preference.
37. **Meaning never relies on color alone.** Gesture controls have accessible alternatives and text scales without blocking core actions.
38. **Taste link accessibility is a release gate.** The web/mobile Taste route, challenge, auth continuation and invite acceptance must work with screen readers/large text and without precision gestures.
39. **External round trips are explicit.** Browser → auth → app/store continuation must explain where the user is and preserve progress; no dead-end or “start over” path after successful Taste responses.
40. **Error states preserve trust.** If prediction, auth or invite resolution fails, say what can be retried without fabricating recommendations or social state.

## Approved Room visual direction

The canonical Room is a **warm, minimalist straight-on 2D cabin/living-room illustration**, not a smart-home UI or game world. It uses softly rounded shapes, restrained texture and a muted palette. Window, fireplace, TV/screen and fully visible bookshelf form one calm front elevation; a narrow floor/rug/bench gives only enough depth to read as a place.

- Fireplace + rug/bench provide warmth and identity.
- Bookshelf is the clear BOOK entrance.
- Low shelf with TV/screen is the clear MOVIE entrance.
- Window carries outside light/sky/time-of-day atmosphere.
- Curtain remains the single functional DiscoveryMode control.
- Base asset should not bake runtime window/fire glow; phase-aware light layers remain separately controllable.
- Window Kajo may breathe slowly and fire flicker gently; reduced motion disables continuous movement.
- Home interaction geometry follows the actual image crop; tap regions match visible functional objects.
- Prefer broad matte shapes and restrained shadows over photorealism, neon, glassmorphism, sci-fi chrome or decorative clutter.
- No standalone `Huone` heading/helper copy is required inside the scene.

DiscoveryMode atmosphere may alter the same scene:

- `FOR_YOU`: brighter morning/day and smallest warm flame.
- `SURPRISE`: darker/warm evening and larger flame.
- `RISK`: night/moon with largest restrained cooler-accented flame while remaining inviting.

## Initial Room vocabulary

- Fireplace: ambient warmth / identity light.
- Window: outside light and scene.
- Curtain: DiscoveryMode.
- Bookshelf: books.
- TV/screen: movies.

Friends, SharedProfiles, Inbox, Lists and account actions belong to persistent navigation rather than extra Room wall objects unless a later domain genuinely benefits from a new spatial metaphor.

## Browse completion

Discovery may show a bounded contextual row of active Profile Lists. Catalog search/normalized filters are explicit browse constraints and are not durable taste merely because the user searched. Authorized Profile/Group/Friend filtering must never expose unrelated private identities.

## Launch-loop UX acceptance

Before the Share Link Gate, validate the actual path on representative mobile browsers/devices:

```text
open link
→ first Taste interaction without login
→ bounded adaptive test
→ honest holdout challenge
→ recommendation preview
→ Google/Apple continuation
→ authenticated Kajo with taste preserved
→ create/send Friend invite
→ receiver Taste/auth/accept
→ Friends surface
→ explicit SharedProfile creation
→ joint recommendation
```

A polished Room cannot compensate for a broken acquisition path. Conversely, acquisition polish must not compensate for weak or dishonest recommendation quality.
