import type { AppResultAsync } from '@lib/result';

import type { ConversationId } from '../models/ids';

/**
 * One turn of a tutor conversation, independent of the channel that carried it (Alexa today, the web UI uses
 * the same tutor use case directly). Carries no child identity: the tutor side decides which (demo) profile a
 * conversation belongs to.
 */
export interface TutorTurn {
  /** Groups the turns of one conversation. Ephemeral: Alexa's session id, never a user id. */
  readonly conversationId: ConversationId;
  /** What the child said, as free text; `null` when the conversation is opened without words. */
  readonly utterance: string | null;
  readonly locale: 'de-DE';
}

export interface TutorReply {
  /** Plain text (no SSML) that the channel reads out in its standard voice. */
  readonly speech: string;
  /** `open`: the tutor expects an answer and the channel keeps listening; `closed`: the conversation ends. */
  readonly conversation: 'open' | 'closed';
}

/**
 * What the Alexa channel needs from hort.ai's tutor. Implemented by an infrastructure adapter that calls the
 * tutor module's public API and wired in composition.ts; until that exists, a connection-test stub answers.
 */
export interface TutorConversation {
  respond(turn: TutorTurn): AppResultAsync<TutorReply>;
}
