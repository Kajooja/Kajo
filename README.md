# Kajo

Kajo is a mobile-first personal and shared discovery platform. It learns a person as a whole instead of building isolated book, movie or music taste silos.

Kajo starts with **books and movies**. Its domain and prediction architecture are intentionally generic so it can later expand to music, series, hyperlocal events, concerts, travel, restaurants and other experiences.

The repository—not a ChatGPT conversation—is the permanent project memory.

## Start here

AI agents and contributors **must read [`AGENTS.md`](AGENTS.md) before doing any work**.

Documentation map: [`docs/README.md`](docs/README.md)

Current project state: [`docs/project/STATUS.md`](docs/project/STATUS.md)

Current MVP scope: [`docs/product/MVP.md`](docs/product/MVP.md)

The first public release includes the Taste-first link → anonymous learning → account conversion → Friend → explicit SharedProfile loop. Its runtime and release acceptance remain open; see [`STATUS.md`](docs/project/STATUS.md).

## Development quick start

Prerequisites:

- Node.js 22 or newer.
- npm 10 or newer.

From the repository root:

```bash
npm ci
npm run start
```

Useful commands:

```bash
npm run ios       # Expo iOS development launch
npm run android   # Expo Android development launch
npm run check     # lint + typecheck + tests + iOS/Android bundle smoke checks
```

The mobile application lives under `apps/mobile/` and uses React Native, Expo and TypeScript.

For a new local database, use `npm run database:install -- /absolute/new/workspace`.
The [installation procedure](docs/architecture/decisions/0006-clean-install-database-baseline.md#adopted-installation-procedure)
uses the verified source baseline plus unchanged forward migrations on pinned
local Supabase. Existing hosted databases follow the separate forward-deployment
procedure. The original historical replay remains a failing diagnostic.
