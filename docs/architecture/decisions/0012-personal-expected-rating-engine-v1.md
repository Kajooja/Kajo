# ADR-0012 — Personal expected rating and the first useful engine

Date: 2026-10-25
Status: Accepted owner direction; implementation and predictive-quality acceptance remain open.
Refines: ADR-0008 and ADR-0011. Execution order belongs to ROADMAP.

## Context

The owner explicitly corrects the earlier goal of maximizing the probability of
a ten. A person who reserves 8 for an excellent experience and 4 for a poor one
must be learned on their own response scale, just as a person using 10 and 0.
The primary objective is the expected post-experience rating for the current
Profile, with the person's rating behavior learned alongside preference.

The owner also confirms the existing feed has three choices: List saving,
numeric rating and Ohita. En tunne has already been removed. List saving
indicates interest; rating means the actor has experienced the Item; Ohita
combines unknown/not-interested situations without observing which reason held.

The full state/memory/scenario/path architecture remains the destination. The
immediate commitment is a useful, measurable Engine V1 as complete as available
evidence justifies, followed by UX/acquisition, UI refinement and release.

## Decision

### 1. A declared expectation on the person's own scale

For Profile p, eligible Item i, decision t and available history H_t, the Personal
target is:

```text
q_p,i,t(r) = P(R = r | Item experienced, p, i, current state/context, H_t)
mu_p,i,t  = sum(r * q_p,i,t(r)), r in {0,...,10}
FOR_YOU base choice = argmax_i mu_p,i,t
```

The target concerns a post-experience report. A familiar-Item Taste answer is a
retrospective experience report; a later rating after a new recommendation is
prospective usefulness evidence. Keep those populations separate in evaluation.
We cannot identify the rating of every unconsumed/unrated Item from observed
ratings alone. Record missingness, exposure/selection and follow-up coverage;
state the population for which prediction quality has actually been measured.

Maximizing P(R=10), a universal P(R>=9), a convex high-rating bonus, save rate,
clicks or dwell does not define this objective. Distribution tails remain useful
diagnostics of disappointment, variability and calibration. A 70% chance of 10
and 30% chance of 2 has expectation 7.6 and loses to a certain 8 under this base
objective; uncertainty does not turn the 7.6 into a better expectation.

Eligibility, privacy and availability remain hard constraints. SURPRISE/RISK may
make declared, bounded novelty/exploration tradeoffs shared by Taste and Discovery.
Such departures must retain the expected-rating component and measured tradeoff;
they are not a hidden replacement objective. A conservative uncertainty fallback
must state why it was used rather than pretending to maximize the true expectation.

The numerical expectation is an explicit product convention for the reported
0–10 scale. A positive affine change of one person's entire response scale leaves
their within-person expected-rating ordering unchanged. An arbitrary monotone
nonlinear transform can change expected-utility ordering. Do not silently replace
the objective with percentile ranks, z-scores or learned latent utility; such
quantities may be internal modeling aids or declared diagnostics.

### 2. Learn rating response behavior with preference

Use a versioned RatingResponseModel to map supported preference/context evidence
to the person's reported rating distribution. The first candidate is a compact
hierarchical model: global/domain baseline, shrunk Profile offset and supported
response spread/ordered thresholds, plus content and bounded state effects.
Compare it with the simpler unpersonalized-response model before adding parameters.

Retain original numeric ratings. Learn response parameters from only the eligible
training prefix, with source-scale mappings and parameter support recorded.
Unsupported parameters in sparse or constant-response histories shrink/fall back
to shared/domain priors, without division by zero, forced full-scale usage or
certainty. A long constant-rating history may support a personal mean while
leaving preference differentiation and response spread/thresholds unsupported.
Retain that supported location rather than discarding it. Domain-specific response
style needs its own support. Style drift and preference drift are separate
hypotheses; neither is a claim about personality.

An illustrative later ordinal link is `P(R<=k)=sigmoid(tau_p,d,k-eta_p,i,t)` with
ordered thresholds and an identified, regularized parameterization. A free
person offset and free threshold location cannot both float without constraints.
Only retain added scale/threshold flexibility when validation improves the
declared rating task. This design does not require fitting a large neural model.

A point predictor admitted as `expectedRating` must target the conditional mean,
for example through a justified squared-error objective, or derive that mean
from a validated rating distribution trained with a proper scoring rule. A model
fitted only to absolute error generally targets a median; do not silently name
its output an expectation. MAE may still be a useful evaluation diagnostic.

Absolute liking and scale usage are not fully identifiable from sparse subjective
ratings. An 8 cannot automatically be labeled this person's maximum happiness,
nor can a 4 be labeled hatred. The user's examples motivate learning a response
distribution, not invented anchor labels. Cross-person recall should account for
response style and uncertainty; raw grades are not interpersonally comparable
cardinal utility. Group policy needs an explicit, evaluated aggregation contract
and may not silently average inferred latent happiness across members.

### 3. Preserve the three-action evidence boundary

| Current action | Admitted meaning | Excluded inference |
|---|---|---|
| Save to one or more Lists | Interest/intention | Consumption or an invented high rating |
| Numeric rating 0–10 | Actor reports having experienced the Item and supplies a rating | Exact consumption time, causal recommendation success or another member's rating |
| Ohita | Deliberate current-context skip | Certain unknown/not-interested reason, a numeric zero or a durable dislike |

Multiple List destinations in one choice do not multiply independent preference
support. A positive committed choice must not also create Ohita. Historical
UNKNOWN/NOT_INTERESTED records retain their original semantics and correction/
withdrawal rules; their existence does not reintroduce separate feed controls.
The actor's rating in Shared context does not establish that every member has
experienced the Item. SharedRatingRound remains the joint-outcome boundary.

### 4. Finish a useful Engine V1 before acquisition expansion and polish

Engine V1 must implement and evaluate the shared serving/evidence boundary,
supported content/state representation, personal response-aware rating baseline,
bounded local scenario recall, measured cross-domain transfer, dated WorldState
facts, outcome/readiness contracts and repeatable comparison/rollback operations.
Shared input/output correctness and a bounded supported group baseline remain
required; speculative interpersonal inference does not.

Every proposed capability receives a disposition: admitted after comparison,
implemented but inactive with an exact blocker, or deferred research with a
reason and re-entry criterion. An inactive component is not claimed as delivered
predictive benefit. A complete architecture ledger is not itself Engine V1.

External priors and native cross-Profile memory require actual eligible data and
source/privacy admission. If unavailable, preserve a tested native/local fallback,
record the missing evidence and avoid simulated cohorts. Prototype support,
multi-space embeddings, sequence encoders, learned world transitions, synthetic
rollouts and automatic evolution are expanded only after simpler controls justify
them. Real replay, error review and controlled challengers are worthwhile V1 work.

The online response loop updates Profile state immediately after accepted
evidence. Offline learning changes shared parameters only through a versioned
artifact and admission process. Prefetched deliveries retain their original
prediction version; a new forecast must consume the declared committed prefix.

### 5. Evaluate the actual task and declare readiness honestly

Freeze each forecast before its first eligible target rating. Train later
forecasts from that rating only after measurement. Lock chronological
training/selection/final-evaluation windows, rating scale and target population.
Report own-scale error and distribution calibration where supported, per-Profile
and per-domain coverage, sparse/constant/strict/generous-rater slices, and macro
aggregation so heavy raters do not dominate. Report model selection uncertainty
and user/session dependence; many pairs or tags are not independent subjects.

Recommendation benefit requires subsequent real experiences and a declared
comparison. Offline prediction accuracy, deterministic parity and prospective
policy improvement are different evidence. Missing follow-up is not a bad rating.
Select numerical acceptance thresholds and stopping rules using development
evidence before inspecting the held-out owner/production test; do not tune them
until the test appears to pass. Repeated readiness checks use a justified
sequential method or predeclared checkpoints, with assumptions and scope stated.

Readiness is per task/domain and can weaken after contradiction, correction,
withdrawal or drift. It is not a universal percentage of how well Kajo knows a
person. Taste may stop with insufficient evidence and continue learning in
Discovery without resetting the Profile. BOOK → MOVIE remains the guided order.

## Consequences and acceptance

- Current scalar reward constants and serving scores are retained implementation
  facts until a versioned successor is admitted; they are not personal expected
  ratings or calibrated probabilities.
- Preserve the independent core, 51-part design, E1/D1/D2 work and all original
  prediction/evidence/source lifecycles. No account reset or historical rewrite
  follows from this decision.
- Required fixtures include the 7.6-versus-8 example; strict/generous and sparse/
  constant raters; positive affine scale invariance under otherwise equivalent
  modeled inputs; numeric-prefix changes; list multiplicity; ambiguous skip;
  correction/withdrawal; frozen forecasts; and Personal/Shared isolation.
- Predictive acceptance additionally requires declared baselines/ablations,
  coverage/uncertainty and real held-out outcomes. Synthetic fixtures establish
  contracts, not learned quality.
- ROADMAP owns substantial sprint order and STATUS owns the single next task.
  The owner-ordered sequence is current work closure → verified branch cleanup
  → Engine V1 → UX/acquisition and other existing flows → UI → release. Necessary
  evidence/measurement UI and correctness repairs may accompany engine work;
  broad visual or acquisition expansion waits for the Engine V1 gate.

## Alternatives considered

- **Maximize a ten or a fixed high-rating threshold:** rejected as the primary
  objective; ignores the accepted expectation objective and varying scale usage.
- **Normalize each person to a forced 0–10 range:** rejected; sparse/constant
  histories and unobserved extrema do not support those anchors.
- **Treat every positive action as satisfaction:** rejected; List interest and
  post-experience rating are different targets.
- **Build the complete neural/dreaming architecture before testing usefulness:**
  rejected; V1 must earn complexity through supported improvements.
