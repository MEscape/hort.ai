# Help sessions

How the guidance module stores a child's work on one task, so the child can continue later (#17) and an answer counts as understood only on stored evidence (#78). The backend is the only source of this state; screens get views built from it on every request.

## Model

One `HelpSession` per task, owned by the child's guardian (`tenantId`, `ownerId`) and the child (`childProfileId`). It keeps the task text, the subject that grounds its hints, the rung of the hint ladder it is on (`currentHintLevel`) and a `version` that every step increments. Its steps are child rows:

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

- `StartHelpSession { childProfileId, task, subject }`: `started` or `continued`, with the session view.
- `GetOpenHelpSession { childProfileId }`: the open session's view for "Continue", or `null`.
- `ReplyToComprehensionQuestion { childProfileId, sessionId, reply }`: the reply is checked like any child input (`parseChildTaskText`); `guidance.no_open_question` when no question waits for it. Answers `understood` when it completed the task.

`HelpSessionRepository` extends the hint ladder's `HintSessionStore` (#30): `RequestHint` and `CheckAnswer` load the ladder state and record hints and answer checks through the same Prisma repository (`load`, `recordHint`, `recordAnswerCheck`), wired in `composition.ts`.

## Views and privacy

`HelpSessionView` carries the task, the hints, the answer checks as results only (`result`, `assessedBy`, `hintLevel`), the open question and a status (`working`, `awaiting_comprehension_reply`, `understood`). The child's answer and reply texts stay in the store. Audit events (`guidance.session_started`, `guidance.comprehension_replied`) carry ids and outcomes only. Learning insights (#35) read results and ids, never transcripts.

## Limits

- At most the latest 100 hints and 100 answer checks are read back per session.
- Steps are ordered by their timestamp from the application clock.
- Sessions on a teacher's assignment (`assignmentId`) are not started yet; that needs the class-membership check of #33.
