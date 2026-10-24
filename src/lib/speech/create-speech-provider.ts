import type { SpeechEnv } from '@lib/config/speech-env-schema';

import { ElevenLabsSpeechProvider } from './elevenlabs-speech-provider';

import type { SpeechProvider } from './speech-provider';

/**
 * Builds the provider the speech settings name, or `null` while `ELEVENLABS_API_KEY` is unset:
 * speech is then off and callers fall back to text. There is no fallback to another provider.
 */
export function createSpeechProvider(
  env: SpeechEnv,
  deps: { readonly fetch?: typeof fetch } = {},
): SpeechProvider | null {
  if (env.ELEVENLABS_API_KEY === undefined) {
    return null;
  }
  return new ElevenLabsSpeechProvider({
    apiKey: env.ELEVENLABS_API_KEY,
    apiUrl: env.ELEVENLABS_API_URL,
    ttsModelId: env.ELEVENLABS_TTS_MODEL_ID,
    sttModelId: env.ELEVENLABS_STT_MODEL_ID,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
}
