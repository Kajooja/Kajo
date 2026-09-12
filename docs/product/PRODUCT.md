# Kajo Product Constitution

Status: **canonical product foundation**

## 1. Value proposition

Kajo learns what kind of experiences a person is likely to value and helps that person discover what to experience next—alone or together with others.

The intended feeling is:

> **Kajo knows me, but it can still surprise me.**

The long-term product promise is simple:

> **What should I watch, read, listen to or do next — and later, who might I enjoy doing it with?**

## 2. Kajo is not a book or movie app

Books and movies are the first production domains, not the product boundary.

A recommendable object is a generic `Item`. Future domains may include series, music, artists, concerts, events, restaurants, travel, activities, podcasts and games.

The core prediction architecture must not require redesign when a new ItemType is introduced.

The independent [Predictive Memory Engine](../architecture/PREDICTIVE_MEMORY_ENGINE.md)
is a reusable technical system, with Kajo as its first DomainAdapter. Public
preference data supports isolated non-commercial research before native user
volume grows. E1/D1/D2 are required bounded foundations; a trained prior is admitted
only with appropriate evidence, rights and fallback. The architecture is a target,
not a claim that the portable package or trained model already exists.

## 3. Prediction targets Profile

Prediction targets a `Profile`, never a User directly.

- `PersonalProfile` = one person's learned Kajo.
- `SharedProfile` = persistent 2-N person Kajo with its own evidence, memory and joint taste.

A SharedProfile is not a simple average of member profiles.

First-release joint experiences also retain each participant's own response:
after Personal Taste/setup, one Shared rating prompts the others and all required
responses precede completed joint history. Controlled rewatches create new
experiences while retaining Personal and earlier joint history. These #232
requirements are planned successors, with exact acceptance in MVP and Phase 16.3.

## 4. First public product: prove value before registration

The first public Kajo uses a **Taste-first launch loop**.

A new visitor should be able to:

```text
open link
→ use Kajo immediately
→ complete adaptive Taste Test
→ see Kajo predict held-out known preferences
→ receive a small unseen recommendation preview
→ continue with Google/Apple
→ enter the full app with cold start already completed
```

Registration is a continuation of an already useful Kajo session, not the prerequisite for discovering what Kajo does.

The canonical contract is `LAUNCH_LOOP.md`.

## 5. Viral/social acquisition

Kajo's first growth loop is product-native rather than reward-based.

An existing user can send a personal Friend invite. The receiver follows the same Taste-first path. After explicit acceptance and account conversion, the receiver becomes a `Friend` of the inviter.

Important invariant:

> **Friendship is not SharedProfile membership.**

A personal invite does not automatically create a joint profile. Friends appear on a lightweight Friends surface and can explicitly create a SharedProfile in one short consent-based flow.

This preserves the natural path:

```text
one user
→ invite next person
→ both have useful PersonalProfiles
→ Friendship
→ optional SharedProfile
→ joint recommendations
```

## 6. What Kajo predicts

Kajo estimates how suitable and valuable an Item is for a Profile in current Context.

User-facing DiscoveryModes:

- `FOR_YOU`: high expected fit / safer choice.
- `SURPRISE`: meaningful novelty while retaining expected fit.
- `RISK`: greater uncertainty/variance and deliberately bolder discovery.

Internally Kajo may estimate interest, selection, save, consumption, completion, rating, recommendation and return, but it must not optimize raw engagement at the expense of actual satisfaction.

## 7. Memory model

### Working/short-term

Kajo models current/session intent and temporary drift separately from durable taste.

### Long-term

Kajo learns slowly changing cross-domain characteristics rather than isolated media silos.

### ScenarioMemory

Kajo remembers comparable situations: Profile state, Context, candidates, prediction and observed outcome.

### PopulationMemory

Later, privacy-gated aggregate/collaborative learning may help sparse Profiles. It is not required for the first release and must not expose another person's private Profile.

## 8. Cross-domain learning

The core differentiator is one evolving model of the person across domains.

A book may provide useful evidence for a movie only through shared features/representations with measured transfer reliability. A future music/event/activity signal should extend the same generic architecture rather than spawn a new user model.

## 9. Taste Test is part of the algorithm

Taste Test is not a genre questionnaire.

It is an active cold-start/evaluation surface using real Items. Kajo selects recognizable and informative questions, learns from canonical taste responses and then predicts held-out known Items before seeing their answers.

The test therefore serves four purposes at once:

1. cold start,
2. proof of value,
3. algorithm evaluation,
4. acquisition/virality.

User-facing accuracy claims must be mathematically honest and tied to actual frozen predictions.

## 10. Context

Context may include Profile type, recent behavior, session state, time and explicit intent. Later domains may add permissioned location, event time, travel distance, budget or weather.

Prefer explicit user-entered context over covert inference where possible.

## 11. Behavior data

Kajo is event-driven. Meaningful exposures/actions/outcomes must be measurable so predictions can be evaluated against reality.

Growth telemetry such as link opens, auth clicks and invite conversion is separate from Item preference evidence unless a canonical event explicitly says otherwise.

## 12. Social model

Kajo is not primarily a feed-based social network.

The first social layers are:

1. consent-based `Friendship`,
2. persistent `SharedProfile`,
3. Shared Lists/Endorsement/messages.

Later optional friend-review feeds may exist only if they help people make choices without turning Kajo into endless scrolling.

## 13. Discovery

Default discovery is a visual Kajo-ranked grid. Swipe is optional and useful for calibration/history capture; it is not the product itself.

Kajo must avoid a static taste bubble. FOR_YOU/SURPRISE/RISK are different ranking/exploration policies, not cosmetic filters.

## 14. Room and theme

Room remains Kajo's 2D atmospheric home/navigation metaphor.

Initial functional objects:

- bookshelf → books,
- screen/projector → movies,
- window/curtain → DiscoveryMode,
- fireplace → ambient identity,
- restrained social navigation → Friends/SharedProfiles.

Graphics can evolve substantially without rewriting domain/event/prediction contracts.

## 15. Privacy and identity

Identity, taste and social graph are separate concepts.

A Friend cannot inspect another person's private PersonalProfile evidence merely by being a Friend. SharedProfile contains its own authorized shared history. Personal invitation tokens are opaque, revocable and abuse-controlled.

Anonymous Taste state has a bounded retention/deletion lifecycle and upgrades safely to permanent identity.

Demographics are not required for cold start. Any future demographic prior must remain weak and behavior must supersede it.

## 16. Success

Kajo succeeds when it helps people find experiences they actually value.

Important measures include:

- prediction error/calibration,
- successful discoveries,
- saves leading to consumption and later satisfaction,
- number of recommendations required to find a choice,
- return behavior,
- SharedProfile satisfaction/minimum-member fit,
- Taste Test completion and honest holdout quality,
- Taste → account activation,
- invite → Friend conversion,
- Friends → SharedProfile creation.

Installs, swipes and time spent are not North Stars.

## 17. Scaling principle

Design stable contracts for one million users; provision only for measured demand.

Keep separate:

- Identity/Auth,
- Personal/Shared taste state,
- Friend/Shared social relationships,
- acquisition/Taste sessions,
- Event/Prediction evidence.

Do not add Kafka, Kubernetes, graph databases or many microservices merely because Kajo may grow. Split services only when measured throughput, latency, recovery, isolation or cost justifies it.

## 18. First-release boundary

The first release requires:

- real BOOK/MOVIE catalog,
- trustworthy generic Prediction + memory/evidence system,
- adaptive Taste Test + honest holdout challenge,
- web/app Taste links,
- anonymous → Google/Apple conversion,
- Friends through personal invite links,
- explicit Friends → SharedProfile creation,
- Lists/search/core Shared flows,
- funnel/evaluation telemetry,
- privacy/abuse/recovery/operations,
- closed external beta of the actual link-to-app path,
- store/public release and explicit Share Link Gate acceptance.

See `MVP.md` and `ROADMAP.md`.

## 19. Complete-product direction

After the first release Kajo should expand toward books, movies, series, music and hyperlocal things to do; richer personal/shared experience memory; stronger group learning; optional friend-review discovery; and eventually broader real-world discovery.

A distant research direction is using long-lived taste/behavior compatibility to help people find friends, activity partners or possibly dating matches. This is not assumed to work and requires separate consent, safety, privacy and predictive-validity evidence before productization.

The complete long-term backlog and stop/acceptance gates live in `FUTURE_PLAN.md`.

## 20. North star

Kajo should become both:

1. a prediction engine for future experiences, and
2. a personal/shared memory layer for past experiences.

The strongest long-term product position is:

> **Kajo helps you discover what is worth experiencing next — and eventually, with whom.**
