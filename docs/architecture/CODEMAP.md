# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–007 are merged, validated and complete. The configured Android app has accepted authentication, persisted BOOK/MOVIE interaction and generic Event/undo flows. Sprint 008 — Prediction V0 is active; Issue #95 establishes the first server-owned generic scorer boundary before mobile integration.

Important current paths:

```text
AGENTS.md
README.md
package.json
package-lock.json
docs/
apps/mobile/
supabase/migrations/
supabase/functions/password-auth/
.github/workflows/ci.yml
```

## Implementation locations

| Area | Canonical path | Current state |
|---|---|---|
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application; Sprint 006 configured auth, profile and persistence flows are accepted on a real Android phone |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; authenticated routes share one persistent DiscoveryMode shell above the Stack, while auth/callback routes stay outside it; book/movie discovery and generic Item detail routes live under `app/discovery/` |
| Core domain contracts | `apps/mobile/src/domain/` | Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts and canonical mode mapping; Sprint 007 persists the existing Event contract rather than inventing domain-specific variants |
| Room feature | `apps/mobile/src/features/room/` | 2D Room shell whose ambient phase follows the global DiscoveryMode; the duplicate window control is removed until post-MVP Room design, while bookshelf/projector navigate to discovery |
| Theme engine | `apps/mobile/src/theme/` | Reusable personal Room base tokens plus AmbientPhase overlays and tests |
| Discovery feature | `apps/mobile/src/features/discovery/` | Shared DiscoveryMode state exposed by one persistent app-shell curtain, typed Prediction V0 RPC mapping/refresh boundary, hosted ranking in configured grids and explicit mock fallback; generic grid/detail/swipe plus a tap/drag 0–10 rating control, compact expandable-description detail layout and one interaction store with ordered persistence, retry feedback and exact-card undo |
| Event Engine | `apps/mobile/src/features/events/` | Root-scoped session/correlation tracker, meaningful-impression deduplication, canonical interaction/undo mapping and retry-safe append boundary for generic Event/session rows |
| Swipe | `apps/mobile/src/features/swipe/` | Intentionally not created; current optional swipe behavior is part of the existing generic discovery flow rather than a duplicate feature tree |
| Personal identity | `apps/mobile/src/features/profiles/` | User-bound profile hydration, unique display-cased nickname onboarding/fallback and canonical User/PersonalProfile mapping behind one root provider; SharedProfile product flow remains later scope |
| Memory/history | `apps/mobile/src/features/memories/` | Intentionally not created; Sprint 005 consumed-history presentation/state currently lives at the generic discovery interaction boundary until persistent memory work requires a separate area |
| Mobile data boundary | `apps/mobile/src/data/` | Public Expo configuration validation, testable configured/unconfigured connection factory, one persistent-session Supabase client and root provider; no direct Supabase calls in screens |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Root-scoped persisted login state, email-or-nickname password sign-in, email+nickname registration, explicit static and token-path Android callback routes, redundant intent token parsing, explicit confirmation success, in-memory recovery sessions and callback-stack-clearing return-to-login actions; unconfigured builds preserve the accepted mock flow |
| Password auth boundary | `supabase/functions/password-auth/` | One public Edge Function resolves email/nickname identifiers server-side, checks account existence, signs in against Supabase Auth, resends signup confirmation and requests recovery without returning resolved email or privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | Scanner-safe HTTPS hop maps signup to the documented email OTP type, forwards token hashes redundantly without consuming them and foregrounds/reuses Kajo's Android task; only the app verifies the token |
| Supabase function config | `supabase/config.toml` | `password-auth` is explicitly callable before login (`verify_jwt = false`); credential validation remains inside the auth function/Supabase Auth flow |
| Prediction service | `public.rank_items_v0` via `supabase/migrations/20260831093000_prediction_v0_foundation.sql` | Server-owned generic Prediction V0 scorer with authenticated Profile membership, response-level traceability, inspectable signals and deterministic mode-aware ranking; mobile integration follows separately |
| DB migrations | `supabase/migrations/` | Sprint 006 identity/current-state foundation, Sprint 007 append-only Event/session tables and Sprint 008 Prediction V0 plus rating/not-interested state; explicit grants, membership-based RLS, stable retry IDs and actor/Profile consistency constraints form the authorization/data-quality base |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; optional public Supabase repository variables feed Expo, and `main` also builds/verifies/uploads a standalone Android release APK |

Do not create empty feature folders merely to match the target architecture.
