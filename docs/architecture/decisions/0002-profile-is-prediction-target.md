# ADR-0002: Profile is the prediction target

Status: Accepted
Date: 2026-08-25

## Context

Kajo must support both one-person discovery and persistent 2-N person shared Kajos that learn their own joint preferences.

## Decision

Predictions target `Profile`, not directly `User`. A Profile is Personal or Shared. Events retain `actorUserId` separately from `profileId`.

## Consequences

- SharedProfile can develop emergent joint preferences.
- The same user can behave differently in personal and shared contexts without corrupting either model.
- Every prediction API/data model must carry profile identity.
