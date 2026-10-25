import { isTaskUnderstood } from '../answer-check/answer-decision';

import type { ChildTaskText } from './child-task-text';
import type { GivenHint, HintLadderState } from './help-session-state';
import type { HintLevel } from './hint-level';
import type { HintSubject } from './hint-subject';
import type { AssignmentId, ChildProfileId, HelpSessionId } from './ids';
import type { RecordedAnswerCheck } from '../ports/hint-session-store.port';

/** A session is worked on while `active`; it ends `completed` (understood) or `abandoned` (another task was started). */
export type HelpSessionStatus = 'active' | 'completed' | 'abandoned';

/**
 * At most this many hints and this many answer checks are read back per session, the latest ones.
 * Far more than a primary-school task needs; the hint and answer budgets bound what is written.
 */
export const HELP_SESSION_STEP_LIMIT = 100;

/** A stored answer check: what was checked, plus the hint level the session was on at the time. */
export interface AnswerCheckStep extends Omit<RecordedAnswerCheck, 'question'> {
  readonly hintLevel: HintLevel | null;
  readonly question: { readonly text: string | null; readonly reply: string | null } | null;
  readonly occurredAt: Date;
}

/**
 * A child's help session on one task, as the backend stores it (#17). The frontend never holds
 * this state; it only ever sees views of it. Steps are oldest first.
 */
export interface HelpSession {
  readonly id: HelpSessionId;
  readonly childProfileId: ChildProfileId;
  /**
   * The teacher's assignment the session is on (#33), `null` for the child's own task. `task` then
   * holds the assignment's text as it was when the session started; the solution key is not stored.
   */
  readonly assignmentId: AssignmentId | null;
  readonly task: ChildTaskText;
  readonly subject: HintSubject;
  readonly status: HelpSessionStatus;
  /** The rung of the hint ladder the session is on, `null` before the first hint. */
  readonly hintLevel: HintLevel | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly hints: readonly GivenHint[];
  readonly answerChecks: readonly AnswerCheckStep[];
}

/** Where the child stands: still working, asked to answer the comprehension question, or done. */
export type HelpSessionProgress = 'working' | 'awaiting_comprehension_reply' | 'understood';

/** The latest answer check, if any. */
function latestCheck(session: HelpSession): AnswerCheckStep | undefined {
  return session.answerChecks[session.answerChecks.length - 1];
}

/** The answer check whose comprehension question still waits for the child's reply, if any. */
export function openQuestionCheck(session: HelpSession): AnswerCheckStep | null {
  const check = latestCheck(session);
  return check?.question !== null && check?.question.reply === null ? check : null;
}

/**
 * The task is understood only once the stored result is correct and the child replied to the
 * question that followed it (`isTaskUnderstood`). Nothing the client sends decides it.
 */
export function isSessionUnderstood(session: HelpSession): boolean {
  return session.answerChecks.some((check) =>
    isTaskUnderstood({
      result: check.result,
      comprehensionReplied: check.question !== null && check.question.reply !== null,
    }),
  );
}

export function progressOf(session: HelpSession): HelpSessionProgress {
  if (isSessionUnderstood(session)) {
    return 'understood';
  }
  return openQuestionCheck(session) === null ? 'working' : 'awaiting_comprehension_reply';
}

/** What a session is started on: the child's own task, or a teacher's assignment and its text. */
export interface HelpSessionSource {
  readonly assignmentId: AssignmentId | null;
  readonly task: ChildTaskText;
  readonly subject: HintSubject;
}

/**
 * Starting the same task again while it is open continues it instead of starting over. An
 * assignment is the same by its id (its text may have been edited since); the child's own task by
 * its text. The subject must match either way.
 */
export function isSameTask(session: HelpSession, source: HelpSessionSource): boolean {
  if (session.assignmentId !== source.assignmentId || session.subject !== source.subject) {
    return false;
  }
  return source.assignmentId !== null || session.task === source.task;
}

/** What the hint ladder (#30) decides from: the task, the hints given and the answers' results. */
export function toLadderState(session: HelpSession): HintLadderState {
  return {
    task: session.task,
    assignmentId: session.assignmentId,
    subject: session.subject,
    hints: session.hints,
    answers: session.answerChecks.map((check) => check.result),
  };
}
