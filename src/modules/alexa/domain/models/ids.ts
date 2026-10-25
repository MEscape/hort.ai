import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { conversationIdInvalid, tutorIdInvalid } from '../errors/alexa-errors';

/** Opaque id that groups the turns of one conversation (Alexa's ephemeral session id, never a user id). */
export type ConversationId = Brand<string, 'ConversationId'>;

export const CONVERSATION_ID_MAX_LENGTH = 256;

/** Brands a stored conversation id. Request values go through `parseConversationId`. */
export function toConversationId(raw: string): ConversationId {
  return raw as ConversationId; // Brand constructor: the cast is only permitted here.
}

/** Stable id of a tutor in the tutors catalog (`max`, `lili`, …); only read from that catalog. */
export type TutorId = Brand<string, 'TutorId'>;

/** Brands a tutor id read from the checked-in tutor catalog. */
export function toTutorId(raw: string): TutorId {
  return raw as TutorId; // Brand constructor: the cast is only permitted here.
}

/** Brands a conversation id that arrived with an Alexa request, after checking its shape. */
export const parseConversationId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CONVERSATION_ID_MAX_LENGTH,
  brand: toConversationId,
  mapError: conversationIdInvalid,
});

/** Same shape as a tutors catalog id (`ALEXA_TUTOR_ID` uses it too). */
const TUTOR_ID_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

/** Brands a tutor id read from the tutors catalog after checking its shape; others are skipped. */
export const parseTutorId = createIdParser({
  isValid: (raw: string) => TUTOR_ID_PATTERN.test(raw),
  brand: toTutorId,
  mapError: tutorIdInvalid,
});
