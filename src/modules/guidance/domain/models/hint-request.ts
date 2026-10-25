import type { ChildTaskText } from './child-task-text';
import type { HintLevel } from './hint-level';
import type { AssessmentResult } from '../ai-output/ai-output';

/** At most this many earlier hints go into a request, the latest ones; each is a bounded AI text. */
export const EARLIER_HINT_LIMIT = 4;

/** A hint the AI worded earlier in the session and the child saw: validated output, never child input. */
interface EarlierHint {
  readonly level: HintLevel;
  readonly text: string;
}

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
  /** The latest generated hints of the session, oldest first, so the next one builds on them. */
  readonly earlierHints: readonly EarlierHint[];
  /** The result of the child's latest answer check, `null` before one or when it was not assessable. Never the answer. */
  readonly lastAnswerResult: AssessmentResult | null;
}
