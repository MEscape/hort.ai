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

/**
 * Lets the holder's session have one validated text read aloud: pass it to `/api/voice/speech` as
 * `ticket`. Signed and short-lived; it says nothing the holder cannot already read.
 */
export interface SpeechTicketView {
  readonly ticket: string;
}
