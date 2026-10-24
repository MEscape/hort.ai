import { describe, expect, it, vi } from 'vitest';

import type { SpeechEnv } from '@lib/config/speech-env-schema';
import { createSpeechProvider } from '@lib/speech/create-speech-provider';
import { ElevenLabsSpeechProvider } from '@lib/speech/elevenlabs-speech-provider';

const defaults: SpeechEnv = {
  ELEVENLABS_API_URL: 'https://api.elevenlabs.io',
  ELEVENLABS_TTS_MODEL_ID: 'eleven_multilingual_v2',
  ELEVENLABS_STT_MODEL_ID: 'scribe_v1',
  ELEVENLABS_TIMEOUT_MS: 20_000,
};

describe('createSpeechProvider', () => {
  it('builds no provider while the key is unset: speech is off', () => {
    expect(createSpeechProvider(defaults)).toBeNull();
  });

  it('builds the ElevenLabs provider from the settings', async () => {
    const send = vi.fn(() => Promise.resolve(new Response(new Uint8Array([1]), { status: 200 })));
    const provider = createSpeechProvider(
      { ...defaults, ELEVENLABS_API_KEY: 'k'.repeat(32) },
      { fetch: send as unknown as typeof fetch },
    );

    expect(provider).toBeInstanceOf(ElevenLabsSpeechProvider);
    await provider?.synthesize({ text: 'Hallo', voiceId: 'Voice123' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('uses the platform fetch when none is injected', () => {
    expect(
      createSpeechProvider({ ...defaults, ELEVENLABS_API_KEY: 'k'.repeat(32) }),
    ).toBeInstanceOf(ElevenLabsSpeechProvider);
  });
});
