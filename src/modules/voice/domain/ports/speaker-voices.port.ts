import type { SpeakerId } from '../models/ids';

/**
 * Which provider voice a speaker uses. Speakers are the tutors that are ready to speak (by their
 * catalog id) and the narrator (the owl). The voice comes from trusted configuration, never from a
 * request, so a voice can be swapped by editing the catalog without a code change.
 */
export interface SpeakerVoices {
  /** The provider's voice id, or `null` when the id names no speaker with a voice. */
  voiceFor(speakerId: SpeakerId): string | null;
  /**
   * Whether the text is one of the speaker's fixed lines from trusted configuration (the owl's
   * greetings). Those are spoken as they are; any other text must pass the spoken-text guard.
   */
  isFixedLine(speakerId: SpeakerId, text: string): boolean;
}
