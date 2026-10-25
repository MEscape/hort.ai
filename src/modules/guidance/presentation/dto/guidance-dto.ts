import type { AnswerFeedback } from '../../application/contracts/answer-views';
import type { HintOutcome, HintStep } from '../../application/contracts/hint-views';

/**
 * The next rung of the hint ladder, as the Server Action returns it. A `fallback` hint carries no
 * text: the UI shows the translated `guidance.hint.fallback.<level>` prompt. `step` counts from 1
 * ("understand the task"); at `isTopStep` asking again brings another similar example.
 */
export interface HintDto {
  readonly sessionId: string;
  readonly hint: HintOutcome;
  readonly step: number;
  readonly isTopStep: boolean;
}

/** The feedback on the child's answer, with the session it belongs to. */
export type AnswerFeedbackDto = { readonly sessionId: string } & AnswerFeedback;

export function toHintDto(sessionId: string, { hint, step, isTopStep }: HintStep): HintDto {
  return { sessionId, hint, step, isTopStep };
}

export function toAnswerFeedbackDto(
  sessionId: string,
  feedback: AnswerFeedback,
): AnswerFeedbackDto {
  if (feedback.result === 'correct') {
    const { result, assessedBy, next, praise, question } = feedback;
    return { sessionId, result, assessedBy, next, praise, question };
  }
  const { result, assessedBy, next, message } = feedback;
  return { sessionId, result, assessedBy, next, message };
}
