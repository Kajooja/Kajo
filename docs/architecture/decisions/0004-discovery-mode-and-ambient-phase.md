# ADR-0004: Separate DiscoveryMode from AmbientPhase

Status: Accepted
Date: 2026-08-25

## Context

The curtain visually moves Kajo from dawn to evening to night while algorithmically moving from safe recommendations toward greater exploration/risk.

## Decision

Keep the concepts separate:

- `DiscoveryMode`: `FOR_YOU`, `SURPRISE`, `RISK`.
- `AmbientPhase`: `DAWN`, `EVENING`, `NIGHT`.

Initial mapping:

```text
FOR_YOU  -> DAWN
SURPRISE -> EVENING
RISK     -> NIGHT
```

## Consequences

The UI metaphor remains strong without coupling prediction semantics to a specific visual theme. A dark personal theme does not imply risk-seeking behaviour.
