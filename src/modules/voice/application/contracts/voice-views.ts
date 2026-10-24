/** Spoken audio, ready to play. */
export interface SpeechAudioView {
  readonly audio: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/**
 * The signed-in parent's speech consent. `given` is what counts; the timestamps (ISO 8601, UTC) say
 * when it was last granted and revoked.
 */
export interface VoiceConsentView {
  readonly given: boolean;
  readonly grantedAt: string | null;
  readonly revokedAt: string | null;
}

/**
 * What the child said, as text. It is a suggestion: the child corrects it before sending, and the
 * sent text goes through the same validation as typed text.
 */
export interface TranscriptView {
  readonly text: string;
}
