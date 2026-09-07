# ADR-0007 — Taste-first acquisition and identity/social boundaries

Status: **Accepted**  
Date: **2026-09-07**  
Decision owner: Product / architecture  
Tracking: #215

## Context

Kajo's first public release must acquire users through a low-friction Taste Test that can begin before registration, preserve cold-start learning through account conversion, support personal invite links and then make shared use easy.

The existing architecture already has canonical `User`, `PersonalProfile`, `SharedProfile`, Event and Prediction boundaries. The new launch loop must not collapse identity, taste and social relationships into one table or one token because that would create correctness, privacy and scaling problems.

## Decision

Kajo adopts a **Taste-first launch architecture** with four separate concerns:

1. **Identity** — anonymous/permanent account identity and auth-provider linking.
2. **Taste/Profile** — PersonalProfile learning state, bootstrap evidence, Memory and Prediction.
3. **Social graph** — FriendInvite/Friendship and SharedProfile membership.
4. **Acquisition** — TasteSession, campaign/referral attribution and invite-token lifecycle.

The public entry flow may create an anonymous identity/profile state before sign-up. When the person continues with Google or Apple, that identity is upgraded/linked without creating a second logical PersonalProfile.

A personal invite creates a Friend relationship only after the receiver explicitly accepts and completes identity conversion. Friendship does not grant access to PersonalProfile evidence and does not automatically create a SharedProfile.

A SharedProfile is created explicitly from one or more Friends and remains the first-class learned joint Prediction target.

## Link semantics

Kajo maintains separate link/token types:

- public/reusable Taste link: acquisition only,
- personal Friend invite: one relationship invitation with expiry/revocation/use limits,
- SharedProfile membership invite: existing group membership path.

These token classes are not interchangeable.

## Scaling decision

Data contracts are designed so the system can grow to approximately one million users without changing the conceptual identity/taste/social model. Infrastructure is provisioned according to measured demand.

We explicitly reject premature Kafka/Kubernetes/graph-database/microservice adoption as a release requirement. Candidate retrieval, feature state, ranking, event ingestion, analytics and SleepLayer may later be split behind the same contracts when real bottlenecks justify it.

## Consequences

Positive:

- Taste Test can prove value before sign-up.
- Cold-start data survives account conversion.
- Invites form a natural viral loop without silently creating groups.
- Friend graph remains lightweight.
- SharedProfile retains deliberate consent and joint-learning semantics.
- Identity, taste and social authorization can scale and be deleted/retained independently.

Costs:

- anonymous identity lifecycle and account-link collision handling become release-critical,
- invite token security and anti-abuse must be implemented before public sharing,
- funnel telemetry must distinguish growth events from recommendation evidence,
- web/app continuation and auth conversion require end-to-end testing.

## Alternatives rejected

### Require registration before Taste Test

Rejected because it adds friction before Kajo demonstrates value and wastes the strongest cold-start/acquisition opportunity.

### Personal invite automatically creates SharedProfile

Rejected because opening a link should not create a joint-learning/private collaboration context without explicit later group creation. Friendship is the correct lightweight result.

### Store Taste answers only in browser/local state until sign-up

Rejected because it makes recovery, cross-device continuation, attribution and trustworthy experiment/evaluation semantics fragile.

### One generic referral token for all link purposes

Rejected because acquisition attribution, Friend authorization and SharedProfile membership have different security and lifecycle semantics.

## Related documents

- `docs/product/LAUNCH_LOOP.md`
- `docs/product/MVP.md`
- `docs/project/ROADMAP.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/DATA_EVENTS.md`
- `docs/domain/PREDICTION_MODEL.md`
