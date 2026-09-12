# Sprint 014 — E1 executable engine checkpoint

Date: **2026-09-12**. Issue [#235](https://github.com/Kajooja/Kajo/issues/235).
Source branch: `feat/235-portable-engine-contracts` from accepted main
`d4d014dc59761df98072fd15395552ab50135247` (#234). STATUS owns continuation.

After the owner reported the exercised #229 device flows working, with reconnect
retry UI retained as #240, source work moved explicitly to independent E1.
The owner-requested pre-MVP UI requirements are preserved in MVP/UX_PRINCIPLES
and issues #230/#231/#239/#240. This branch incorporates those documentation
changes deliberately; it does not incorporate or accept #229 runtime code.

## Delivered source

`packages/prediction-engine` is a real ESM workspace with declaration exports,
root lint/typecheck/test integration and a standalone `npm run engine:demo`.
Contracts separate Subject from acting identity; access scope from observed,
external and synthetic sources; raw scale and missingness from numeric zero;
state hypotheses from action alternatives, outcome branches and challengers.

The bounded reference cycle represents an available prefix, retrieves authorized
compatible frozen prefixes with already-known continuation, creates immutable
numeric forecasts, chooses under hard constraints, compares an eligible observed
result to the original value, and returns a rebuildable local Scenario. The
Kajo snapshot adapter and invented machine-energy adapter execute the same core.
Both demo datasets are explicitly synthetic; neither is native product evidence.
The algorithm is documented in the package README and does not copy or replace
Kajo SQL serving. No neural model, production memory service or public dataset
pipeline is claimed.

## Validation

`EXPO_OFFLINE=1 CI=1 npm run check` passed **310 tests**: 212 mobile, 14 catalog,
61 isolated database and 23 engine tests, plus lint/TypeScript, built ESM export
and core-import checks, and iOS/Android Hermes exports. This is accepted-main
runtime plus E1; #229 has a different, newer native test suite (439 at its tested
client SHA). `npm run engine:demo` separately ran the built package successfully.

Engine cases cover time/availability, artifact and representation scope, private
and Shared separation, source admission, unknown/zero labels, constraints,
immutable original forecasts, unobserved alternatives, horizon/exposure eligibility,
no-match/budgets, replay deduplication and latest available corrections. The
correction regression first returned obsolete 9 rather than corrected 2; resolving
available source revisions before selecting memories makes it pass.

The lockfile adds only the workspace link and explicitly declared existing
compiler/linter/test dependencies; no existing dependency version was changed.
The engine has no runtime dependencies. Mobile, SQL, existing scripts and CI
workflow bytes are unchanged from accepted main. No hosted query/migration,
model deployment, account reset, APK dispatch or build polling ran in E1.
Published-head CI and source acceptance must be recorded separately before
closing MVP-ENG-001. No device or broader DATA/ALG/ENG gate is closed by this check.

## Exact continuation

Finish the E1 PR's five required CI jobs/source acceptance, then D1 #236.
D1 freezes the exact MovieLens source/rights/checksum/resource manifest, implements
validation, quarantine, namespaced IDs, raw values/scales, availability assumptions
and idempotent deterministic normalization, then records the actual bounded real
cohort in ignored research storage. D2 #237 follows with temporal/cold-start
train-only baselines and the fixed static-state/ordered-prefix experiment.
A losing challenger is valid. Existing SQL serving and #229's native acceptance
remain independent; do not start UI #239/#240 or download data as an implicit E1
side task. No requirement to repeat the owner's device tests or build an APK is
introduced by this standalone source packet.
