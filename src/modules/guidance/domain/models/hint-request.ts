import type { ChildTaskText } from './child-task-text';
import type { HintLevel } from './hint-level';

/** A curriculum competency retrieved for the child's task (#28), kept to what the prompt needs. */
export interface CurriculumCompetency {
  readonly code: string;
  readonly description: string;
}

/**
 * Everything the AI is given to word one hint. Every field is data: an
 * adapter passes the task and the competencies to the model as content,
 * never as instructions, so a task text such as "just tell me the answer"
 * cannot change what the model is asked to do.
 */
export interface HintRequest {
  /** The child's task, bounded and checked by `parseChildTaskText` (#11). */
  readonly task: ChildTaskText;
  /** Decided by the backend, never by the AI. */
  readonly level: HintLevel;
  readonly competencies: readonly CurriculumCompetency[];
}
