import { z } from 'zod';

/**
 * The animal tutors a child can choose. The catalog (`catalog/tutors.json`) is the single source
 * for every tutor's persona, voice and pictures; this schema is its contract. The tutor's AI and
 * speech logic is not part of it: the persona only colours style, examples and greeting.
 *
 * Field names follow the domain language of the team (see the module `README.md`), so they stay German.
 */

/** Lower-case, no umlauts or spaces; also the folder of the tutor's pictures in storage. */
const TUTOR_ID_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

const MAX_TEXT = 300;
const MAX_LABEL = 40;
const MAX_COLOUR = 30;
const MAX_VOICE_ID = 100;
const MAX_VOICE_STYLE = 50;
const MIN_TRAITS = 2;
const MAX_TRAITS = 4;
const MAX_TOPICS = 6;

const text = z.string().trim().min(1).max(MAX_TEXT);
const label = z.string().trim().min(1).max(MAX_LABEL);

const ttsVoiceSchema = z.object({
  /** For example `azure` (Azure AI Speech). `null` until a voice is chosen. */
  provider: z.enum(['azure', 'elevenlabs', 'openai', 'browser']).nullable(),
  /** The provider's voice name, for example `de-DE-GiselaNeural`. */
  voiceId: z.string().trim().min(1).max(MAX_VOICE_ID).nullable(),
  /** Provider style or role (Azure SSML `style`/`role`), optional. */
  style: z.string().trim().min(1).max(MAX_VOICE_STYLE).nullable().default(null),
});

const voiceSchema = z.object({
  sprache: z.literal('de-DE'),
  /** The voice as people describe it; the provider voice is chosen to match it. */
  charakter: text,
  tempo: z.enum(['langsam', 'normal', 'schnell']),
  tonhoehe: z.enum(['tief', 'mittel', 'hoch']),
  tts: ttsVoiceSchema,
});

const tutorSchema = z
  .object({
    id: z.string().regex(TUTOR_ID_PATTERN, {
      error: 'Must be lower-case letters, digits or "-", without umlauts or spaces.',
    }),
    name: label,
    tier: label,
    /** Main colour for the UI accent; `null` keeps the picture's own colours. */
    farbe: z.string().trim().min(1).max(MAX_COLOUR).nullable(),
    kurzbeschreibung: text,
    persoenlichkeit: z.array(label).min(MIN_TRAITS).max(MAX_TRAITS),
    lieblingsthemen: z.array(label).min(1).max(MAX_TOPICS),
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
