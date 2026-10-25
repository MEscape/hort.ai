/** Browser-safe API of the guidance module: the help session's Server Actions and its screen. */
export { checkAnswerAction } from './presentation/actions/check-answer-action';
export { replyComprehensionAction } from './presentation/actions/reply-comprehension-action';
export { requestHintAction } from './presentation/actions/request-hint-action';
export { startHelpSessionAction } from './presentation/actions/start-help-session-action';
export type { HelpSessionDto } from './presentation/dto/guidance-dto';
export { HelpConversation } from './presentation/components/help-conversation';

export { DistressHelp } from './presentation/components/distress-help';
export { CHILD_DISTRESS_ERROR_CODES } from './domain/errors/child-distress-errors';
