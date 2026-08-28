# Kajo Architecture

Status: target architecture for MVP development. Implementation folders are created only when needed.

## Repository model

Use a single monorepo while Kajo is one product/team.

Target shape:

```text
kajo/
├── apps/
│   └── mobile/               # React Native + Expo + TypeScript
├── services/
│   └── prediction/           # Python prediction service when introduced
├── supabase/
│   ├── migrations/
│   └── functions/
├── packages/
│   ├── contracts/            # shared contracts when justified
│   └── ui/                   # shared UI only when justified
├── docs/
└── .github/
```

Do not create empty complexity merely to match this diagram.

## Mobile

Planned stack:

- React Native
- Expo
- TypeScript
- Expo Router
- Reanimated / gesture tooling where needed

Feature-oriented organization is preferred:

```text
apps/mobile/src/features/
├── room/
├── discovery/
├── swipe/
├── profiles/
├── memories/
└── onboarding/
```

Cross-feature primitives may live under `components`, `theme`, `data` or `lib` once real reuse exists.

## Theme architecture

Theme/ambient logic must be centralized rather than hard-coded across Room components.

Conceptually:

```text
RenderedTheme = ProfileTheme + ContentAreaTheme + AmbientPhase
```

`DiscoveryMode` is domain/prediction state. `AmbientPhase` is UI state. Mapping between them is explicit.

## Data/backend

MVP backend direction:

- Supabase
- PostgreSQL
- Auth
- migrations committed to repository
- pgvector when vector similarity/scenario memory is introduced

Presentation components should use service/data boundaries, not arbitrary direct Supabase calls.

Configured CI and standalone APK builds read the optional GitHub Actions
repository variables `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If both are absent, the accepted local
mock path remains active. These values are public mobile configuration, but
project access tokens, secret/service-role keys and database passwords must
never be stored in repository variables or committed files.

Sprint 006 password authentication has one server-side identifier boundary in
`supabase/functions/password-auth`. The mobile client may submit an email or
nickname, but nickname-to-email resolution stays inside that Edge Function.
The function may use Supabase secret/service-role credentials only in its
hosted environment and must never return the resolved email or privileged key
to the mobile client. Email/nickname existence checks intentionally support the
MVP's explicit user-facing not-found/duplicate messages.

Email confirmation returns to the native app through the committed `kajo://`
URL scheme. Supabase Auth redirect settings must allow the Kajo scheme, and the
mobile client converts the returned auth tokens into the persisted session.

Password recovery uses a six-digit email OTP instead of a clickable auth link.
The recovery email template must show `{{ .Token }}` and must not include
`{{ .ConfirmationURL }}`, so email scanners and tracking redirects cannot
consume the one-time credential. The `password-auth` function verifies the OTP
without exposing the resolved account email, returns the resulting session to
the mobile auth boundary, and the authenticated client then updates the
password.

## Prediction service

Prediction logic belongs outside the mobile UI. Initial implementation may evolve, but the boundary must preserve a stable conceptual request:

```text
Profile + Context + DiscoveryMode -> ranked Items / Predictions
```

Python is the preferred language for the later dedicated prediction service because of ML/data tooling. FastAPI is a likely transport layer when a separate service is necessary.

## External content

External providers are adapters/data sources, not the Kajo domain model. TMDB/Open Library or future sources must be normalized into Kajo `Item` representations.

## Observability and learning

Every recommendation intended for learning should be traceable through `predictionId` into Event outcomes.

## Security/privacy

- No secrets in repository.
- `.env.example` documents required configuration only.
- Access to personal/shared data must follow profile membership/authorization rules.
- Location/demographic/context data should be minimized and permission-aware.
