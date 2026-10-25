/** The companions whose voice words are translated; any other keeps the catalog's German. */
const TRANSLATED_VOICES = ['max', 'lili', 'fina'] as const;

export type TranslatedVoice = (typeof TRANSLATED_VOICES)[number];

export const hasTranslatedVoice = (tutorId: string): tutorId is TranslatedVoice =>
  (TRANSLATED_VOICES as readonly string[]).includes(tutorId);

const WORDS_SHOWN = 3;

/**
 * How a voice sounds in two or three words, from the catalog's description: the bracketed part
 * ("(Jungenstimme)") is dropped, what is left is cut at the third word.
 */
export function voiceWordsOf(description: string): string {
  return description
    .replace(/\s*\([^)]*\)/g, '')
    .split(',')
    .map((word) => word.trim())
    .filter((word) => word !== '')
    .slice(0, WORDS_SHOWN)
    .join(', ');
}
