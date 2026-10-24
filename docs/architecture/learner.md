# Learner module: child profiles and onboarding

What a parent stores about their child and how the onboarding steps create it. Owning rules: [`security.md`](../rules/security.md), [`persistence.md`](../rules/persistence.md). Code: [`src/modules/learner`](../../src/modules/learner). Identity and authorization: [`authentication.md`](authentication.md).

## What is stored

A `ChildProfile` holds the minimum [`vision.md`](../product/vision.md) allows plus what the parent chose from closed lists. Nothing is free text except the display name.

| Field                                            | Rule                                                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayName`                                    | Trimmed, 1 to 24 characters (code points), no control or invisible format characters                                                                              |
| `federalState`                                   | One of the 16 state codes (`BW BY BE BB HB HH HE MV NI NW RP SL SN ST SH TH`)                                                                                     |
| `grade`                                          | 1 to 4                                                                                                                                                            |
| `interests`                                      | 0 to 4 distinct values of `INTERESTS` (`nature animals science art music sports technology stories puzzles history`); skipping is valid; stored in the list order |
| `tutorId`                                        | `null`, or the stable id of a tutor the tutors catalog lists with status `bereit` (`max`, `lili`, `fina` today)                                                   |
| `voiceConsent` (domain: `controls.voiceEnabled`) | The parent's "voice allowed" control, default `false`. The column keeps its original name to avoid a rename migration; the record mapper maps it                  |
| `dailyLimitMinutes`                              | `null` (no limit) or one of `DAILY_LIMIT_MINUTES` (15, 30, 45, 60, 90)                                                                                            |
| `allowedFromMinute`, `allowedUntilMinute`        | Both `null` (any time) or both set: minutes since midnight in `Europe/Berlin`, 0 to 1440, multiples of 15, from < until, at least 30 minutes wide                 |
| `learningInsights`                               | The parent lets Hort note where the child needed help, for the parent summary (#35); default `false`                                                              |
| `guardianConfirmedAt`, `guardianConsentVersion`  | When the guardian confirmed the guardianship statement, and which version of it (`GUARDIAN_CONSENT_VERSION`, currently `2026-10-24`)                              |
| `setupStep`                                      | The furthest step the parent has reached: `child < interests < tutor < controls < review < done` (`SETUP_STEPS`)                                                  |
| `setupCompletedAt`                               | UTC instant the parent finished the setup; `null` while unfinished. `setupStep = 'done'` exactly when it is set                                                   |
| `tenantId`, `ownerId`, `id`                      | Tenant and guardian's `ActorId` come from the signed-in actor, never from a request                                                                               |

All defaults are the most private and restrictive: voice off, no limit, no window, insights off. No age, avatar or free-text interests.

The database repeats the rules as CHECK constraints: name length, grade range, state set, step set, `cardinality(interests) <= 4` and the interest set, the daily-limit set, the window rules (both set or both empty, range, step of 15, width), and `done <=> setupCompletedAt IS NOT NULL`. The partial unique index `ChildProfile_one_unfinished_per_owner` keeps at most one unfinished profile per parent. Migration `20261024T2032_extend_child_profile_setup` is additive and backfills existing rows (`setupCompletedAt` set: `done`; otherwise `interests`).

## The step

`setupStep` only moves forward, also under concurrency. Each step's write is one conditional `UPDATE ... WHERE setupStep IN (steps before the target)` that stores the choice and the new step together; when the stored step is already at or past the target, a second `UPDATE` stores the choice alone. Both only match an unfinished profile of the signed-in parent, so editing an earlier step never moves the step back and no interleaving of requests can. The server does not force the order of the saves (a client may save the controls before the tutor); it only guarantees the step never decreases, and `CompleteSetup` needs the `review` step.

## Use cases

All take no tenant, owner or role from the caller. Each authorizes the signed-in parent first (`requireInTenant`, then the owner-scoped load and `requireOnResource` for an existing profile). Another parent's profile id answers exactly like an unknown one: `learner.not_found`, nothing written. A finished profile answers `learner.already_onboarded` for every editing step.

- `GetOnboardingState` (query, `learner.read`): `{ step, profile }`. No profile: step `child`. Otherwise the stored step of the parent's unfinished profile, else `done` for the oldest finished one.
- `CreateChildProfile` (command, `learner.create`): idempotent. While the setup is unfinished, a repeated or corrected submit replaces the details of that one profile and keeps the furthest step. A new profile is stored at `interests` (creating it is the `child` step). Concurrent submits cannot leave two unfinished profiles: the partial unique index refuses the second insert and the repository then updates the first row.
- `SaveInterests` (command, `learner.update`): validates against `INTERESTS` (distinct, at most 4; none is valid), stores them in list order, advances to at least `tutor`. Always allowed and idempotent.
- `ChooseTutor` (command, `learner.update`): the id is checked through `TutorCatalogPort`; unknown, draft and empty ids are a field error `learner.validation.tutor_invalid` on `tutorId`. Advances to at least `controls`.
- `SaveControls` (command, `learner.update`): validates voice, daily limit, allowed window and insights, and requires `guardianConfirmed === true` (`learner.validation.guardian_confirmation_required`). Stores the controls and the confirmation (time from the `Clock`, version `GUARDIAN_CONSENT_VERSION`) and advances to at least `review`. A re-save while unfinished keeps the first confirmation time unless the statement version changed.
- `CompleteSetup` (command, `learner.update`): loads the profile owner-scoped. A finished profile is returned unchanged, with no write and no audit. A profile whose step is not `review` answers `learner.setup_incomplete` (conflict). Otherwise one conditional `UPDATE ... WHERE setupStep = 'review' AND setupCompletedAt IS NULL` sets step `done` and `setupCompletedAt` (from the `Clock`), so only one call wins; the others return what the winner stored.

The tutor catalog is the tutors module's checked-in catalog, read through `TutorCatalogPort` (`infrastructure/tutors/catalog-tutor-catalog.ts`, wired only in `composition.ts`) so the use cases stay free of that module.

## Views

`ChildProfileView = { id, displayName, federalState, grade, interests, tutorId, controls: { voiceEnabled, dailyLimitMinutes, allowedWindow, learningInsights }, guardianConfirmed, setupStep, setupCompletedAt }`. `guardianConfirmed` is true only for the current statement version, so a new version asks again. Tenant, owner and timestamps other than `setupCompletedAt` are not exposed.

## Using the controls

`isLearningAllowedNow(controls, now)` is the pure check for the future help-session use case: with an allowed window it is true only inside `[from, until)` read as clock time in `LEARNER_TIME_ZONE` (`Europe/Berlin`, through `Intl`, so it follows daylight saving), and always true without one. Nothing calls it yet.

## Audit

Events are ids, counts and flags only, never the name or any other detail of the child.

| Event                               | Written                                         | Carries                                                                                                                    |
| ----------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `learner.profile_created`           | Only when a row was inserted                    | ids                                                                                                                        |
| `learner.interests_saved`           | Only when the set changed                       | `count` (not the values)                                                                                                   |
| `learner.tutor_chosen`              | Only when the choice changed                    | `tutorId` (catalog data)                                                                                                   |
| `learner.controls_changed`          | Only when a control differs from the stored one | `voiceEnabled` and `learningInsights` (the new value, or `null` if unchanged), `dailyLimitChanged`, `allowedWindowChanged` |
| `learner.guardian_consent_recorded` | Once per confirmation (first, or a new version) | `consentVersion`                                                                                                           |
| `learner.setup_completed`           | Only for the call that wins the write           | ids                                                                                                                        |

`learner.voice_consent_changed` no longer exists; the voice flag is part of `learner.controls_changed`. Wired in `composition.ts` with `withAuditTrail(..., { source: 'learner' })` (`TRAIL_BY_EVENT`, `LEVEL_BY_EVENT`; all `member`/`info`). Denials are audited by the authorization service.

## Screens and routing

`/onboarding` (`src/app/[locale]/(app)/onboarding`) is the parent's setup. The server decides where a visit starts from `GetOnboardingState`, so a parent who stopped halfway resumes at the stored step, and the browser never holds the only copy of what was saved. A screen is left only after the backend answered "saved"; "all set" appears only after `CompleteSetup` succeeded.

- `/home` calls `requireOnboarded()`: a parent whose setup is not finished is redirected to `/onboarding`. Sign-in already lands on `/home`, so a new parent reaches onboarding after confirming the e-mail address and signing in, and a finished parent never sees it again.
- `/onboarding` calls `requireOnboarding()`: a finished parent is redirected to `/home`.
- Both guards are navigation only. A failure to read the state reaches `error.tsx` instead of redirecting, so a database outage cannot cause a redirect loop.
- The Server Actions validate with Zod and call the use cases; the use cases authorize again and the domain validates again.
- The journey has seven screens (welcome, child, interests, companion, safety and settings, review, done). A wide screen shows Hort and the list of steps beside the card, a phone one progress bar above it. "Change" on the review returns to the review after saving, so a correction never means walking through every step again.
- The companions come from the checked-in tutor catalog (`@modules/tutors`): the page prepares them (`tutor-options.ts`) and passes them down, so presentation never imports another module. Their pictures live in public storage; a missing picture shows an icon. A companion is recommended when the child's interests match what it likes; nothing is preselected. The voice is described in words, not played: no speech exists yet.
- Every control starts at its most private value (no voice, no limit, no window, no notes) and the guardian confirmation starts unticked. The "always on" list on the controls screen is plain text, not a switch: it states principles, not settings.
- Not part of onboarding on purpose: Alexa (no account linking exists; PR #42 is a dev-only skill), an age field, free-text interests, linking to a class (#32).

## Known gaps

- `dailyLimitMinutes` is stored, not enforced: nothing counts a child's usage yet. `isLearningAllowedNow` covers only the allowed window and nothing calls it yet. Do not present either as a working limit until the help session (#34) uses them.
- `voiceEnabled` is only stored; nothing reads it until voice (#34). `learningInsights` is only stored until the parent summary (#35).
- The save order is not enforced on the server: a client can save the controls before choosing a tutor (the profile then reaches `review` with `tutorId = null`). Only the monotonic step and the `review` requirement of `CompleteSetup` are guaranteed.
- One child per parent: there is no list, edit or delete of finished profiles, and no way to change the controls after the setup finished.
- A parent who finishes the setup in one request while another creates in the same instant can still end with a second profile; the unique index only guards unfinished profiles.
- A `guardianConsentVersion` bump asks a parent in the middle of the setup again, but a finished profile keeps its old confirmation: there is no re-consent flow yet.
