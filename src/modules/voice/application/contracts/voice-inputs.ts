import type { SystemPhrase } from '../../domain/models/system-phrase';

/**
 * What a speaker should say. There is deliberately no way to pass words: a request names a fixed
 * line of the tutor catalog, or redeems a ticket the server issued for a validated hint.
 */
export type SpeechSource =
  | { readonly kind: 'phrase'; readonly phrase: SystemPhrase }
  | { readonly kind: 'ticket'; readonly ticket: string };

/** `speakerId` is a tutor id from the catalog or the narrator's. */
export interface SynthesizeSpeechInput {
  readonly speakerId: string;
  readonly source: SpeechSource;
}

/** A child's recording, held in memory for the one request, and which child is speaking. */
export interface TranscribeSpeechInput {
  readonly childProfileId: string;
  readonly audio: Uint8Array<ArrayBuffer>;
  /** A bare `type/subtype`, parameters removed. */
  readonly contentType: string;
}
