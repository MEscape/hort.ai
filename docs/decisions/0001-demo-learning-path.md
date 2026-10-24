# 0001: Demo learning path and learning goal

- Status: accepted
- Date: 2026-10-24
- Issue: [#5](https://github.com/MEscape/hort.ai/issues/5), part of epic [#2](https://github.com/MEscape/hort.ai/issues/2)
- Builds on this: data contract [#6](https://github.com/MEscape/hort.ai/issues/6), data model [#8](https://github.com/MEscape/hort.ai/issues/8), welcome screen [#12](https://github.com/MEscape/hort.ai/issues/12), scene [#13](https://github.com/MEscape/hort.ai/issues/13), evaluation [#14](https://github.com/MEscape/hort.ai/issues/14), next step [#16](https://github.com/MEscape/hort.ai/issues/16)

## Context

The MVP needs exactly one learning path that works end to end. Without a fixed subject, concept and age group, neither the scene nor the evaluation nor the data contract can be built. The concept must allow deterministic evaluation in the backend, so the AI only words explanations, hints and feedback and never decides whether an answer is correct.

## Decision

### Subject, concept and age group

| Item       | Choice                                         |
| ---------- | ---------------------------------------------- |
| Subject    | Mathematics                                    |
| Concept    | Addition of two quantities with a sum up to 10 |
| Age group  | 6 to 7 years (first grade)                     |
| Language   | German (child-facing copy)                     |
| Path id    | `math-addition-to-10`                          |
| Concept id | `addition-up-to-10`                            |

**Learning goal (one sentence):** The child can combine two small groups of objects and name the total up to 10.

Child-facing wording of the goal: „Ich kann zwei kleine Mengen zusammenzählen und sagen, wie viele es zusammen sind.“

Why this concept: answers are single integers, so evaluation is exact and cannot be gamed by AI wording; the concept is visual by nature; and it is part of every first-grade curriculum.

### Scene type

The interactive explanation uses the scene type **`counting-objects`**: two groups of identical objects (apples in two baskets) are shown. The child moves each apple into one shared basket by tapping it (or focusing it and pressing Enter or Space), and a counter shows how many are in the shared basket. Dragging is optional, never required. The child then answers with a number pad showing 0 to 10.

Parameters the scene needs (the allowed types and bounds are fixed in the data contract, #6):

| Parameter    | Meaning                         | Bounds for the demo  |
| ------------ | ------------------------------- | -------------------- |
| `object`     | Object shown, from an allowlist | `apple` only for MVP |
| `leftCount`  | Objects in the first group      | integer 1 to 5       |
| `rightCount` | Objects in the second group     | integer 1 to 5       |

The sum `leftCount + rightCount` is never above 10. The scene never decides correctness; it only sends the child's chosen number to the server as the answer.

### Tasks

The path has four tasks in a fixed order, from small to larger sums. The expected answer is always derived from the task parameters (`leftCount + rightCount`), so it never comes from the AI.

| #   | Task id   | Scene          | Prompt (child-facing)                                                    | Expected answer |
| --- | --------- | -------------- | ------------------------------------------------------------------------ | --------------- |
| 1   | `add-2-3` | 2 and 3 apples | „Im linken Korb sind 2 Äpfel, im rechten 3. Wie viele sind es zusammen?“ | 5               |
| 2   | `add-4-2` | 4 and 2 apples | „Im linken Korb sind 4 Äpfel, im rechten 2. Wie viele sind es zusammen?“ | 6               |
| 3   | `add-3-4` | 3 and 4 apples | „Im linken Korb sind 3 Äpfel, im rechten 4. Wie viele sind es zusammen?“ | 7               |
| 4   | `add-5-5` | 5 and 5 apples | „In beiden Körben sind 5 Äpfel. Wie viele sind es zusammen?“             | 10              |

Each task has two graded hints. Hint 1 is shown after the first answer that is not correct yet, hint 2 after the second. The predefined texts below are also the safe fallback when AI wording is missing or rejected (#10, #11).

| Task      | Hint 1                                                         | Hint 2                                                         |
| --------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `add-2-3` | „Leg alle Äpfel in einen Korb und zähl sie dann nacheinander.“ | „Fang bei 3 an und zähl 2 weiter: 4, 5.“                       |
| `add-4-2` | „Tipp jeden Apfel an, damit er in den großen Korb rollt.“      | „Fang bei 4 an und zähl 2 weiter: 5, 6.“                       |
| `add-3-4` | „Zähl zuerst die Äpfel im linken Korb, dann zählst du weiter.“ | „Fang bei 4 an und zähl 3 weiter: 5, 6, 7.“                    |
| `add-5-5` | „Wie viele Finger hast du an beiden Händen zusammen?“          | „5 und 5 sind so viele wie deine Finger an beiden Händen: 10.“ |

### Evaluation

Evaluation is deterministic in the backend (#14). An answer is an integer from 0 to 10; anything else is rejected as invalid input before evaluation.

| Outcome             | Rule                                                               | What the child gets                                    |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `correct`           | answer equals `leftCount + rightCount`                             | praise, the step is completed                          |
| `partially-correct` | answer equals `leftCount` or `rightCount` (only one group counted) | encouragement to count the other basket too, try again |
| `not-correct-yet`   | any other integer                                                  | the next hint, try again                               |

Rules that apply to every outcome:

- Feedback is never punishing, and a wrong answer never removes XP.
- XP is awarded only once per completed task, whatever the number of attempts (#15).
- After the second hint, the child may keep trying. A third answer that is not correct yet shows the solution with the scene counting along, and the step counts as completed with help. This keeps the flow from becoming a dead end. How a completion with help is rewarded is decided in #15.

Example feedback texts (fallbacks when AI wording is missing or rejected):

- correct: „Super gemacht! Es sind zusammen {total} Äpfel.“
- partially correct: „Fast! Du hast einen Korb gezählt. Zähl jetzt die Äpfel im anderen Korb dazu.“
- not correct yet: „Das ist noch nicht ganz richtig. Probier es mit diesem Tipp noch einmal.“

### Learning paths in the MVP

| Path                               | MVP status  | Behaviour                                                                                                  |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Neues lernen (Learn something new) | works       | starts the demo path `math-addition-to-10` at task 1                                                       |
| Weiterlernen (Continue learning)   | works       | resumes the demo path at the first open task (#17); hidden or disabled when there is no saved progress yet |
| Entdecken (Explore)                | placeholder | shown with a friendly "Kommt bald" label, cannot be started (#12)                                          |

After the last task, the next-step recommendation (#16) offers repeating the path or taking a break; there is no second concept in the MVP.

## Consequences

- The data contract (#6) only needs the scene type `counting-objects` with the parameters above. Every other scene type and parameter is rejected.
- The data model (#8) stores progress per path id and step results per task id, using the ids defined here.
- Task definitions, expected answers, hints and fallback texts are fixed backend content. The AI may only reword explanations, hints and feedback, and that wording is validated before use.
- Adding a second concept later means adding a new path definition, not changing the evaluation rules.

## Open questions

- The i18n configuration still uses `en` as `defaultLocale`, while #7 asks for German as the default. The demo content is German; switching the default locale belongs to #7, not to this decision.
- Whether a step completed with help (after the solution is shown) awards full, reduced or no XP is decided in #15.
