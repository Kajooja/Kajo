# Sprint 014 — D2 model/state development checkpoint

Date: **2026-09-12**. Issue [#237](https://github.com/Kajooja/Kajo/issues/237).
Branch: `feat/237-movielens-baselines`, based on accepted D1 main
`7602b3418354687855f6b3384085684f4b37a373` / merged PR #242. All five required
D1 CI #475 jobs passed at `816bf2e6c1437e29f664faef9669729507968209`.
This D2 branch needs its own current-head five-job CI and merge before acceptance.

## Delivered bounded experiment

- Actual built engine research export: train-only global/shrunken item means,
  positive bounded item-neighbor graph, compact explicit-rating factorization,
  durable/recent state, and static/ordered-prefix continuation retrieval.
- One standalone command with a separately inspectable pre-fit freeze and
  independent replay. Source/code/runtime and exact temporal/cold-subject
  partition hashes bind the run; selection is saved before final partition reads.
- Identical candidate/target scope, equal-time exclusion, frozen-batch and
  score-before-update prequential protocols, and controlled 0/5/10/20 held-out
  subject prefix budgets. Features, graph, factors and memory fit only on train.
- MAE/RMSE, error quantiles, paired subject-bootstrap intervals, item/subject
  support and cold/tail slices, component/no-match coverage and bounded costs.
- Tested absent/invalid/withdrawn/disallowed/out-of-domain fallback that retains
  only authorized native-prefix evidence, otherwise unavailable. The research
  dataset provides zero native support. Withdrawal/rebuild lineage is explicit.

[The readable report](../../../research/reports/movielens-small-d2.md) and
[aggregate JSON](../../../research/reports/movielens-small-d2.json) own full
measured evidence. The pre-fit manifest hash is
`1d5e642c9a5e83414fec404f725aa6b4cb53d941ad4263a8081b6dcebd3289f4`.
Two independent runs matched model parameters, every prediction journal, all
metrics/intervals and the decision/fallback, with deterministic result hash
`46e68b5310e6a3ff08793a85145b897992a43337b741ba93f360acb302ba49a8`.

Validation selected recent state but its 0.001959 RMSE improvement missed the
predeclared 0.01 gate: **reject challenger admission in this configuration**.
The separate prequential comparison supports recent rating-entry state within
this development task. It does not establish native product benefit; cold-start
gains are inconsistent and only thirteen reserved subjects have final targets.
Native serving admission is **deferred**, with no automatic promotion or rollout.

## Validation and scope

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **357 tests**: 212 mobile,
14 catalog, 61 database, 43 engine, 19 Python intake and eight research runner
cases. Lint/typecheck and both Hermes exports passed. The pre-existing mobile
Hook dependency warning remains. CI runs artificial fixtures only; the two real
fits are separate recorded operations, not inferred from source CI.

No added dependencies, hosted SQL/configuration/query/import, native UI edit,
APK dispatch or serving replacement. Source histories, subject partitions,
prediction journals and fitted artifacts remain ignored and unpublished.
The public aggregate report contains neither subject membership nor parameters.

Important paths: package `src/research.ts`, `test/research.test.ts`, separate
`./research` export; `scripts/research/evaluate-ratings.mjs` and its test;
`research/manifests/movielens-small-d2.json`; report files; root evaluation script.
Canonical STATUS/MVP/ROADMAP/DATA_ENRICHMENT/CODEMAP and package/research READMEs
record the changed truth. The complete target architecture remains a future
design beyond this bounded implementation.

## Exact continuation

Finish this D2 head's required CI/review and merge; close #237 as a reproducible
experiment with a valid negative admission result. On accepted main, continue
**#182 catalog Edge entrypoint/configuration verification** before provider data
expansion. This Phase14.3 source unit can proceed independently of #229's remaining
native/device/fresh-account gates. Inspect current provider/gateway semantics,
declare the catalog server-key/JWT boundary, pin Edge imports and verify rejected
anonymous/ordinary-user requests plus authorized requests. Hosted configuration,
credentials and actual provider import are distinct operations.

Keep #229's source/rollout evidence and immutable installed forwards intact.
#240 retry UI, #239 card controls, #230 statistics and #231 grid operations remain
ordered pre-MVP application work. Optional D3/D4/D5 studies, larger datasets and
an external model win are not prerequisites for continuing the release march.
Sprint014, native DATA/ALG/quality, device and Share Link acceptance remain open.
