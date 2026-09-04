# Kajo Current Status

Last updated: **2026-09-04**  
Current milestone: **MVP 0.1**  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory** (`sprints/SPRINT-013.md`)

This is the authoritative current-state document. Sprint files preserve execution evidence; `ROADMAP.md` owns future sequencing. Avoid duplicating historical narrative here.

## Current product state

Kajo is a phone-runnable Expo/React Native application with:

- one fixed illustrated 2D Room as the authenticated home/backdrop,
- global `DiscoveryMode` control and phase-aware Room atmosphere,
- BOOK/MOVIE discovery, detail and swipe-style browsing,
- hosted Profile-targeted Prediction V1 with complete run/candidate trace,
- Working/Short/Long state plus same-Profile ScenarioMemory,
- versioned reacted-Item suppression plus bounded saved-only reminders,
- controlled SleepLayer/EvolutionEngine with immutable genomes, frozen shadows, mature evaluation, manual Profile canary and rollback,
- PersonalProfile and consent-based 2-N SharedProfiles,
- Shared Endorsement -> unanimous consensus delivery,
- Profile-scoped system/custom Lists and messaging,
- combined invitation/message Inbox,
- accepted bottom Profile identity quick switcher for recent/used SharedProfiles,
- email + nickname identity and email-or-nickname login.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets the Profile; recommendable things remain `Item`s. Do not create media/provider-specific duplicate user, List, Event, Profile or predictor architectures.

## Acceptance truth

### Accepted

- Sprints 001–010.
- Sprint 011/#151 Shared discovery + Endorsement consensus.
- persistent Room/backdrop/navigation direction and current minimalist straight-on Room contract.
- Sprint 013A Prediction nervous-system evidence spine + ScenarioMemory V1.
- Sprint 013B hosted + configured-Android Personal/Shared Prediction V1 trace gate.
- Sprint 013C controlled SleepLayer serving/evaluation/manual-canary/rollback gate.
- #174 reacted-Item resurfacing policy (`resurfacing-v1`).
- **#175 / `MVP-NAV-004` bottom SharedProfile quick switcher**: merged main APK passed configured-Android switching and `Näytä lisää` acceptance; issue closed completed.

### Implemented/hosted but configured-device acceptance deferred

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171/current Room-lighting/target/profile-hydration follow-up needs refreshed Android review.

CI or hosted verification does not substitute for those explicit device checks.

## Active polish — shell + bootstrap loading

The current narrow UI follow-up keeps the existing shell dimensions and architecture while polishing presentation:

- bottom Profile identity uses a softer, larger, heavier rounded system face without increasing dock height,
- Inbox envelope is a slightly larger rounded cross-platform glyph inside the existing dock footprint,
- top Kajo mark is aligned slightly lower with the DiscoveryMode curtain,
- the artificial fixed two-second startup splash is removed,
- the Kajo logo surface becomes the real bootstrap-loading surface and shows the current white loading message underneath for session, PersonalProfile and interaction hydration,
- auth confirmation/recovery callback routes remain outside the bootstrap loading gate so callback processing cannot be blocked.

No backend, Profile state, recommendation or navigation architecture is changed by this polish.

## Prediction / evolution state

The canonical Prediction path remains:

```text
Events
  -> Working / Short / Long state
  -> Prediction V1 + same-Profile ScenarioMemory
  -> resurfacing-v1 eligibility/slate policy
  -> immutable PredictionRun + complete Candidate pool
  -> prospective frozen Challenger shadows
  -> mature exposed-outcome EvaluationWindow / GenomeEvaluation
  -> evidence-gated manual Profile canary
  -> reversible rollback
```

Automatic production genome promotion remains **disabled in MVP 0.1**. Full autonomous genetic optimization, global auto-promotion, cohort production assignment and learned/LLM Challenger families remain post-MVP evidence work.

## Real catalog — #182

The current discovery catalog is still a tiny seeded `KAJO_MOCK` set. Issue #182 owns replacing it with real provider-backed data while keeping `public.items` as the only canonical recommendable Item table.

Direction:

- **MOVIE:** TMDB server-side provider adapter/import; developer use requires attribution and commercial use requires a commercial licensing decision.
- **BOOK:** Open Library monthly bulk data is the preferred low-cost initial import path; do not use the public Open Library API as Kajo's high-traffic backend. Keep the provider boundary replaceable for a paid commercial provider such as ISBNdb after current terms are accepted.
- provider credentials remain server-side,
- add generic provider provenance/dedup/lifecycle rather than media-specific stores,
- normalize provider genres/subjects into Kajo `tags`,
- existing mock Items must not be deleted because historical Events, Lists and Prediction traces may reference them; make them non-discoverable after real catalog acceptance,
- start with a curated catalog of hundreds/thousands rather than ingesting millions of records immediately,
- Prediction V1/SleepLayer continue ranking generic Items unchanged.

Establishing a useful real catalog should precede judging recommendation quality at larger scale.

## Remaining MVP Prediction work — #177 / `MVP-PRED-005`

SharedProfile common-fit remains open. Implement an inspectable Shared-only common-fit component using Shared joint evidence plus authorized accepted-member PersonalProfile fit, minimum-member/consensus behavior and disagreement penalty. The Prediction target stays the SharedProfile; Personal Events/Scenarios are not copied into Shared history and no second Shared recommender is allowed.

## Other open MVP work

- #160 — production Supabase security hardening / release security.
- #127 — production auth email delivery/SMTP/domain and confirmation/recovery acceptance.
- #102 — refreshed configured-Android List acceptance.
- #138 — configured-Android messaging acceptance.
- PR #171/current Room follow-up — refreshed Room lighting/targets/profile-hydration acceptance.
- `MVP-MEM-004` — confirm/document future memory-extension point before final MVP gate.
- #78 — optional logo polish only if it does not delay functional MVP.
- #73 — Google/Apple sign-in remains future unless explicitly promoted into MVP.

## Next MVP sequence

1. **Finish current shell/bootstrap polish** — CI, merge and configured Android visual/loading acceptance.
2. **#182 real BOOK/MOVIE catalog foundation + initial provider imports** through generic `Item` architecture.
3. **#177 SharedProfile common-fit / MVP-PRED-005** through canonical Prediction V1, evaluated against the materially larger real catalog.
4. **Deferred configured-device acceptance** for #102/#138/current Room follow-up without reopening accepted architecture.
5. **Sprint 014** — production hardening, privacy/support/operations, auth delivery, provider licensing/attribution gates, signing/versioning, store assets, clean install/update acceptance and official store release; also close remaining explicit MVP requirements such as `MVP-MEM-004`.
6. **MVP COMPLETE gate** — all accepted requirements/code on `main`, hosted state matches migrations, end-to-end Personal/Shared/Prediction flows pass, security/rollback/monitoring are ready, official store availability exists and the product owner accepts the installed release.

## Repository hygiene / non-duplication rules

- Follow `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md` before starting new work.
- One canonical implementation per capability; extend generic Profile/Item/Event/Prediction architecture.
- Provider integrations normalize into generic Items; never create separate mobile catalogs/recommenders per provider.
- Deployed migrations are immutable; corrections use ordered forward migrations.
- `STATUS.md` = current truth, sprint docs = execution/history, `ROADMAP.md` = ordered future work.
- Do not merge speculative empty feature folders, duplicate documentation or unused abstraction layers.
- #160 security work stays separate from product/Prediction/catalog follow-ups.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/HANDOFF_PROTOCOL.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/app/_layout.tsx`
- `/apps/mobile/src/features/auth/BootstrapLoadingGate.tsx`
- `/apps/mobile/src/features/auth/AuthGate.tsx`
- `/apps/mobile/src/features/branding/KajoBrand.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/profiles/BottomProfileControl.tsx`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/supabase/migrations/20260827073000_seed_mvp_items.sql`
- `/supabase/migrations/20260831163000_expand_mvp_candidate_catalog.sql`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target after this polish is accepted: **#182 real catalog**, then **#177 Shared common-fit**. Do not rebuild Prediction V1/SleepLayer, enable automatic promotion, create a second Profile/group state, delete historical mock Items, or fold #160 into these scopes.
