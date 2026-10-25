# Parent area and dashboard

The parent area (`/parent`, `/parent/tasks/[taskId]`) is where a guardian sees the child's recorded tasks, the help used, teacher assignments, time settings, the companion and the privacy facts, and changes the adult settings. It answers the vision's promise of "a short summary of where the child needed help" ([vision](../product/vision.md)) without grades, comparisons or diagnoses.

## Access

The child and the parent share one signed-in account on the device, so a valid session alone opens nothing.

1. `requireSignedIn` (auth) and then `getParentAreaServices().require` on the server, in `ParentFrame`, before any child data is loaded. Without the proof the page renders only the password gate.
2. `OpenParentArea` re-verifies the account password through Better Auth (rate-limited like sign-in) and sets a signed, HttpOnly proof bound to the session token, valid for 5 minutes. Both outcomes are audited (`authentication.parent_area_opened`, `authentication.parent_area_open_failed`).
3. Every parent read and write in the learner module (`getParentLearnerServices`) rechecks that proof inside its `AuthorizationService`, then loads the profile by the actor's own id and tenant and checks the stored owner. Calling a server action or query directly without the proof fails the same way.
4. `CloseParentArea` ("Back to the child") revokes the proof at once. The child's Home and World have no dashboard content and no sign-out control.

## Data sources

`PrismaParentLearningRepository` is a read model over existing tables; it creates nothing and never selects text.

| Shown                  | Source                                                                  | Notes                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks and status       | `HelpSession` (`status`, `startedAt`, `updatedAt`, `endedAt`)           | Status is the current snapshot, not a history. No separate "paused" status is stored.                                                                                                                                                   |
| Subject                | `HelpSession.subject`                                                   | Recorded for every task when it starts.                                                                                                                                                                                                 |
| Title                  | `Assignment.title`                                                      | A task the child brought in has none; its own task text stays private.                                                                                                                                                                  |
| Curriculum topic       | `HelpSession.competencyCode` → `curriculumQueries.describeCompetencies` | Resolved in the app route (`describe-topics.ts`): learner must not import curriculum, which reaches learner through classroom. Official wording. `openTopicLabel` is derived from the child's own text and stays private.               |
| Hint count and ladder  | `HintEvent.level`                                                       | Only with "help-related notes" on.                                                                                                                                                                                                      |
| Own answers and checks | `ChildAnswer`, `AnswerAssessment.result`                                | Only with notes on. An unknown result value is ignored, never bucketed.                                                                                                                                                                 |
| Own-words explanations | `ComprehensionQuestion.repliedAt`                                       | Only with notes on. A reply is not judged for correctness (the backend only refuses non-answers), so it is shown as "explained in their own words", never as understanding or a passed check. See [help-sessions.md](help-sessions.md). |
| Assignments            | `Assignment` of the child's current active class, with sessions         | Overdue only with a due date before today (Berlin calendar).                                                                                                                                                                            |
| Help time today        | `getHelpSessionQueries().getTodayHelpMinutes` (guidance)                | Step gaps per session, each pause capped at 5 minutes, Berlin day; the same count the use cases enforce the daily limit against. A failed read shows "not available", never zero.                                                       |
| Settings               | `ChildProfile` controls                                                 | Daily limit, window and notes; voice has its own consent flow. Companion and interests are not editable here.                                                                                                                           |
| Companion and World    | progression ledger, tutor catalog, `worldIsland` art                    | Informational; no selection controls.                                                                                                                                                                                                   |

Reads are bounded (`PARENT_RECORD_LIMIT`, `PARENT_EVIDENCE_LIMIT` in `application/learner-limits.ts`). More records show a "partial" note; more evidence per task makes that evidence unavailable rather than an undercount.

## Metric definitions

Computed in `aggregateParentLearning` and tested in `__tests__/src/modules/learner/application/parent-learning.test.ts`.

- **Period**: today, the current week from Monday, or the last 30 days, as Berlin calendar days (23- and 25-hour days included). The current day is always partial and labelled so; no period is compared with another.
- **Task counts** by stored status; a task counts on the Berlin day it started.
- **Hint metrics** use only tasks with a known hint count (`insightTasks`); a task with notes off or truncated hints is left out of the denominator, never counted as zero.
- **Where help was needed**: per rung of the hint ladder, the number of tasks that used it at least once, drawn against `insightTasks`.
- **Own answers**: tasks with at least one own answer, and tasks with at least one answer checked as correct, both out of the tasks whose answers are known.
- **Topics explored** (`exploredTopics` in `parent-topics.tsx`): tasks per curriculum section (or statement, when the curriculum has no section), grouped by subject; tasks without a described topic are counted separately, never guessed.

## Deliberately not shown

- A day-by-day history of help time: only today's measured minutes are available (`getTodayHelpMinutes`).
- Practice suggestions, try-at-home ideas and trends: there is no reviewed recommendation source and no agreed comparison method, and a topic seen once is not a practice need. Each shows an explicit unavailable state. A radar chart was rejected: there are no comparable, defensible skill dimensions.
- Transcripts, task text, answers, hint wording, photos, audio and safety disclosures. No safeguarding policy authorizes showing them to a parent.
- Deletion and export: not implemented, and the privacy section says so instead of offering a button. Retention periods are undefined; the specification leaves them to product and legal review.
