import { z } from 'zod';

/**
 * The animal tutors a child can choose. The catalog (`tutors.json`) is the single source for
 * every tutor's persona, voice and pictures; this schema is its contract. The tutor's AI and
 * speech logic is not part of it: the persona only colours style, examples and greeting.
 *
 * Field names follow the domain language of the team (see `README.md` next to this module), so they stay German.
 */

/** Lower-case, no umlauts or spaces; also the folder of the tutor's pictures in storage. */
export const TUTOR_ID_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

const text = z.string().trim().min(1).max(300);

/** Where every tutor's pictures live in the public container: `tutors/<id>/<file>`. */
export const TUTOR_STORAGE_PREFIX = 'tutors';

export const TUTOR_IMAGE_FILES = { mund_zu: 'mund-zu.svg', mund_auf: 'mund-auf.svg' } as const;

const ttsVoiceSchema = z.object({
  /** For example `azure` (Azure AI Speech). `null` until a voice is chosen. */
  provider: z.enum(['azure', 'elevenlabs', 'openai', 'browser']).nullable(),
  /** The provider's voice name, for example `de-DE-GiselaNeural`. */
  voiceId: z.string().trim().min(1).max(100).nullable(),
  /** Provider style or role (Azure SSML `style`/`role`), optional. */
  style: z.string().trim().min(1).max(50).nullable().default(null),
});

const voiceSchema = z.object({
  sprache: z.literal('de-DE'),
  /** The voice as people describe it; the provider voice is chosen to match it. */
  charakter: text,
  tempo: z.enum(['langsam', 'normal', 'schnell']),
  tonhoehe: z.enum(['tief', 'mittel', 'hoch']),
  tts: ttsVoiceSchema,
});

export const tutorSchema = z
  .object({
    id: z.string().regex(TUTOR_ID_PATTERN, {
      error: 'Must be lower-case letters, digits or "-", without umlauts or spaces.',
    }),
    name: z.string().trim().min(1).max(40),
    tier: z.string().trim().min(1).max(40),
    /** Main colour for the UI accent; `null` keeps the picture's own colours. */
    farbe: z.string().trim().min(1).max(30).nullable(),
    kurzbeschreibung: text,
    persoenlichkeit: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
    lieblingsthemen: z.array(z.string().trim().min(1).max(40)).min(1).max(6),
    sprechstil: text,
    begruessung: text,
    lob_beispiel: text,
    tipp_beispiel: text,
    stimme: voiceSchema,
    /**
     * Prefix of the designer's source files: `<quelle>_mund_zu.svg` and `<quelle>_mund_offen.svg`
     * (for example `hort_ai_hund_blau`). The sync script maps them to `tutors/<id>/mund-*.svg`.
     */
    quelle: z.string().regex(/^[a-z0-9_]+$/),
    status: z.enum(['entwurf', 'bereit']),
  })
  .strict();

export const tutorCatalogSchema = z
  .object({
    version: z.literal(1),
    tutoren: z.array(tutorSchema).min(1),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    catalog.tutoren.forEach((tutor, index) => {
      if (seen.has(tutor.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tutoren', index, 'id'],
          message: `Duplicate tutor id "${tutor.id}".`,
        });
      }
      seen.add(tutor.id);
    });
  });

export type Tutor = z.infer<typeof tutorSchema>;
export type TutorCatalog = z.infer<typeof tutorCatalogSchema>;
export type TutorImage = keyof typeof TUTOR_IMAGE_FILES;

/** The storage key of one of a tutor's pictures, relative to the public container. */
export function tutorImageKey(id: string, image: TutorImage): string {
  return `${TUTOR_STORAGE_PREFIX}/${id}/${TUTOR_IMAGE_FILES[image]}`;
}
