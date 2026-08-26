# Kajo UX Principles

## Core feeling

Kajo should feel calm, personal, atmospheric and intelligent. It should not feel like a dashboard, analytics tool, casino UI or 3D game.

## Principles

1. **The Room is navigation.** The home scene is not decorative wallpaper; its objects are the primary entrances to experiences.
2. **Minimal controls.** Prefer a few meaningful objects and gestures over persistent navigation clutter.
3. **2D only.** Use layered 2D surfaces, light, gradients, opacity, blur, shadow and subtle movement. No virtual walking or 3D world interaction.
4. **Content is more important than chrome.** Posters/covers and the Room atmosphere carry visual interest.
5. **Kajo brings the light.** The product identity is expressed through light and atmosphere rather than many coloured buttons.
6. **Theme identity persists.** A user's theme is the base visual identity across areas.
7. **Context transitions are smooth.** Opening the bookshelf should transition the existing scene toward the user's book theme rather than feel like loading an unrelated app page.
8. **The curtain is Kajo's global DiscoveryMode/risk control.** It belongs visually to the top of the Room window and represents exactly three canonical states: `FOR_YOU`, `SURPRISE`, `RISK`. The handle can be dragged continuously, but interaction settles only on those three states. Tapping the left/centre/right target region should smoothly animate and snap the handle to the corresponding state. Downstream discovery/swipe screens inherit the same state instead of presenting competing mode button groups.
9. **DiscoveryMode is visible as time/light across the experience.** `FOR_YOU` -> dawn/day, `SURPRISE` -> evening, `RISK` -> night. Colour/light may interpolate continuously during movement, while the settled DiscoveryMode remains one of the three canonical values. The selected mode should affect the full scene/content behind the control, not only the curtain itself.
10. **Visual preference != risk preference.** Loving dark aesthetics must not imply the user wants risky recommendations. `AmbientPhase` is presentation; `DiscoveryMode` is recommendation policy.
11. **Grid first, swipe optional.** Grid is the default discovery surface. Opening an Item may transition naturally into a swipe-oriented browsing sequence when swipe mode is available; swipe remains calibration/discovery tooling rather than the only way to browse.
12. **Committed card choices should behave consistently.** Every explicit interest, save or consumed choice should give restrained visual feedback, move the current card away and reveal the next Item without game-like effects. A consumed Item remains available in consumed history.
13. **Recent choices are reversible.** Swipe/state actions should provide a clear undo/back-arrow affordance for recent decisions. Reversal must restore the prior state and return the exact Item/card concerned without an incorrect index jump.
14. **User-facing copy is presentation, not domain semantics.** Labels such as `Pidän`, `Tallenna`, `Luettu` or future wording may change without changing canonical state/event meanings. Reused action wording should come from one maintained feature-level source rather than repeated literals across screens.
15. **Shared Kajo feels like a place.** Entering a SharedProfile changes the profile context and shared Room/theme, not merely a filter in a user list.
16. **Motion communicates state.** Animation should explain transition and atmosphere, not compete for attention.
17. **Accessibility remains required.** Gesture controls need accessible alternatives; motion must respect reduced-motion settings; meaning must not rely solely on colour.

## Initial Room vocabulary

- Fireplace: ambient warmth / identity light.
- Window: outside light and scene.
- Curtain: global DiscoveryMode/risk control.
- Bookshelf: books.
- Screen/projector: movies.
- Social/shared object: SharedProfiles.

Additional objects should be added only when a new product domain needs a clear navigation metaphor.
