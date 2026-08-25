# ADR-0003: Generic Item and cross-domain learning

Status: Accepted
Date: 2026-08-25

## Context

Kajo starts with books and movies but should later recommend other experiences without rebuilding the core prediction system.

## Decision

Use a generic `Item` core model and generic behavioural events. HumanState and prediction learning must be capable of using signals across item domains.

## Consequences

- No separate core BookProfile/MovieProfile models.
- External source schemas must be normalized into Kajo Items.
- Domain-specific metadata is allowed, but prediction identity remains generic.
