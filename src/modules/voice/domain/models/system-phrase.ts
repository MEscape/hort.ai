/**
 * The fixed lines a tutor may say without an AI in the loop: its greeting, a praise example and a
 * tip example, as written in the tutor catalog. They are the only speakable text besides the fixed
 * screen lines below and a hint the guidance orchestrator validated, so a request can name one but
 * never supply the words.
 */
export const TUTOR_PHRASES = ['greeting', 'praise', 'tip'] as const;

/**
 * The short, fixed lines a companion says on the child's home screen (a greeting and what it says
 * when a card is tapped). Every tutor says the same words in its own voice. They never contain a
 * name or anything about the child: the words are the same for everyone, so the provider only ever
 * hears reviewed text. Their German wording is `infrastructure/catalog/ui-lines.json` and equals the
 * German screen text (a test keeps both in step).
 */
export const UI_LINES = [
  'hello',
  'welcomeBack',
  'photoSoon',
  'voiceOff',
  'stripTime',
  'stripUnavailable',
  'closedLimit',
  'closedWindow',
  'low',
  'offline',
] as const;

export const SYSTEM_PHRASES = [...TUTOR_PHRASES, ...UI_LINES] as const;

export type TutorPhrase = (typeof TUTOR_PHRASES)[number];
export type UiLine = (typeof UI_LINES)[number];
export type SystemPhrase = (typeof SYSTEM_PHRASES)[number];

export const isTutorPhrase = (phrase: SystemPhrase): phrase is TutorPhrase =>
  (TUTOR_PHRASES as readonly string[]).includes(phrase);
