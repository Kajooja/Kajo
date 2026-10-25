# Kajo Taste-first Launch Loop

Status: **canonical MVP launch specification**

Product decision: **2026-09-07**, sequential Taste refinement **2026-10-14**, engine-first priority and personal expected-rating objective **2026-10-25**

Tracking: **#215**, adaptive source foundation **[#336](https://github.com/Kajooja/Kajo/issues/336)**

This document defines how the first public Kajo acquires, activates and socially connects a new user. It is not a marketing appendix. The flow below remains a release requirement.

The October 25 owner decision makes practical **Engine V1 (Sprints 015–021)**
the first development priority after the active source work and safe repository
cleanup. The existing owned app can validate the common Taste/Discovery engine
without first completing browser/anonymous acquisition. Full web Taste, identity
conversion, sharing/Friends/Shared UX and general usability follow V1; UI polish
then precedes beta/store/release. Anonymous identity, retention, abuse controls
and conversion remain prerequisites for the public flow described here.
[ROADMAP](../project/ROADMAP.md) owns that execution order.

## 1. Product thesis

Kajo should prove value before asking a new visitor to create an account.

The canonical public entry flow is:

```text
Taste link / campaign link / personal invite
        ↓
web or installed-app entry
        ↓
anonymous sequential Taste Test
        ↓
prospective prediction → answer evaluation → future taste update
        ↓
explicit provisional readiness or insufficient pause
        ↓
small recommendation preview
        ↓
Google / Apple account conversion
        ↓
full Kajo
        ↓
invite another person
```

For a personal invite, successful conversion additionally produces a consented Friend relationship with the inviter. It does **not** create a SharedProfile automatically. Friends can create a two-person or larger SharedProfile explicitly in one short flow.

The desired user experience is: **use Kajo first, register only after Kajo has shown why it is useful.**

## 2. Release objective

The first public release is not complete merely because BOOK/MOVIE discovery works. It must be able to take a previously unknown person from an external link to a useful Kajo state without developer help.

A release candidate must support all of the following:

1. Open a public Taste link without an installed app.
2. Start the Taste Test without registration.
3. Learn initial taste through a variable sequence of real catalog Items within explicit safety budgets.
4. Commit each forecast before its answer, evaluate the original, then let the answer inform later questions; report provisional readiness or insufficient evidence honestly.
5. Show a small number of genuinely personalized unseen recommendations.
6. Convert the anonymous visitor to the same canonical Kajo identity through Google or Apple without losing taste/history.
7. Continue into the mobile product with the cold start already completed.
8. If the link was a personal invite, create the Friend relationship only after the receiver accepts and converts.
9. Show that Friend in the friends surface and allow creation of a SharedProfile from one or more Friends.
10. Allow the activated user to create the next Taste link or personal invite.

This is the first complete Kajo growth loop.

## 3. Link types

Kajo has separate link semantics. Do not overload one URL/token with incompatible permissions.

### 3.1 Public Taste link

Purpose: acquisition from ads, social posts, creators, QR codes or generic sharing.

Properties:

- opens the Taste Test,
- may carry campaign/referral attribution,
- does not expose an inviter identity unless explicitly part of the campaign UX,
- never creates a Friend relationship or SharedProfile,
- may be reusable subject to abuse controls.

### 3.2 Personal Friend invite

Purpose: one existing Kajo user invites a specific next person.

Properties:

- opens the same Taste-first experience,
- carries an opaque server-owned invite token,
- identifies the inviter only through an authorized server resolution,
- receiver explicitly accepts the connection,
- successful conversion creates a reciprocal Friend relationship,
- does not automatically create a SharedProfile,
- has expiry, use limits, revocation and rate limits,
- replay cannot create duplicate friendships.

### 3.3 SharedProfile/group invite

Existing SharedProfile membership invitations remain a separate concept. A group invite grants no friendship automatically unless a later explicit product decision changes that rule.
The planned compact creation flow can show/copy/share this opaque invitation
through the OS share sheet or WhatsApp where available. A receiver uses the same
app/Taste/link continuation, reusing accepted Personal setup where present, and
explicitly accepts group membership. If Friendship is also offered, it requires
its own clear consent; link delivery/opening grants no private Personal history
access and creates no automatic Friend or group relationship.

## 4. Anonymous identity and conversion

The Taste Test must not be a disconnected browser questionnaire.

At Taste start Kajo creates or resumes a bounded anonymous Kajo identity/session and a corresponding temporary PersonalProfile-compatible taste state. The implementation may use Supabase anonymous auth or an equivalent canonical backend boundary, but the invariant is stable:

```text
anonymous identity
   + anonymous PersonalProfile/taste state
            ↓ link provider
permanent Kajo User
   + same PersonalProfile/taste history
```

This server-backed foundation must exist before real anonymous Taste acceptance.
It includes authorized resume, bounded creation, retention/deletion of abandoned
state, redacted diagnostics and versioned opportunity/completion/challenge
measurement. A logged-in policy prototype can test selection separately; it
cannot stand in for anonymous identity or claim the complete launch flow.

Conversion requirements:

- no second PersonalProfile is created,
- all accepted Taste responses remain attached to the same logical person,
- attribution/invite context survives the conversion exactly once,
- a failed or abandoned auth attempt does not destroy the anonymous Taste state,
- account collision/linking is handled safely,
- the system never merges two existing permanent Users merely because a browser session has an invite token.

Google and Apple are the primary low-friction release providers. Email/password may remain available, but the launch funnel must not depend on a long registration form.

## 5. Taste Test interaction

Taste Test is Kajo, not a conventional genre survey.

The user reacts to real Items one at a time through the current shared feed.
The owner confirms on October 25 that there are exactly three ordinary choices:
List save indicates interest/intention; a 0–10 rating means seen/read/experienced;
**Ohita** covers both "do not know" and "not interested" without identifying
which reason applies. A numeric zero is a real rating, and the person's response
style determines the meaning of other grades; five is not a universal neutral
satisfaction label. There is no separate **En tunne / Ei kiinnosta** control.

The shared feed uses legally usable poster/cover, metadata and description
presentation. A deliberate completed upward dismissal, or accessible **Ohita**,
removes the Item from this feed under the versioned return policy without
inferring recognition, consumption, permanent dislike or a numeric rating.
Explain the gesture once on first use/Taste, keeping help discoverable. Earlier
UNKNOWN/NOT_INTERESTED responses retain their exact meanings and history.
Ordinary scrolling, partial gestures or navigation must not create skip evidence. The
[shared card-feed contract](UX_PRINCIPLES.md#shared-vertical-card-feed--required-target-2026-10-15)
owns interaction/accessibility acceptance; [DATA_EVENTS](../domain/DATA_EVENTS.md#shared-feed-ohita--required-target-2026-10-15)
owns versioned evidence/suppression. The three-action interaction is current;
full guided progression, readiness and device acceptance retain their separate
open gates. Retained sessions are not rewritten by this clarification.

### Guided Discovery refinement — 2026-10-25

The owner requires one continuous recommendation/learning experience, specified
in [ADR-0011](../architecture/decisions/0011-taste-as-guided-discovery.md).
New guided Taste starts with **BOOK**, stays in that domain until supported
readiness, then transitions to **MOVIE**. Both use the same PersonalProfile and
shared Discovery prediction/retrieval service; there is no separate test model.
After a rating, the next fresh recommendation uses that committed evidence and
the shared personal expected-rating objective. The model learns the person's
rating response scale; it does not optimize the chance of ten or apply a hidden
Taste-only high-grade bonus. List saves remain interest evidence and ambiguous
skips remain no-rating observations.
A compact active-domain meter exposes genuine measured readiness and its support.
Automatic phase advancement/completion requires the declared validated criterion;
answer count or an uncalibrated rank score cannot fill a probability meter.

This supersedes interleaved domain balancing as the new target, without changing
retained sessions. Repeated skips, unavailable useful questions or voluntary exit
preserve an explicit
insufficient state and offer continuation; it never forces endless questions.
Book-to-movie and movie-to-book evidence transfer is shared but does not certify
untested domain accuracy. Covers must be correctly resolved for both surfaces.
Current V4's always-insufficient readiness and separate selection utility do not
fulfil this refinement; implementation and quality acceptance are still open.

### Sequential target — 2026-10-14

Question count is variable. Neither six answers, twenty answers, a 10 MOVIE +
10 BOOK schedule nor the earlier 12–24 range establishes completion. Selection
uses the committed response prefix, including numeric rating magnitude, to seek
the next useful recognizable Item. The first accepted rating must influence the
next fresh Taste forecast wherever supported. Discovery continues learning on
the same Profile and uses the committed prefix for its first new refill, while
its active card plus at most five already prepared successors may retain older
frozen origins under the [bounded preparation policy](../domain/PREDICTION_MODEL.md#82-next-card-satisfaction-and-prefix-freshness--required-target).
Preserve UNKNOWN's recognition-only meaning and
explicit not-interest's distinct historical meaning; the new Ohita supplies only
its declared contextual no-rating evidence. A new answer
may improve the next forecast or reveal uncertainty and contradiction; monotonically
improving forecasts are not promised.

Each step commits a forecast before the answer, stores its first measurement and
any available evaluation, projects the answer with source provenance, then
selects/predicts from the next
committed prefix. The [sequential prediction contract](../domain/PREDICTION_MODEL.md#sequential-adaptive-taste)
owns scoring, cutoff and comparison rules. The user can pause and resume without
losing that order. An independent accessible **Ohita** remains usable after an
accidental rating-wheel movement: it discards the unsubmitted draft, after any
already pending command has been resolved. Deliberate zero and five
remain ratings; five is not an assumed neutral satisfaction point for every
person. The shared successor does not reinterpret an old session's versioned
response contract.

The enduring recommendation objective is the highest supported **expected
post-experience rating for this Profile**, under its current authorized
world/state/Scenario and learned rating-response scale. The October 25 owner
correction supersedes the earlier "ultimately a ten" objective. Taste uses the
same acquisition/scoring and declared exploration policy as Discovery under equal
inputs, with explicit opener/progression constraints. The magnitude and surprise
of an answer update supported estimates; no fixed title pair or grade guarantees
a particular next Item. Recognizable questions support learning without replacing
the common objective with a private test-only utility.
For Taste, recompute from the acknowledged prefix before the next question; do
not serve a precomputed fixed test order or retain stale future questions after
a supported answer. Discovery alone may advance after durable local admission
and retain its bounded five-successor window across ordinary acknowledgements;
an already started bounded refill may finish into free slots, with exact retries
resolved before the next new refill renews from the latest committed prefix.
This does not precompute
future Taste questions or change account conversion. Exact retry/current-card
and prepared Discovery origins remain frozen. The
[next-card objective](../domain/PREDICTION_MODEL.md#82-next-card-satisfaction-and-prefix-freshness--required-target)
owns scoring, freshness and honest evaluation.

An empty Profile may begin with a recognizable Item supported by recent
population/provider evidence. The
[recent cold-start prior](../domain/PREDICTION_MODEL.md#recent-supported-cold-start-prior--required-target)
must consider declared support and recency with a defensible positive-versus-
negative balance, not raw lifetime popularity, an unsupported NPS label or the
largest count of tens. Same supported empty prefixes may share a first Item;
different answers must affect later supported estimates. Publicly sourced and
native population evidence keep their existing authorization/admission limits.

Readiness must declare per-domain support, forecast coverage, informative feature
dispersion, prospective evaluation and stability. A provisional source diagnostic
is not statistical reliability or admitted model quality. The V1 measured-readiness
successor additionally requires the declared calibration/uncertainty and stopping
contract; user-facing claims cannot exceed its admitted scope. Repeated skips,
exhausted eligible Items, a safety budget or a pause with unmet
criteria yield insufficient evidence rather than a pass. The October 15
clarification permits continuing to ordinary Discovery with that partial state:
ending the questionnaire must neither block browsing indefinitely nor discard
learning. The same PersonalProfile keeps learning from canonical Discovery actions,
and its support/readiness remains revisable. Native continuation must be verified;
the portable reference alone does not implement this user flow. Progress communicates
those conditions instead of a fixed number of required answers. #336 supplies a
bounded portable source foundation; #341 supplies durable SQL v2 and the mobile
successor consumes it. Native acceptance, calibrated grade predictions and
measured usefulness remain open. This foundation precedes
canonical preview because preview requires trustworthy state/evaluation evidence.

The sequential mobile source offers **Jatka selaamaan** throughout the questions.
After all pending commands are acknowledged, it records PAUSE and releases the
same Profile into ordinary browsing. Dismissal survives app restart; a remotely
paused session offers explicit continuation. Each accepted answer is followed by a
separate current-state read and NEXT request. Interrupted writes retry their exact
ID before another question. Progress describes saved answers and an initial,
still-learning forecast without a quota or an extra mandatory v1 challenge.
Existing v1 sessions/challenges keep their original flow. STATUS distinguishes
source acceptance from matching hosted/device observations.

The October 17 shared-feed source now presents sequential questions with the
same poster/cover, metadata and credited-description card as canonical Discovery.
It loads public Item presentation for the current owner/question/revision only;
no panel or delivery identity is synthesized. Optional native capability enables
neutral Ohita through the existing durable Taste controller, including clearing
an unsubmitted rating draft. Old v1/challenge/calibration responses remain intact.
The required hosted skip rollout and actual phone/acquisition acceptance are still
open; this source does not create anonymous identity or certify readiness.

### Current v1 source and superseded count plan

The September 10 proposal for approximately 10 movies followed by 10 books,
within 12–24 opportunities, is preserved as the earlier design. The October 12
v1 source below implements its versioned stage/stop policy; those counts are
current-source facts, not the sequential target's completion rule. Legacy
`cold-start-v1` still permits completion after six known ratings within its bounded
slate. Existing v1 sessions and completed setup must remain usable without reset,
forced reprofiling or rewriting their forecasts/first evaluation answers.

The October 12 portable `taste-selection-v1` source returns bounded immutable
question/transition/stop decisions from an authorized frozen input and presentation
ledger. Its provisional rule uses 12–24 opportunities, at least eight known
ratings, and the proposed ten MOVIE → acknowledged transition → ten BOOK stages.
Recognition, diversity and feature-coverage proxies are compared with a fixed
PRIOR_ONLY control; they do not measure expected satisfaction or uncertainty.
Unknown contributes no taste support, not-interest remains distinct, and a rating
of zero remains known. Correction/withdrawal, current-question replay and genuine
exhaustion are explicit. The retained legacy static calibration does not consume this selector; #330 now
connects the owned adaptive mobile flow to its server adapter. The own-Personal server successor now provides durable
catalog/policy/presentation/response storage and a parity-tested SQL selection
adapter, with exact retries, corrections, removal and rating-only bootstrap
provenance. The separate owned challenge now freezes canonical forecasts and
evaluation-only first answers with an honest ordinal metric. The #330 owned mobile consumer connects both boundaries. It persists exact pending
commands in backend/actor/Profile-scoped SQLite, resumes retained state after
acknowledgement, acknowledges the book transition explicitly and renders honest
ordinal counts only after challenge completion. New START waits for the start
action so history can be imported first; already-completed setup is preserved.
Legacy calibration is a guarded first-missing-RPC fallback. Anonymous prerequisites,
preview, hosted/device acceptance and observed first-session usefulness remain required.

The question-selection policy should optimize information gained about the Profile while retaining:

- high recognition probability,
- feature diversity,
- domain diversity where useful,
- balanced positive/negative evidence,
- no demographic requirement,
- no repetitive near-duplicate Items,
- fail-open behavior when the visitor does not recognize enough Items.

The sequential target may begin with a transparent heuristic. Its feature and
readiness proxies must be labelled as such; a learned active-learning policy is
optional until it beats a transparent baseline under the same evaluation contract.

## 6. Prediction challenge

In the sequential target, prospective prediction evaluation occurs throughout
Taste, before each answer joins future state. A question is held out relative to
its own committed prediction prefix. A final summary may report those original
measurements; it must not rescore old answers using the final learned state.

Challenge contract:

1. The answer must be absent from the prediction's authorized committed input prefix.
2. Kajo commits that prefix, Profile state, model/policy versions and the supported forecast or explicit unavailability before accepting the answer.
3. The first-answer measurement and currently available evaluation are stored against that exact forecast; a comparison needing another label remains pending, not a hit or failure.
4. Only afterward is source-provenanced answer evidence projected for future predictions.
5. Corrections/withdrawals change future state and remove affected copied reports under lifecycle rules; they cannot rewrite the original forecast or measured first answer.
6. Ordinal comparisons use a retained same-prefix panel where both first labels were unseen. A later second label may finish the original comparison after intervening learning; it cannot rescore that panel. Scores from different learned prefixes never share one comparison scale.

User-facing metrics must correspond to a documented measure, actual sample size,
coverage and uncertainty. Never fabricate an accuracy percentage. MAE/RMSE or
rating-point hits require a real grade predictor with an admitted calibration
contract; ranking scores cannot supply those metrics. See the
[evaluation boundary](../domain/PREDICTION_MODEL.md#sequential-adaptive-taste).

The current October 12 v1 own-Personal source supports **ranking order**, not a calibrated
rating estimate. It reserves up to three unseen Items per domain before one
canonical forecast and hides scores until all first answers are locked. Its
[taste-ordinal-agreement-v1 metric](../domain/PREDICTION_MODEL.md#frozen-personal-taste-challenge)
reports same-domain pair agreement, ties, missing forecasts and known/unknown
counts; dependent pairs are not independent observations. Percentage, rating
error and statistical certainty are unavailable. UI must describe ordering
agreement and sample size, never say “within N rating points” from these scores.
These v1 answers remain evaluation-only; sequential projection is a new versioned
target and does not alter existing v1 sessions. Anonymous prerequisites and observed usefulness
remain separate gates. #330 supplies the owned mobile presentation, with actual
hosted/device acceptance still required.


## 7. Recommendation preview and conversion wall

After explicit provisional readiness, Kajo may return a small preview of unseen
candidates through the canonical production recommendation boundary. An
insufficient pause/exhaustion result must explain its limitations and cannot
claim that Taste or prediction quality passed. The current v1 consumer retains
its separate post-test challenge; sequential v2 runtime acceptance is still open.

The preview should communicate:

- a high-fit choice,
- optionally a safer vs. bolder choice using existing DiscoveryMode semantics,
- why Kajo believes the Item fits using safe inspectable explanation components,
- that substantially more recommendations are available in the app.

Then the user receives the low-friction account action:

```text
Continue with Apple
Continue with Google
```

The conversion is not a reset. The user enters the app with the Taste Test already represented in PersonalProfile state.

## 8. Friend conversion

If the entry was a valid personal invite:

```text
inviter creates invite
  ↓
receiver opens link
  ↓
receiver completes/uses Taste Test anonymously
  ↓
receiver chooses to continue
  ↓
receiver authenticates
  ↓
receiver explicitly accepts inviter connection
  ↓
Friend relationship ACTIVE
```

Both users then see each other in the canonical friends surface.

Friendship invariants:

- friendship is reciprocal active relationship state,
- one pair cannot have duplicate active Friend rows,
- pending invite is not Friendship,
- Friendship is not SharedProfile membership,
- Friendship grants no access to private PersonalProfile history,
- either user can remove/block according to the MVP friend lifecycle,
- blocked/removed relationships cannot be recreated through replayed invite tokens,
- user enumeration and invitation spam are rate-limited.

Future invite presentation (owner idea, 2026-09-10): place a small “lähetä linkki”
action below Send invitation. Tapping reveals the invitation URL and a one-tap
copy button. Deliver with Phase 16 link flows, not the current collection fixes.
Apply the presentation to the appropriate invitation type only once its URL,
consent and lifecycle exist; a Friend link must not silently join a SharedProfile.

## 9. SharedProfile creation from Friends

Friends are a lightweight social graph. SharedProfile remains the learned recommendation target for joint use.

Canonical two-person path:

```text
Friends
  ↓ select friend
Create yhteinen Kajo
  ↓ explicit confirmation
SharedProfile
```

Planned Phase 16.2 creation uses **2–5 total people including the creator**.
Show at most five member slots, with the creator occupying one. Each `+` slot
selects an authorized accepted Friend or generates an opaque invitation with
show, copy and OS-share actions, including WhatsApp where available. For 3–5
people, collect each person's explicit canonical membership acceptance; pending
slots are not accepted members. Expiry, revocation, rate limits, replay and
block/remove safety under 16.0–16.1 precede this UI. The compact creation bound
does not replace existing generic 2-N SharedProfile membership support.

Do not make every friendship a SharedProfile. This keeps the friend graph lightweight and makes joint learning intentional.

Personal Taste setup precedes joint rating. Preserve an existing completed setup
and the bounded recognition-aware cold-start exit; do not force a repeat test or
20 recognized Items to unlock a group. The required next step is SharedRatingRound
(#232, ROADMAP 16.3): one member’s Shared score invites the others’ own responses,
then the completed joint experience enters Shared history. Personal history stays
separate. DOMAIN_MODEL and PREDICTION_MODEL own the round and rewatch contracts.
The October 9 clarification reaffirms the initial adaptive Taste before release;
the group shortcut is not a substitute for the planned Taste/usefulness gates.

### Planned joint decision for today — ROADMAP 16.4

After 16.3's evidence/rewatch delivery, offer an optional Shared session for
“what should we watch/read today?” before the complete beta. At most five current
BOOK/MOVIE options come from the same canonical Shared predictor and inherited
DiscoveryMode/risk policy; an optional Tinder-like card sequence does not create
a second recommender. “Do today”/other domains remain future scope.

Proposed behavior is an any-participant session-level “not interested” veto;
confirm its exact threshold when implemented. “Already seen/read” replaces that
current option for this session. Refill is bounded, retains exact origins and
explains genuine eligible exhaustion or expiry. Preserve prior history and
controlled rewatch: these controls are not ordinary durable not-interest,
history deletion, SharedRatingRound completion or automatic group reward.

Freeze a bounded accepted roster, retain actor/session/scope/version provenance
and define membership-change, expiry, cancellation, exact-retry, concurrency and
deletion behavior. Session opening, options exposed and rejection/selection/end
telemetry remain separate from confirmed outcomes. Ordinary Shared discovery
and the separately optional List-only FUT-UX-003 remain distinct. All behavior
here is planned; MVP-SOCIAL-010..012 own acceptance.

## 10. Funnel and event measurement

Kajo must know where the launch loop succeeds or fails. Acquisition/product funnel telemetry is distinct from taste evidence when semantics differ.

Minimum funnel events/concepts:

```text
TASTE_LINK_OPENED
TASTE_SESSION_STARTED
TASTE_ITEM_PRESENTED
TASTE_ITEM_RESPONDED
TASTE_SESSION_COMPLETED
TASTE_CHALLENGE_PREDICTED
TASTE_CHALLENGE_ANSWERED
TASTE_PREVIEW_SHOWN
AUTH_CONVERSION_STARTED
AUTH_CONVERSION_COMPLETED
FRIEND_INVITE_CREATED
FRIEND_INVITE_OPENED
FRIEND_INVITE_ACCEPTED
FRIEND_RELATIONSHIP_CREATED
SHARED_PROFILE_CREATE_STARTED
SHARED_PROFILE_CREATED
```

Only Item responses that meet canonical taste/evidence semantics should enter recommendation learning. Link opens, auth clicks and friend conversions are growth telemetry, not evidence that the user likes an Item.

Every funnel event includes only the minimum required attribution/session/version data. Campaign attribution, invite identifiers and experiments must not leak another user's private Profile data.

## 11. Experimentation

The launch loop is experimentable from the start.

Version or assign at least:

- Taste question-selection policy,
- readiness criteria, safety budget and pause/insufficient rule,
- challenge metric/presentation,
- recommendation preview policy,
- CTA/copy variant where tested,
- acquisition campaign/referral source.

An experiment assignment must never silently change recommendation evidence semantics. Test outcomes should include activation and downstream recommendation success, not only CTA clicks.

## 12. Success metrics

Do not optimize only installs.

Primary launch-loop metrics:

- Taste link → first response,
- first response → completed Taste session,
- recognized-experience answer coverage and ambiguous skip rate; true recognition rate only where a retained protocol actually observes it,
- questions to useful confidence,
- holdout prediction error / hit rate,
- Taste completion → account conversion,
- account conversion → first app session,
- D1/D7 return,
- recommendation preview → later save/consumption/rating,
- invites created per activated User,
- invite open → Friend conversion,
- Friends → SharedProfile creation,
- successful discoveries per active Profile,
- SharedProfile successful choice/outcome rate.

The long-term North Star remains valuable experiences found, not swipes or raw time spent.

## 13. Scale design: one million users

Architecture principle:

> **Design contracts for one million users; provision infrastructure for measured demand.**

The MVP must avoid data-model choices that require a social/identity rewrite at scale, but it must also avoid speculative infrastructure.

Keep these boundaries separate:

```text
IDENTITY
User / AuthIdentity / anonymous conversion

TASTE
PersonalProfile / bootstrap evidence / Memory / Prediction

SOCIAL
Friendship / FriendInvite / SharedProfile membership

ACQUISITION
TasteSession / attribution / campaign / invite token

BEHAVIOR
Event / PredictionRun / Outcome
```

At scale Kajo may split candidate retrieval, ranker, feature state, event ingestion, analytics and SleepLayer into separate services. Their contracts must remain compatible with the canonical Profile/Item/Event/Prediction model.

Do not introduce Kafka, Kubernetes, a graph database or a large microservice topology solely because the product may later reach one million users. Add them only when measured latency, throughput, isolation, recovery or cost justifies the change.

## 14. Security and privacy

Release blockers include:

- opaque unguessable invite tokens,
- expiry/revocation/use limits,
- rate limits on invite creation/open/accept and anonymous Taste creation,
- anti-enumeration controls,
- Friend remove/block path,
- exact authorization for invite resolution and SharedProfile creation,
- deletion/retention rules for abandoned anonymous identities and Taste sessions,
- attribution retention limits,
- no exposure of PersonalProfile evidence to Friends,
- no automatic use of message text/contact lists/precise location,
- redacted logs and diagnostics.

## 15. Build order

The October 25 owner priority supersedes earlier ordering that advanced public
acquisition before the practical first engine was complete. The authoritative
schedule and substantial engine sprint definitions are in [ROADMAP](../project/ROADMAP.md).

1. Finish active source work, reconcile remaining acceptance and remove only verified obsolete branches.
2. Deliver and evaluate practical Engine V1 through Sprints 015–021, including the shared owned-app Taste/Discovery loop, personal expected-rating/response-style model, useful state/memory, honest readiness and operating acceptance. Existing authenticated flows can provide this evidence; they do not certify anonymous/public readiness.
3. Complete core UX and measured end-to-end performance: navigation, Lists/history/search, recovery, accessible actions and the general duration work package (Phase 17.0).
4. Complete web/public acquisition: browser/installed-app Taste; server-backed anonymous identity, bounded retention/deletion/abuse controls and measurement; Google/Apple conversion preserving the same Profile; and the complete conversion funnel (Phase 15).
5. Complete recommendation preview, personal Friend invite/safety lifecycle, compact explicit SharedProfile creation, Shared rounds/rewatch and bounded joint decisions (Phase 16).
6. Complete remaining telemetry, privacy, support and operating flows (Phase 17.1–17.2).
7. Complete UI/visual polish and representative accessibility/device verification against those working flows.
8. Run the closed external beta of the complete link-to-Kajo loop, resolve failures, and complete store/public release acceptance.
9. **Only after all release gates pass: share the Taste link with real acquisition traffic.**

Minimum safety, privacy, accessibility and lifecycle behavior applies at every
stage that handles the relevant data or user flow; later polish is not permission
to defer a correctness defect. Engine V1 completion does not close the remaining
launch requirements.

Personal source work may proceed alongside independent Shared/native acceptance.
Known Shared evidence defects, the genuine #232F prepared-input consumer,
#306 integration, #229 device/fresh-account acceptance and Phase 16.3 remain
required. Advanced Shared model enhancements do not serialize every Personal
source task; all relevant quality/privacy and complete-beta gates still apply.

The project should not announce “now is the time to share the link” until the release readiness gate in the roadmap is explicitly satisfied.

## 16. Out of first-release scope

The following remain later even though the launch architecture must not block them:

- public/global feeds,
- local stranger discovery,
- dating or compatibility matching between strangers,
- music/events/restaurants/travel as production domains,
- autonomous global predictor promotion,
- public influencer/follower graph,
- continuous location tracking,
- complex reward/referral economics.

See `FUTURE_PLAN.md` for the preserved complete vision.
