import type { ChildTaskText } from './child-task-text';
import type { HintFallbackReason } from './hint-fallback-reason';
import type { HintLevel } from './hint-level';
import type { HintSubject } from './hint-subject';
import type { AssignmentId, StepRequestId } from './ids';
import type { AssessmentResult } from '../ai-output/ai-output';
import type { SessionOpening } from '../topic/session-topic';

/**
 * One hint the child was given in a session: the validated AI text, or the predefined prompt of the
 * level (which carries no text, presentation translates it) and why it was used.
 */
export type GivenHint =
  | {
      readonly requestId: StepRequestId;
      readonly level: HintLevel;
      readonly kind: 'generated';
      readonly text: string;
    }
  | {
      readonly requestId: StepRequestId;
      readonly level: HintLevel;
      readonly kind: 'fallback';
      readonly reason: HintFallbackReason;
    };

/**
 * A stored help session as guidance needs it: the task the session was started with (the client
 * never sends it again), and what the hint ladder decides from, the hints already given and the
 * results of the child's answers, each oldest first. `null` is an answer that could not be assessed.
 */
export interface HintLadderState {
  readonly task: ChildTaskText;
  /** The teacher's assignment the task came from (#33), `null` for the child's own task. */
  readonly assignmentId: AssignmentId | null;
  readonly subject: HintSubject;
  /**
   * The curriculum competency the session was classified with at its start (#92), already checked
   * against that request's candidates. `null` for no competency, an open topic or an older session.
   */
  readonly competencyCode: string | null;
  /** How the session opened (#92); a `redirect` gives no hint. `null`: help as usual. */
  readonly opening: SessionOpening | null;
  readonly hints: readonly GivenHint[];
  readonly answers: ReadonlyArray<AssessmentResult | null>;
}
