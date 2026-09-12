# Kajo Current Status

Last updated: **2026-09-12**  
Current milestone: **MVP 0.1 — first public Kajo**  
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable-engine foundation**  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns the exact resumable handoff. [ROADMAP](ROADMAP.md) owns dependency order; [MVP](../product/MVP.md) owns release blockers; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md) owns the Taste-first acquisition flow. Historical sprint/CI details remain in the relevant PRs and [Sprint 014](sprints/SPRINT-014.md).

## Documentation direction — 2026-09-12 / #233

The owner supplied the 51-part Predictive Memory Engine and requested review, independent-engine architecture, public movie-taste enrichment and aligned repository documentation **before implementation**.

The documentation branch is `docs/233-predictive-memory-engine`, based on accepted main `6dd1fecaca6a081d633bf640aab12b35dcf2cb8f`. Its architecture and integration changes require acceptance through its own PR; they do not merge or accept the active code PR below.

Canonical new documents:

- [Predictive Memory Engine](../architecture/PREDICTIVE_MEMORY_ENGINE.md): all 51 conceptual sections, with explicit review amendments and staged implementation.
- [Data enrichment](../architecture/DATA_ENRICHMENT.md): isolated MovieLens baseline, optional Tag Genome/Beliefs packets, data limits, permissions, manifests and reproducible evaluation.
- [ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md): independent generic core + Kajo adapter; external research prior is not native PopulationMemory.

Only documentation is delivered by #233. **No engine package, dataset download/import, trained embedding/model, new runtime endpoint or deployment is delivered.** No new feature is marked accepted merely because its design exists. The source architecture's WorldModel, DreamEngine and self-evolving geometry remain intact as staged targets.

## Accepted main and active source are different

Accepted implementation main at inspection: `6dd1fec` — PR #227 / Issue #226, atomic/durable Lists and Shared actions. Its merge records all five final CI #409 gates passed. The earlier main handoff to finish #227 is therefore historical, not the next task.

Active implementation: **Issue #228 / draft PR #229**, branch **`feat/228-delivered-origin`**, inspected head **`44b11b437286653eae427bad10493a9380b92668`**. Preserve this branch and its source/test evidence. Do not copy its unfinished implementation into accepted-main descriptions or reset its data.

This handoff incorporates the active branch's recorded 2026-09-11 checkpoint; it is not a fresh verification of hosted state or native CI. Reinspect current refs/checks before continuing. Keep source changes, CI acceptance, hosted rollout and device acceptance separate.

## Next bounded implementation unit — retain #229 checkpoint

1. Inspect required CI for the corrected #229 head. The recorded preceding run `34575684407` on `91d07ee` had four passed required jobs; the native CLI/race job failed while parsing a bare PostgreSQL boolean as JSON. The latest source wraps the lock-observation EXISTS result in `to_jsonb`. Corrected-head native acceptance remains **unverified in this documentation task**.
2. Then implement atomic next-page delivery from the private frozen continuation source: exact actor/Profile/session/domain/mode/request/cursor scope, current eligibility, no repeated seen Items, an independent immutable page PredictionRun/ranks, retry receipt and page-aware frozen/shadow replay.
3. Keep the continuation capability disabled and the prepared client inactive until the complete boundary passes. Hosted rollout and captured-scope client/device validation remain separately reviewed steps.

The active branch records a full local `EXPO_OFFLINE=1 CI=1 npm run check` pass with **377 tests**, lint/TypeScript and both exports for its checkpoint. This is recorded source evidence, not a new test run performed for #233 and not proof of pending native/deployment/device gates.

Do not reopen already accepted foundation work or start an unrelated broad scorer rewrite to reconstruct chat context. The engine work packets below have explicit boundaries and can be prepared independently without erasing this handoff.

## Pending source and hosted boundaries

As recorded by the active #229 checkpoint, hosted remains on **`20260910190243_shared_list_destinations`**. Five following forwards remain **undeployed**, in dependency order:

```text
late Outcome attribution
→ frozen prediction replay
→ eligibility-first candidate admission
→ identified first-page response
→ private prediction continuation windows
```

The last four named sources are `20260910202244_frozen_prediction_replay.sql`, `20260910210520_eligibility_first_candidate_pool.sql`, `20260911070959_identified_prediction_page.sql` and `20260911074543_prediction_continuation_windows.sql`. Use the branch's exact migration history for the first source; do not invent filenames or apply anything from this summary.

The private window cache is source preparation only: up to 50 candidates/seen IDs, 2 MiB, fifteen minutes from source ranking and sixteen windows per actor/Profile. It does not deliver another page. Scope, historical-source, native race/cap and populated-upgrade acceptance must be checked against current code/CI. Derived-cache cleanup must preserve request/run/Event history.

A valid identified empty prediction, genuine source exhaustion and transport/authorization errors are different states. Existing candidate-source fixes do not prove independently generated pools or catalog-scale retrieval. `MVP-ALG-002..003` and Phase 14.1 recovery/provenance gates stay open.

The separately deferred `20260909131913_close_postgres_function_defaults.sql` privilege-default forward is not made deployed or accepted by this documentation update. Follow its existing review/rollout evidence before any hosted change.

## Owner device feedback and data preservation

The owner reports exercised tests appear to work, but did not provide an installed APK SHA/run or measured timings. A completely empty/fresh-account flow was **not tested** because more accounts could not be created; do not diagnose why without evidence. A future small-group reset/test is deferred, not authorized now.

Keep the deferred Personal two-List/add-latency and process-death/reconnect cases in [Sprint 014](sprints/SPRINT-014.md) and its linked device handoff. Planned List/consumed-history long-press selection/trash remains Phase 17 / #231, not part of this engine documentation packet.

**No account/data reset, hosted mutation, APK dispatch/poll or implementation-PR merge is authorized or performed by #233.**

## New engine/data work packets

After the documentation is accepted, [ROADMAP Phase 14.3A](ROADMAP.md#143a--portable-contracts-and-external-data-research) introduces:

```text
E1: generic contracts + Kajo mapping + deterministic media/non-media fixtures
→ D1: isolated dataset manifest + MovieLens adapter + small repeatable cohort
→ D2: train-only baselines + chronological/cold-start evaluation + honest report
```

E1/D1/D2 are independent research/source work and may proceed on an explicitly named separate packet/branch without deploying or overwriting #229. Record which packet is active before writing; do not silently mix the two branches. Native serving integration E2 depends on the relevant Phase 14.1/14.2 gates, artifact admission and rollback evidence.

D3 (named Tag Genome enrichment) and D4 (Beliefs release-2 study) follow only when justified; they are not required to complete the first baseline. No learned prior is required to win. A losing or rights-blocked artifact stays out of serving, with a recorded decision and a working transparent baseline.

The next engine-specific unit is **E1**, not a full neural recommender, production-data import or general service migration. It must make subject/acting identity, observation provenance, missingness, time cutoff and synthetic separation executable, while leaving the current hosted scorer unchanged.

## Existing accepted foundation and remaining release sequence

Profile/actor separation, Personal/Shared boundaries, generic Items, append-only Events, server-owned traces, current ScenarioMemory, explicit shared common-fit, source-provenanced bootstrap and controlled scalar SleepLayer foundations remain valid.

Phase 14.0 technical bootstrap/fresh-install acceptance is retained through #207/#210 and #208/#223. The adopted installation strategy does not mean the unchanged historical migration chronology passes; preserve protected historical migration files and follow ADR-0006. Statistical usefulness, source-aware memory, full parity/refill, catalog features, operational evaluation and device gates remain separate.

Then follow the existing sequence: trustworthy algorithm/catalog → adaptive Taste with honest holdout → anonymous web/app and Google/Apple continuity → recommendation preview → Friend invite/safety → explicit SharedProfile creation → core UX/telemetry/privacy → closed beta → production/store acceptance → **Share Link Gate**.

Commercial monetization, Kajo-wide population retrieval, large multistep dreams, autonomous promotion and distant social/domain expansions are not silently pulled into the first release. The new direction is independent engine contracts plus early, well-bounded research, not abandonment of the working Kajo product.
