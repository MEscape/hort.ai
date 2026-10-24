/** Text a speaker should say. `speakerId` is a tutor id from the catalog or the narrator's. */
export interface SynthesizeSpeechInput {
  readonly speakerId: string;
  readonly text: string;
}

/** A child's recording, held in memory for the one request. */
export interface TranscribeSpeechInput {
  readonly audio: Uint8Array<ArrayBuffer>;
  /** A bare `type/subtype`, parameters removed. */
  readonly contentType: string;
}
