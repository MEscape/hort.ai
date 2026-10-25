# Learner module: child profiles and onboarding

What a parent stores about their child and how the onboarding steps create it. Owning rules: [`security.md`](../rules/security.md), [`persistence.md`](../rules/persistence.md). Code: [`src/modules/learner`](../../src/modules/learner). Identity and authorization: [`authentication.md`](authentication.md).

## What is stored

A `ChildProfile` holds the minimum [`vision.md`](../product/vision.md) allows plus what the parent chose from closed lists. Nothing is free text except the display name.

| Field                                            | Rule                                                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `displayName`                                    | Trimmed, 1 to 24 characters (code points), no control or invisible format characters                                                                                                                         |
| `federalState`                                   | One of the 16 state codes (`BW BY BE BB HB HH HE MV NI NW RP SL SN ST SH TH`)                                                                                                                                |
| `grade`                                          | 1 to 4                                                                                                                                                                                                       |
| `interests`                                      | 0 to 4 distinct values of `INTERESTS` (`nature animals science art music sports technology stories puzzles history`); skipping is valid; stored in the list order                                            |
| `tutorId`                                        | `null`, or the stable id of a tutor the tutors catalog lists with status `bereit` (`max`, `lili`, `fina` today)                                                                                              |
| `voiceConsent` (domain: `controls.voiceEnabled`) | The parent's "voice allowed" control, default `false`. The column keeps its original name to avoid a rename migration; the record mapper maps it                                                             |
| `dailyLimitMinutes`                              | `null` (no limit) or one of `DAILY_LIMIT_MINUTES` (15, 30, 45, 60, 90)                                                                                                                                       |
| `allowedFromMinute`, `allowedUntilMinute`        | Both `null` (any time) or both set: minutes since midnight in `Europe/Berlin`, 0 to 1440, multiples of 15, from < until, at least 30 minutes wide                                                            |
| `learningInsights`                               | The parent lets Hort note where the child needed help, for the parent summary (#35); default `false`                                                                                                         |
| `guardianConfirmedAt`, `guardianConsentVersion`  | When the guardian confirmed the guardianship statement, and which version of it (`GUARDIAN_CONSENT_VERSION`, currently `2026-10-24`)                                                                         |
| `voiceNoticeVersion`, `voiceNoticeConfirmedAt`   | Which version of the voice notice (`VOICE_NOTICE_VERSION`, currently `2026-10-25`) the parent confirmed when allowing speech-to-text, and when; both `null` or both set (CHECK), cleared on withdrawal (#34) |
| `setupStep`                                      | The furthest step the parent has reached: `child < interests < tutor < controls < review < done` (`SETUP_STEPS`)                                                                                             |
| `setupCompletedAt`                               | UTC instant the parent finished the setup; `null` while unfinished. `setupStep = 'done'` exactly when it is set                                                                                              |
| `welcomeCompletedAt`                             | UTC instant the child finished their own welcome (`/hello`), after the parent's setup; `null` while open. A CHECK allows it only when `setupCompletedAt` is set                                              |
| `tenantId`, `ownerId`, `id`                      | Tenant and guardian's `ActorId` come from the signed-in actor, never from a request                                                                                                                          |

All defaults are the most private and restrictive: voice off, no limit, no window, insights off. No age, avatar or free-text interests.

The database repeats the rules as CHECK constraints: name length, grade range, state set, step set, `cardinality(interests) <= 4` and the interest set, the daily-limit set, the window rules (both set or both empty, range, step of 15, width), and `done <=> setupCompletedAt IS NOT NULL`. The partial unique index `ChildProfile_one_unfinished_per_owner` keeps at most one unfinished profile per parent. Migration `20261024T2032_extend_child_profile_setup` is additive and backfills existing rows (`setupCompletedAt` set: `done`; otherwise `interests`).

## The step

`setupStep` only moves forward, also under concurrency. Each step's write is one conditional `UPDATE ... WHERE setupStep IN (steps before the target)` that stores the choice and the new step together; when the stored step is already at or past the target, a second `UPDATE` stores the choice alone. Both only match an unfinished profile of the signed-in parent, so editing an earlier step never moves the step back and no interleaving of requests can. The server does not force the order of the saves (a client may save the controls before the tutor); it only guarantees the step never decreases, and `CompleteSetup` needs the `review` step.

## Use cases

All take no tenant, owner or role from the caller. Each authorizes the signed-in parent first (`requireInTenant`, then the owner-scoped load and `requireOnResource` for an existing profile). Another parent's profile id answers exactly like an unknown one: `learner.not_found`, nothing written. A finished profile answers `learner.already_onboarded` for every editing step.

- `GetOnboardingState` (query, `learner.list`: it reads all of the parent's profiles, so a channel bound to one child, which holds `learner.read` only, is refused): `{ step, profile }`. No profile: step `child`. Otherwise the stored step of the parent's unfinished profile, else `done` for the oldest finished one.
- `CreateChildProfile` (command, `learner.create`): idempotent. While the setup is unfinished, a repeated or corrected submit replaces the details of that one profile and keeps the furthest step. A new profile is stored at `interests` (creating it is the `child` step). Concurrent submits cannot leave two unfinished profiles: the partial unique index refuses the second insert and the repository then updates the first row.
- `SaveInterests` (command, `learner.update`): validates against `INTERESTS` (distinct, at most 4; none is valid), stores them in list order, advances to at least `tutor`. Always allowed and idempotent.
- `ChooseTutor` (command, `learner.update`): the id is checked through `TutorCatalogPort`; unknown, draft and empty ids are a field error `learner.validation.tutor_invalid` on `tutorId`. Advances to at least `controls`.
- `SaveControls` (command, `learner.update`): validates voice, daily limit, allowed window and insights, and requires `guardianConfirmed === true` (`learner.validation.guardian_confirmation_required`). Stores the controls and the confirmation (time from the `Clock`, version `GUARDIAN_CONSENT_VERSION`) and advances to at least `review`. A re-save while unfinished keeps the first confirmation time unless the statement version changed.
- `SetVoiceConsent` (command, `learner.update`): the parent allows or withdraws speech-to-text for their own child at any time, also after the setup (#34). Allowing needs `noticeVersion === VOICE_NOTICE_VERSION`, else `learner.voice_notice_outdated` (conflict) and nothing is stored; it sets `voiceEnabled` and the notice confirmation (time from the `Clock`). Withdrawing sets `voiceEnabled = false` and clears the confirmation. Owner-scoped like every command: another parent's id answers `learner.not_found`. The switch lives on the parent's home (`VoiceConsentSwitch`).
- `CompleteSetup` (command, `learner.update`): loads the profile owner-scoped. A finished profile is returned unchanged, with no write and no audit. A profile whose step is not `review` answers `learner.setup_incomplete` (conflict). Otherwise one conditional `UPDATE ... WHERE setupStep = 'review' AND setupCompletedAt IS NULL` sets step `done` and `setupCompletedAt` (from the `Clock`), so only one call wins; the others return what the winner stored.

## Child welcome

After the parent finished the setup, the child's own welcome runs once on `/hello` (issue #64). The parent's choices are pre-selected and the child may change interests and companion before the welcome is closed. These three use cases are valid only while `setupCompletedAt` is set and `welcomeCompletedAt` is `null`: before the setup is done they answer `learner.setup_incomplete`, after the welcome `learner.welcome_already_completed` (conflict; `CompleteChildWelcome` is the exception, see below). All use `learner.update`, authorize like the parent steps and answer another parent's profile like an unknown one (`learner.not_found`).

- `SaveChildInterests` (command): same validation as `SaveInterests` (distinct, closed list, at most 4, none is valid). Changes only `interests` of that profile.
- `ChooseChildTutor` (command): checked through `TutorCatalogPort`, field error `learner.validation.tutor_invalid` otherwise. Changes only `tutorId`.
- `CompleteChildWelcome` (command): idempotent. One conditional `UPDATE ... WHERE setupStep = 'done' AND welcomeCompletedAt IS NULL` (via `updateAndCount`) stamps the time from the `Clock`, so only one call wins; a finished welcome returns the stored view with no write and no audit. A companion is not required: the parent may have skipped it.

Neither the two save commands nor the completion touch `setupStep`. The repository writes them through `updateWelcomePending` / `markWelcomeCompleted`, both bound to the parent's own id and tenant, and both only match a profile in the pending state, so a welcome that ends between the load and the write is reported as `learner.welcome_already_completed`. `ResetOnboarding` deletes the profile and, through the `ProgressEvent.childProfileId ... ON DELETE CASCADE` foreign key, its progress rows (see [`progression.md`](progression.md)); nothing else has to run. Migration `20261024T2329_add_child_welcome_and_progress_events` adds the column and the table.

The tutor catalog is the tutors module's checked-in catalog, read through `TutorCatalogPort` (`infrastructure/tutors/catalog-tutor-catalog.ts`, wired only in `composition.ts`) so the use cases stay free of that module.

## Views

`ChildProfileView = { id, displayName, federalState, grade, interests, tutorId, controls: { voiceEnabled, dailyLimitMinutes, allowedWindow, learningInsights }, guardianConfirmed, voiceConsent, setupStep, setupCompletedAt, welcomeCompletedAt }`. `guardianConfirmed` is true only for the current statement version, so a new version asks again. `voiceConsent` (`hasCurrentVoiceConsent`) is what the voice module reads: `voiceEnabled` and a confirmed current voice notice and a current guardian confirmation; the switch in the onboarding controls alone is not consent to speech-to-text. Tenant, owner and timestamps other than `setupCompletedAt` are not exposed.

## Dev reset

`ResetOnboarding` (command, `learner.delete`) exists so a developer or tester can run the parent setup again without touching the database: it deletes ALL of the signed-in parent's child profiles (finished or not) and nothing else. Tenant and owner come from the actor, never from input; another parent's rows are never reached. It is idempotent (0 rows is success) and answers with the number deleted.

It is development only, and the gate is in the backend, not just the UI. `composition.ts` sets `isDevResetAllowed` from the validated server config (`serverEnv.NODE_ENV !== 'production'`); `isDevResetAvailable()` is the same check for a page that decides whether to show the button. The use case authorizes first, then refuses with `learner.dev_reset_unavailable` (forbidden) without reading any data, so the answer does not reveal whether profiles exist. The audit event `learner.onboarding_reset` carries the deleted count only and is written only when something was deleted.

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
| `learner.voice_consent_changed`     | Every `SetVoiceConsent` that stored             | `allowed`, `noticeVersion` (`null` for a withdrawal)                                                                       |
| `learner.onboarding_reset`          | Only when the dev reset deleted rows            | `deletedCount` (no names, no ids)                                                                                          |
| `learner.setup_completed`           | Only for the call that wins the write           | ids                                                                                                                        |
| `learner.child_interests_saved`     | Only when the child changed the set             | `count` (not the values)                                                                                                   |
| `learner.child_tutor_chosen`        | Only when the child changed the choice          | `tutorId` (catalog data)                                                                                                   |
| `learner.child_welcome_completed`   | Only for the call that wins the write           | ids                                                                                                                        |

The onboarding's voice flag is part of `learner.controls_changed`; the parent's later speech-to-text decision is `learner.voice_consent_changed`. Wired in `composition.ts` with `withAuditTrail(..., { source: 'learner' })` (`TRAIL_BY_EVENT`, `LEVEL_BY_EVENT`; all `member`/`info`). Denials are audited by the authorization service.

## Screens and routing

`/onboarding` (`src/app/[locale]/(app)/onboarding`) is the parent's setup. The server decides where a visit starts from `GetOnboardingState`, so a parent who stopped halfway resumes at the stored step, and the browser never holds the only copy of what was saved. A screen is left only after the backend answered "saved"; "all set" appears only after `CompleteSetup` succeeded.

- `/home` calls `requireOnboarded()`: a parent whose setup is not finished is redirected to `/onboarding`, and one whose child has not done the welcome yet to `/hello`. Sign-in already lands on `/home`, so a new parent reaches onboarding after confirming the e-mail address and signing in, and a finished parent never sees it again.
- The onboarding page gives the flow a new key on every server render. The router keeps the state of a page the parent left, so without it a reset (or a second visit) could show the screen of the last visit, for example the finished "ready" screen, instead of the welcome.
- `/onboarding` calls `requireOnboarding()`: a finished parent is redirected to `/home`.
- `/hello` (`src/app/[locale]/(app)/hello`) is the child's one-time welcome and calls `requireChildWelcome()`: setup not done redirects to `/onboarding`, welcome done to `/home`, otherwise it returns the profile (`ChildProfileDto`). The Server Actions `saveChildInterestsAction`, `chooseChildTutorAction` and `completeChildWelcomeAction` (browser-safe through `@modules/learner/client`) persist the screens; the page navigates to `/home` only after the completion succeeded.

  The six screens share one look (`hello/_components`): `WelcomeShell` owns the scene, the round back button and the dots, `StepScene` + `StepButton` + `StepHero`/`SpeechBubble` lay out each screen (heading of at most three words, one bubble line, one huge bottom button). Interests are four star slots and big tiles; at four every free tile is dimmed (`aria-disabled`, a tap only shakes it) and tapping a chosen tile frees its star at once (`useInterestChoice`).

- All guards are navigation only. A failure to read the state reaches `error.tsx` instead of redirecting, so a database outage cannot cause a redirect loop.
- The Server Actions validate with Zod and call the use cases; the use cases authorize again and the domain validates again.
- The journey has seven screens (welcome, child, interests, companion, safety and settings, review, done). A wide screen shows Hort and the list of steps beside the card, a phone one progress bar above it. "Change" on the review returns to the review after saving, so a correction never means walking through every step again.
- The companions come from the checked-in tutor catalog (`@modules/tutors`): the page prepares them (`tutor-options.ts`) and passes them down, so presentation never imports another module. Their pictures and the spoken introduction are read from `STORAGE_PUBLIC_BASE_URL/tutors/<id>/` (`mund-zu.svg`, `mund-auf.svg`, `vorstellung.mp3`). The variable is set per environment (local, Vercel preview, production), so each environment reads its own public container; nothing is hardcoded. A missing picture shows an icon, and a missing sound disables the play button and says so. A companion is recommended when the child's interests match what it likes; nothing is preselected. The companions stand in a stage as picture cards that rise above its box on purpose (a tap makes one hop, the chosen one grows; only transforms and opacity animate, and calm mode turns it off); the chosen one is shown up close below it, with a speech bubble, and its spoken introduction (15 to 19 s, a stored MP3, no speech provider) plays only when the parent presses the button, with the chosen figure's mouth moving while it plays (the shared `Character` component does the lip sync: an uneven open/shut rhythm, always open with reduced motion). `Character` and `useCharacterVoice` are shared on purpose, so every other screen that shows a companion reuses them.
- Every control starts at its most private value (no voice, no limit, no window, no notes) and the guardian confirmation starts unticked. The "always on" list on the controls screen is plain text, not a switch: it states principles, not settings.
- Not part of onboarding on purpose: Alexa (the `alexa` module is a signed connection-test endpoint; it has no account linking, and `alexa/README.md` says a pairing code between a device and a child needs its own review). The controls screen says so in one sentence instead of showing a connect button that would not connect, an age field, free-text interests, linking to a class (#32).

The safety and settings step is grouped under headings (voice, learning time, notes for the summary, what always applies, the guardian's confirmation); each group is one bordered list with lines between rows, with no icons or tinted tiles, so the words and the switches carry it.

## Alexa step (placeholder)

The journey has an optional Alexa screen between the companion and the controls. It is a placeholder on purpose: there is no account linking yet (the `alexa` module is a signed connection-test endpoint, and `alexa/README.md` says a pairing between an Alexa account or device and a child needs its own privacy review). So the screen says "not available yet", the connect button is disabled, nothing is stored, and the setup never depends on it. A parent who reloads on this screen resumes at the controls (the stored step), which is fine for an optional step.

To build the real linking, replace the body of `presentation/hooks/use-alexa-linking.ts`; `AlexaStep` already draws the states (not connected, connected). Checklist:

1. Decide and review the coupling (what links an Alexa user to a parent and which child), then add the use cases (`GetAlexaLinkStatus`, `StartAlexaLinking`, `RemoveAlexaLink`) in the learner or alexa module with authorization, ownership, audit and a migration for the link.
2. Serve the OAuth account-linking endpoints the Alexa console needs (authorization and token) and register them in `alexa/skill-package/skill.json`.
3. `status` reads the link state, `connect` calls a Server Action that returns the Amazon authorization address and navigates there, `disconnect` removes the link and shows the real answer.
4. If the link must be part of the setup, add a step to `SETUP_STEPS` with a migration; today the screen is UI-only.

## Known gaps

- `dailyLimitMinutes` is stored, not enforced: nothing counts a child's usage yet. `isLearningAllowedNow` covers only the allowed window and nothing calls it yet. Do not present either as a working limit until the help session (#34) uses them.
- `learningInsights` is only stored until the parent summary (#35).
- The save order is not enforced on the server: a client can save the controls before choosing a tutor (the profile then reaches `review` with `tutorId = null`). Only the monotonic step and the `review` requirement of `CompleteSetup` are guaranteed.
- One child per parent: there is no list, edit or delete of finished profiles, and no way to change the controls after the setup finished, except the speech-to-text switch (`SetVoiceConsent`).
- A parent who finishes the setup in one request while another creates in the same instant can still end with a second profile; the unique index only guards unfinished profiles.
- A `guardianConsentVersion` bump asks a parent in the middle of the setup again, but a finished profile keeps its old confirmation: there is no re-consent flow yet.
