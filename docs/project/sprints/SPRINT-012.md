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
5. [x] Apply the hosted migration, merge PR #165 and pass main CI.
6. [-] Finish product-owner-requested UI polish and configured-device acceptance.

## Current verification

- PR #165 is merged at main commit `07f62dd`; main CI #248 completed successfully and produced the standalone Android artifact.
- Hosted migration `20260902185821_profile_messaging_foundation` is permanently applied.
- Shared A→B send/read, contextual Profile/List/Item reference, stable-ID retry, per-User unread/read cursor and Personal/Shared outsider denial passed post-apply inside a rolled-back smoke transaction.
- The pre-acceptance polish merged in PR #167 at main commit `4377987`; main CI #252 passed with 147 tests and produced the standalone Android artifact.
- Configured-device review found that the Room still had outer gutters and secondary routes exposed a white navigator canvas instead of the intended Room atmosphere. This build is not visually accepted.
- PR #168 merged the edge-to-edge persistent/blurred Room correction at main commit `56fae50`; main CI #254 passed with 148 tests and produced the standalone Android artifact.
- Configured-device review on 2026-09-03 accepted the corrected full-screen Room/backdrop behavior. The remaining navigation finding is the default Stack animation: returning Home or opening an Item briefly leaves both routes visible.
- PR #169 merged the immediate-transition/Room-art follow-up at main commit `7bccc2a`; main CI #256 passed with lint, TypeScript, 149 tests, both platform bundle exports and the standalone Android APK build.
- Configured-device review confirmed the navigation/layout look good and refined the art target away from realism, perspective and video-game/pixel styling toward a softer, mildly abstract straight-on 2D cabin. The complete bookshelf must remain inside tall-phone crop boundaries; window and fireplace Kajo render separately.
- The focused `feat/minimalist-2d-room` follow-up uses one optimized portrait limited-palette Room illustration with neutral baked lighting, a mobile-safe full bookshelf, independent Profile/DiscoveryMode-aware window/fireplace light layers and precise Home-only TV/bookcase interaction targets. Window Kajo breathes slowly, fireplace Kajo flickers gently and DiscoveryMode changes cross-fade the complete atmosphere over 680 ms; reduced-motion settles the presentation without continuous motion. `npm run check` passes with lint, TypeScript, 149 tests, both platform bundle exports and verified inclusion of the optimized 560 KB Room asset. This follow-up has not yet received configured-device acceptance.

## Pre-acceptance UI polish

The product owner requested that the next device build include:

- approximately 70%-opaque surfaces so the active Profile and DiscoveryMode atmosphere remains visible across screens,
- no duplicate `Huone`/`Discover` row above discovery content and a smaller BOOK/MOVIE title,
- a lightweight 0–10 ribbon with live numeric preview, commit on tap/release and a 500 ms committed-value pause before card advance,
- removal of the repeated drawer identity block,
- fixed Saved/read/watched List shortcuts and at most three actor-local most-used custom List shortcuts in the drawer.
- no white gutters or page canvas: one full-screen Room remains sharp on Home and blurred/dimmed below every secondary authenticated route.

The most-used drawer order is deliberately separate from the destination picker contract: drawer ranking is use count first and latest use second, while the compact picker remains latest-use-first.

## Handoff

Current target: validate and cut the straight-on minimalist 2D cabin follow-up, then request one explicit push/PR/merge authorization. Do not extend earlier visual acceptance to this new Room asset or the deferred complete Lists/messaging acceptance flows.
