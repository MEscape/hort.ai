import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { StepRequestId } from '../../domain/models/ids';
import type { RecordedAnswerCheck } from '../../domain/ports/hint-session-store.port';
import type { AnswerFeedback, FeedbackText } from '../contracts/answer-views';

function generatedText(text: FeedbackText): string | null {
  return text.kind === 'generated' ? text.text : null;
}

/**
 * What the session keeps of one answer check (#78): the result, who decided it, and the validated
 * AI texts the child saw (`null` where the predefined text was shown).
 */
export function toRecordedAnswerCheck(
  requestId: StepRequestId,
  answer: ChildTaskText,
  feedback: AnswerFeedback,
): RecordedAnswerCheck {
  const base = { requestId, answer, result: feedback.result, assessedBy: feedback.assessedBy };
  return feedback.result === 'correct'
    ? {
        ...base,
        feedbackText: generatedText(feedback.praise),
        question: { text: generatedText(feedback.question) },
      }
    : { ...base, feedbackText: generatedText(feedback.message), question: null };
}
