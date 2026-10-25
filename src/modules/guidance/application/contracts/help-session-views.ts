import type { AssessedBy, FeedbackText } from './answer-views';
import type { HintOutcome } from './hint-views';
import type { AssessmentResult } from '../../domain/ai-output/ai-output';
import type { HelpSessionProgress } from '../../domain/models/help-session';
import type { HintLevel } from '../../domain/models/hint-level';
import type { HintSubject } from '../../domain/models/hint-subject';

/** One stored answer check, as ids and results only: never the child's answer text. */
export interface AnswerCheckView {
  readonly result: AssessmentResult | null;
  readonly assessedBy: AssessedBy | null;
  /** The rung of the hint ladder the session was on when the answer was checked. */
  readonly hintLevel: HintLevel | null;
}

/**
 * Everything a screen needs to show or resume a help session (#17). Built from the stored state on
 * every request, so the frontend is never the source of it. `status` is decided by the backend:
 * `understood` only after a correct answer AND the child's reply to the comprehension question.
 */
export interface HelpSessionView {
  readonly sessionId: string;
  /** The teacher's assignment the session is on (#33), `null` for the child's own task. */
  readonly assignmentId: string | null;
  /** The child's own text, or the assignment's text. Never the solution key. */
  readonly task: string;
  readonly subject: HintSubject;
  readonly status: HelpSessionProgress;
  /** The rung of the hint ladder the session is on, `null` before the first hint. */
  readonly hintLevel: HintLevel | null;
  /** The hints given so far, oldest first. */
  readonly hints: readonly HintOutcome[];
  readonly answerChecks: readonly AnswerCheckView[];
  /** The comprehension question waiting for the child's reply, `null` when none is. */
  readonly openQuestion: FeedbackText | null;
  /** ISO instant of the last step. */
  readonly updatedAt: string;
}

/** Starting the same task again while it is open continues it (`continued`). */
export interface StartHelpSessionView {
  readonly outcome: 'started' | 'continued';
  readonly session: HelpSessionView;
}

/** After the reply: `understood` when it completed the task. */
export interface ComprehensionReplyView {
  readonly sessionId: string;
  readonly status: HelpSessionProgress;
}
