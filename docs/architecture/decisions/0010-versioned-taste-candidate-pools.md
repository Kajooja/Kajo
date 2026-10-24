# ADR-0010 — Versioned Taste candidate pools

Date: 2026-10-24
Status: Accepted design; implementation and deployment acceptance tracked in STATUS.

## Context

The canonical V3 selector consumes current committed forecasts, but native Taste
sessions retain only the 25 BOOK and 25 MOVIE candidates frozen at START. A later
answer can change their ordering without admitting a new candidate. Mutating
that retained catalog would change old question, retry and evaluation semantics.

## Decision

New sessions use `CANONICAL_FORECAST_POOL_V4`. Retained sessions keep
their original policy, START catalog, first labels and frozen panels. The public
v2 command/receipt protocol and separate committed ANSWER → NEXT boundary remain.

Each fresh NEXT acquires a current bounded recognition catalog, excludes asked,
previously labelled and currently suppressed Items before retaining at most 25
candidates per domain, and captures one canonical evaluation panel of at most 50
Items. The existing V3 selector ranks within that refreshed panel. This is
recognition-bounded acquisition, not personalized retrieval over the whole catalog
or a new scoring-weight policy. No cross-panel score comparison is introduced.

Store the acquired catalog and its server cutoff in a private pool record bound
to the exact session and evaluation panel. Question presentation, answer metadata,
source validation and neutral-skip validation resolve that question's original
pool. Exact retries retain their original reply and never refresh a pool merely
because a response was lost. Fresh NEXT can acquire new candidates even when the
original START catalog was empty.

Pools are immutable except for source-lifecycle redaction. Panel invalidation,
session removal and source erasure clear dependent copied candidates; parent
deletion cascades. Denied private storage/helpers cannot become a public candidate
selection API. Existing ownership, revision, transaction and erasure barriers remain.

A stale unanswered pool rejects a new answer rather than acknowledging an
unrecorded rating. The mobile client treats the explicit source-withdrawn error
as a confirmed rejection requiring reload, while ambiguous transport failures
retain the exact pending command. RESUME/existing-session START can then expose
a stopped catalog-changed snapshot, preserving the original question and panel
and leaving Discovery and removal available instead of an endless retry loop.

## Consequences

Later questions can include Items outside the START catalog while old predictions
remain auditable. New pool membership still has bounded recognition-source bias;
full retrieval quality, recent priors, readiness and measured usefulness remain
separate requirements. Source validation does not authorize a hosted installation,
convert retained sessions, reset accounts or establish phone acceptance.

Tests must cover populated old policies, new candidates after START, answer/skip
flows, empty START recovery, immutable prior panels, retry after catalog change,
authorization, source erasure and genuine PostgreSQL transaction boundaries.

## Alternatives considered

- Mutating session.catalog: rejected because it changes historical validation.
- Rescoring old panels: rejected because the answer would contaminate its forecast.
- Comparing separately normalized acquisition chunks: unnecessary for this bounded
  successor and would add unsupported score-comparability assumptions.
- Client-side acquisition/scoring: rejected; recommendation truth stays server-owned.
