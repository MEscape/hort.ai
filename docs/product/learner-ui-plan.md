# Learner UI plan: the help screen

The child-facing part of Hort.ai: from choosing a task to understanding it. Read the [product vision](vision.md) first; this plan only maps its help session to screens, backend capabilities and issues. The calls and their types are in the [help session contract](../architecture/help-session-contract.md). Status: plan, 2026-10-25.

## Guardrails

- The child's own task, or a task their teacher wrote, is the only content. Hort.ai shows no exercises of its own.
- No screen ever shows the solution. Every hint, praise and question comes from the backend, already validated, or is the predefined text of its kind.
- Asking for a hint is never failure; a wrong answer is "not yet", never a loss. No timers, no scores, no ranking.
- The chosen companion (Max, Lili or Fina) appears at the edge of the screen while it guides and steps back while the child works alone. It never covers the task or the answer field.
- The backend holds the session. After a reload the screen shows what the backend returns.

## Screens and states

| #   | Screen or state                         | What the child does and sees                                                                                                                        | Backend capability                                                                | Provided by                         |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Start                                   | Three choices: my task, tasks from my teacher, continue.                                                                                            | `getOpenHelpSessionAction` decides whether "continue" is offered                  | #12 (start screen from PR #40), #17 |
| 2   | Enter a task                            | Types or dictates the task and picks the subject.                                                                                                   | `startHelpSessionAction` with task and subject; voice input through #34           | #17, #34                            |
| 3   | Pick a teacher task                     | Sees the open assignments of their class and picks one. No solution key is ever sent to the browser.                                                | assignment list (child view); a session started from the assignment (follows #33) | #33 (PR #74), #17                   |
| 4   | Help screen                             | The task stays visible. The companion appears with the first thinking prompt (rung 1). Two actions: "I need a hint" and "My answer".                | `requestHintAction` for rung `understand_task`                                    | #30                                 |
| 5   | Hint ladder                             | Each new hint is one small step: understand the task, what you already know, the next step, a similar example. A quiet step indicator, not a score. | `requestHintAction`; the backend picks the rung from the session                  | #30, guarded by #31                 |
| 6   | Give an answer                          | Types or says their own answer.                                                                                                                     | `checkAnswerAction`                                                               | #14 (PR #81), #30                   |
| 7a  | Correct: praise and question            | Specific praise, then one comprehension question; the companion asks it.                                                                            | `AnswerFeedbackDto` with `result: 'correct'`                                      | #14                                 |
| 7b  | Partly correct, not yet, not assessable | An encouraging line, then back to the help screen with the hint button.                                                                             | `AnswerFeedbackDto` with `next: 'hint_ladder'`                                    | #14                                 |
| 8   | Reply to the question                   | Answers the comprehension question in their own words.                                                                                              | `replyComprehensionAction`; "understood" decided by `isTaskUnderstood`            | #78                                 |
| 9   | Understood                              | A warm closing; the companion leaves. Any XP shows only after the backend granted it.                                                               | session `understood`; `AwardLearningXp` (`help_session_completed`)                | #78, #64                            |
| 10  | Safe fallback                           | The predefined prompt or praise of the same kind, in the same look. The child cannot tell it from an AI text.                                       | `kind: 'fallback'` / `'predefined'` in the responses                              | #10, #11, #31                       |
| 11  | Pause and errors                        | A calm line for a used budget (no countdown), a retry for infrastructure errors, the typed text always kept.                                        | `ActionResult` error codes                                                        | #11, contract                       |
| 12  | Continue later                          | "Continue" opens the last unfinished task with its hints, or the open comprehension question.                                                       | `getOpenHelpSessionAction`                                                        | #17                                 |

Shared building blocks: the components in `src/components/ui` and `src/components/shared` and the tokens in the design system (#38, #20). The companion figures come from the tutors module, the same ones as in the onboarding.

## Proposed order

1. **This contract** is merged, so backend and UI build against one shape.
2. **UI against fakes** (#12): screens 4 to 7 and 10 with a fake implementation of the contract's types. Needs no backend and can start now.
3. **Check answer** (#14, PR #81) is merged; it already returns `AnswerFeedback`.
4. **Help sessions** (#17): start, open session, the session id that hint and answer calls use, and retry dedup.
5. **Hint ladder and actions** (#30): the rung chosen from the session, `requestHintAction` and `checkAnswerAction` as Server Actions.
6. **Solution-leak guard** (#31) in parallel with 4 and 5; it changes no UI, only which texts fall back.
7. **Wire the UI** to the real actions; screens 1 to 3 and 12 (start, own task, teacher task, continue).
8. **Comprehension reply** (#78): screens 8 and 9.
9. **Demo check** of the whole flow in a real browser, German and English, mobile, reduced motion (`demo-flow-qa`).

Steps 2, 4 and 6 can run at the same time. Step 7 waits for 4 and 5.

## Not in this plan

Photo recognition, Alexa, frustration detection, several children on one device, and anything beyond the small progression of #64.
