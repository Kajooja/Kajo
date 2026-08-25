# Kajo

Kajo is a mobile-first personal and shared discovery platform. It learns a person as a whole instead of building isolated book, movie or music taste silos.

Kajo starts with **books and movies**. Its domain and prediction architecture are intentionally generic so it can later expand to music, series, hyperlocal events, concerts, travel, restaurants and other experiences.

The repository—not a ChatGPT conversation—is the permanent project memory.

## Start here

AI agents and contributors **must read [`AGENTS.md`](AGENTS.md) before doing any work**.

Documentation map: [`docs/README.md`](docs/README.md)

Current project state: [`docs/project/STATUS.md`](docs/project/STATUS.md)

Current MVP scope: [`docs/product/MVP.md`](docs/product/MVP.md)

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
