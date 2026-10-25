import type { AppResultAsync } from '@lib/result';

import type { SpeechError } from './speech-errors';

/** What text-to-speech returns: always MP3, ready for an `<audio>` element. */
export const SYNTHESIZED_AUDIO_TYPE = 'audio/mpeg';

export interface SynthesisRequest {
  /** Already validated and shortened by the caller; the provider bills every character. */
  readonly text: string;
  /** The provider's voice, resolved by the caller from trusted configuration, never from a request. */
  readonly voiceId: string;
}

export interface SynthesizedSpeech {
  readonly audio: Uint8Array<ArrayBuffer>;
  readonly contentType: typeof SYNTHESIZED_AUDIO_TYPE;
}

export interface TranscriptionRequest {
  /** The recording, held in memory only; nothing here stores it. */
  readonly audio: Uint8Array<ArrayBuffer>;
  /** A bare `type/subtype`, for example `audio/webm`. */
  readonly contentType: string;
  /** ISO 639-3, for example `deu`. */
  readonly languageCode: string;
}

export interface Transcript {
  readonly text: string;
  /** The language the provider detected, or `null` when it did not say. */
  readonly languageCode: string | null;
}

/**
 * The application's whole view of a speech provider. An adapter implements it; use cases
 * `import type` it and are handed an implementation (or `null` while speech is off) by
 * `composition.ts`.
 *
 * Neither direction persists audio or text: a recording lives only as long as the request.
 * Authorization, rate limits and text validation are the caller's job.
 */
export interface SpeechProvider {
  synthesize(request: SynthesisRequest): AppResultAsync<SynthesizedSpeech, SpeechError>;
  transcribe(request: TranscriptionRequest): AppResultAsync<Transcript, SpeechError>;
}
