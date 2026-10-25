import type { AnswerFeedback } from '../../application/contracts/answer-views';
import type {
  ComprehensionReplyView,
  HelpSessionView,
  StartHelpSessionView,
} from '../../application/contracts/help-session-views';
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

/**
 * A help session as the help screen shows or resumes it (#17). Field by field from the stored
 * view, so nothing added to the view later reaches the browser unnoticed. It carries no solution
 * and no answer or reply text of the child.
 */
export type HelpSessionDto = HelpSessionView;

/** `started`, or `continued` when the same task was already open. */
export interface StartHelpSessionDto {
  readonly outcome: StartHelpSessionView['outcome'];
  readonly session: HelpSessionDto;
}

/** `understood` when the reply completed the task; the backend decides it, never the client. */
export type ComprehensionReplyDto = ComprehensionReplyView;

export function toHelpSessionDto(view: HelpSessionView): HelpSessionDto {
  const {
    sessionId,
    task,
    subject,
    status,
    hintLevel,
    hints,
    answerChecks,
    openQuestion,
    updatedAt,
  } = view;
  return {
    sessionId,
    task,
    subject,
    status,
    hintLevel,
    hints,
    answerChecks: answerChecks.map(({ result, assessedBy, hintLevel: level }) => ({
      result,
      assessedBy,
      hintLevel: level,
    })),
    openQuestion,
    updatedAt,
  };
}

export function toStartHelpSessionDto({
  outcome,
  session,
}: StartHelpSessionView): StartHelpSessionDto {
  return { outcome, session: toHelpSessionDto(session) };
}

export function toComprehensionReplyDto({
  sessionId,
  status,
}: ComprehensionReplyView): ComprehensionReplyDto {
  return { sessionId, status };
}
