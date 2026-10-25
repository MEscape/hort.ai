import { okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { SpeechError, SpeechProvider, SynthesisRequest, SynthesizedSpeech } from '@lib/speech';

import type { SpeechClips } from '../../domain/ports/speech-clips.port';

const READ_TIMEOUT_MS = 2_000;

/**
 * Reuses the existing private speech-clip store for validated companion audio. Callers still
 * authorize, validate and rate-limit before reaching this adapter. A cached clip is read on the
 * server: its bearer URL never reaches the child. Recordings are passed straight through to the
 * provider, never to the clip store. A storage failure falls back to the provider, not a broken
 * lesson. Equal concurrent requests share one synthesis per server instance.
 */
export function cachedCompanionSpeech(
  provider: SpeechProvider,
  clips: SpeechClips,
): SpeechProvider {
  const running = new Map<string, AppResultAsync<SynthesizedSpeech, SpeechError>>();

  async function read(url: string): Promise<SynthesizedSpeech | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
      if (!response.ok) {
        return null;
      }
      return { audio: new Uint8Array(await response.arrayBuffer()), contentType: 'audio/mpeg' };
    } catch {
      return null;
    }
  }

  async function load(request: SynthesisRequest) {
    const content = { voice: request.voiceId, text: request.text };
    const found = await clips.find(content);
    if (found.isOk() && found.value !== null) {
      const spoken = await read(found.value.url);
      if (spoken !== null) {
        return okAsync(spoken);
      }
    }
    const synthesized = await provider.synthesize(request);
    if (synthesized.isOk()) {
      await clips.save(content, synthesized.value.audio, synthesized.value.contentType);
    }
    return synthesized;
  }

  return {
    transcribe: (request) => provider.transcribe(request),
    synthesize: (request) => {
      const key = `${request.voiceId}\u0000${request.text}`;
      const existing = running.get(key);
      if (existing !== undefined) {
        return existing;
      }
      const result = new ResultAsync(
        load(request).finally(() => {
          running.delete(key);
        }),
      );
      running.set(key, result);
      return result;
    },
  };
}
