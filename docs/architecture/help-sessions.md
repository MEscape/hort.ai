# Help sessions

How the guidance module stores a child's work on one task, so the child can continue later (#17) and an answer counts as understood only on stored evidence (#78). The backend is the only source of this state; screens get views built from it on every request.

## Model

One `HelpSession` per task, owned by the child's guardian (`tenantId`, `ownerId`) and the child (`childProfileId`). It keeps the task text (the child's own, or a teacher's assignment text with its `assignmentId`), the subject that grounds its hints, the rung of the hint ladder it is on (`currentHintLevel`) and a `version` that every step increments. Its steps are child rows:

| Step                   | Row                                | Notes                                                                                         |
| ---------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Hint given             | `HintEvent`                        | The validated AI text, or no text and the `fallbackReason` of the predefined prompt.          |
| Answer checked         | `ChildAnswer` + `AnswerAssessment` | Result (or none: not assessable), who decided it, the hint level at the time, validated text. |
| Comprehension question | `ComprehensionQuestion`            | Asked after a correct answer only; the child's reply is stored on the same row, once.         |

An answer, its assessment and its question share the request id of the check (`idempotencyKey`), which pairs them when the session is read back.

## Rules

- **One open session per child.** A partial unique index (`HelpSession_one_active_per_child`) allows one `ACTIVE` session per child. Starting the same task (same text after normalization, same subject) while it is open continues it, so a retried start creates nothing. Another task ends the open one as `ABANDONED` and starts a new one in the same transaction. Two starts at once: the loser's insert hits the index and it returns the winner's session.
- **Every step is stored once.** A step carries the caller's request id; `(sessionId, idempotencyKey)` is unique. A repeat hits the index, the transaction rolls back, and the outcome is `duplicate`: nothing changes, not even `updatedAt`.
- **Steps only in an active session.** Every step first locks the session with `UPDATE … WHERE id, tenantId, ownerId, childProfileId, status = 'ACTIVE'`. An ended session, another parent's or another child's, is `guidance.session_not_found`, exactly like a missing one.
- **The hint level of a check comes from the store**, read under that lock, never from the caller.
- **Understood is decided by the backend.** `isTaskUnderstood` holds only when the stored result is `correct` and the reply to the question that followed it is stored. The reply completes the session (`COMPLETED`), so "Continue" no longer offers it. The client never sends "understood".
- **Nothing punishing is stored.** There is no score, no count of wrong answers and no XP here; a "not yet" is one row among the steps. XP for confirmed learning events stays with the progression module.

## Use cases

All use `hint.request`, the guardian's guidance permission, and ask the learner module whether the child is theirs before any session is read. None calls a provider. Starting spends the child's `guidance.session-start` budget (30 in 10 minutes, denied when the limiter's store is down), because each new task stores a session and abandons the open one; reading spends none, and a reply follows only a checked answer, which the answer budget bounds. The Server Actions over these use cases are listed in the [help session contract](help-session-contract.md).

- `StartHelpSession { childProfileId, task, subject }` or `{ childProfileId, assignmentId, subject }`: `started` or `continued`, with the session view. See "Sessions on a teacher's assignment" below.
- `GetOpenHelpSession { childProfileId }`: the open session's view for "Continue", or `null`.
- `ReplyToComprehensionQuestion { childProfileId, sessionId, reply }`: the reply is checked like any child input (`parseChildTaskText`); `guidance.no_open_question` when no question waits for it. Answers `understood` when it completed the task.

`HelpSessionRepository` extends the hint ladder's `HintSessionStore` (#30): `RequestHint` and `CheckAnswer` load the ladder state and record hints and answer checks through the same Prisma repository (`load`, `recordHint`, `recordAnswerCheck`), wired in `composition.ts`.

## Sessions on a teacher's assignment (#33)

A child can work on an assignment their teacher posted for the class. The software never writes or changes it, and the AI never solves it.

- **Membership is checked by the backend.** `StartHelpSession` with an `assignmentId` first confirms the child is the parent's own (learner module), then asks the assignments module (`GetAssignmentForHelp`, through the `AssignmentAccess` port, adapter `infrastructure/assignments`). That query authorizes the parent on the child (`learner.read`), reads the child's current class from the classroom module and finds the assignment only in that class. Another class's assignment, a deleted one, or any assignment while the child is in no class is `guidance.assignment_not_found`; nothing is stored.
- **The task text comes from the assignment**, never from the client; a `task` sent along is ignored. It is checked like child input but with the assignment's bound (4,000 characters, `parseAssignmentTaskText`), and stored as the session's task. The same assignment again continues the open session, even if the teacher edited its text in the meantime.
- **The solution key is never stored in a session.** Every hint and every answer check reads it anew through the same query, so membership is checked on each step and a key the teacher changed applies at once. `HintOrchestrator.suggest` gets it as its second argument for the leak guard (#31); `AnswerCoach` decides the result against it (`assessedBy: 'solution_key'`, #14). It never goes to the AI, into a view, a log or an audit event.
- **No key, still help.** If the key cannot be read during a step (the child left the class, the assignment was deleted, the store failed), the step goes ahead without it: the AI assesses, the leak guard checks the known patterns. `guidance.solution_key_unavailable` logs the step and the error code.

## Views and privacy

`HelpSessionView` carries the assignment id (or `null`), the task, the hints, the answer checks as results only (`result`, `assessedBy`, `hintLevel`), the open question and a status (`working`, `awaiting_comprehension_reply`, `understood`). The child's answer and reply texts stay in the store. Audit events (`guidance.session_started`, `guidance.comprehension_replied`) carry ids and outcomes only. Learning insights (#35) read results and ids, never transcripts.

## Limits

- At most the latest 100 hints and 100 answer checks are read back per session.
- Steps are ordered by their timestamp from the application clock.
- A session on an assignment keeps the assignment's text from its start; a later edit by the teacher shows in a new session only. If the teacher deletes the assignment, the session's `assignmentId` becomes `null` (`ON DELETE SET NULL`) and it goes on as a task without a key.

## Learning summaries (#35)

Two read-only queries over the stored sessions; neither calls an AI provider and neither reads a task, answer, reply or AI text (`PrismaLearningRecordRepository` selects ids, statuses, timestamps and hint rungs only).

- **Parents** (`GetLearningSummary`, card on the overview of the parent area `/parent`, behind its password proof): the learner module confirms the child is the parent's own and reads the learning-notes switch (`ChildProfile.learningInsights`); with it off nothing is read. The last 14 days, at most 10 sessions, newest first. A topic is named by the assignment's title (assignments module, the child's current class), else the competency's curriculum text (curriculum module, `describeCompetencies`), else the open topic label, else "own task". Per session: status in friendly words, number of hints, highest rung, whether the comprehension question was answered; plus "needed many hints" (3 or more hints, or a similar example) and "understood" (completed with the question answered). The rules are in `domain/insights/learning-summary.ts`.
- **Teachers** (`GetClassLearningOverview`, section on the class page): `assignment.read`, then the assignments module lists the assignments of the teacher's own class (an id that is not theirs has no overview). Per assignment: children with a help session, of them children who finished it, the median of the hints per child. Only numbers over at least 3 children leave the query (`CLASS_MIN_GROUP`); zero to two children read the same, so no single child can be singled out. No child id, name or text is in the view. A child can only start a session on an assignment while a member of its class (#33). The rules are in `domain/insights/class-overview.ts`.

The events these read are already stored server-side, once and in UTC: every step carries its request id under `(sessionId, idempotencyKey)` unique indexes, and timestamps come from the application clock as UTC instants.
