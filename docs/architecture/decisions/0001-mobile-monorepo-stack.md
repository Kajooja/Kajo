# ADR-0001: Mobile-first monorepo stack

Status: Accepted
Date: 2026-08-25

## Context

Kajo is a mobile-first product expected to contain a mobile client, database/backend artifacts and later a prediction service. AI agents should be able to inspect the complete product in one repository.

## Decision

Use one monorepo. Build the mobile client with React Native + Expo + TypeScript. Add backend/prediction areas to the same repository as they become necessary.

## Consequences

- One source of truth for agents and humans.
- iOS and Android share the mobile codebase.
- Cross-layer contracts can be reviewed together.
- Repository complexity must still be kept low; do not create unused workspace packages.

## Alternatives considered

Separate repositories and fully native iOS/Android were rejected for the MVP because they add coordination and duplicated implementation cost without product benefit.
