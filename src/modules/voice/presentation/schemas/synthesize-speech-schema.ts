import { z } from 'zod';

/** A tutor id from the catalog or the narrator's: lower-case letters, digits and `-`. */
const SPEAKER_ID_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;
/**
 * Bounds the work of parsing only. The speakable length (`SPEECH_LIMITS.maxTextLength`) is a domain
 * rule and checked by the use case, so a too-long text gets its own validation code.
 */
const MAX_RAW_TEXT_LENGTH = 4000;

/** The JSON body of `POST /api/voice/speech`. */
export const synthesizeSpeechSchema = z
  .object({
    speakerId: z.string().regex(SPEAKER_ID_PATTERN),
    text: z.string().max(MAX_RAW_TEXT_LENGTH),
  })
  .strict();
