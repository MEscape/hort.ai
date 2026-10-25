# Progression

A child's small, non-punishing progress: XP, a level out of six, one daily reward and the companion's mood. Introduced with the child onboarding (issue #64); the product decision is recorded in [`../product/vision.md`](../product/vision.md). Module: `src/modules/progression`.

## Hard rules

- XP comes only from events the backend confirmed. Never from AI text, never for opening or refreshing a screen. The UI animation reacts to a result the backend already returned and never decides anything.
- No streaks, no ranking, no comparison, no timers. A missed day removes nothing and damages nothing; the ledger is append-only and nothing in it is negative.
- A companion that was not visited for some days looks relaxed, sleepy or bored (a face overlay with lowered lids, a yawn, a thought bubble with its food), never sad. No copy says it is sad, lonely, missed the child or needs them; the lines are short and upbeat ("Snack time?"). Nothing is lost at any level and one feeding makes it cheerful again at once.
- No new personal data. Audit events carry ids, counts and codes, never a name.

## Data

One table, `ProgressEvent` (owned by `prisma/schema.prisma`, migration `20261024T2329_add_child_welcome_and_progress_events`): one row per confirmed reward `(childProfileId, kind, eventKey, xp, occurredAt)` with tenant and owner. The child's XP is the SUM of its rows, so there is one source of truth; level and mood are derived when read and never stored. `UNIQUE(childProfileId, eventKey)` is the idempotency guard; `xp` is checked to lie in 1..100; rows go only with their profile (`ON DELETE CASCADE`, which also covers the development reset of the onboarding).

## Rules (domain, pure and tested)

| Rule            | Value                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Levels          | `LEVEL_THRESHOLDS = [0, 20, 50, 90, 140, 200]`, `MAX_LEVEL = 6`. `levelOf(xp)` gives level, XP into the level, the size of the level (`xpForNextLevel`, `null` at the top) and the fraction (`1` at the top).                                                           |
| Daily reward    | `DAILY_REWARD_XP = 5`, key `daily:<YYYY-MM-DD>`.                                                                                                                                                                                                                        |
| Learning events | `LEARNING_EVENT_XP = { help_session_completed: 10, comprehension_check_passed: 5 }`. The event KIND decides the amount; a caller can pass no number. Stored key `learning:<callerKey>`.                                                                                 |
| Day             | The `Europe/Berlin` calendar day (`dayKeyOf`), read through `Intl`, so the 25 hour and 23 hour days of the daylight saving changes are right. `daysBetween` counts calendar days of two day keys.                                                                       |
| Companion mood  | `companionMoodOf({ lastEventAt, now })`: returns `{ mood, boredomLevel, daysAway }`: no event ever `new` (level 0); same Berlin day `cheerful` (0); 1 day `calm` (1); 2 days `sleepy` (2); 3 days `bored` (3); 4 or more `bored` (4). Calendar days, not 24 hour spans. |

A caller's learning key is 1 to 55 characters of `[A-Za-z0-9:_-]`: the `learning:` prefix takes 9 of the 64 characters the column holds, and the prefix keeps the two key spaces apart.

## Use cases

All authorize first (`requireInTenant`, then ownership of the child), take no tenant, owner or role from input, and answer another parent's child exactly like an unknown id (`progression.not_found`) without reading or writing anything.

- `GetProgress { childProfileId }` (query, `progression.read`): the `ProgressView`. Writes nothing.
- `ClaimDailyReward { childProfileId }` (command, `progression.daily_reward`): one insert under `daily:<Berlin day of now>`; `granted` or `already_claimed`, `leveledUp` (true only for the call that crossed a threshold) and the new progress. The unique index decides, so two claims at once still grant once; no read-then-write.
- `AwardLearningXp { childProfileId, event, eventKey }` (command, `progression.update`): the idempotent entry point for XP from learning events (`granted` or `duplicate`). No caller exists yet; the help sessions (#34) will be the first. Not exposed as a Server Action.

Time comes from the `Clock` port. Audit events (`progression.daily_reward_claimed` `{xp, level}`, `progression.xp_awarded` `{event, xp, level}`) are written only when a row was inserted. None of the use cases is rate limited: each is owner-scoped, idempotent and bounded by the unique key, so repeating a request changes nothing.

## Ownership across modules

The child profile belongs to the learner module. `ChildAccessPort` (domain) answers "does the signed-in parent own this child"; `infrastructure/children/learner-child-access.ts` implements it through the learner module's public API (`getLearnerQueries().getOnboardingState`, which lists the signed-in parent's own profiles), wired in `composition.ts`. The adapter's shortcut: the learner module has one profile per parent in the MVP, so ownership is "the id is that profile"; replace it with a lookup by id when several children are supported. `ProgressEvent` rows additionally store tenant and owner, and every repository query is bound to tenant, owner and child.

## Presentation

`presentation/dto/progress-dto.ts` (`ProgressDto`, `ClaimDailyRewardDto`; the instant travels as ISO text), `claimDailyRewardAction(input: unknown)` (input `{ childProfileId }`, Zod-validated), `loadProgressDto(childProfileId)` for pages (a failure throws and reaches `error.tsx`). `client.ts` is browser-safe (the action, DTO types, `MAX_LEVEL`, error codes and the components); `index.ts` is the server API.

### Feeding the companion

The daily reward is a small care game, the same on the welcome (step 5, `RewardsStep`) and on the home (`CompanionCard`); both use `useFeedGame` and `FeedStage`. The companion is hungry; its treat (a bone for Max, a carrot for Lili, a fire-gem for Fina, an apple for anyone else; inline SVG in `presentation/components/food`) sits on a plate. The child drags it to the mouth OR taps it (a native button, so Enter and Space work too): both end in the one real `claimDailyRewardAction`, called only once the food has reached the mouth. Pending: the mouth is open and the food waits there. `granted`: chewing, hearts, a star flies into the level meter, the meter and level come from the answer, a burst only if the server said `leveledUp`. `already_claimed` (or fed earlier today): a content companion, no food, a quiet "see you tomorrow". A failure sends the food back to the plate with a short message and a retry. The motion only draws what the server decided; calm mode and reduced motion skip the flight, the hearts and the chewing and keep the words, the meter and the happy eyes. Nothing counts down and a missed day costs nothing.

The companion's face (`CompanionAvatar`) uses the shared face overlay (`Character` `face` and `expression`, `useCharacterExpression`): lids, a slump, yawns and drifting eyes by `boredomLevel`, and a thought bubble with its treat at level 4. Where the mouth is comes from the tutors' face data (`face.mouth`, measured on the drawings), through `CompanionVisual.face`.

## Errors

`progression.not_found`, `progression.validation_failed`, `progression.persistence_failed`; field codes `progression.validation.id_invalid`, `.event_invalid`, `.event_key_invalid`. Permissions `progression.read`, `progression.update` and `progression.daily_reward` are held by the parent (and the platform admin) like `learner.*`; the Alexa child channel holds `progression.read` and `progression.daily_reward` only, never learning XP. The audit trail source is `progression`.

## Tests

`__tests__/src/modules/progression`: domain rules (including the Berlin day boundaries and the 2026-10-25 change), the use cases against an in-memory ledger (idempotency, concurrency, ownership, no negative or lost XP, missed days), the action, the audit trail and the learner adapter. The Prisma repository has an integration test against Postgres (`*.integration.test.ts`); it needs the migration above applied.
