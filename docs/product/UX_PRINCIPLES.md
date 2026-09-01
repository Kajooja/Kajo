# Kajo UX Principles

## Core feeling

Kajo should feel calm, personal, atmospheric and intelligent. It should not feel like a dashboard, analytics tool, casino UI or 3D game.

## Principles

1. **The Room is home.** The home scene is not decorative wallpaper; its objects are the primary entrances to content domains. The Room itself should stay visually clean rather than accumulating account/settings controls.
2. **Navigation has two sources: Room or side drawer.** Domain discovery begins from Room objects. Account/Profile/Lists/Groups navigation belongs in the restrained side drawer opened from the bottom dock.
3. **Minimal persistent shell.** Top: Kajo Home mark + global DiscoveryMode curtain. Bottom: menu + active Profile identity/Home + Inbox. Do not add a conventional multi-tab bar unless an explicit later product decision reverses this rule.
4. **Home is redundant in a useful way.** Both the top Kajo mark and the bottom-center active Profile identity return to the active Profile Room. They do not change Profile context.
5. **Sign out is secondary account navigation.** `Kirjaudu ulos` belongs at the bottom of the side drawer, not in the Room scene.
6. **2D only.** Use layered 2D surfaces, light, gradients, opacity, blur, shadow and subtle movement. No virtual walking or 3D world interaction.
7. **Content is more important than chrome.** Posters/covers and Room atmosphere carry visual interest.
8. **Kajo brings the light.** Product identity is expressed through light and atmosphere rather than many colored buttons.
9. **Theme identity persists.** Active Profile theme is the base visual identity across areas.
10. **Context transitions are smooth.** Opening bookshelf/screen should feel like moving deeper into the same Kajo, not loading an unrelated app.
11. **Curtain is Kajo's global DiscoveryMode control.** Exactly `FOR_YOU`, `SURPRISE`, `RISK`; drag/tap settles on one canonical state. Downstream screens inherit it and do not add competing selectors.
12. **DiscoveryMode is visible as time/light.** FOR_YOU -> dawn/day, SURPRISE -> evening, RISK -> night. AmbientPhase is presentation; DiscoveryMode is recommendation policy.
13. **Visual preference != risk preference.** Dark aesthetics do not imply risky recommendations.
14. **Grid first, swipe optional.** Grid is default discovery. Swipe is optional calibration/browsing tooling.
15. **Committed choices behave consistently.** Explicit feedback gives restrained visual confirmation and rotates the current Item appropriately without game-like effects.
16. **Recent choices are reversible.** Undo/back restores prior current state and exact Item/card when deterministic reversal exists.
17. **Copy is presentation, not domain semantics.** Labels such as `Tykkää`, `Tallenna`, `Luettu` may differ by Profile context while canonical Event/state meaning remains explicit and stable.
18. **Shared Kajo feels like a place.** Switching to SharedProfile changes Profile context/theme and joint recommendation behavior, not merely a filter.
19. **Shared recommendations are already shared.** Do not add a parallel `Ehdota yhteiseen` recommendation surface. The normal Shared discovery feed is the common-taste surface.
20. **Shared positive action is collaborative.** In Shared discovery one member's quick positive action is an actor-specific Endorsement. It should disappear from that actor's normal queue and be surfaced prominently to other non-endorsing members with subtle provenance.
21. **Consensus is visually distinct from one person's opinion.** A single `Mirri tykkäsi` marker means pending collaboration; it must not look like the whole SharedProfile has saved/agreed. Only unanimity promotes to Shared `Tallennetut`.
22. **Lists and discovery are different surfaces.** An Item consumed by any member disappears from ordinary Shared discovery but may remain visible in Saved/custom Lists/history with current watched/read/rating state.
23. **Custom Shared Lists are collaborative organization, not votes.** Accepted members may add Items to custom Lists with added-by/added-at provenance without unanimous endorsement.
24. **Motion communicates state.** Animation explains transition/atmosphere, not attention capture.
25. **Accessibility remains required.** Gesture controls need accessible alternatives; motion respects reduced-motion settings; meaning must not rely solely on color.

## Initial Room vocabulary

- Fireplace: ambient warmth / identity light.
- Window: outside light and scene.
- Curtain: global DiscoveryMode control.
- Bookshelf: books.
- Screen/projector: movies.

SharedProfile switching, Inbox, Lists, Groups and account actions belong to the persistent shell/drawer rather than adding more Room wall objects.

Additional Room objects should be added only when a new content domain genuinely benefits from a clear spatial navigation metaphor.