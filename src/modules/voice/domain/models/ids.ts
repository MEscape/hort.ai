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

/** The child who speaks: a local reference to the learner module's child profile. */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

/** The learner module accepts ids of up to this length. */
const CHILD_PROFILE_ID_MAX_LENGTH = 128;

/** Brands an id read from trusted data. */
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId; // Brand constructor: the cast is only permitted here.
}

/** Brands a child profile id that arrived from a request, after checking its shape. */
export const parseChildProfileId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CHILD_PROFILE_ID_MAX_LENGTH,
  brand: toChildProfileId,
  mapError: () => invalidVoiceInput('childProfileId', VOICE_VALIDATION_CODES.childProfileRequired),
});
