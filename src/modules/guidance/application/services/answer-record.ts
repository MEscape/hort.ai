import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { invariant } from '@lib/utils';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { FeedbackKind } from '../../domain/models/feedback-request';
import type { StepRequestId } from '../../domain/models/ids';
import type { GuidanceAuditLog } from '../../domain/ports/guidance-audit-log.port';
import type { HelpSessionRepository } from '../../domain/ports/help-session.repository';
import type {
  HelpSessionRef,
  HintSessionStoreError,
  RecordedAnswerCheck,
} from '../../domain/ports/hint-session-store.port';
import type { AnswerFeedback, FeedbackText } from '../contracts/answer-views';

function generatedText(text: FeedbackText): string | null {
  return text.kind === 'generated' ? text.text : null;
}

/**
 * What the session keeps of one answer check (#78): the result, who decided it, and the validated
 * AI texts the child saw (`null` where the predefined text was shown).
 */
function toRecordedAnswerCheck(
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

function shownText(text: string | null, feedback: FeedbackKind): FeedbackText {
  return text === null
    ? { kind: 'predefined', feedback, reason: null }
    : { kind: 'generated', text };
}

/**
 * The feedback a stored check gave, for a retried request: the same result and texts, so the child
 * never sees praise or a question the session does not hold. A predefined text comes back without
 * the reason it was used, which is not stored.
 */
function toReplayedFeedback(check: RecordedAnswerCheck): AnswerFeedback {
  if (check.result !== 'correct') {
    return {
      result: check.result,
      assessedBy: check.assessedBy,
      next: 'hint_ladder',
      message: shownText(check.feedbackText, 'answer_assessment'),
    };
  }
  invariant(check.assessedBy !== null, 'A stored result always says who decided it.');
  return {
    result: 'correct',
    assessedBy: check.assessedBy,
    next: 'comprehension_question',
    praise: shownText(check.feedbackText, 'praise'),
    question: shownText(check.question?.text ?? null, 'comprehension_question'),
  };
}

type AnswerChecks = Pick<HelpSessionRepository, 'loadSession' | 'recordAnswerCheck'>;

/** The feedback of the check stored under `requestId` in the session, `undefined` when there is none. */
export function storedFeedback(
  sessions: AnswerChecks,
  ref: HelpSessionRef,
  requestId: StepRequestId,
): AppResultAsync<AnswerFeedback | undefined, HintSessionStoreError> {
  return sessions.loadSession(ref).map((session) => {
    const check = session.answerChecks.find((stored) => stored.requestId === requestId);
    return check === undefined ? undefined : toReplayedFeedback(check);
  });
}

/**
 * Records a fresh check (#78) and returns what the child may see: the feedback once stored, or the
 * stored twin's when a concurrent request with the same id was first. Praise and a question are
 * never shown unstored, so a failed write of a correct answer is an error; any other result is
 * still shown, and the failure logged with its code.
 */
export function recordChecked(
  { sessions, audit }: { readonly sessions: AnswerChecks; readonly audit: GuidanceAuditLog },
  check: {
    readonly ref: HelpSessionRef;
    readonly requestId: StepRequestId;
    readonly answer: ChildTaskText;
    readonly feedback: AnswerFeedback;
  },
): AppResultAsync<AnswerFeedback, HintSessionStoreError> {
  const { ref, requestId, answer, feedback } = check;
  return sessions
    .recordAnswerCheck(ref, toRecordedAnswerCheck(requestId, answer, feedback))
    .orElse((error) => {
      audit.record({ type: 'guidance.step_not_recorded', step: 'answer_check', code: error.code });
      return feedback.result === 'correct' ? errAsync(error) : okAsync('recorded' as const);
    })
    .andThen((outcome) =>
      outcome === 'recorded'
        ? okAsync(feedback)
        : storedFeedback(sessions, ref, requestId).andThen((twin) =>
            twin === undefined
              ? errAsync(
                  infrastructureError(
                    GUIDANCE_ERROR_CODES.sessionStoreFailed,
                    'The answer check was stored by another request but cannot be read back.',
                  ),
                )
              : okAsync(twin),
          ),
    );
}
