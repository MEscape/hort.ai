/** Presentation-facing view of the tutor port; the route handler maps Alexa requests onto these shapes. */
export type {
  TutorConversation,
  TutorReply,
  TutorTurn,
} from '../../domain/ports/tutor-conversation.port';
export { parseConversationId, type ConversationId } from '../../domain/models/ids';
