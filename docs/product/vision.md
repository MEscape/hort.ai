# Product vision

This document is the source of truth for what Hort.ai is. Issues, milestones and design reviews follow it. The [concept overview](flows.md) illustrates the intended experience; it is not binding and cannot add requirements. Engineering rules in [`docs/rules/`](../rules/README.md) take precedence over `AI_RULES.md`. It replaces the earlier learning-path idea (learning paths, streaks and interactive learning scenes), which is no longer part of the product. Only the small progression in Principles ([#64](https://github.com/MEscape/hort.ai/issues/64)) came back.

## What Hort.ai is

Hort.ai is an AI companion for primary-school children who need help with their homework or with preparing for a test, when their parents do not have the time to help.

The child works on a real task from school. Hort.ai supports from the outside: it helps the child understand the task, think it through and check their own answer. **Hort.ai never solves the task for the child.** It gives thinking prompts (Denkanstöße) and graduated hints, and the child does the work.

Hort.ai is not an exercise app. It does not offer its own exercises, lessons or learning content.

## Who it is for

| Role    | What they do                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Child   | Primary school, grades 1 to 4, in any German federal state. Talks to Hort.ai by text and, preferably, by voice while working on a task.                                                                                                                                                                                      |
| Parent  | Creates the child's profile (interests, companion, controls), links it to a class, and sees a short summary of where the child needed help.                                                                                                                                                                                  |
| Teacher | Creates a class and invites children with a code (valid for 14 days, a new code replaces it). May upload curriculum material and may post work assignments for the class. To manage a class, sees the display name and join date of its children; learning data only as aggregates for their own classes, never transcripts. |

## How a help session works

1. The child enters their homework task (typed or spoken) or picks an open assignment from their teacher.
2. Hort.ai asks a thinking prompt that helps the child understand the task.
3. When the child is stuck, they ask for a hint. Hints follow a ladder: understand the task, recall what you know, find the next step, a worked example on a similar but different problem. No level reveals the solution.
4. The child gives their own answer. Hort.ai assesses it (correct, partly correct, not yet). "Not yet" leads back to the hints, never to the solution.
5. Good work gets specific praise. Hort.ai then asks comprehension questions to make sure the child really understood it.
6. The session is saved, so the child can continue later.

When a teacher solution key exists, the backend checks the answer against it deterministically. Otherwise an AI assessment is only a proposal that the backend validates; it never decides on its own.

## Curriculum and teachers

- The AI is grounded in the real curriculum (Lehrplan) of the child's federal state and grade. The backend ingests the official curriculum documents and passes the relevant competencies to the AI as data.
- Teachers may upload their own material, which is used as additional grounding for their class.
- Teachers may post work assignments. These are always written by the teacher. Hort.ai never generates exercises or assignments, and the AI never writes or changes them. An optional solution key is used only by the backend and is never shown to the child.

## Companions

The child chooses one predefined companion: Max the dog, Lili the rabbit or Fina the dragon. Each combines appearance, personality and voice. The companion changes tone and wording only, never correctness, hint policy or safety rules.

## Learning events

The MVP records deduplicated learning events (competencies, attempts, hint levels, comprehension checks, completion) for the parent summary and the teacher view. Teachers see aggregates for their class only, never transcripts. Logs never contain raw child input or conversation content.

## Principles

- **Never the solution.** The rule is enforced in the backend: every AI text passes a solution-leak guard before the child sees it.
- **Backend is the source of truth** for sessions, hint levels, answers and roles. The AI only suggests wording; it never changes state.
- **AI output is untrusted** until it is validated against a fixed data contract. Invalid, unsafe or solution-revealing output is replaced with a safe fallback.
- **Child-safe and never punishing.** Mistakes are part of learning. No pressure, no ranking, no comparison with other children.
- **No pressure gamification.** Motivation comes from specific praise and from the child understanding their task. Decided in [#64](https://github.com/MEscape/hort.ai/issues/64) (the team must confirm): a small, gentle progression is allowed, nothing more. It is XP that only the backend grants for a confirmed event (a daily reward once per Berlin calendar day, later confirmed learning events), a handful of levels, and a companion whose look is derived from when the child was last there (relaxed, sleepy and then bored after some days away, with a short upbeat line such as "snack time?", happy to see the child again and cheerful at once after one feeding). It never takes anything away: no streaks, no loss for a missed day, no ranking, no comparison, no timers, no guilt or sad-companion messages: bored and sleepy looks are fine, sad, lonely or "missed you" are not. AI text never decides XP or levels.
- **Privacy.** Child profiles store a display name, federal state, grade, up to four interests from a fixed list, the chosen companion and the parent's controls (voice, learning window, daily limit, opt-in notes), when the child finished its welcome, and the XP ledger of the small progression (an amount and a reason per confirmed event), and nothing else: no surname, age, photo or free text. Extended for the onboarding in [#53](https://github.com/MEscape/hort.ai/issues/53); the team must confirm. Teachers see only the children in their own classes.
- **MVP focus.** One subject and grade range end to end before anything else. No overengineering.

## Out of scope for the MVP

- Exercises, lessons or learning content created by Hort.ai.
- Streaks, leaderboards, grading, loss of XP, and any reward beyond the small progression described under Principles.
- Photo or worksheet recognition (after the MVP).
- School administration integrations, a full subject library.
- Alexa beyond its development stage. Alexa is a second channel onto the same session and the same use cases, at development stage with one demo profile only ([alexa/README.md](../../alexa/README.md)); the team must confirm. No publication, no account linking, no real child profiles.

## After the MVP

- Interests and learning goals set by parents.
- A parent switch that turns storage off.
- Automatic recognition of emotions such as frustration.
- Several children sharing one device.
