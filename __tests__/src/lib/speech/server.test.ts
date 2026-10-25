import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@lib/config/server');
});

const settings = {
  ELEVENLABS_API_URL: 'https://api.elevenlabs.io',
  ELEVENLABS_TTS_MODEL_ID: 'eleven_multilingual_v2',
  ELEVENLABS_STT_MODEL_ID: 'scribe_v1',
  ELEVENLABS_TIMEOUT_MS: 20_000,
};

describe('getSpeechProvider', () => {
  it('is null while no key is configured', async () => {
    vi.doMock('@lib/config/server', () => ({ serverEnv: settings }));
    const { getSpeechProvider } = await import('@lib/speech/server');

    expect(getSpeechProvider()).toBeNull();
  });

  it('builds the configured provider once', async () => {
    vi.doMock('@lib/config/server', () => ({
      serverEnv: { ...settings, ELEVENLABS_API_KEY: 'k'.repeat(32) },
    }));
    const { getSpeechProvider } = await import('@lib/speech/server');

    const provider = getSpeechProvider();
    expect(provider).not.toBeNull();
    expect(getSpeechProvider()).toBe(provider);
  });
});
