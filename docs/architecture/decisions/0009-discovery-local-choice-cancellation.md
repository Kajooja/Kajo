# ADR-0009: Bounded local cancellation for Discovery choices

Status: Accepted design; successor device acceptance remains open
Date: 2026-10-24

## Context

APK #715 still feels slow when reversing a feed choice and when returning to
Löydä after a long session. The owner requests keeping the newest choice one
step behind server dispatch so C → B can cancel B before it commits. Existing
server Undo waits for ordered receipts and a fresh same-Item ranking; its cached
presentation alone cannot remove that wait.

## Decision

Persist every explicit feed choice before navigation. Reserve the newest
skip/rating in the existing scoped outbox before admission; release the previous
reservation only after the next choice is durably accepted. The outbox alone
arbitrates cancellation against dispatch. A provably never-dispatched exact
command may be removed atomically and its optimistic state recomputed. Sent,
recovered, ambiguous or changed commands cannot become locally cancellable.

The feed may restore only that cancelled choice's still-valid original delivery
in the same scope, preserving one-step Undo and eligible prepared successors.
Unknown/expired origins and server-committed choices use canonical reversal and
fresh delivery. The runtime-only hold expires after 30 seconds and releases on
exit/background/scope changes or before dependent List operations. Restart
replays the durable queue without reconstructing a hold. Pending or cancelled
intent is never confirmed learning or an invented server receipt.

Grid return may consume at most five unhandled prepared successors via a single
ephemeral owner-bound handoff with exact origins. It is not a cache of the old
full grid. Scope/bootstrap/failure checks, a 60-second handoff lifetime and the
conservative original-root age bound apply. The fresh six-Item ranking waits for
pending action queues to settle; source authority remains server-owned. Taste
continues acknowledged ANSWER → NEXT and does not use delayed feed choices.

## Consequences

- Navigation no longer always requires a server reversal/ranking roundtrip.
- Durable persistence and exposure ordering remain mandatory; local write or
  cancellation failure cannot silently discard a selected choice.
- Concurrent receipts, cancellation/send races, exact restart replay, background
  flush, scope changes, source age and one-step rearming require regressions.
- Phone latency and kill/reconnect observations remain separate from test/CI
  success. This decision changes dispatch/presentation timing, not scoring.

## Alternatives considered

Only showing the old card inert retains the network wait before it is usable.
Memory-only choices risk loss on process death. Cancelling an already sent
command or resurrecting the old full grid would violate evidence/retry rules.
