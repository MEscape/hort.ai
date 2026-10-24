/** Spoken audio, ready to play. */
export interface SpeechAudioView {
  readonly audio: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/**
 * What the child said, as text. It is a suggestion: the child corrects it before sending, and the
 * sent text goes through the same validation as typed text.
 */
export interface TranscriptView {
  readonly text: string;
}
