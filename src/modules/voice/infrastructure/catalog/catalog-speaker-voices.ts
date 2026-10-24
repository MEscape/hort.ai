import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';

import { arrayOf, invariant, isString, nullable, objectOf, oneOf } from '@lib/utils';

import narratorJson from './narrator.json';

import type { SpeakerVoices } from '../../domain/ports/speaker-voices.port';

/** The only provider this adapter speaks for; a tutor with another provider has no voice here. */
const PROVIDER = 'elevenlabs';

/**
 * The narrator (the owl) is the app's own voice, not a tutor a child chooses, so it lives here
 * rather than in the tutor catalog. Its name is still open.
 */
interface Narrator {
  readonly id: string;
  readonly rolle: 'erzaehler';
  readonly name: string | null;
  /** Fixed lines the owl may say without the spoken-text guard: written and reviewed by us. */
  readonly saetze: readonly string[];
  readonly tts: {
    readonly provider: string;
    readonly voiceId: string;
    readonly style: string | null;
  };
}

const isNarrator = objectOf<Narrator>({
  id: isString,
  rolle: oneOf(['erzaehler'] as const),
  name: nullable(isString),
  saetze: arrayOf(isString),
  tts: objectOf<Narrator['tts']>({
    provider: isString,
    voiceId: isString,
    style: nullable(isString),
  }),
});

/**
 * Voices from checked-in configuration: every tutor that is `bereit` with an ElevenLabs voice
 * (`tutors.json`, `stimme.tts`) plus the narrator (`narrator.json`), and the narrator's fixed lines
 * (`saetze`, a server-side allow-list). Swapping a voice is an edit of those files, not of code.
 */
export function catalogSpeakerVoices(
  catalog: TutorCatalog = tutorCatalog,
  narrator: unknown = narratorJson,
): SpeakerVoices {
  invariant(isNarrator(narrator), 'narrator.json does not describe a narrator voice.');
  const voices = new Map<string, string>();
  for (const tutor of catalog.tutoren) {
    const { provider, voiceId } = tutor.stimme.tts;
    if (tutor.status === 'bereit' && provider === PROVIDER && voiceId !== null) {
      voices.set(tutor.id, voiceId);
    }
  }
  if (narrator.tts.provider === PROVIDER) {
    invariant(!voices.has(narrator.id), `The narrator id "${narrator.id}" is also a tutor id.`);
    voices.set(narrator.id, narrator.tts.voiceId);
  }
  const fixedLines = new Map<string, ReadonlySet<string>>([
    [narrator.id, new Set(narrator.saetze.map((line) => line.trim()))],
  ]);
  return {
    voiceFor: (speakerId) => voices.get(speakerId) ?? null,
    isFixedLine: (speakerId, text) => fixedLines.get(speakerId)?.has(text.trim()) ?? false,
  };
}
