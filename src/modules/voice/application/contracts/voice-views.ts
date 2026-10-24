/** Spoken audio, ready to play. */
export interface SpeechAudioView {
  readonly audio: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/** Spoken audio behind a URL that needs no credentials until `expiresAt`. */
export interface HostedSpeechView {
  /** A bearer link: never log or persist it. */
  readonly url: string;
  readonly expiresAt: Date;
}

/**
 * What the child said, as text. It is a suggestion: the child corrects it before sending, and the
 * sent text goes through the same validation as typed text.
 */
export interface TranscriptView {
  readonly text: string;
}
