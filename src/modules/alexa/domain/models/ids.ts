import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { conversationIdInvalid } from '../errors/alexa-errors';

/** Opaque id that groups the turns of one conversation (Alexa's ephemeral session id, never a user id). */
export type ConversationId = Brand<string, 'ConversationId'>;

export const CONVERSATION_ID_MAX_LENGTH = 256;

/** Brands a stored conversation id. Request values go through `parseConversationId`. */
export function toConversationId(raw: string): ConversationId {
  return raw as ConversationId; // Brand constructor: the cast is only permitted here.
}

/** Brands a conversation id that arrived with an Alexa request, after checking its shape. */
export const parseConversationId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CONVERSATION_ID_MAX_LENGTH,
  brand: toConversationId,
  mapError: conversationIdInvalid,
});
