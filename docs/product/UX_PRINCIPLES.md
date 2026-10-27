# Kajo UX Principles

These are canonical UX requirements. Implementation and device acceptance are separate: owner corrections from #228/#229 are included in the owner-authorized #329 source integration. STATUS owns the exact source/deployment state; dated device observations below do not claim a verified installed build identity.

## Delivery priority — owner decision, 2026-10-25

After the current source work and safe repository cleanup, practical Engine V1
(Sprints 015–021) takes priority. Existing owned-app flows provide its minimal
usable integration. Broader UX, browser Taste, identity conversion, sharing/social
and general performance work follow, then UI/visual polish and beta/release.
[ROADMAP](../project/ROADMAP.md) owns order. All requirements below remain; their
visual detail does not delay an engine packet unless needed for usable evidence,
accessibility or correction of a current functional defect.

The current ordinary Taste/Discovery feed has **List save, numeric rating and
Ohita**. List save means interest; rating means seen/read/experienced; Ohita covers
unfamiliarity or lack of interest with no known reason. **En tunne is already
removed** and must not be restored as a separate required choice. A skip is no
rating. Old UNKNOWN/NOT_INTERESTED records retain their original meanings.

## Core feeling

**October 27 Shared successor:** Friends and temporary accepted sessions replace
required permanent-group creation/selection in the target UX. The numbered
principles below incorporate that direction; the currently implemented named
groups/quick switcher remain until the server lifecycle and replacement UI are
accepted. [ADR-0013](../architecture/decisions/0013-friend-network-and-temporary-shared-sessions.md)
preserves internal SharedProfile memory and legacy data.

Kajo should feel calm, personal, atmospheric and intelligent. It should not feel like a dashboard, analytics tool, casino UI, futuristic control panel, 3D game or registration funnel disguised as a product.

The first-time experience has one additional rule:

> **Show value before asking for commitment.**

A person opening a Kajo link should be able to begin using Kajo immediately, build an initial taste state and see credible personalized value before being asked to continue with Google or Apple.

## Core product principles

1. **The Room is home after activation.** The Room is the authenticated product's primary navigation metaphor. It stays visually clean rather than accumulating account/settings controls.
2. **Taste-first is the public front door.** External Taste/Friend links open directly into the Taste experience, not a login screen, marketing landing page or empty Room.
3. **Registration is continuation, not reset.** Google/Apple conversion happens only after useful Taste/challenge/preview value is visible, and the user enters the app with cold start already completed.
4. **Do not fake intelligence.** Taste challenge scores, explanations and confidence language must reflect actual frozen predictions and documented metrics. Prefer understandable low-sample wording to false precision.
5. **Taste Test is interaction, not a questionnaire.** Show recognizable real Items one at a time in the same vertical card feed as optional Discovery card browsing. An upward dismissal or accessible **Ohita** action skips without a rating. Do not require genre forms, demographics or long preference surveys. The shared interaction is current; remaining guided-readiness and runtime/device acceptance are tracked separately.
6. **The test adapts quietly.** Every committed response, including the first rating, enters the supported state before selecting the next fresh card. Recognition and bounded exploration may guide Taste within the common personal expected-rating objective; UI should remain simple. Do not expose algorithm machinery unless it helps trust.
7. **Preview before CTA.** After the challenge, show a small unseen recommendation preview before the primary Apple/Google continuation action.
8. **Personal invites feel personal but remain consent-based.** An invite may identify the inviter in restrained copy after server authorization. Receiver explicitly accepts Friendship; opening a link never silently creates a social relationship.
9. **Friendship is lightweight.** Accepted Friends appear on a simple Friends surface. Friendship does not create a joint Room/Profile automatically and does not expose private taste history.
10. **Joint browsing is intentional and temporary.** From Friends, choose people and invite them to “Selaa yhdessä”. Show the proposed roster and each person's acceptance. No group name or permanent group creation is required; internal joint memory is not a side effect of a Friend invite.

The owner's October 9 clarification reaffirms the initial adaptive Taste as a
pre-release requirement. Group invitation shortcuts preserve accepted Personal
setup and never replace the planned Taste, frozen challenge or usefulness gates.

## Authenticated Kajo principles

11. **Navigation stays compact.** Domain discovery begins from Room objects. Account, Lists, Friends and authorized history belong in restrained navigation. A permanent Groups destination is not required by the new session flow.
12. **Minimal persistent shell.** Top: Kajo Home mark + global DiscoveryMode curtain. Bottom: menu + active Personal/session identity + Inbox. An active joint session shows its people and an accessible leave/end action. Keep the shell compact without a conventional multi-tab bar.
13. **Context changes are explicit.** Home controls return to the current Personal/session Room. Friends starts joint browsing; an actually active accepted session can be resumed directly. The target replaces the permanent-group quick picker, and safely falls back to Personal when the session ends/expires. Preserve old data access during migration.
14. **Sign out is secondary account navigation.** `Kirjaudu ulos` belongs in account/drawer navigation, not the Room.
15. **Illustrated 2D first.** The Room may use restrained 2.5D depth through overlap/light/blur/shadow but remains a fixed illustrated mobile surface. No free camera, virtual walking or game-like 3D world.
16. **Content is more important than chrome.** Posters/covers and atmosphere carry visual interest.
17. **Kajo brings the light.** Product identity is expressed through light and atmosphere rather than many colored controls.
18. **Theme identity persists.** Active Profile theme is the base visual layer. Secondary authenticated routes may blur/dim the same Room background instead of replacing it with opaque generic screens.
19. **Context transitions are smooth.** Moving from Room to discovery/detail should feel like moving deeper into the same Kajo.
20. **Curtain is the single global DiscoveryMode control.** Exactly `FOR_YOU`, `SURPRISE`, `RISK`; downstream screens inherit it rather than introducing duplicates.
21. **DiscoveryMode is visible as restrained atmosphere.** FOR_YOU → dawn/day, SURPRISE → evening, RISK → night. AmbientPhase is presentation; DiscoveryMode is prediction policy.
22. **Visual preference is not risk preference.** Dark aesthetic choice does not imply risky recommendations.
23. **Grid first, card feed optional.** Grid remains default Discovery. Optional card browsing and Taste share the vertical feed contract below; this decision does not change the global default to cards.
24. **Committed choices behave consistently.** Rating/Ohita/List actions give restrained confirmation and advance appropriately. List addition indicates interest/intention; it is not a post-experience rating. No duplicate Like or En tunne control is needed.
25. **Recent choices are reversible.** Undo restores prior state and exact Item/card when deterministic reversal exists. It waits for pending saves; List removals are not offered for undo. Shared Saved must explain unavailable completed-consensus removal instead of exposing a guaranteed failing action.
26. **Copy is presentation, not domain semantics.** User-facing labels may change while canonical Event/state meanings remain stable.

## Shared Kajo principles

27. **Together means this accepted set of people.** Entering a SharedSession changes the authorized prediction context, participants and joint behavior. A–B–C and A–B–Z remain distinct; the same people's eligible joint history can persist across sessions without group setup.
28. **Shared recommendations are already shared.** Do not create a parallel `Ehdota yhteiseen` recommender surface.
29. **Shared positive action is collaborative.** Choosing a custom List in Shared discovery creates actor-specific Endorsement/pending proposal, not immediate membership or Saved state.
30. **Pending and consensus are visually distinct.** Pending proposer/List provenance and explicit approval remain readable without relying on color alone. Only unanimity produces durable consensus and Shared Saved/list commit.
31. **Lists and discovery are different surfaces.** Consumed/saved/List history persists even when ordinary discovery suppresses an Item. Collections reuse Discovery covers, show given ratings, and offer list/poster-grid browsing while keeping their own collection context. The planned view controls below extend the existing partial List/grid support to consumed history.
32. **Shared provenance is truthful.** List membership retains original proposer/added time where defined; UI does not invent actor provenance.
33. **List choice stays lightweight.** Personal users check all destinations and press Lisää valituille listoille once; all acknowledged additions advance to the next card without a separate Valmis action. Show save progress, retain confirmed additions and unresolved choices on partial failure. Recent choices stay bounded with expansion/new-list creation on demand. Shared members approve the same explicit destination set before unanimous commit.
34. **Messaging stays context-scoped and quiet.** Inbox distinguishes Friend, session and legacy Profile invitations. Retained joint messages/Lists keep their actual authorized Profile; changing sessions never exposes another set's content. Message failure must not roll back successful List action.

The session invitation surface distinguishes accepted/pending/declined/expired
people. A changed roster needs explicit acceptance; late acceptance cannot alter
an active session silently. Returning to Personal or closing joint browsing does
not reset taste, clear Lists or complete a SharedRatingRound. Reconnect resumes
only the exact still-authorized live session. Accessible controls, large text,
partial acceptance, block/remove, expiry and old-card retries require device
acceptance. Ordinary joint discovery remains the shared feed; an optional bounded
“today” decision uses this session rather than creating a second group surface.

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

Friends, active-session access, Inbox, Lists and account actions belong to
persistent navigation rather than extra Room wall objects unless a later domain
genuinely benefits from a new spatial metaphor. Internal SharedProfiles do not
require a permanent-group picker in the target session UX.

## Browse completion

Discovery may show a bounded contextual row of active Profile Lists. Catalog search/normalized filters are explicit browse constraints and are not durable taste merely because the user searched. Authorized Profile/Group/Friend filtering must never expose unrelated private identities.

### Owner browse refinements — planned, 2026-09-23

The September 23 queue remains recorded product work. The owner's October 6
promotion moves #199 continuous append, compact one-row header and unused
bottom-space removal into the native correction packet described below;
gesture/small-screen/large-text acceptance remains required. ROADMAP Phase 17.0
retains the other broad browse refinements; the issues below own implementation.

- **One consumed history (#200):** Discovery's Katsotut/Luetut opens the same
  canonical, active-Profile and ItemType-scoped history as the Lists entry. A
  filtered subset of the current recommendation slate is not that history.
  Membership, saved ratings, empty/loading/error behavior and authorization must
  agree regardless of entry. BOOK and MOVIE use the same generic route contract.
- **Discovery page swipe — owner refinement, 2026-10-24:** Löydä and canonical
  Katsotut/Luetut form two adjacent pages below the compact shared header. A
  deliberate left drag reveals history with the finger; right returns to Löydä.
  Header buttons select those same pages, and Android Back from embedded history
  returns to Löydä. The standalone Lists history route retains its own back path.
  Preserve each page's scroll on Item open/return. Only the settled selected page
  accepts actions or records exposure; adjacent previews are inert and hidden
  from accessibility. Vertical grid scrolling/append and the separate vertical
  detail reel/rating gestures keep their existing behavior. Cancel ambiguous,
  reversed, multitouch, obsolete-scope and backgrounded gestures without a page
  action. Bound the two edges and respect reduced motion. Profile/actor/session,
  ItemType or DiscoveryMode replacement cancels motion and selects fresh Löydä;
  merely returning from an Item preserves the selected page. Read history lazily
  for its first reveal, retain its snapshot and defer hidden dirty reloads.
- **Compact header (#199/#200):** align the active ItemType title (Elokuvat),
  Löydä and Katsotut on one row at ordinary phone text sizes. The title is an
  accessible dropdown for Kirjat and other supported ItemTypes; future domains
  can join that same selector when available. Keep bounded contextual Lists and
  their canonical overflow without adding another permanent header tier.
  Small screens and large text may adapt without clipping labels or targets.
- **More poster space (#199):** remove the reported empty brown strip beneath
  the grid and redundant content/footer insets. Posters use the available shell
  content area down to the dock; retain the actual dock/system safe areas and
  readable final rows. Preserve the accepted visual direction and bounded image
  caching/virtualization.
- **Continuous browsing (#199, dependent on #228/#229):** approaching the end
  loads the next server page, preserving order, existing rows and scroll. Reuse
  the versioned cursor/delivery contract with its separate source/native gates;
  coalesce requests, retain exact per-Item origins, avoid duplicate IDs and
  cancel obsolete Profile/domain/session reads. Errors allow the same request
  to recover. Exhaustion or expiry remains truthful; do not fabricate an endless
  feed by recycling Items, reranking on the client or silently resetting a run.
- **Collection view control (#231):** beside a List or Katsotut/Luetut heading,
  offer list (horizontal lines) and poster-grid (2 × 2 squares) icons with
  accessible names and selected state. Both render the same canonical collection,
  filters, order, ratings and membership. Reuse existing List/grid components;
  keep collection/scroll context when opening and returning from an Item.
  Switching presentation creates no taste Event, rating or membership write.

### Owner detail refinements — planned, #239, 2026-09-23

Use an arrow-only Back control with accessible name **Takaisin**, including
Items opened from Lists or consumed history. Remove the visible **Discovery**
label from an open card. Back returns to the actual entry collection and its
state/scroll position; it never routes to Discovery merely because detail uses
the shared discovery route.

Show the full description immediately when it fits the available card area.
Only overflowing text needs an explicit expansion affordance, after which the
card content scrolls. Measure available space with title, metadata, controls,
safe areas and scaled text; a fixed two-line cutoff is not the fit rule. Reuse
the shared `ItemDescription` renderer and preserve source/credit/license/changes
visibility and link behavior in both states. Verify small and large screens,
long text, large fonts and return from both Discovery and collections alongside
the existing #239 controls. These changes do not alter text permission rules.

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
→ explicit temporary SharedSession acceptance
→ joint recommendation
```

A polished Room cannot compensate for a broken acquisition path. Conversely, acquisition polish must not compensate for weak or dishonest recommendation quality.


## Collection and discovery interaction requirements

Discovery, the List index, individual Lists and consumed history use native
pull-to-refresh for ordinary loading/reloading. Load errors explain the downward
pull rather than presenting a normal retry button. Short and empty collections
retain the gesture. Shared Discovery keeps its loading indicator active while
either recommendations or Shared choices load. Durable mutation recovery remains
a distinct action; refreshing never discards queued choices. Gesture behavior
requires the combined real-device acceptance checkpoint.

The 2026-10-06 owner correction supersedes the terminal fresh-search footer:
Discovery downward pull at the bottom viewport or top and accessible **Näytä
lisää** extend the current list. Approaching the end also appends through the
scoped server cursor. Preserve existing order/scroll and per-Item origins;
coalesce repeated gestures and discard obsolete scope callbacks. Show no more
eligible books/movies only after server proof; report a reader limit or cursor
expiry separately. An expired cursor requires explicit **Aloita uusi haku**.
Selected **Löydä** does not reset the feed. Catalogue-wide append and compact
header/bottom-space fixes are owner-promoted into the current native packet;
physical gesture, small-screen and large-text acceptance remains required.


Destination-picker panels must keep all action buttons above Android system
navigation and Kajo's bottom navigation, consistent with the other panels.
Respect safe-area and keyboard insets with gesture and three-button navigation.
The first #228/#229 Modal-inset correction failed the owner's OnePlus follow-up.
The active #229 picker source lives inside the same shell content bounds above the dock as
Inbox, with the same bottom gap, rather than calculating a second Android window's
position. Its body scrolls, the keyboard is avoided, and Back closes the picker.
The third owner APK report lists only multi-destination selection as remaining; its exact installed SHA was not supplied. Retain a short navigation/keyboard regression for the new picker.

Creating a destination only creates/selects the List. It must not add, endorse or
advance an Item. A sole available destination is selected automatically; an
explicitly created destination is selected for the pending draft. Message input
requires a selected, usable destination. The separate Add/Propose button commits
the choice; Shared failure keeps the picker, Item and message draft available.
Use independent checkboxes and a selected count for one or more destinations in
both Personal and Shared. Creating another List preserves earlier checks. An
intentional empty selection stays empty. Explicit confirmation commits the set;
Shared approvers must be able to read every target name before confirming.
Current delivered layout (superseded only when #239 is implemented): Personal
Add is the final confirmation. After every selected destination is
acknowledged, close the picker and advance once without a separate Done button.
Do not make the interface appear frozen: show an activity indicator and confirmed
destination count while saving. A partial failure retains the unresolved choices
and completed saves. A message failure is reported and does not undo a successful
List action.

Refreshing discovery may vary equal-fit candidates and apply the existing recent
exposure cooldown. The owner explicitly accepts tie variation. Preserve server
rank and truthful slate provenance; do not replace scored priorities with an
unconditional client shuffle or lock the whole slate to hide a scoring defect.

## History rating position

Opening a previously rated Item from Katsotut/Luetut or a named List must place
the rating handle at that Profile's current saved value on first display:
8 means position 8; 0 means position 0. Swiping between collection cards,
reopening, refresh, edit and Undo must preserve this agreement with the visible
rating badge. Consumed-only/unrated Items have no invented saved rating.
Opening the control must never submit the starting value as a new rating.
Shared member-history attribution must not prefill another member's rating as a
SharedProfile rating. The owner’s third report says only multi-List selection remains; no specific slider reproduction/fix is claimed. Keep the regression recorded in
the active #229 `docs/project/DEVICE_TEST.md` handoff named in STATUS.

## Planned personal statistics and selection

The owner accepts light progression through a separate Tilastot destination,
reachable below Profiili and from the Profile surface. Independent category
unlock/weekly counters may encourage returning while keeping the existing
Room/navigation restrained. This is a planned opt-in view, not a delivered
analytics dashboard. Exact count/source/schedule rules and comparison gates
belong to [FUTURE_PLAN.md](FUTURE_PLAN.md#fut-ux-001--personal-category-statistics--planned--230).

Planned long-press selection uses an upper-left checkbox, visible selected count,
explicit bulk actions and a non-gesture accessibility entry. This includes
Luetut/Katsotut: a trash icon appears in selection mode and replaces permanent
per-card “Poista historiasta” text only when the new interaction is implemented.
History clearing and removing a List membership remain distinct operations. Selecting alone
creates no rating, not-interest or List mutation. The complete Discovery/List
and partial-failure contract is
[FUTURE_PLAN.md](FUTURE_PLAN.md#fut-ux-002--long-press-multi-select--planned--231).

## Planned Shared rating rounds — required #232

A submits 5 in Shared context. The other participant sees “A antoi arvosanan 5,
minkä sinä annat?” with a separate, initially unrated control for their own answer;
do not prefill 5 as agreement. Show pending participants until the round completes,
then “Pari!” and joint Katsotut/Luetut. Display whose ratings belong to that round.
A new joint viewing uses a new round and retains the earlier experience. Existing
Personal setup/history survives. This is a release requirement, not functionality
delivered by the multi-destination picker.

## Planned compact Shared session and joint decision — refined 2026-10-27

Deliver the October 27 session flow under ROADMAP 16.2 after Friend invite/safety
lifecycle 16.0–16.1. Keep the October 9 compact **2–5 total person slots including
the initiator**. A `+` selects a Friend and sends a correctly scoped session
invitation with show/copy/OS-share where supported. New Friends first accept
the distinct Friend relationship; that consent does not join the session.
Show the declared roster and accepted/pending/declined/expired states, then
activate only after explicit acceptance. No group name/setup/picker is required.
App/Taste/auth continuation, roster changes and legacy 2-N history/access stay
within the authorization/lifecycle contracts in LAUNCH_LOOP and DOMAIN_MODEL.

After 16.3's rating evidence/controlled rewatch, planned 16.4 offers an optional
“what should we watch/read today?” mode within the active SharedSession with at most five current
canonical BOOK/MOVIE suggestions. Reuse the same predictor and inherited
DiscoveryMode/risk; optional Tinder-like cards retain accessible buttons and do
not replace ordinary grid discovery or duplicate the global curtain control.
“Do today”/other domains remain future work.

Proposed any-participant session-level “not interested” veto removes the current
option; confirm the exact veto rule at implementation. “Already seen/read”
replaces the option within this session. Bound refill and give truthful exhaustion,
expiry and retry states. Neither action silently submits a permanent dislike,
erases history, permanently forbids rewatch, completes a SharedRatingRound or
creates group reward. Freeze the accepted session roster with explicit expiry,
membership-change, concurrency, lifecycle and minimal telemetry rules; choice
alone is not confirmed consumption. The separate optional List-only FUT-UX-003
is not promoted by this plan. MVP-GROUP-001..005 and MVP-SOCIAL-010..012 remain open;
no current UI changes merely by recording these ideas.

## Required pre-MVP card controls — #239 / MVP-UX-006

**Owner refinement 2026-10-22 supersedes the September 12 quick-save star /
separate overflow and explicit-save controls for the Discovery feed.** The star
opens the existing multi-destination List picker. Its outline means no confirmed
membership in any active-Profile List; solid white means at least one confirmed
membership. Pending/failed writes and a pending Shared proposal are not confirmed
membership. Use the existing Saved/List/Endorsement model; the glyph does not
introduce a new rating, consumed state, group or collection. Shared unanimity and
membership authorization remain unchanged. Final Add commits once without a
second Done confirmation, and creating a List alone does not save the Item.

A deliberate slider release, track tap or accessible adjustment commits the
selected integer rating immediately. Remove **Tallenna arvio ja jatka**. Merely
opening the card or cancelling a drag never saves the initial value; zero and
five remain real ratings. The engine learns personal use of the response scale;
five is not a universal neutral satisfaction label. A tap anywhere on the track or a deliberate
horizontal drag accepts the chosen rating once into durable local storage, then
automatically advances to the prepared successor. Discovery forward skip follows
the same durable-admission boundary; ordinary network acknowledgement does not
block the next card. A failed local write cannot advance. A List choice retains
its confirmed positive state until the next forward gesture; List/server-undo
admission waits for pending commands to settle. The local cancellation exception
below does not wait for an unrelated server receipt. Neither positive advance creates Ohita.
Commands retain exact action and delivery identities, and later receipts cannot
change whichever card is now active. A vertical
or diagonal drag over the rating handle and multitouch movement must not commit
a rating; only deliberate horizontal slider intent does.

The card fills the usable area between compact top and bottom navigation bars.
Do not reserve empty feedback/help rows, duplicate safe-area padding or a large
header/footer panel. Center artwork with the accepted symmetric side margins;
align the card's title, metadata and description to the left within that column.
Center the bottom rating slider with small side margins; place the List star
beside the title at the title's visual size while retaining an accessible touch
target and independent focus. Leave a small gap between the rating controls and
bottom dock without adding a reserved feedback band. The October 23 refinement makes the whole card
follow a vertical drag started over artwork, metadata or description, including
expanded text. Long descriptions extend the card rather than creating a separate
nested scroll surface. The October 24 rating-stop refinement makes any upward
gesture that starts above a long card's readable bottom reading-only: even a fast
flick or overshooting drag stops at the rating controls and cannot dismiss the
Item. A new deliberate upward gesture starting at that bottom may advance.
Compact cards retain their direct upward flick. Retain metadata, artwork fallback, source credits
and usable controls with large text. Horizontal slider input and ordinary control
taps keep their own meaning; metadata and title actions remain independently
accessible.

**October 24 immediate one-step cancellation:** persist each feed skip/rating
before advancing, but keep the newest such choice from server dispatch until the
next choice is durably accepted. A → B holds A; B → C releases A and holds B.
Reverse C → B may atomically cancel B only while the sender can prove it was
never dispatched, restoring its still-valid exact delivery in the same mounted
scope immediately and retaining eligible prepared successors. This is withdrawal
of unsent local intent, not a successful server undo or new learning evidence.
The one-step gate still applies. A sent, ambiguous, expired or otherwise invalid
source uses the existing ordered server reversal and fresh-delivery path below.
Failed cancellation preserves the queued command and recovery. Holds are
runtime-only: a 30-second idle deadline, exit, navigation blur, background and
scope change release them; restart drains the
original durable commands without reconstructing a hold. No selected choice is
lost merely because there is no later card. This supersedes the earlier universal
queue-empty/clear-window rule only for proven never-dispatched local cancellation.

Forward/upward card scrolling advances one Item at a time; without an already
accepted positive action it submits contextual Ohita. Backward/downward scrolling restores
the preceding card and reverses its exact eligible action through the existing
canonical undo/withdrawal boundary. After the first exact undo/withdrawal command
is durably admitted, show the cached prior Item immediately as a separate inert
`restoringPresentation`. It has no actionable origin: mutation controls, impression
and dwell remain blocked until every ordered acknowledgement and a fresh same-Item
delivery arrive. Preserve the visual identity through activation, without another
card flash. The October 23 post-#711 refinement permits only one backward step
between accepted forward choices. The first durable reversal admission consumes
that opportunity; a failed first local admission does not. Retrying the remaining
commands of that same partial reversal is recovery, not a second backward step.
After restoration, forward browsing remains available; only a new accepted
forward skip/rating or positive-card advance enables Undo again. Background
acknowledgements, refills and rerenders do not re-enable it. Retain bounded exact
history without allowing repeated backward traversal. First try a fresh five-Item
root after every ordered reversal receipt. If that successful current-epoch page
does not contain the exact prior Item, replace its known reader with the original
bounded search of at most three 50-Item pages. This small first probe does not
shrink that fallback search, continue a five-Item cursor as a 50-Item request,
reuse an old delivery or supply siblings when the target is absent. Ambiguous
requests retain their exact retry identity before replacement. Once the exact prior Item
is found in a successful fresh restoration page after all reversal receipts,
prepare up to five eligible siblings from that same page in server order, with
their fresh page origins and normal target/handled/duplicate exclusions. These
are new deliveries, not the invalidated pre-Undo buffer. They remain inert until
activation. Do not empty this fresh window and require another network roundtrip
before forward browsing. The next new refill uses a five-Item root replacing the
restoration reader; never continue a 50-Item page size for ordinary refills.
Missing-target, stale and error replies supply no prepared siblings.
Failed local admission
leaves the current card; unavailable
or conflicted undo must explain the limitation instead of silently changing a
different Item. Keep bounded session history explicit; feed continuity does not
mean infinite history or recycling an exhausted catalogue. Discovery prepares the
active card plus up to five successors, warming five initially and refilling
free slots after every consumption. One free slot admits one replacement even
though the ordinary refill chain's immutable wire page size stays five; no extra
staging window is kept.
The next card becomes visible during the upward drag, but
its preview is inert and creates no impression or action capability. Activate it
after successful durable local admission of the outgoing skip/rating, with its
server acknowledgement handled in the background. Normal acknowledgements retain
the prepared window: rating/List receipts mark future read work dirty, while
an already started refill or exact retry may finish and fill only free slots.
Renew the root from the latest committed prefix before the next new refill;
coalesce repeated acknowledgements rather than repeatedly interrupt loading.
Neutral skip keeps its reader because it adds no learning evidence. Undo, scope/source invalidation
and rejected-command discard still clear the window. The prediction contract
owns this explicit bounded freshness tradeoff. Retain the outgoing card as an
inert presentation only when no prepared successor is available; exact retries
must not produce another choice. Normal save, impression-wait and refill progress
are quiet: do not flash saving/wait/retry banners or briefly remount the rated
card. Real persistence/rejection/conflict errors retain stable, accessible recovery
until resolved; never hide or discard them to make the feed seem smooth. Avoid
snap-back/blank transitions, animate entry in the navigation direction and settle
cancelled drags, respecting reduced motion. Ordinary data updates must not cancel
a valid in-progress gesture. A new native drag may immediately interrupt entry
or snap-back animation and follow the thumb; waiting for an animation callback
must not lock the next card. An accepted outgoing card still cannot commit twice.
No separate visible
Ohita or Kumoa button is needed in this feed. Screen-reader/accessibility actions
provide equivalent advance, reverse and help without permanent control rows.
A deliberate dismissal requires one-finger vertical intent: at least 96 points
of dismissal travel, or at least 24 points with matching vertical release speed
of 0.6 points/ms and vertical dominance over horizontal motion. A short fast
upward flick may advance a compact card or a long card only when the gesture
starts at its readable bottom; the gesture that reaches that bottom never also
submits Ohita. A fast downward flick reverses
only when it begins at the readable top; inside long content, downward motion
reads back toward the top and only 96 points of deliberate excess beyond that
edge can undo. Small slow movement, reversal,
multitouch, responder termination, layout changes and backgrounding do not commit.
Native responder capture must preserve the accumulated drag offset rather than
jumping when its gesture coordinates reset on grant. These thresholds and
whole-card behavior require the superseding device matrix.
Reduced motion suppresses automatic entry and spring interpolation while
preserving direct user-controlled reading offsets so long text remains readable.
Collection/legacy detail and retained Taste/challenge protocols preserve their
existing evidence contracts until an explicit compatible successor is delivered.

## Shared vertical card feed — required target, 2026-10-15

Optional Discovery card browsing and **Aloita makutesti** must use the same
reusable Item card/feed presentation: poster or cover, image fallback, title,
metadata, description and permitted source credits. Taste is the initial use of
the same experience rather than a visually separate questionnaire. Keep the
existing grid as the default Discovery presentation. This is a required near-term
successor, tracked by `MVP-UX-007` and ROADMAP, not delivered APK behavior.

**Owner clarification — 2026-10-25:** active Taste cards must look the same as
BOOK/MOVIE cards in Discovery, including the usable viewport, symmetric margins,
poster/cover size, title/metadata/description column and rating-control placement.
Use the actual visible card bounds and apply safe-area/navigation spacing once;
a Taste-only oversized image or extra surrounding padding must not push rating
controls out of reach. Long content and larger text remain readable through the
same whole-card reading and rating-stop behavior. This is presentation parity;
Taste retains its own pending-command and acknowledged-answer → fresh NEXT rules.
The owner's #721 report exposes a device blocker, so shared source components
alone do not establish this parity. STATUS/DEVICE_TEST own correction evidence.

**Guided-learning refinement — 2026-10-25:** visual parity must extend to the
common prediction/learning loop under [ADR-0011](../architecture/decisions/0011-taste-as-guided-discovery.md).
Show BOOK first, then MOVIE, without mixing cards across unfinished guided phases.
A compact active-domain readiness indicator explains measured support and missing
certainty without shrinking the shared artwork/rating viewport. Advance/end only
when the server's validated criterion passes; voluntary continuation is visibly
insufficient, not success. A fit probability for one Item and readiness of the
model are different labels. A correct cover is part of new-card presentation;
known missing images require canonical repair or an eligible covered replacement
before question commitment, with honest recovery if a committed image later fails.

The deliberate upward gesture that completes moving the active card out of the
feed means **Ohita** when no positive action has already been accepted for that
card. In Discovery, a durably admitted rating cannot also produce a skip even
before its server reply; confirmed List choices likewise advance without Ohita.
Taste retains its pending-command gate and acknowledged-answer → fresh NEXT flow.
Equivalent accessibility actions support people who cannot swipe without a
permanent visible Ohita row. Show short overlay guidance on first use for each
account, including Taste; dismiss it after acknowledgement or the first successful
interaction, and preserve that dismissal across cards and restarts. Opening another
Item, category or Profile under the same account does not show it again. Help remains
discoverable on request. Explain forward advance, backward undo and direct rating;
Ohita still gives no rating and the Item may return later. Replace
the separate new-feed **En tunne** and **Ei kiinnosta** labels with this single
action; the app must not infer which reason the user had for skipping.

Ohita removes the Item from the current feed with bounded, context-scoped
suppression. It gives no numeric grade, consumption, permanent dislike or
unrecognized-item assertion. The Item may become eligible in a later appropriate
Scenario under the versioned resurfacing policy, without an immediate loop.
Keep earlier UNKNOWN and explicit NOT_INTERESTED history intact; changing copy
does not merge those historical evidence types. The
[canonical feed evidence contract](../domain/DATA_EVENTS.md#shared-feed-ohita--required-target-2026-10-15)
owns event, retry, expiry and resurfacing meanings.

Only a completed intentional card dismissal commits the skip. Partial scrolls,
slow reading within a long card, reflow, loading, rotating the screen, opening a
menu, navigating Back, leaving the app and changing Profile/domain do not imply
a response. Pending commands retain their exact actor/Profile/Item origin through
restart/retry; they cannot be duplicated or retargeted. Gesture thresholds,
cancel/recovery, large text, reduced motion and the accessible action require
representative device acceptance.

Ratings and acknowledged positive choices must refresh the supported serving
prefix before the next Taste question or newly requested Discovery refill.
Discovery retains at most five already prepared successors with their frozen
origins across ordinary acknowledgements, so the next visible card may predate
the latest rating. Rating/List acknowledgements schedule a renewed root before
the next new refill without interrupting the already started bounded refill or
its exact retry; neutral skip retains its reader. Hard invalidation still rejects
late responses. Do not shuffle
the retained window or jump the card under the user's finger. Grid order follows
the same committed-state freshness rules when
a fresh ranking is requested. The
[next-card prediction contract](../domain/PREDICTION_MODEL.md#82-next-card-satisfaction-and-prefix-freshness--required-target)
owns this timing. Repeated opening films across fresh Profiles is a diagnostic
observation, not alone proof of a defect: identical empty prefixes may share a
supported first card, while supported divergent ratings must affect later
forecasts and selection. Never promise that Interstellar 10 guarantees Inception
next, that each answer changes rank, or that an unsupported score is a calibrated
probability of a future ten.

### Shared-feed source boundary — 2026-10-17

This dated receipt describes #350/#351, before the October 22 controls refinement
above. STATUS identifies the active successor and its unverified device gates.

The #239 source uses `FeedItemCard` for sequential Taste and canonical Discovery
cards. Both use poster/cover fallback, metadata, verified description/credit and
the same persistent first-use help. The image area accepts a deliberate upward
drag (at least 96 points, vertical dominance, one finger); description and controls
remain ordinary scroll/touch surfaces. A reversed, partial or cancelled gesture,
layout or background event submits nothing. Accessible Ohita has the same writer
and remains available after an unsubmitted rating draft. Reduced motion removes
gesture translation. These thresholds remain subject to actual device acceptance.

Pending writes retain the displayed Item and disable competing actions. Numeric
rating uses an explicit save; zero/five remain valid. A fresh card follows only
an exact server receipt, with stale unshown work retired. Scoped catalog enrichment
cannot replace a later Taste question. V1/challenge/calibration and collections or
unranked Shared-overlay detail keep their prior contracts. This is source behavior,
not acceptance of the October 22 successor or native layout. ROADMAP now advances
the bounded star-picker/direct-rating/compact-feed work into the active packet.

### October 22 implementation boundary — acceptance open

Discovery's active source preserves exact history action IDs for the mounted
scope, subject to the existing ten-native-action undo limit and the post-#711
one-backward-step gate above. The post-#710
refinement may show the cached prior Item after the first durable undo admission,
but that originless presentation remains inert. After all required
undo receipts, it first requests a fresh five-Item root for the same prior Item,
with a successful missing-target probe falling back to at most three fresh
50-Item pages under the reader-replacement policy above. A consumed/expired
original delivery is never reused.
An unavailable target has retry/cancel recovery; cancellation starts a fresh feed
instead of silently showing a substitute as the requested previous card. Shared
consensus that cannot be undone is detected before reversing related actions.

Sequential Taste shares the compact viewport, direct slider commitment and
account-scoped help. Its acknowledged-answer controller advances automatically;
Discovery's preparation of the active card and five successors does not precompute
future adaptive Taste
questions. Numeric backward-question undo is not implemented. That gap remains
open before claiming full Taste/Discovery interaction parity. V1/challenge save
controls and frozen first-answer measurement retain their established contracts.
STATUS owns source/CI/hosted and device facts; these boundaries are not device
acceptance or permission to weaken exact provenance.

## Required reconnect recovery — #240 / MVP-UX-003

The 2026-09-12 device report found that Yritä uudelleen remains visible when the
network returns. On usable reconnection, a focused failed reader should perform
one bounded/coalesced recovery of its exact request and clear error/retry UI when
that recovery succeeds. An online indication alone cannot hide a backend failure.
Preserve loading/error distinction, 15-second deadline, existing page origins,
source expiry/cap, scope cancellation and durable action queues. Reconnection
must not create fresh windows or work for a hidden/changed scope. A proven expired
cursor still needs explicit **Aloita uusi haku**. The native #229 reader packet
now implements this correction under Phase 14.2; STATUS owns exact source/CI
acceptance. A repeat of the actual device failure/recovery flow remains required
before this release requirement closes.
