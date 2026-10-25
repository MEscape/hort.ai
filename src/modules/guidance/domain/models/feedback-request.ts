import type { ChildTaskText } from './child-task-text';
import type { HintLevel } from './hint-level';
import type { CurriculumCompetency } from './hint-request';

/** What the AI words about the child's own answer (#14). Never a hint, never the solution. */
export const FEEDBACK_KINDS = ['answer_assessment', 'praise', 'comprehension_question'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/**
 * Everything the AI is given to word one piece of feedback. Every field is data, like a hint
 * request. The teacher's solution key is deliberately not part of it: the key never reaches the AI.
 */
export interface FeedbackRequest {
  readonly kind: FeedbackKind;
  readonly task: ChildTaskText;
  /** The child's answer, checked like a task text (`parseChildTaskText`). */
  readonly answer: ChildTaskText;
  /** The rung of the hint ladder the session is on; the AI never chooses it. */
  readonly level: HintLevel;
  readonly competencies: readonly CurriculumCompetency[];
}
