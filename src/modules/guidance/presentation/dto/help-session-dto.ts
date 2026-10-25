import type { FeedbackText } from '../../application/contracts/answer-views';
import type {
  ComprehensionReplyView,
  HelpSessionView,
  StartHelpSessionView,
} from '../../application/contracts/help-session-views';
import type { HintOutcome } from '../../application/contracts/hint-views';

/**
 * A help session as the browser gets it: the task, the hints given, the open question and where
 * it stands. The answer checks cross as a count only; the child's answer texts stay in the store.
 */
export interface HelpSessionDto {
  readonly sessionId: string;
  readonly task: string;
  readonly status: HelpSessionView['status'];
  readonly hints: readonly HintOutcome[];
  readonly answerChecks: number;
  readonly openQuestion: FeedbackText | null;
}

export interface StartHelpSessionDto {
  readonly outcome: StartHelpSessionView['outcome'];
  readonly session: HelpSessionDto;
}

export interface ComprehensionReplyDto {
  readonly sessionId: string;
  readonly status: ComprehensionReplyView['status'];
}

export function toHelpSessionDto(view: HelpSessionView): HelpSessionDto {
  return {
    sessionId: view.sessionId,
    task: view.task,
    status: view.status,
    hints: view.hints,
    answerChecks: view.answerChecks.length,
    openQuestion: view.openQuestion,
  };
}

export function toStartHelpSessionDto(view: StartHelpSessionView): StartHelpSessionDto {
  return { outcome: view.outcome, session: toHelpSessionDto(view.session) };
}

export function toComprehensionReplyDto(view: ComprehensionReplyView): ComprehensionReplyDto {
  return { sessionId: view.sessionId, status: view.status };
}
