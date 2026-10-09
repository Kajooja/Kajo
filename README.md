# Kajo

Kajo is a mobile-first personal and shared discovery platform. It learns a person as a whole instead of building isolated book, movie or music taste silos.

Kajo starts with **books and movies**. Its domain and prediction architecture are intentionally generic so it can later expand to music, series, hyperlocal events, concerts, travel, restaurants and other experiences.

Kajo is the first adapter for the independent [Predictive Memory Engine](docs/architecture/PREDICTIVE_MEMORY_ENGINE.md). The executable [E1 package](packages/prediction-engine/README.md) supplies generic contracts and deterministic media/non-media fixtures. The [D1 research intake](research/README.md) now has an independently reproduced 500-subject / 84,849-rating development cohort from a pinned GroupLens release. The [D2 report](research/reports/movielens-small-d2.md) now records actual train-only model/state comparisons, an independent replay and a rejected challenger. Source acceptance, model evaluation and runtime admission remain separate gates. [ROADMAP](docs/project/ROADMAP.md) orders native reliability, portable contracts, isolated MovieLens data and evaluation before any admitted serving change.

The repository—not a ChatGPT conversation—is the permanent project memory.

## Start here

AI agents and contributors **must read [`AGENTS.md`](AGENTS.md) before doing any work**.

Documentation map: [`docs/README.md`](docs/README.md)

Current project state: [`docs/project/STATUS.md`](docs/project/STATUS.md)

Current MVP scope: [`docs/product/MVP.md`](docs/product/MVP.md)

The first public release includes the Taste-first link → anonymous learning → account conversion → Friend → explicit SharedProfile loop. Its runtime and release acceptance remain open; see [`STATUS.md`](docs/project/STATUS.md).

## Development quick start

Prerequisites:

- Node.js 22.12+ (22 LTS) or Node.js 24+.
- npm 10 or newer.

From the repository root:

```bash
npm ci
npm run start
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the
configured app. Expo configuration defaults to production and rejects absent,
partial, privileged or malformed configuration before building. Production needs
a non-loopback HTTPS origin and a publishable key (legacy `anon` JWTs remain
supported); credentials are never echoed in failures.

For a deliberate local demo without a backend, use `KAJO_BUILD_MODE=demo npm run
start` or `KAJO_BUILD_MODE=demo npm run check`. The mode is embedded in the build;
an unconfigured production client cannot silently enter demo. The Android release
job explicitly requires production mode. Demo exports are not release acceptance.

Useful commands:

```bash
npm run ios       # Expo iOS development launch
npm run android   # Expo Android development launch
npm run check     # lint + typecheck + tests + iOS/Android bundle smoke checks
npm run test:edge # pinned Deno entrypoint checks + local HTTP fixtures
npm run engine:demo  # standalone synthetic media/non-media contract cycles
```

The mobile application lives under `apps/mobile/` and uses React Native, Expo and TypeScript.
Research intake/tests also require Python 3.12 (standard library only); see
[`research/README.md`](research/README.md) for the source verification and repeat commands.

`npm ci` also installs the pinned Deno 2.1.4 validation runtime. `test:edge` is part
of the root check and CI's existing `validate` job: it checks every Edge entrypoint
against `supabase/functions/deno.lock` and runs local HTTP tests with fixture
provider/Data API responses. The first check fetches integrity-locked dependencies;
test execution allows only loopback networking and needs no Supabase/TMDB secrets.
These checks do not deploy functions or verify the hosted gateway/configuration.

For a new local database, use `npm run database:install -- /absolute/new/workspace`.
The [installation procedure](docs/architecture/decisions/0006-clean-install-database-baseline.md#adopted-installation-procedure)
uses the verified source baseline plus unchanged forward migrations on pinned
local Supabase. Existing hosted databases follow the separate forward-deployment
procedure. The original historical replay remains a failing diagnostic.


### Reviewed dependency compatibility

`npm ci` applies the reviewed CommonJS/ESM decoder interop needed by Expo Router
57 / query-string 7.1.3. It verifies the exact parent source hash and decoder
version before changing one import; an unexpected dependency change fails the
installation. Do not skip install scripts for a runnable app. `npm run
test:dependencies` checks real Expo routing, malformed URL handling and the xcode
UUID call; `npm run audit:dependencies` checks current published advisories.

Root query-string/xcode dev pins make the parents used by these tests explicit
and keep security overrides effective across npm workspace-link resolution.
Vitest is coordinated at 4.1.11; Vite stays at the previously accepted 7.3.6.
[The September 28 audit record](docs/project/dependency-audit-2026-09-28.json)
retains that dated lockfile and its results; current dependency/source acceptance
is recorded in [STATUS](docs/project/STATUS.md). Review/remove the decoder interop when the routing parent
adopts a compatible patched decoder; its source hash intentionally rejects blind
upgrades. Do not use `npm audit fix --force` to downgrade Expo.
