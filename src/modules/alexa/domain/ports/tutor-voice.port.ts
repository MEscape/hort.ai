import type { AppResultAsync } from '@lib/result';

import type { TutorId } from '../models/ids';

/**
 * The tutor's own voice for the Alexa channel: a reply's text as an audio file Alexa can fetch.
 * Implemented by an adapter onto the voice module's public API; the channel never calls a speech
 * provider itself. Any failure means "use Alexa's standard voice", never a failed answer.
 */
export interface TutorVoice {
  /** A short-lived public HTTPS URL of `text` spoken by the tutor (a bearer link: never log it). */
  audioUrl(text: string): AppResultAsync<string>;
  /** A short-lived public HTTPS URL of the catalog greeting of `tutorId`, in that tutor's voice. */
  greetingUrl(tutorId: TutorId): AppResultAsync<string>;
}

/** One tutor introducing itself when the skill opens: its catalog id and its catalog greeting. */
export interface TutorIntroduction {
  readonly tutorId: TutorId;
  /** The catalog greeting; spoken in Alexa's voice when the tutor's own voice is not available. */
  readonly text: string;
}
