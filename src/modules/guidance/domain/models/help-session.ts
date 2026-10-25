import { isTaskUnderstood } from '../answer-check/answer-decision';

import type { AssessedBy } from './assessed-by';
import type { ChildTaskText } from './child-task-text';
import type { HintFallbackReason } from './hint-fallback-reason';
import type { HintLevel } from './hint-level';
import type { HintSubject } from './hint-subject';
import type { ChildProfileId, HelpSessionId } from './ids';
import type { AssessmentResult } from '../ai-output/ai-output';

/** A session is worked on while `active`; it ends `completed` (understood) or `abandoned` (another task was started). */
export type HelpSessionStatus = 'active' | 'completed' | 'abandoned';

/**
 * At most this many hints and this many answer checks are read back per session, the latest ones.
 * Far more than a primary-school task needs; the hint and answer budgets bound what is written.
 */
export const HELP_SESSION_STEP_LIMIT = 100;

/**
 * One hint the child received. `requestId` is the caller's idempotency key: the same request is
 * stored once. A fallback stores no text, only why the predefined prompt of the level was shown.
 */
export type GivenHint =
  | {
      readonly requestId: string;
      readonly level: HintLevel;
      readonly kind: 'generated';
      readonly text: string;
    }
  | {
      readonly requestId: string;
      readonly level: HintLevel;
      readonly kind: 'fallback';
      readonly reason: HintFallbackReason;
    };

/**
 * One check of the child's own answer (#14, #78). `result` and `assessedBy` are both `null` when it
 * could not be assessed. `feedbackText` and the question's `text` are the validated AI texts,
 * `null` when the predefined text was shown. A question follows a correct answer only.
 */
export interface NewAnswerCheck {
  readonly requestId: string;
  readonly answer: ChildTaskText;
  readonly result: AssessmentResult | null;
  readonly assessedBy: AssessedBy | null;
  readonly feedbackText: string | null;
  readonly question: { readonly text: string | null } | null;
}

/** A stored answer check: what was checked, plus the hint level the session was on at the time. */
export interface AnswerCheckStep extends Omit<NewAnswerCheck, 'question'> {
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

/** Starting the same task again while it is open continues it instead of starting over. */
export function isSameTask(
  session: HelpSession,
  task: ChildTaskText,
  subject: HintSubject,
): boolean {
  return session.task === task && session.subject === subject;
}
