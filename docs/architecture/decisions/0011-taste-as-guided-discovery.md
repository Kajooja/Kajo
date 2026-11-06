# ADR-0011 — Taste as guided Discovery with measured readiness

Date: 2026-10-25; domain-order correction: 2026-11-05
Status: Accepted product direction from owner feedback; implementation and quality acceptance remain open.
Tracking: #336; refines ADR-0007/0008/0010 without rewriting retained sessions.

## Context

The owner reports that Taste still feels disconnected from Discovery. A shared
card is insufficient: each rating must update the same predictive state and the
next recommendation. The requested flow is MOVIE first, then BOOK, with a visible
readiness measure and automatic completion when supported accuracy is sufficient.
The film-A rating-4 example illustrates conditional preference learning; it is
not a hardcoded title, score, first-domain choice or rule that every next result
must differ. The explicit MOVIE → BOOK order takes precedence over that example.

The original V4 source shares canonical scoring and PersonalProfile evidence but
acquires a recognition-bounded pool, then applies a separate Taste utility and
maximum-two-opportunity domain lead. Its native readiness is always INSUFFICIENT.
Its selection/readiness gap remains distinct from the bounded progression
correction below. Provider popularity and aggregate votes do not supply the joint
histories needed for “people who disliked A liked B”.

## Decision

### One prediction and learning loop

Taste is guided use of the same Discovery recommendation service, Item universe,
state composition, eligibility, model versions and evidence lifecycle. There is
one PersonalProfile across domains and surfaces. A TasteSession owns onboarding
progress, frozen evaluation and exact commands; it is not another taste model.

Under equal Profile/prefix/domain/mode/source/cutoff and declared eligibility,
Taste and Discovery must use the same candidate acquisition and scoring result.
First-question recognition and domain progression are explicit, versioned policy
constraints. Subsequent questions prioritize the shared supported satisfaction
objective; a private 35/45/10/10 Taste utility must not silently replace it.
Any exploration policy must be shared, declared and evaluated, not a fixed test
slate or an unreported reason to ignore the latest rating.

The server freezes a forecast before accepting its target answer, commits that
answer once, updates the common state, and selects the next fresh question from
that committed prefix. Preserve the current freshness reads until an equivalent
transaction-boundary proof permits a change. Discovery's already prepared cards
retain their origins; “same engine” does not authorize relabelling stale buffered
forecasts as predictions made after the latest answer.

### Supported opener and conditional recall

With no personal support, select a recognizable, well-supported, well-rated Item
in the active domain using available recent popularity/consumption signals and
a declared quality/support policy. Use the complete eligible catalogue through
bounded retrieval, rather than a permanently frozen popular test shortlist.
Source, timestamp, sample count and missing fields must be explicit. A vote count
is not a watched/read count; a static popularity value is not a current trend.
Missing book ratings or current trend data cannot become invented values.

After a low rating for A, retrieve eligible comparable prefixes and their observed
continuations, then rank B using the same engine as Discovery. Conditioning must
include the actual numeric rating and broader available state, with shrinkage and
bounded influence so one answer does not define the whole person. The A=4 versus
A=9 counterfactual fixture must demonstrate an appropriate change when supported
evidence distinguishes the outcomes. A shared dislike alone is not proof of a
shared preference for B.

Use authorized local scenarios, separately admitted privacy-protected native
cohorts, or a rights-cleared external preference model under their existing
contracts. External ratings remain preference evidence, not fabricated native
users or complete Scenarios. No usable neighbor means an explicit supported
fallback, not a claim that a cohort match occurred. Reuse EB-04/06 and the existing
research pipeline; do not build a second Taste-only neighbor engine.

### Ordered domains, shared state

New guided progression is MOVIE → BOOK. The November 5 owner correction
supersedes the earlier reverse order. Stay in MOVIE until its declared readiness
criterion is met, then show a compact transition and continue BOOK with the same
Profile and all accepted evidence. Do not interleave domains or use fixed 10+10
completion. Book evidence can inform movie predictions and vice versa, but
transfer strength must be supported and evaluated; success in one domain cannot
automatically certify accuracy in the other.

Poor recognition, exhausted eligible covers/catalogue, user fatigue or safety
limits must offer an explicit pause/continuation with that domain still
insufficient. The user may continue to the other domain or ordinary Discovery;
that exit is not a passed test. Never require an endless test or account reset.

### Bounded native correction — 2026-11-05 / #428

Fresh V4 NEXT selections use a separately versioned `movie-first-v1` progression:
MOVIE until its 24-opportunity safety limit or unsupported eligible selection,
then BOOK for the remainder of the existing 48-opportunity session limit. Once a
new-version BOOK question is committed, the session never returns to MOVIE.
These are maximum opportunities, including skips/withdrawn exposures, not fixed
completion quotas or readiness thresholds. The user can leave for Discovery at
any time; readiness remains explicitly insufficient. Within the chosen domain,
the existing canonical-ordinal selector and full frozen candidate panel remain.
This fixes ordering without claiming the shared expected-rating selection or
calibrated stopping contract is complete.

An existing mixed V4 session retains all prior questions and answers. Its next
fresh question adopts the versioned progression; old unversioned BOOK exposures
do not falsely mark the new BOOK phase as started, but still consume the total
budget. Pending questions, frozen measurements, old cached replies and V1–V3
policies are unchanged. No account reset is needed. Complete reply persistence
must accommodate all 1,128 possible ordinal pairs under the session bound; the
512 KiB response cap replaces the insufficient 32 KiB cap without truncation.

### A meaningful meter and stopping rule

Expose two different concepts: predicted fit for the current Item, and readiness
of predictions in the active domain. A rank score, answer count or filled progress
bar is neither probability nor accuracy.

The readiness contract must declare its target outcome, evaluation metric,
forecast coverage, distinct independent support, uncertainty method, calibration
scope and versioned stopping threshold. Numeric rating-error accuracy requires
a validated rating predictor; a calibrated like probability requires a defined
like threshold and out-of-sample probability calibration. The existing ordinal
pair diagnostic must remain labelled as ordinal agreement and cannot be renamed
to either metric. Choose and freeze the numerical criterion from validation
before measuring the owner test, not after seeing favorable answers.

Evaluate only first labels against predictions frozen before those labels became
available. Many pairs sharing a few Items are not independent observations.
Require sufficient varied support and an uncertainty bound, not a few lucky hits,
stable tied scores, or trivial predictions of only one outcome class. Show the
actual evidence and “not enough evidence” while the criterion is unmet or the
target is uncalibrated. With admitted support, display the measured accuracy and
uncertainty honestly; do not promise an arbitrary 90% confidence.

Advance the domain when its versioned criterion passes; finish guided Taste when
the required domains pass. Continue learning in Discovery without resetting state.
Readiness can weaken after new contradictions, corrections, withdrawal or drift;
past completed onboarding does not force the user through it again automatically.

### Real covers and retained history

Resolve the canonical Work/Edition and licensed cover before presenting a new
guided card. Nonempty URL alone is not proof of a working, correct cover. Keep
missing/failed/mismatched images observable and provide bounded fallback/retry.
Prefer another eligible covered Item before committing a new question when the
cover is known unavailable. A later image failure must not silently change an
already committed question or fabricate a skip/rating.

Repair canonical presentation metadata once for both surfaces. Do not generate
replacement book covers, match solely by title, merge editions/Items casually or
delete rating history to hide missing art. Preserve legacy policies, frozen panels,
first measurements and pending replies. A versioned transition to the new policy
must retain current accounts and accepted evidence; no automatic historical
rewrite or blanket account reset is authorized by this design.

## Acceptance and next implementation boundary

1. Reproducible catalogue/cover and shared-retrieval audit; cover repair binds exact
   source identity and changes no preference/model/evidence data.
2. One shared serving path with a versioned MOVIE → BOOK progression, proven by
   same-input parity, low/high first-answer and cross-domain transfer fixtures.
3. Admitted outcome/readiness contract, prequential evaluation and calibrated
   meter with pass, insufficient, contradiction, correction and withdrawal tests.
4. Supported conditional-recall baseline versus no-recall and popularity controls;
   source permissions, cohort minimums and temporal leakage checks precede use.
5. Hosted preservation and phone verification of the complete loop, including
   same-state continuation in Discovery. A UI screenshot or successful CI is not
   evidence that prediction quality or calibration has passed.

ROADMAP orders these dependencies. Native readiness and the data/model foundation
are substantive open work; #428 implements only the bounded correction above.
Source, hosted and phone acceptance are recorded separately in STATUS/the PR.
