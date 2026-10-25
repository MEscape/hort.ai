import { z } from 'zod';

import { SYSTEM_PHRASES } from '../../application/contracts/voice-constraints';

/** A tutor id from the catalog or the narrator's: lower-case letters, digits and `-`. */
const SPEAKER_ID_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;
/**
 * Bounds the work of parsing only: a ticket for the longest speakable text (400 characters of up
 * to four UTF-8 bytes each, base64url-encoded) plus its signature fits well within this.
 */
const MAX_TICKET_LENGTH = 4000;

const speakerId = z.string().regex(SPEAKER_ID_PATTERN);

/**
 * The JSON body of `POST /api/voice/speech`: a speaker and either a fixed line of the tutor
 * catalog (`phrase`) or a ticket for a validated hint (`ticket`). There is no field for words:
 * a body with `text` does not match and is refused.
 */
export const synthesizeSpeechSchema = z.union([
  z.object({ speakerId, phrase: z.enum(SYSTEM_PHRASES) }).strict(),
  z
    .object({
      speakerId,
      childProfileId: z.string().min(1).max(128).optional(),
      ticket: z.string().min(1).max(MAX_TICKET_LENGTH),
    })
    .strict(),
]);
