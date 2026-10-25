import type { SpeakerId } from '../models/ids';
import type { SystemPhrase } from '../models/system-phrase';

/** The fixed lines of a speaker, from trusted configuration (the tutor catalog), never a request. */
export interface SystemPhrases {
  /** The line, or `null` when this speaker has no such line. */
  phraseFor(speakerId: SpeakerId, phrase: SystemPhrase): string | null;
}
