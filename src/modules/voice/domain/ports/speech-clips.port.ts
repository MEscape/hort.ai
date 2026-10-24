import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

/** What a clip says and in which voice: the whole identity of a clip, so equal content is stored once. */
export interface ClipContent {
  /** The provider's voice (from the catalog, never from a request). */
  readonly voice: string;
  readonly text: string;
}

/** A stored clip, reachable without credentials until `expiresAt`. */
export interface HostedClip {
  /** A short-lived bearer URL: never log or persist it. */
  readonly url: string;
  readonly expiresAt: Date;
}

/**
 * Spoken audio kept for channels that play a URL instead of receiving bytes (Alexa). Clips are a
 * cache keyed by their content, not records: nobody owns them, and losing one only costs a new
 * synthesis.
 */
export interface SpeechClips {
  /** The stored clip for this content, or `null` when there is none yet. */
  find(content: ClipContent): AppResultAsync<HostedClip | null, InfrastructureAppError>;
  save(
    content: ClipContent,
    audio: Uint8Array<ArrayBuffer>,
    contentType: string,
  ): AppResultAsync<HostedClip, InfrastructureAppError>;
}
