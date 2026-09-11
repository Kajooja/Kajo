# Kajo Complete Product and Research Backlog

Status: **permanent long-term product memory**  
Product direction consolidated: **2026-09-07**

This file preserves Kajo's complete ambition without allowing distant ideas to displace the first public release.

Execution authority:

- `MVP.md` — first public release boundary,
- `LAUNCH_LOOP.md` — Taste-first acquisition loop,
- `ROADMAP.md` — exact build order and Share Link Gate,
- `STATUS.md` — exact current task.

Everything in this file is **after or conditional on the first-release gates** unless a requirement is explicitly promoted into MVP.

## 1. Long-term product thesis

Kajo is a personal/shared discovery and memory layer that learns a person's deeper preference structure across experiences.

The long-term progression is:

```text
things for me
→ things for us
→ things to do now / nearby
→ richer memories of what happened
→ useful social discovery
→ only much later, evidence-gated people compatibility
```

Kajo should eventually answer:

- What should I watch?
- What should I read?
- What should I listen to?
- What should we do tonight?
- Where should we go?
- What would make a good date/activity?
- Which experiences would fit this group?
- Much later: are there people nearby whose interests/dynamics suggest a useful friendship or other connection?

The final product should remain quiet and choice-oriented rather than becoming an endless engagement feed.

## 2. What moved into the first release

The following are **no longer future-only ideas**:

- Taste-first public link,
- anonymous Taste Test,
- honest holdout prediction challenge,
- recommendation preview before registration,
- Google/Apple identity conversion preserving cold start,
- personal Friend invite,
- reciprocal lightweight Friendship,
- Friends surface and basic remove/block/abuse lifecycle,
- explicit Friends → SharedProfile creation,
- complete acquisition/funnel telemetry,
- one-million-user-compatible identity/taste/social contracts.

Do not duplicate these here. Their canonical specs are `MVP.md` and `LAUNCH_LOOP.md`.

## 3. FUT-REL-001 — Both public mobile stores — PLANNED

If MVP closes with only one public store, complete public distribution in both Google Play and Apple App Store next.

Acceptance:

- clean install/update/auth/account deletion,
- Taste link continuation,
- Friends/Shared flows,
- real content discovery,
- representative Android/iOS device evidence,
- current store privacy/data-safety/provider requirements rechecked at submission time.

## 4. FUT-CAT-001 — Broad canonical catalog — PLANNED

Expand persisted canonical catalog breadth and findability while preserving one generic Item model.

Candidate domains/sources must be revalidated at implementation time for current terms, rights and coverage. Current directions include:

- BOOK: Open Library breadth plus Finnish bibliographic enrichment such as Finna/Fennica where permitted,
- MOVIE: current TMDB adapter plus any licensed gap-filling needed,
- SERIES: compatible TV metadata provider,
- MUSIC: MusicBrainz/release-group style metadata and legally usable cover sources where permitted,
- EVENTS: Helsinki-first official/structured event sources.

Required architecture:

```text
provider
→ checkpointed bounded ingestion
→ validation/provenance/rights
→ ItemSource + ItemExternalId
→ canonical Item
→ normalized versioned features
→ Kajo search/retrieval/ranking
```

Do not make external provider availability part of every user interaction.

Acceptance includes coverage/duplicate/image/description/language reports, provider outage behavior, safe alias/work/edition matching and legally usable imagery/attribution.

## 5. FUT-DOM-001 — Series — PLANNED

Add series through the same generic Profile/Item/Event/Prediction/List architecture.

Define series vs season/episode identity and consumption semantics carefully. Watching one episode is not automatically consuming/rating the entire series.

Acceptance:

- mixed BOOK/MOVIE/SERIES Lists,
- search/tags/creators,
- Personal/Shared recommendations,
- cross-domain transfer compared with no-transfer baseline,
- real-device acceptance.

## 6. FUT-SOC-001 — Stronger friendship and group learning — PLANNED

Basic Friendship is MVP. This future package strengthens the social/product intelligence **after real usage exists**.

Possible extensions:

- friend discovery preferences / nickname discoverability controls,
- richer friend invitation management,
- useful friend-based discovery surfaces that do not expose private taste,
- better SharedProfile dynamics for 3+ groups,
- membership-change-aware group learning,
- fairness/minimum-member satisfaction,
- detecting when one very active member is dominating evidence,
- improved pair/group recommendation explanations.

Acceptance compares improved group policy against current common-fit and simple-average controls using actual delayed group outcomes. Do not ship complexity merely because a graph exists.

## 7. FUT-LOC-001 — Helsinki event ingestion — PLANNED

Build a high-quality Helsinki-first event/activity inventory before attempting broad geographic expansion.

Preferred source order:

1. official/structured Helsinki event data,
2. measured coverage gaps from selected venues/organizers through permitted structured feeds/APIs,
3. organizer submission/correction channel if justified,
4. allowlisted extraction only after explicit source/rights/security review.

Event data should include title, description, tags, organizer, place, time/timezone, recurrence, price/unknown, language/accessibility/age where available, source/ticket URL, image rights, cancellation/status, provenance and freshness.

Acceptance includes idempotency, recurrence/duplicate handling, cancellation/reschedule freshness, Europe/Helsinki timezone correctness, outage behavior and measurable coverage/maintenance cost.

## 8. FUT-LOC-002 — Hyperlocal “what should we do?” — PLANNED

Once event data is trustworthy, rank real-world activities for PersonalProfile and SharedProfile.

Context may include:

- tonight/weekend,
- available time,
- optional manual location/radius,
- travel time,
- price/budget,
- language,
- group constraints.

Location remains optional and purpose-bound. Manual place/neighborhood selection is a complete path. No continuous background tracking is required.

Critical evidence distinction:

- event shown ≠ attended,
- ticket/link click ≠ enjoyed,
- proximity ≠ interest.

This package begins to solve the common “what should we do today?” and date-idea problem using the same Kajo taste model.

## 9. FUT-DOM-002 — Music — PLANNED

Start with albums/releases/artists and discovery, not necessarily streaming.

Potential capabilities:

- album/artist search,
- save/rating/history,
- external listening links,
- Personal/Shared music recommendations,
- cross-domain transfer between music and other experience types.

Later separately evaluate:

- track-level modeling,
- streaming-service history import,
- listening-provider integrations,
- rights/licensing implications.

Acceptance requires safe artist/release identity, duplicate-release handling, legal cover path and measured benefit from cross-domain learning.

## 10. FUT-MEM-001 — Experience memory layer — PLANNED

Kajo should become not only a predictor of future experiences but a memory layer for past ones.

Possible consumed-experience memory fields:

- note,
- rating/reflection,
- date,
- people,
- location,
- image/photo,
- occasion/trip/group,
- later edits/corrections.

This must remain optional and private by default. Memories are human records, not automatically raw model features. Each field needs an explicit reason before entering Prediction.

Long-term value:

> “What have I experienced, what did I think, and with whom?”

## 11. FUT-SOC-002 — Optional friend-review feed — CONDITIONAL

Only after Friendship usage and publishing/privacy/moderation foundations are mature.

A private rating is **not automatically a public review**.

If built, feed should be small and relevance-oriented:

> “A friend rated this highly and Kajo believes it may fit you.”

Required controls:

- explicit publish/audience,
- edit/delete propagation,
- spoiler handling,
- hide/mute/block/report,
- bounded pagination/notifications,
- no private rating leakage.

Stop criterion: if feed increases scrolling/noise without improving successful discoveries, do not expand it.

## 12. FUT-SOC-003 — Local/global review discovery — CONDITIONAL

Only after friend feed proves useful and moderation capacity exists.

Potential scopes:

- friends,
- local/coarse area,
- global.

Protect against brigading, fake reviews, popularity dominance and location/privacy leakage. The user must be able to keep Kajo feed-light or feed-off.

## 13. FUT-ALG-001 — PopulationMemory — CONDITIONAL

Current first release learns from the Profile itself plus permitted provider/catalog priors. Cross-user PopulationMemory becomes possible only when consent, data volume, deletion lineage, minimum-cohort privacy and exposure-bias correction are mature.

Potential components:

- collaborative Item representations,
- Profile/Scenario clusters rather than exposed identities,
- cross-domain semantic space,
- aggregate trend priors,
- sparse-user transfer.

PopulationMemory never means one mobile client can inspect another Profile's raw history.

Acceptance requires fixed controls, cohort/privacy thresholds, deletion propagation, exposure-bias handling, fairness/concentration metrics and real downstream outcome benefit.

## 14. FUT-ALG-002 — Evidence-gated EvolutionEngine expansion — PLANNED / CONDITIONAL

The first release already requires trustworthy SleepLayer evaluation and controlled Challenger architecture. Later evolution may become more powerful.

Possible Challenger families:

- alternative scalar weights,
- memory horizons,
- feature subsets,
- retrieval variants,
- learned ranking models,
- sequence models,
- calibrated uncertainty models,
- contextual gating/policy models,
- stochastic exploration/bandit variants where propensities can be recorded truthfully.

Owner metaphor:

- dreams = bounded alternate simulations/shadows,
- DNA = immutable PredictorGenome/artifact lineage,
- subconscious = derived versioned state/policy.

Hard rule:

> **Imagined/counterfactual outcomes never become historical Events.**

Automatic/global promotion remains conditional on sustained leakage-safe evidence, canary/A/B discipline, rollback, support/uncertainty, latency/cost/privacy/fairness guardrails.

Per-Profile or SharedProfile Champions are allowed only when evidence is sufficient and shrunk appropriately toward safer baselines.

## 15. FUT-OPS-001 — Scale to 10k / 100k / 1M users — PLANNED

First-release contracts already anticipate scale. This package is about **measured infrastructure evolution**, not redesigning the domain.

Track separately:

- registered Users,
- MAU/DAU,
- concurrent sessions,
- Taste sessions/conversion,
- Prediction requests,
- candidates/traces,
- Events,
- Friends/SharedProfiles,
- image egress,
- SleepLayer/shadow multiplier,
- storage/backup/analytics retention,
- provider/license/support/moderation costs.

Potential measured transitions:

- read replicas / larger Postgres compute,
- dedicated candidate retrieval/vector service,
- dedicated ranking service,
- event stream/warehouse,
- background worker queues,
- regional/service decomposition.

Do not introduce these by calendar date. Introduce when the measured bottleneck justifies operational complexity.

## 16. FUT-PERSON-001 — Local people discovery for friendship — RESEARCH

This is a distant extension of Kajo's strongest long-term insight: years of voluntary behavioral taste data may describe compatibility more richly than a short questionnaire.

Research question:

> Can Kajo identify people who are likely to enjoy being friends/activity partners because of compatible or complementary interest structures?

This is **not** equivalent to “both like the same movie.”

Potential future signals might include only explicitly permitted, non-sensitive representations such as:

- shared latent taste structure,
- complementarity,
- novelty/risk appetite,
- activity preferences,
- group choice history,
- successful shared outcomes.

Hard gates before even a pilot:

- explicit opt-in,
- adult/safety/abuse model where relevant,
- no raw private history exposure,
- location minimization/coarse/manual options,
- block/report/moderation,
- measurable predictive validity,
- careful fairness/harms review,
- legal/privacy review.

Stop if compatibility signal does not outperform simple baselines or creates unacceptable safety/privacy risk.

## 17. FUT-PERSON-002 — Dating / relationship compatibility — RESEARCH, VERY DISTANT

Potentially build only after friendship/activity matching has demonstrated genuine predictive validity and operational safety.

The concept is not “Tinder with movie tags”. The research hypothesis is that a long-lived voluntary Kajo profile could support better compatibility signals than photos/bios alone.

This requires its own product, consent, safety, moderation, age, sensitive-data, fairness and legal design. Never infer sexual orientation, relationship intent or other sensitive attributes from entertainment behavior. Ask explicitly where needed.

No current roadmap milestone should depend on this research.

## 18. RES-NET-001 — Planet / folded-space distributed network — RESEARCH

Preserve the owner's distributed-network concept as research memory: a ledger/network represented in virtual higher-dimensional/folded space, routing work toward predicted online nearby nodes, parallel confirmation and cross-validation.

Possible research questions:

- can a geometry/embedding-based routing model reduce coordination cost,
- can distributed validation remain secure under churn/adversaries,
- can compact state/history be reconstructed safely,
- does the model offer any real benefit over established distributed systems.

This is not required for Kajo service scaling. Conventional cloud infrastructure remains the default until a prototype demonstrates a clear advantage.

## 19. RES-EDGE-001 — On-device / federated learning — RESEARCH

Explore only if privacy/cost/offline evidence makes it worthwhile.

Potential ideas:

- local PersonalProfile adaptation,
- privacy-preserving aggregation,
- compact model/state deltas,
- offline recommendation cache.

Do not imply that on-device training automatically improves privacy; model updates can leak information and require their own threat/privacy design.

## 20. FUT-MEM-002 — Compact memory / representation research — PLANNED RESEARCH

Kajo may eventually store compact learned representations rather than replay every raw interaction forever.

Candidate representations:

- sparse feature summaries,
- vectors/embeddings,
- Scenario prototypes,
- immutable genome/artifact references,
- bounded trace retention,
- graph/relational links.

Retention/compression must preserve defined audit/replay/deletion guarantees. “Compressing” evidence cannot fabricate missing history or make expired experiments magically replayable.

## 21. Idea recording rule

New ambitious ideas belong here when they are not first-release blockers.

Every major future idea should eventually record:

- purpose,
- dependencies,
- smallest credible experiment,
- success metric,
- stop criterion,
- privacy/safety/licensing implications,
- scale/cost implications.

Do not delete a distant idea merely because it is not ready. Do not promote it into the active roadmap merely because it sounds exciting.

## 22. Default long-term order

Unless evidence changes priorities, the post-release sequence is:

```text
public Kajo / Share Link Gate
→ both stores if needed
→ broader BOOK/MOVIE catalog
→ series
→ stronger Friends/Shared learning
→ Helsinki events + things to do
→ music
→ richer experience memory
→ optional friend-review feed
→ conditional local/global discovery
→ PopulationMemory/evolution improvements
→ measured 10k/100k/1M infrastructure scaling as needed
→ only much later people/friendship research
→ dating only after separate evidence/safety gates
```

Distributed-network and on-device learning remain independent research tracks and never block the product sequence.

## 23. Final vision

If the long path succeeds, Kajo becomes a single evolving model of experiences rather than a collection of disconnected recommendation apps.

A user can ask Kajo:

> What should I experience next?

A couple/group can ask:

> What should we experience together?

And only after years of product/evidence maturity, Kajo may investigate:

> Who might I genuinely enjoy experiencing life with?

The first step remains much narrower and measurable: make the Taste-first BOOK/MOVIE Kajo good enough that a real person sends the next person a link voluntarily.


## List choice for today — “Mitä tänään” (owner idea, 2026-09-10)

Offer an explicit action on a List: recommend the best Item from that List for
today, followed by a browsable ordered card sequence from the same List. This is
especially useful for an existing Shared Profile deciding what to watch/read
from jointly saved options. Personal Lists use the active PersonalProfile;
Shared choices use the existing SharedProfile model, never a simple member average.

- Keep the List name and a clear “saved List” presentation visible, so this cannot
  be confused with ordinary Discovery or treated as a newly discovered Item.
- Rank only authorized current List members, using the active Profile, current
  context and existing canonical Prediction/Item architecture. Freeze the delivered
  order/origin and distinguish this surface in evidence and evaluation.
- Browsing or opening this mode must not itself remove List entries, mark Items
  consumed or fabricate consensus. Preserve explicit decision/consumption actions.
- Empty Lists, unavailable Items, membership changes and no suitable choice need
  honest handling; do not claim objective certainty that one Item is “best”.
- Schedule after current algorithm/evidence and List correctness gates, as part of
  a separately scoped List/Shared UX package. The owner supplied this as an idea,
  not as a new release blocker or authorization to bypass the roadmap.

## FUT-UX-001 — Personal category statistics — PLANNED / #230

Owner idea recorded **2026-09-10**. Give the person a readable account of their
taste and activity, with light progression and a reason to return. Open
**Tilastot** below **Profiili** in the drawer and through the Profile surface.
Keep the Room and primary navigation restrained.

Execution slot: a separately scoped Phase 17.0 increment after reliable history,
atomic actions and delivered-origin gates. Weekly aggregation and comparisons
also depend on Phase 17.1/17.2 telemetry/operations/privacy. This records a
candidate for that phase, not a new Phase 14 task or an automatic MVP release
blocker. [Issue #230](https://github.com/Kajooja/Kajo/issues/230) tracks delivery.

### Personal summary and unlock

Each generic ItemType has independent progress, initially MOVIE and BOOK.
Use the active PersonalProfile's authorized state; do not mix Shared activity
or other members' personal history into "your" totals.

| Measure | Planned meaning |
| --- | --- |
| Rated | Distinct canonical Items with a current rating; 0 is a real rating |
| Mean rating | Mean of those ratings, including 0; not-interest is excluded; no rated Items means no invented average |
| Not interested | Distinct currently rejected Items, separate from consumed/rated |
| On Lists | Distinct Items currently on one or more of this Profile's Lists; one Item on several Lists counts once |
| Unlock progress | Distinct Items with a qualifying rating or not-interest reaction in this category; saves alone do not qualify |

The owner first suggested 50 reactions, then explicitly suggested starting at 30.
Working configuration: **30 to unlock**, **5 new reactions for a weekly update**;
keep these versioned/tunable rather than hard-coded in copy. The earlier 50 is
retained as a possible tuning value. A category with 22/30 shows "8 reaktiota
tilastoihin"; unlocking movies does not unlock books.

Accepted calibration/import ratings contribute once to initial historical totals
and unlock progress through source-aware projection. Consumed-only imports have
no invented rating. Working weekly rule: count new explicit Kajo ratings or
not-interest choices on previously uncounted Items; importing old history is not
five new weekly actions. Settle/document this source rule in the implementation
contract before rollout. Preserve bootstrap/native provenance; no copied Events.

Repeated requests, edited ratings, undo/re-rating of the same Item and overlapping
imports cannot manufacture progress. An Item contributes at most once to unlock
and as a new weekly qualifying Item; rating and rejecting the same Item cannot
count twice. Pending local actions do not become published progress until server
acceptance. Reversals/deletions reconcile current totals and uncommitted weekly
eligibility; already unlocked access is retained.

### Weekly summaries

The first summary is available when the category first reaches the threshold.
Afterward show its last-update date, the next-update countdown and the independent
reaction counter, for example "3/5 uutta reaktiota tällä viikolla".

Working calendar: Monday 00:00 **Europe/Helsinki**, shown explicitly and calculated
by the server with daylight-saving rules. Store one versioned schedule/timezone;
do not let each phone's clock/timezone choose a different week. A future timezone
change must have explicit transition semantics.

- At the next boundary, refresh only categories with at least five eligible new
  Items since the preceding weekly boundary (or first unlock, for a partial week).
- Fewer than five keeps the previous dated summary visible and explains why it
  did not update. Start the next week's counter at zero; no streak penalty,
  re-locking or implicit carry-over. This is the working interpretation of the
  owner's weekly minimum.
- Count a durable action in the window where the server first accepts it.
  A lost reply/retry keeps that original acceptance; a queued offline choice
  accepted after the boundary belongs to the following window.
- Publish one idempotent snapshot per Profile/category/window with a known cutoff.
  A delayed worker catches up consistently; countdown zero must not imply an
  unfinished update has completed.
- Corrections and deletion must reconcile or invalidate affected cached summaries
  promptly. Weekly scheduling does not justify retaining removed private data.

### Wrapped-style comparison and delivery slices

First ship useful private counts/means/progress. Add a compact comparison with
other users only when authorized anonymous aggregates have enough independent
Profiles and sufficient support per category. Specify the cohort, period,
minimum sample, deletion propagation and safe suppression rule before enabling
percentiles; the personal unlock threshold is not a cohort privacy threshold.
Sparse beta data shows that comparison is not available yet. Friendship alone
grants no private-history access, and this does not introduce PopulationMemory
or change ranking.

Smallest delivery: personal category summary and independent unlock counters,
then retry-safe weekly snapshots/countdowns, then evidence-gated comparisons.
Opening stats or an unlock card is product telemetry, not taste/reward evidence.
Judge usefulness by understandable summaries and returning users with meaningful
choices; do not optimize raw reaction volume at the expense of recommendation
quality. Keep aggregation incremental/bounded and avoid scanning all raw Events
on every screen open.

Acceptance covers 0/30/50 boundaries, independent categories, ratings including 0,
mean denominators, multi-List deduplication, import/native overlap, edits/undo,
4/5 weekly transitions, Monday/DST, delayed/offline/retried writes, stale snapshots,
deletion, scope changes and sparse community cohorts. No runtime is delivered by
this planning entry.

## FUT-UX-002 — Long-press multi-select — PLANNED / #231

Owner idea recorded **2026-09-10**. Reduce repeated work directly in Discovery and
List grids. Delivery belongs to a separately scoped Phase 17.0 browse/List
increment after MVP-DATA-003/004 and current List/history correctness.
[Issue #231](https://github.com/Kajooja/Kajo/issues/231) tracks implementation;
this is not an automatic additional MVP gate.

### Selection and actions

Long-press selects that card and enters selection mode, with a checked box in its
upper-left corner. Show checkboxes on selectable cards, a selection count and
clear Cancel/deselect controls. Further taps toggle selection. Normal taps outside
selection mode still open the card. Provide an accessible explicit Select action
so long-press is not the only entry.

| Surface | Explicit bulk actions |
| --- | --- |
| Discovery grid | Ei kiinnosta; Lisää listaan |
| A List's grid | Siirrä toiselle listalle; Poista tältä listalta |
| Luetut/Katsotut history grid | Poista historiasta (trash icon in selection mode) |

Entering/toggling selection never opens a card, records a preference or hides it.
Creating a destination only creates/selects the List; the sole/new usable
destination selects automatically and a separate confirmation performs the bulk
action. Do not revive the create-List → premature Item advancement defect.

List removal affects only selected memberships. It does not delete canonical
Items, remove other memberships, erase consumed/rating history or mean
not-interest. Owner extension (2026-09-11): history is explicitly included. Long-press in
Luetut/Katsotut enters the same multi-selection mode and reveals a trash icon.
Once this accessible mode is delivered, remove the permanent per-card
“Poista historiasta” text. The trash operation must dispatch history clearing,
not List-entry deletion: preserve Saved/other memberships, clear rated/consumed
and corresponding bootstrap/native evidence through the canonical correction
contract. Apply the existing durable partial-failure rules to selected Items;
never erase unselected Items. Until implementation and device acceptance, retain
the current working history-removal action. This remains planned Phase 17.0 / #231.

### Durable execution

- Freeze selected canonical Item IDs and their actual per-Item delivered origin,
  actor/Profile/session and source surface. Reordering cannot retarget an action.
  No guessed Prediction, blanket source or fake Item-open Event for a batch.
- Keep selection stable by ID across a same-scope refresh; explain/prune targets
  that have become unavailable. Account/Profile/session changes clear the draft
  and late reads/completions cannot act in the new scope.
- Initial moves stay within the active Profile. A move atomically commits target
  membership plus source removal per Item, with authorization, provenance and
  idempotent receipts; it never removes the source before securing the target.
  Existing separate add/remove UI calls do not establish that atomic contract.
- Shared actions retain the canonical actor-specific Endorsement and unanimity
  rules. A bulk proposal cannot force consensus or silently move a Shared choice;
  unavailable consensus-Saved removal stays unavailable with an explanation.
- Reuse durable command ordering/replay protection, with bounded dispatch and
  pending/succeeded/failed counts. Retain unresolved selections and retry their
  original commands; do not repeat already acknowledged successes.
- Whole-batch atomicity is not implied. Explain partial results, advance/remove
  cards only after their action reaches the existing accepted durability point,
  and do not offer an unsupported whole-batch Undo.

Delivery slices: accessible selection + Discovery actions; then per-Item atomic
List move and membership removal; Shared cases pass their existing consent/access
gates before exposure. Verify long-press versus scroll/open, empty selection,
refresh/reorder, first destination, partial success, offline/restart/retry,
concurrent List changes, Profile isolation and large-text/screen-reader use.
Success is less repeated tapping with accurate outcomes; stop or simplify if
accidental reactions or failed/misleading moves increase.

## Scope clarification — Shared rating rounds, 2026-09-10

The owner’s A-rates → B-responds → joint-history flow, separate Personal history
and controlled rewatch behavior are promoted to required first-release scope:
`MVP-SOCIAL-007..009`, ROADMAP Phase 16.3, Issue #232. DOMAIN_MODEL,
DATA_EVENTS and PREDICTION_MODEL own their contracts. They are not deferred
behind optional statistics, bulk selection or later social research. Personal
statistics must not silently count Shared round responses as Personal reactions.
