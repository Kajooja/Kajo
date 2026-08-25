# Kajo Product Constitution

Status: **Kajo 0 product foundation**

## 1. Value proposition

Kajo learns what kind of person a user is and helps that person discover experiences they are likely to value—alone or together with others.

The intended feeling is: **"Kajo knows me, but it can still surprise me."**

## 2. Kajo is not a book app

Books and movies are the first supported domains, not the product boundary.

A recommendable object is a generic `Item`. Future item types may include series, music, artists, concerts, hyperlocal events, restaurants, travel destinations, activities, podcasts and games.

The core prediction architecture must not require a redesign when a new item type is introduced.

## 3. Prediction targets Profile

A prediction is made for a `Profile`.

A profile may be:

- `PersonalProfile`: one person's Kajo.
- `SharedProfile`: a persistent 2-N person Kajo.

A SharedProfile has its own history, memory, theme, saved items and learned joint taste. It is not simply an average of its members.

## 4. What Kajo predicts

Kajo estimates how suitable and valuable an item is for a profile in the current context.

User-facing discovery modes:

- `FOR_YOU`: high expected fit and relatively high confidence.
- `SURPRISE`: higher novelty while retaining a meaningful reason to expect fit.
- `RISK`: higher uncertainty and variance; a deliberately bolder recommendation space.

Internally Kajo may later estimate several outcomes such as interest, selection, save, consumption, completion, enjoyment, recommendation and return.

## 5. Memory model

### Long-term

Kajo learns slowly changing characteristics of the person/profile instead of maintaining isolated category taste silos.

Examples include novelty appetite, tolerance for complexity, darkness/lightness, intensity, familiarity/experimentation, emotionality, realism/fantasy and pacing preferences.

### Short-term

Kajo models what the person/profile appears to want now. Recent signals can cross domains: recent science-fiction reading may affect movie recommendations; recent heavy-music listening may affect event or movie recommendations.

### Scenario memory

Kajo should retrieve similar historical situations across the user population. A scenario combines profile state, recent state, context, candidate item/pattern, prediction and observed outcome.

Population scenarios are evidence. As personal evidence grows, it should increasingly dominate generic population priors.

## 6. Context

Context may include personal/shared profile, group size, recent behaviour, current session behaviour, time, weekday, season, active intent, available time and—with permission—location. Domain-specific context may later include distance, event time, weather, budget or travel constraints.

## 7. Behaviour data

Kajo is event-driven. Important user actions and exposures must be measurable so predictions can be compared with real outcomes.

The event record must distinguish **who acted** from **which profile context the action occurred in**.

## 8. Social model

Kajo is not primarily a feed-based social network.

Its social core is persistent SharedProfiles where members can browse, swipe, save, suggest and build a shared history together.

A user action in a SharedProfile should not automatically be interpreted as equally strong evidence for the user's PersonalProfile.

## 9. Discovery

The default discovery experience is a visual grid ranked by Kajo. Swipe is optional and serves calibration, discovery and exposure/history capture; it is not the product itself.

Swipe should help Kajo learn both preference and what popular/recommended content the user has already consumed so familiar items do not repeatedly dominate recommendations.

## 10. Exploration

Kajo must avoid trapping users inside a static taste bubble. `FOR_YOU`, `SURPRISE` and `RISK` are intentionally different exploration policies, not cosmetic filters.

## 11. Room and theme

The Room is Kajo's home screen and primary navigation metaphor.

It is minimalist, 2D and atmospheric. Objects have function rather than existing as game decoration.

Initial metaphors:

- Bookshelf -> books.
- Screen/projector -> movies.
- Window/curtain -> discovery-risk control.
- Fireplace -> ambient identity/light source.
- A minimal social object -> SharedProfiles.

The Room remains visually present as the user enters content areas. Each area may smoothly shift into its own user-configured theme.

The user's personal theme remains the base identity. Discovery modes apply a subtle ambient phase on top of it:

- `FOR_YOU` -> dawn/day.
- `SURPRISE` -> evening.
- `RISK` -> night.

## 12. Privacy and demography

Personal history and learned state are private by default. SharedProfile actions belong to that shared context and retain the acting user identity.

Demographic data may be used only as a weak cold-start prior. It must not define the user's long-term identity or remain dominant once behavioural evidence exists.

## 13. Success

Kajo succeeds when it helps people find experiences they actually value, not when it maximizes swipes.

Relevant success measures include prediction calibration, saves leading to real consumption, user satisfaction/outcomes, number of recommendations required to find a choice, return behaviour and SharedProfile success.

## 14. MVP boundary

The MVP starts with books and movies, a personal Room, SharedProfiles, grid discovery, optional swipe, saved/consumed history, theme/discovery-state transitions, event capture and the first generic personalized prediction model.

See `MVP.md` for executable requirements.

## 15. North star

Kajo should become both:

1. a prediction engine for future experiences, and
2. a personal/shared memory layer for past experiences.

Consumed experiences should eventually support notes, memories, images, dates, locations and people. The same system should learn from those experiences without reducing the person to separate media-category profiles.
