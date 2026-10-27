# ADR-0013 — Friend network and temporary Shared sessions

Status: **Accepted product direction; implementation and runtime acceptance open**

Date: **2026-10-27**

Tracking: #215, #232 / #232F; Sprint 015 and ROADMAP Phase 16

## Context

The owner wants joint discovery to start from the Friend network. A invites B
and C to browse together today; tomorrow A may invite B and Z. People should not
have to create, name or select a permanent group for each combination. Joint
recommendations, Lists, individual answers and their evidence boundaries remain.

This refines ADR-0002 and ADR-0007: Profile remains the prediction target, while
the visible collaboration becomes a temporary session. It does not replace the
October 25 engine-first execution order or add a public social feed.

## Decision

### 1. Separate the social relationship, active session and learned context

| Concept | Lifetime and responsibility |
|---|---|
| `Friendship` | Persistent reciprocal social connection; supplies invite candidates, without private Personal access. |
| `SharedSession` | Planned temporary joint browsing scope with its own identity, accepted roster, lifecycle and current choices. |
| `SharedSessionInvite` | Planned invitation to one explicit session/roster proposal; separate consent and token purpose from Friend or legacy Profile invitations. |
| `SharedProfile` | Durable internal joint prediction/memory context; never replaced by a User or by the host's PersonalProfile. |
| `SharedRatingRound` | One identified experience and its individual responses; session participation/closure is not an outcome. |

The normal product flow is Friends → choose people → invite → explicit acceptance
→ browse together → leave/end. The initial compact bound remains 2–5 people,
including the initiator. No group name, permanent group picker or separate group
Room setup is required. Participants may still have a restrained active-context
presentation and authorized joint history/Lists.

Only invited Users who explicitly accept the declared roster can participate.
B and C need not become Friends of each other merely because A invited them.
Sending or opening either kind of invite creates no automatic relationship,
membership or access. Block rules apply across the proposed roster.

### 2. Temporary interaction does not mean disposable memory

Working assumption from the owner's “otherwise the same” requirement: the same
people can benefit from their earlier authorized joint history when they meet
again. A new session has new immediate WorkingState and delivery identities;
ending it does not reset the PersonalProfile or erase joint history.

For new session-backed contexts, the exact accepted participant set identifies
the eligible joint context, independent of invite order or who initiated it.
The server may reuse its authorized SharedProfile; a matching set alone never
restores revoked access or erased evidence. Existing enrollment/source-consent
lineage still constrains usable history.

A–B–C and A–B–Z use different joint contexts. Adding/removing a participant does
not mutate the old context into a different group or relabel its history. Stop
new choices on the old roster and create a newly accepted session/context.
Old forecasts, delivery origins and answers keep their original identities.

Do not create all possible combinations in advance. Resolve a context only for
an actually accepted session, with an idempotent server operation and race-safe
identity. Existing named SharedProfiles with overlapping or identical members
must not be silently merged or deleted; their explicit migration/compatibility
mapping is a separate, preservation-tested implementation step.

### 3. Authorization follows the session and evidence

Future new-session ranking and mutations require both current authorized context
access and the exact active accepted session/roster. Hiding the old picker alone
does not implement this boundary. Pending invitations or old Profile membership
cannot substitute for participation in today's session.

An ended/expired session admits no new browsing decisions. Existing delayed
SharedRatingRound responses may continue only through their own valid frozen-
participant authorization; closure neither supplies answers nor completes rounds.
Revoke/block/deletion and source withdrawal invalidate the corresponding access,
tokens, caches and derived evidence under their declared lifecycle.

Joint Lists/history/messages retain their actual authorized context. Z does not
gain A–B–C history through the later A–B–Z session. Friendship and participation
never expose raw Personal history. Permitted aggregate Personal inputs retain
the existing common-fit/privacy gates; no cross-group or graph-neighbor learning
is admitted by this UI change.

### 4. Keep engine work compatible without claiming a session backend exists

Sprint 015's genuine #232F consumer remains the next engine packet. Its existing
prepared v1 input freezes the full current Profile actor/enrollment set and a
never-answered round, not a future SharedSession. Use that truthful existing
basis for the bounded native consumer; do not invent session IDs or reinterpret
stored capture-only artifacts as consumed forecasts.

The future session producer must bind real session identity/lifecycle revision,
accepted roster/enrollment and receipt to the consumed input and PredictionRun.
It needs an explicit versioned adapter and the same membership/answer races,
withdrawal, exact-retry and dependent-forecast erasure checks. A different actor
set must fail scope comparison even when the sets overlap. Personal and unrelated
Shared contexts remain isolated.

Keep the existing joint/common-fit calculation boundary and individual response
semantics. This decision neither selects new score weights nor proves expected-
rating quality. Broad Friend/session UI follows Engine V1 in Phase 16; existing
authorized Profile fixtures can validate the engine before that UI is delivered.

## Acceptance and consequences

- Demonstrate A–B–C today, A–B–Z tomorrow and the same A–B–C later without a
  permanent-group creation/picker flow, with authorized history reuse and isolation.
- Cover pending/declined/expired invites, partial acceptance and explicit roster
  replacement, block/remove/rejoin, concurrent starts, retries and restart recovery.
- Freeze the active roster before the first joint forecast; any changed proposal
  requires the affected participants' explicit acceptance before new ranking.
- Keep old-session requests and cached cards from writing into the new session;
  resume the exact live session after reconnect, otherwise return safely to Personal.
- Verify legacy profiles, Lists, messages, frozen predictions and individual
  responses remain attributable and accessible only under their applicable rights.
- Session starts, joins, exits and duration are lifecycle/telemetry facts, not
  ratings, completed experiences or automatic group reward.

This is a design receipt. No new session table/RPC, Friend graph UI, migration,
APK or phone acceptance is delivered by it. DOMAIN_MODEL owns lifecycle rules,
LAUNCH_LOOP and UX_PRINCIPLES own the flow, and STATUS names the one active packet.

## Alternatives considered

- Require a named persistent group for every outing: adds the friction the owner
  wants removed and conflates navigation with the prediction context.
- Discard all joint memory at session end: loses the accepted learned joint
  behavior; ephemeral coordination does not require ephemeral evidence.
- Mutate one SharedProfile whenever people change: mixes context/history and can
  leak a previous group's evidence to new participants.
- Use the host's PersonalProfile or average all Friends: changes the prediction
  subject and bypasses the existing joint-model and privacy contracts.
- Add live synchronized scrolling/video or a public social feed now: not requested;
  any future synchronization uses this session scope and its own acceptance.
