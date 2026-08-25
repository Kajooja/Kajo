# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

## Milestone: MVP 0.1

### Sprint 001 — Foundation

Repository memory, mobile skeleton, workspace, CI, domain contracts.

### Sprint 002 — Room

First recognisable minimalist 2D fireplace Room with window, fireplace, bookshelf and movie screen using mock data.

### Sprint 003 — Curtain & Theme

Theme engine, user theme tokens, draggable curtain, three snap states, DAWN/EVENING/NIGHT transitions.

### Sprint 004 — Discovery UI

Books + Movies grids, Item cards/details, mock ranking, DiscoveryMode switching.

### Sprint 005 — Swipe & History

Optional swipe, like/dislike, watched/read, saved state and consumed-history suppression.

### Sprint 006 — Backend Foundation

Supabase/PostgreSQL, auth, Profile, ProfileMember, Item persistence, migrations and authorization foundations.

### Sprint 007 — Event Engine

Generic event capture, sessions, prediction traceability and analytics-quality behavioural contracts.

### Sprint 008 — Prediction V0

First real generic personalized ranking using Item similarity, behavioural history, recency/ShortTermState and exploration policy.

### Sprint 009 — Shared Kajo

Persistent SharedProfiles, shared Room/theme, joint saved/history/discovery and member suggestions.

### Sprint 010 — Memory

Consumed experience history, ratings and initial memory/note extension point.

### Sprint 011 — Scenario Memory

Vector/scenario representation and similarity retrieval over historical situations.

### Sprint 012 — MVP Hardening

Onboarding, performance, accessibility, end-to-end flows, quality, privacy checks and release readiness.

## Post-MVP direction

After real prediction/outcome data exists:

- population scenario learning at scale,
- predictor evaluation framework,
- evolutionary predictor/genome engine,
- additional domains such as music, events and travel,
- richer personal/shared memories including images and context.

Roadmap changes must be deliberate. Do not rewrite completed sprint history when sequencing changes.
