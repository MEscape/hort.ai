import { openQuestionCheck, progressOf } from '../../domain/models/help-session';

import type { HelpSession } from '../../domain/models/help-session';
import type { GivenHint } from '../../domain/models/help-session-state';
import type { FeedbackText } from '../contracts/answer-views';
import type { HelpSessionView } from '../contracts/help-session-views';
import type { HintOutcome } from '../contracts/hint-views';

function toHintOutcome(hint: GivenHint): HintOutcome {
  return hint.kind === 'generated'
    ? { kind: 'generated', level: hint.level, text: hint.text }
    : { kind: 'fallback', level: hint.level, reason: hint.reason };
}

/** A stored question without text was the predefined one; presentation words it. */
function toQuestion(text: string | null): FeedbackText {
  return text === null
    ? { kind: 'predefined', feedback: 'comprehension_question', reason: null }
    : { kind: 'generated', text };
}

/** The view of a stored session. The child's answer texts stay in the store. */
export function toHelpSessionView(session: HelpSession): HelpSessionView {
  const open = openQuestionCheck(session);
  return {
    sessionId: session.id,
    assignmentId: session.assignmentId,
    task: session.task,
    subject: session.subject,
    status: progressOf(session),
    hintLevel: session.hintLevel,
    hints: session.hints.map(toHintOutcome),
    answerChecks: session.answerChecks.map(({ result, assessedBy, hintLevel }) => ({
      result,
      assessedBy,
      hintLevel,
    })),
    openQuestion: open?.question ? toQuestion(open.question.text) : null,
    updatedAt: session.updatedAt.toISOString(),
  };
}
