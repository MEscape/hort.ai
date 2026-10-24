# Product vision

This document is the source of truth for what Hort.ai is. Issues, milestones and design reviews follow it. The [concept overview](flows.md) illustrates the intended experience; it is not binding and cannot add requirements. Engineering rules in [`docs/rules/`](../rules/README.md) take precedence over `AI_RULES.md`. It replaces the earlier learning-path idea (learning paths, XP, streaks and interactive learning scenes), which is no longer part of the product.

## What Hort.ai is

Hort.ai is an AI companion for primary-school children who need help with their homework or with preparing for a test, when their parents do not have the time to help.

The child works on a real task from school. Hort.ai supports from the outside: it helps the child understand the task, think it through and check their own answer. **Hort.ai never solves the task for the child.** It gives thinking prompts (Denkanstöße) and graduated hints, and the child does the work.

Hort.ai is not an exercise app. It does not offer its own exercises, lessons or learning content.

## Who it is for

| Role    | What they do                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Child   | Primary school, grades 1 to 4, in any German federal state. Talks to Hort.ai by text and, preferably, by voice while working on a task.                                                      |
| Parent  | Creates the child's profile (interests, companion, controls), links it to a class, and sees a short summary of where the child needed help.                                                  |
| Teacher | Creates a class and invites children with a code. May upload curriculum material and may post work assignments for the class. Sees aggregates for their own classes only, never transcripts. |

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
- **No gamification.** No XP, streaks or rewards. Motivation comes from specific praise and from the child understanding their task.
- **Privacy.** Child profiles store a display name, federal state, grade, up to four interests from a fixed list, the chosen companion and the parent's controls (voice, learning window, daily limit, opt-in notes), and nothing else: no surname, age, photo or free text. Extended for the onboarding in [#53](https://github.com/MEscape/hort.ai/issues/53); the team must confirm. Teachers see only the children in their own classes.
- **MVP focus.** One subject and grade range end to end before anything else. No overengineering.

## Out of scope for the MVP

- Exercises, lessons or learning content created by Hort.ai.
- XP, streaks, rewards, leaderboards and grading.
- Photo or worksheet recognition (after the MVP).
- School administration integrations, Alexa, a full subject library.

## After the MVP

- Interests and learning goals set by parents.
- A parent switch that turns storage off.
- Automatic recognition of emotions such as frustration.
- Several children sharing one device.
