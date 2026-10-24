import { createHash } from 'node:crypto';

import type { Clock } from '@lib/clock';
import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync, type AppResultAsync } from '@lib/result';
import type { ObjectLocation, ObjectStore } from '@lib/storage';

import { speechClipFailed } from '../../domain/errors/voice-errors';

import type { ClipContent, HostedClip, SpeechClips } from '../../domain/ports/speech-clips.port';

/** Bump when the audio of equal content changes (another model or format), so old clips are not reused. */
const CLIP_VERSION = 'v1';
const CLIP_PREFIX = 'speech-clips';
/** Long enough for Alexa to fetch the clip right after the answer; short, because the URL is a bearer link. */
const READ_URL_TTL_SECONDS = 900;
const UPLOAD_TTL_SECONDS = 60;
/** The PUT of a few dozen KiB to Azure; part of the channel's answer time. */
const UPLOAD_TIMEOUT_MS = 2_000;
const CACHE_CONTROL = 'private, max-age=900';
const MS_PER_SECOND = 1_000;

interface SpeechClipsOptions {
  readonly clock: Clock;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Clips in the private container, keyed by a hash of voice and text (no text in the key or in
 * metadata), read through short-lived SAS URLs. The server uploads through the same signed
 * one-object PUT a browser would use, so the store needs no server-side write of its own.
 */
export function objectStoreSpeechClips(
  store: ObjectStore,
  options: SpeechClipsOptions,
): SpeechClips {
  const send = options.fetch ?? globalThis.fetch;

  function readUrl(location: ObjectLocation): AppResultAsync<HostedClip, InfrastructureAppError> {
    const expiresAt = new Date(
      options.clock.now().getTime() + READ_URL_TTL_SECONDS * MS_PER_SECOND,
    );
    return store
      .createReadUrl({ key: location.key, expiresInSeconds: READ_URL_TTL_SECONDS })
      .mapErr(speechClipFailed)
      .map((url) => ({ url, expiresAt }));
  }

  return {
    find: (content) => {
      const location = clipLocation(content);
      return store
        .head(location)
        .mapErr(speechClipFailed)
        .andThen((stored) =>
          stored !== null && stored.byteSize > 0 ? readUrl(location) : okAsync(null),
        );
    },
    save: (content, audio, contentType) => {
      const location = clipLocation(content);
      return store
        .createUploadTarget({
          location,
          contentType,
          byteSize: audio.byteLength,
          cacheControl: CACHE_CONTROL,
          expiresInSeconds: UPLOAD_TTL_SECONDS,
        })
        .mapErr(speechClipFailed)
        .andThen((target) =>
          fromThrowableAsync(
            () =>
              send(target.url, {
                method: 'PUT',
                headers: target.headers,
                body: audio,
                signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
              }),
            speechClipFailed,
          ),
        )
        .andThen((response) =>
          response.ok
            ? readUrl(location)
            : errAsync(speechClipFailed(`upload answered ${response.status}`)),
        );
    },
  };
}

function clipLocation(content: ClipContent): ObjectLocation {
  const digest = createHash('sha256')
    .update(`${CLIP_VERSION}\n${content.voice}\n${content.text}`)
    .digest('hex');
  return { visibility: 'private', key: `${CLIP_PREFIX}/${digest}.mp3` };
}
