import type { HintLevel } from './hint-level';

/**
 * A curriculum competency retrieved for the child's task. Kept to what the
 * prompt needs until curriculum retrieval (#28) defines its own model.
 */
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
  /** The child's task as entered; bounded and checked before it gets here (#11). */
  readonly task: string;
  /** Decided by the backend, never by the AI. */
  readonly level: HintLevel;
  readonly competencies: readonly CurriculumCompetency[];
}
