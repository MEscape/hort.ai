/**
 * The fixed lines a tutor may say without an AI in the loop: its greeting, a praise example and a
 * tip example, as written in the tutor catalog. They are the only speakable text besides a hint the
 * guidance orchestrator validated, so a request can name one but never supply the words.
 */
export const SYSTEM_PHRASES = ['greeting', 'praise', 'tip'] as const;

export type SystemPhrase = (typeof SYSTEM_PHRASES)[number];
