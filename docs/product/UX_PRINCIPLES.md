# Kajo UX Principles

## Core feeling

Kajo should feel calm, personal, atmospheric and intelligent. It should not feel like a dashboard, analytics tool, casino UI, futuristic control panel or 3D game.

## Principles

1. **The Room is home.** The home scene is not decorative wallpaper; its objects are the primary entrances to content domains. The Room itself should stay visually clean rather than accumulating account/settings controls.
2. **Navigation stays compact.** Domain discovery begins from Room objects. Account/Profile/Lists/Groups management belongs in the restrained side drawer opened from the bottom dock. The bottom-center active Profile identity may expose a lightweight SharedProfile quick switcher, but full group management remains on the canonical Groups page. The drawer's Lists section may expose fixed Saved/consumed-history routes plus at most three actor-local most-used custom Lists without duplicating the full Lists screen.
3. **Minimal persistent shell.** Top: Kajo Home mark + global DiscoveryMode curtain. Bottom: menu + active Profile identity/SharedProfile quick switcher + Inbox. Do not add a conventional multi-tab bar unless an explicit later product decision reverses this rule.
4. **Home and Profile switching have distinct controls.** The top Kajo mark returns to the active Profile Room. The bottom-center active Profile identity opens up to five actor-local recent/most-used SharedProfiles plus `Näytä lisää`; selecting one changes the existing Profile context, while `Näytä lisää` opens the existing Groups page. PersonalProfile remains available through the existing Profile/drawer flow. Do not create a second Profile state or group-management surface.
5. **Sign out is secondary account navigation.** `Kirjaudu ulos` belongs at the bottom of the side drawer, not in the Room scene.
6. **Illustrated 2D first.** The Room may use lightly layered 2.5D depth through perspective, overlap, light, gradients, opacity, blur and shadow, but it must remain a simple illustrated surface. No virtual walking, free camera, rendered 3D world or game-like room interaction.
7. **Content is more important than chrome.** Posters/covers and Room atmosphere carry visual interest.
8. **Kajo brings the light.** Product identity is expressed through light and atmosphere rather than many colored buttons.
9. **Theme identity persists.** Active Profile theme is the base visual identity across areas. One edge-to-edge Room backdrop persists below every authenticated route: it stays sharp and interactive on Home, while secondary screens blur and dim the same scene so mainly its light and Kajo remain visible. Approximately 70%-opaque surface-color tokens keep text fully opaque while allowing that atmosphere to remain subtly visible through headers, drawers, cards and secondary screens. Do not introduce white gutters or an opaque page canvas between the Room and route content.
10. **Context transitions are smooth.** Opening bookshelf/screen should feel like moving deeper into the same Kajo, not loading an unrelated app.
11. **Curtain is Kajo's global DiscoveryMode control.** Exactly `FOR_YOU`, `SURPRISE`, `RISK`; drag/tap settles on one canonical state. Downstream screens inherit it and do not add competing selectors.
12. **DiscoveryMode is visible as restrained atmosphere.** FOR_YOU -> calm dawn/day, SURPRISE -> warmer sunset/evening, RISK -> night/moon with a restrained cooler fireplace accent. AmbientPhase is presentation; DiscoveryMode is recommendation policy.
13. **Visual preference != risk preference.** Dark aesthetics do not imply risky recommendations.
14. **Grid first, swipe optional.** Grid is default discovery. Swipe is optional calibration/browsing tooling.
15. **Committed choices behave consistently.** Explicit feedback gives restrained visual confirmation and rotates the current Item appropriately without game-like effects. Rating preview is 0–10, but persistence happens only on tap/release; the committed value remains visible for about 500 ms before advancing. A successful `Lisää listaan` is the positive/like action and advances after visible confirmation; a separate Like button must not duplicate it.
16. **Recent choices are reversible.** Undo/back restores prior current state and exact Item/card when deterministic reversal exists.
17. **Copy is presentation, not domain semantics.** Labels such as `Tykkää`, `Tallenna`, `Luettu` may differ by Profile context while canonical Event/state meaning remains explicit and stable.
18. **Shared Kajo feels like a place.** Switching to SharedProfile changes Profile context/theme and joint recommendation behavior, not merely a filter.
19. **Shared recommendations are already shared.** Do not add a parallel `Ehdota yhteiseen` recommendation surface. The normal Shared discovery feed is the common-taste surface.
20. **Shared positive action is collaborative.** In Shared discovery choosing one custom List creates that member's actor-specific Endorsement and a pending List choice, not immediate membership. It disappears from that actor's normal queue and is surfaced first to other non-endorsing members.
21. **Pending and consensus are visually distinct.** A pending card uses a restrained green top bar such as `Mirri lisäsi listaan Meidän illat` with an explicit `Hyväksy` action. Only unanimity produces `Pari!`, commits the chosen custom-List membership and promotes to Shared `Tallennetut`; meaning must remain readable without relying on green alone.
22. **Lists and discovery are different surfaces.** An Item consumed by any member disappears from ordinary Shared discovery but may remain visible in Saved/custom Lists/history with current watched/read/rating state.
23. **Shared List provenance begins with the proposer.** Discovery approval commits the chosen custom-List entry only at unanimity while preserving the first actor and proposal time as added-by/added-at provenance.
24. **List choice stays lightweight.** Discovery opens a single-destination bottom bar, ordered by the actor's most recently used List. Show at most five choices initially; `Lisää` expands the rest and new-List creation stays collapsed until requested.
25. **Messaging stays Profile-scoped and quiet.** Inbox combines invitations and unread Profile threads. A List message is optional and collapsed by default; a failed send remains retryable without changing the successful List action.
26. **Motion communicates state.** Animation explains transition/atmosphere, not attention capture.
27. **Accessibility remains required.** Gesture controls need accessible alternatives; motion respects reduced-motion settings; meaning must not rely solely on color.

## Approved MVP Room visual direction

The canonical visual reference is a **warm, minimalist straight-on 2D cabin/living-room illustration**, not a modern smart-home interface or a video-game room. It uses softly rounded shapes, low contrast, restrained paper-like texture and a small muted palette. Window, fireplace, TV console and the fully visible bookshelf form one calm front elevation; a narrow floor strip, rug and bench add just enough depth without perspective. It remains one fixed illustrated mobile surface rather than a navigable 3D space.

- **Fireplace + rug/bench** provide the main feeling of warmth and identity.
- **Bookshelf** is the clear BOOK entrance.
- **Low shelf with TV/screen** is the clear MOVIE entrance.
- **Window** carries outside light, sky and time-of-day atmosphere.
- **Curtain** remains the single global DiscoveryMode control; it is functional, not decorative duplication.
- The Room should use restrained overlap and light to feel like a place without introducing perspective; every navigation object must remain immediately readable and easy to tap.
- Furnishings should read as calm, simplified cabin symbols rather than rectangular UI placeholders. Keep the composition flat, balanced and safely inside tall-phone crop boundaries.
- Window and fireplace are two independent runtime Kajo sources. The base Room asset must not bake either source's bloom, beam or cast light into the scene; their phase-aware light layers are positioned and animated separately in the mobile UI. Both sources use soft, uneven alpha falloff rather than hard-edged flat overlays, while the rest of the Room gains progressively deeper shadow. Window Kajo breathes slowly, fireplace Kajo flickers gently and DiscoveryMode changes cross-fade the full atmosphere. Reduced-motion preference disables continuous motion and settles immediately.
- Home interaction geometry is anchored to the source illustration and mapped through the actual `cover` crop. The MOVIE target covers the TV screen only, and the BOOK target covers the bookshelf only; visual press feedback remains nearly transparent.
- Prefer broad matte shapes, soft geometry, generous calm areas and restrained shadows over photorealism, pixel/game art, painterly concept art, glossy surfaces, neon, glassmorphism or sci-fi chrome.
- Do not add decorative objects merely to fill space. New Room objects require a real content-domain/navigation purpose.
- Do not introduce heavy animation, parallax spectacle, complex moving scenery, avatars or game mechanics for MVP.
- No standalone `Huone` heading or helper instructions are needed inside the scene.

DiscoveryMode atmosphere may alter the same scene without rebuilding it:

- `FOR_YOU`: bright morning, low sun, calm clouds and the smallest warm flame.
- `SURPRISE`: slightly darker afternoon, changed cloud position and a larger warm flame.
- `RISK`: dark night, moon/stars and the largest restrained cooler/blue flame while keeping the Room inviting rather than ominous.

## Initial Room vocabulary

- Fireplace: ambient warmth / identity light.
- Window: outside light and scene.
- Curtain: global DiscoveryMode control.
- Bookshelf: books.
- TV/screen: movies.

SharedProfile switching, Inbox, Lists, Groups and account actions belong to the persistent shell/drawer rather than adding more Room wall objects.

Additional Room objects should be added only when a new content domain genuinely benefits from a clear spatial navigation metaphor.
