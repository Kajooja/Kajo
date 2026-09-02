# Sprint 012 — Profile Messaging

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-09-02**
Primary issue: **#138**

## Goal

Add one deliberately narrow message thread per Profile and make the existing Inbox the entry point for invitations plus message activity, without introducing a general social network or a second behavioural Event stream.

Sprint 011 Lists are merged, hosted and automatically verified. Their refreshed configured Android acceptance is explicitly deferred by the product owner and remains unaccepted; Sprint 012 starts on the stable Profile/List/Item identity model without claiming that the deferred device test passed.

## Scope

### Persistence and authorization

- `ProfileMessage` belongs to exactly one Profile and retains the real sending `actorUserId`.
- PersonalProfile messages are readable/writable only by the owner.
- SharedProfile messages are readable/writable only by currently accepted members.
- A message may reference one Profile-owned `ItemList` and one generic `Item`.
- Message body is short plain text for MVP; no image, file, voice or rich-content payload.
- Message persistence is separate from append-only behavioural Events and is not Prediction evidence by default.
- Per-User/Profile read state owns unread delivery; generic Item interaction state does not.

### Mobile delivery

- The bottom-envelope Inbox retains pending invitations and adds Profile message activity.
- The Inbox badge combines pending invitations and unread messages without adding Room chrome.
- Opening activity enters the referenced Profile thread.
- A Profile thread shows actor identity, message time and restrained optional Item/List context.
- Sending is retryable and keeps a failed draft visible.

### Contextual List message

- List addition may include one optional short message referencing the committed Profile/List/Item.
- List membership commits first and remains successful even if sending the optional message fails.
- A failed optional message can be retried from its draft state without repeating the List mutation.
- The compact five-row List destination contract remains lightweight.

## Acceptance

- PersonalProfile owner can send/read; another User is denied.
- accepted SharedProfile members can send/read; outsider and former member are denied.
- Inbox distinguishes invitations and message activity and reports per-User unread state.
- opening a thread marks only that User's delivery state read.
- contextual message references the correct Profile/List/Item/sender.
- a message failure never rolls back or duplicates a successful List membership.
- `npm run check`, hosted rollback/security verification and configured Android acceptance pass before #138 closes.

## Non-goals

- arbitrary User-to-User direct messages,
- public channels, feeds, followers or searchable chat,
- reactions, typing indicators, presence, push notifications or message editing/deletion,
- voice, image and file messages,
- recommendation weighting from message text,
- Room visual redesign,
- ScenarioMemory.

## Execution order

1. [x] Add the ProfileMessage/read-state schema, RLS, explicit grants and narrow RPCs locally.
2. [x] Add typed mobile operations/provider with deterministic mapping/error tests.
3. [x] Extend Inbox and add the Profile thread route.
4. [x] Add optional contextual List message with independent failure/retry semantics.
5. [-] Run full automated, hosted authorization and configured-device acceptance.

## Current verification

- The local migration compiles against the current hosted schema inside a transaction that is always rolled back.
- Shared A→B send/read, contextual Profile/List/Item reference, stable-ID retry, per-User unread/read cursor and outsider denial pass in that rollback smoke.
- A post-smoke catalog check confirms that neither new table exists in hosted production; permanent migration application remains approval-gated.
- `npm run check` passes: lint, TypeScript, 144 tests, and both iOS/Android bundle exports.
- Configured-device acceptance remains unrun and must not be inferred from automated checks.

## Handoff

Current target: retain the verified local #138 commit and request the next release authorization. Do not apply the messaging migration, push, open a PR or merge without the product owner's explicit approval.
