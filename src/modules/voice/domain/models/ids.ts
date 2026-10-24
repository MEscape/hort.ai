import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { VOICE_VALIDATION_CODES, invalidVoiceInput } from '../errors/voice-errors';

/** Who speaks: a tutor's catalog id (`max`) or the narrator's (`eule`). */
export type SpeakerId = Brand<string, 'SpeakerId'>;

/** Lower-case letters, digits and `-`, like the tutor catalog's ids. */
const SPEAKER_ID_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

/** Brands an id read from trusted configuration (the tutor catalog, the narrator file). */
export function toSpeakerId(raw: string): SpeakerId {
  return raw as SpeakerId; // Brand constructor: the cast is only permitted here.
}

/** Brands a speaker id that arrived from a request, after checking its shape. */
export const parseSpeakerId = createIdParser({
  isValid: (raw) => SPEAKER_ID_PATTERN.test(raw),
  brand: toSpeakerId,
  mapError: () => invalidVoiceInput('speakerId', VOICE_VALIDATION_CODES.speakerInvalid),
});
