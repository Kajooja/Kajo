# Kajo Taste-first Launch Loop

Status: **canonical MVP launch specification**  
Product decision: **2026-09-07**  
Tracking: **#215**

This document defines how the first public Kajo acquires, activates and socially connects a new user. It is not a marketing appendix. The flow below is a release requirement and must be implemented only after the recommendation foundation is trustworthy enough to create a useful first-session experience.

## 1. Product thesis

Kajo should prove value before asking a new visitor to create an account.

The canonical public entry flow is:

```text
Taste link / campaign link / personal invite
        ↓
web or installed-app entry
        ↓
anonymous Taste Test
        ↓
first PersonalProfile taste state
        ↓
holdout prediction challenge
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
3. Learn a bounded initial taste state from real catalog Items.
4. Evaluate that state against held-out known Items without contaminating the challenge.
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

The user reacts to recognizable real Items one at a time. Current rating semantics remain canonical: a 0–10 rating means consumed/read/watched; unknown can be skipped; not-interest is distinct from a rating.

The test should normally remain within roughly **12–24 informative known-item opportunities**, adapting to recognition and information gain. Exact thresholds are versioned and must be measured rather than hard-coded forever.

Owner device preference (2026-09-10): make initial profiling visibly longer,
using approximately **10 movies followed by 10 books**, with a distinct transition
card announcing book profiling. Treat this as the proposed default progression
for Phase 15.0, compatible with the 12–24-opportunity adaptive range above, not a
requirement to force 20 known ratings. Keep unknown-item skips, recognition-aware
selection and honest progress. The current logged-in calibration flow also needs
this proposal evaluated after its evidence/history defects are corrected.

Current-calibration evaluation (2026-09-10, #228/#229): the server already accepts
6–24 known ratings and can select 20 balanced candidates, but currently returns
an interleaved MOVIE/BOOK sequence and offers completion after six ratings. The
proposed 10 MOVIE → transition → 10 BOOK progression therefore needs a versioned
presentation/stop rule, not just a higher numeric minimum. Retain unknown skips,
bounded extension to 24 opportunities, and fail-open behavior when recognition or
catalog coverage is insufficient. Freeze the presented order when extending so
already answered Items do not move or repeat. Existing completed profiles must
not be forced through calibration again. Implement this progression in Phase 15.0
with the adaptive Taste interaction; the current history correction does not
change the six-rating completion rule or claim the longer flow is delivered.

Owner follow-up (2026-09-10): keep an independent **“En tunne” / skip** action
visible and usable after the rating wheel has moved, including accidental touches.
“Next” with a draft rating and “unknown” must be separate, unambiguous actions.
Choosing unknown discards that Item's unsubmitted draft rating and advances or
extends the opportunity sequence without creating rating/not-interest evidence.
Cover accidental drag, deliberate zero rating, previous/next and the last-card
extension/fail-open case. Deliver this with the longer Phase 15.0 Taste flow;
the current six-rating calibration still switches its combined label after a
draft rating and has not yet received this interaction correction.

The question-selection policy should optimize information gained about the Profile while retaining:

- high recognition probability,
- feature diversity,
- domain diversity where useful,
- balanced positive/negative evidence,
- no demographic requirement,
- no repetitive near-duplicate Items,
- fail-open behavior when the visitor does not recognize enough Items.

The first production implementation may be transparent and heuristic. A learned active-learning policy is optional until it beats the transparent baseline under the same evaluation contract.

## 6. Prediction challenge

After enough training responses, Kajo should demonstrate what it learned using **held-out known Items**.

Challenge contract:

1. Items used for the challenge must not have been used as training responses for that Taste session.
2. Kajo freezes the Profile/taste snapshot and model/policy version used for each prediction.
3. Kajo predicts the user's rating/fit before revealing or accepting the actual answer.
4. User submits the real answer.
5. The error becomes evaluation evidence.
6. Challenge responses may join the Profile's taste state only after their prediction has been frozen, so they cannot improve their own score retroactively.

Never display a fabricated “91% accuracy” number. User-facing metrics must correspond to a documented mathematical measure, sample size and uncertainty. With very few holdouts, prefer plain language such as “Kajo osui lähelle 2/3 arviossa” rather than false precision.

Possible internal metrics include MAE/RMSE on 0–10 ratings, tolerance hit rate, rank correlation when enough items exist, calibration error and completion/recognition rate.

## 7. Recommendation preview and conversion wall

After the challenge, Kajo returns a small preview of unseen candidates selected through the same production recommendation boundary used after registration.

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

For 3+ people, the creator selects Friends and sends/collects explicit membership acceptance under the existing SharedProfile rules.

Do not make every friendship a SharedProfile. This keeps the friend graph lightweight and makes joint learning intentional.

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
- question count/stop rule,
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
- known-item recognition rate,
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

The launch loop begins only after the algorithm/data spine is reliable enough that the first Taste session is meaningful.

Canonical order:

1. Algorithm correctness, evidence reliability, real catalog and stable serving/shadow semantics.
2. Adaptive cold-start/Taste policy and trustworthy challenge evaluation.
3. Anonymous identity + web Taste entry + identity conversion.
4. Recommendation preview and conversion funnel.
5. Personal Friend invite + friend lifecycle.
6. Fast SharedProfile creation from Friends.
7. End-to-end funnel telemetry, experiments, privacy/abuse and operational gates.
8. Closed external beta of the complete link-to-Kajo loop.
9. Store/public release readiness.
10. **Only after all release gates pass: share the Taste link with real acquisition traffic.**

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
