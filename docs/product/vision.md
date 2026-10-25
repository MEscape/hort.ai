# Product vision

This document is the source of truth for what Hort.ai is. Issues, milestones and design reviews follow it. The [concept overview](flows.md) illustrates the intended experience; it is not binding and cannot add requirements. Engineering rules in [`docs/rules/`](../rules/README.md) take precedence over `AI_RULES.md`. It replaces the earlier learning-path idea (learning paths and streaks), which is no longer part of the product. Only the small progression in Principles ([#64](https://github.com/MEscape/hort.ai/issues/64)) came back, and interactive scenes came back as the main interface (see [The canvas](#the-canvas)).

Canvas-first (draft requirement R-021) was decided by the product owner on 2026-10-25; the team must confirm.

## What Hort.ai is

Hort.ai is an AI companion for primary-school children who need help with their homework or with preparing for a test, when their parents do not have the time to help.

The child works on a real task from school. Hort.ai supports from the outside: it helps the child understand the task, think it through and check their own answer. **Hort.ai never solves the task for the child.** It gives thinking prompts (Denkanstöße) and graduated hints, and the child does the work.

Hort.ai is canvas-first. It explains on a full-screen canvas with interactive scenes, and the child answers by touching, dragging, choosing or speaking. It is not a chat app.

Hort.ai is not an exercise app with its own library. Besides homework help it offers only a few short canvas lessons and island practice rounds, both from templates written by the team (see [Canvas lessons](#canvas-lessons)). The AI never writes exercises, lessons or learning content.

## Who it is for

| Role    | What they do                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Child   | Primary school, grades 1 to 4, in any German federal state. Works on the canvas by touch and, preferably, by voice; can type in the optional "Schreiben" panel.                                                                                                                                                              |
| Parent  | Creates the child's profile (interests, companion, controls), links it to a class, and sees a short summary of where the child needed help.                                                                                                                                                                                  |
| Teacher | Creates a class and invites children with a code (valid for 14 days, a new code replaces it). May upload curriculum material and may post work assignments for the class. To manage a class, sees the display name and join date of its children; learning data only as aggregates for their own classes, never transcripts. |

## The canvas

- The AI explains by composing an interactive scene on a full-screen canvas from approved templates with validated parameters.
- The child answers in the scene by touching, dragging or choosing, or by speaking.
- Chat is not the main interface. "Schreiben" is an optional side panel for typing. It is shown when voice is unavailable or when the child or a parent opens it.
- The AI only selects an approved template and fills bounded parameters. The backend validates them and decides what the child sees. Unknown templates or parameters out of range are rejected and replaced with a safe fallback.
- No generated code, layout or art at runtime. Every template and asset is made by the team.

## How a help session works

1. The child asks their homework question directly on Home (spoken or typed) or picks an open assignment from their teacher. There is no separate start page; the child lands on the canvas.
2. Hort.ai asks a thinking prompt that helps the child understand the task.
3. When the child is stuck, they ask for a hint. Hints follow a ladder: understand the task, recall what you know, find the next step, a worked example on a similar but different problem. No level reveals the solution.
4. The scene shows a similar example with different numbers, never the child's own task. The child works the example on the canvas and then solves their own task themselves.
5. The child gives their own answer. Hort.ai assesses it (correct, partly correct, not yet). "Not yet" leads back to the hints, never to the solution.
6. Good work gets specific praise. Hort.ai then asks comprehension questions to make sure the child really understood it.
7. The session is saved, so the child can continue later.

When a teacher solution key exists, the backend checks the answer against it deterministically. Otherwise an AI assessment is only a proposal that the backend validates; it never decides on its own.

## Canvas lessons

- A few short lessons, written by the team, run on the canvas and are complete without AI. The vertical slice is comparing fractions on bridges for grades 3 and 4.
- Their content and answer checks are fixed; the backend checks answers deterministically.
- They are also the fallback when an AI call fails.
- **Island practice** (decided by the team on 2026-10-25): on an island the child has cleared with real homework, a place with a team-written template (Zahlenwald: counting on, plus, minus, tens; Malmühle: times and sharing) offers short practice rounds on the canvas. The backend fills in the numbers within the child's grade, a little further each solved round, and checks the answer deterministically. The AI never writes the question or decides the answer. A place without a template offers homework help only.

## Curriculum and teachers

- The AI is grounded in the real curriculum (Lehrplan) of the child's federal state and grade. The backend ingests the official curriculum documents and passes the relevant competencies to the AI as data.
- Teachers may upload their own material, which is used as additional grounding for their class.
- Teachers may post work assignments. These are always written by the teacher. The AI never generates exercises or assignments, and never writes or changes them. An optional solution key is used only by the backend and is never shown to the child.

## Companions

The child chooses one predefined companion: Max the dog, Lili the rabbit or Fina the dragon. Each combines appearance, personality and voice. The companion changes tone and wording only, never correctness, hint policy or safety rules.

## Learning events

The MVP records deduplicated learning events (competencies, attempts, hint levels, comprehension checks, completion) for the parent summary and the teacher view. Teachers see aggregates for their class only, never transcripts. Logs never contain raw child input or conversation content.

## Principles

- **Never the solution.** The rule is enforced in the backend: every AI text and every scene passes a solution-leak guard before the child sees it.
- **Backend is the source of truth** for sessions, hint levels, answers, scenes and roles. The AI only suggests wording, a template and its parameters; it never changes state.
- **AI output is untrusted** until it is validated against a fixed data contract. Invalid, unsafe or solution-revealing output is replaced with a safe fallback.
- **Child-safe and never punishing.** Mistakes are part of learning. No pressure, no ranking, no comparison with other children.
- **No pressure gamification.** Motivation comes from specific praise and from the child understanding their task. Decided in [#64](https://github.com/MEscape/hort.ai/issues/64) (the team must confirm): a small, gentle progression is allowed, nothing more. It is XP that only the backend grants for a confirmed event (a daily reward once per Berlin calendar day, later confirmed learning events), a handful of levels, and a companion whose look is derived from when the child was last there (relaxed, sleepy and then bored after some days away, with a short upbeat line such as "snack time?", happy to see the child again and cheerful at once after one feeding). It never takes anything away: no streaks, no loss for a missed day, no ranking, no comparison, no timers, no guilt or sad-companion messages: bored and sleepy looks are fine, sad, lonely or "missed you" are not. AI text never decides XP or levels. The island world may veil an island the child has not done homework on yet in a light mist that clears for good with the first real, classified homework there; an island in the mist cannot be entered until then (decided by the team on 2026-10-25, [`world.md`](../architecture/world.md#discovery)). Homework itself is never locked, and nothing is counted or taken away.
- **Privacy.** Child profiles store a display name, federal state, grade, up to four interests from a fixed list, the chosen companion and the parent's controls (voice, learning window, daily limit, opt-in notes), when the child finished its welcome, and the XP ledger of the small progression (an amount and a reason per confirmed event), and nothing else: no surname, age, photo or free text. Extended for the onboarding in [#53](https://github.com/MEscape/hort.ai/issues/53); the team must confirm. Teachers see only the children in their own classes.
- **MVP focus.** One subject and grade range end to end before anything else. No overengineering.

## Out of scope for the MVP

- Exercises, lessons or learning content written or generated by the AI, and lessons beyond the few short canvas lessons written by the team.
- Code, layouts or art generated at runtime.
- Streaks, leaderboards, grading, loss of XP, and any reward beyond the small progression described under Principles.
- Photo or worksheet recognition (after the MVP).
- School administration integrations, a full subject library.
- Alexa beyond its development stage. Alexa is a second channel onto the same session and the same use cases, at development stage with one demo profile only ([alexa/README.md](../../alexa/README.md)); the team must confirm. No publication, no account linking, no real child profiles.

## After the MVP

- Interests and learning goals set by parents.
- A parent switch that turns storage off.
- Automatic recognition of emotions such as frustration.
- Several children sharing one device.
