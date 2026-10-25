import type { AppResultAsync } from '@lib/result';

/**
 * The tutor's own voice for the Alexa channel: a reply's text as an audio file Alexa can fetch.
 * Implemented by an adapter onto the voice module's public API; the channel never calls a speech
 * provider itself. Any failure means "use Alexa's standard voice", never a failed answer.
 */
export interface TutorVoice {
  /** A short-lived public HTTPS URL of `text` spoken by the tutor (a bearer link: never log it). */
  audioUrl(text: string): AppResultAsync<string>;
}
