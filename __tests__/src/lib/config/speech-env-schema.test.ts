import { describe, expect, it } from 'vitest';

import { speechEnvSchema } from '@lib/config/speech-env-schema';

function problems(env: Record<string, string | undefined>): string[] {
  const result = speechEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('speechEnvSchema', () => {
  it('turns speech off without a key and fills in the defaults', () => {
    expect(speechEnvSchema.parse({})).toEqual({
      ELEVENLABS_API_URL: 'https://api.elevenlabs.io',
      ELEVENLABS_TTS_MODEL_ID: 'eleven_multilingual_v2',
      ELEVENLABS_STT_MODEL_ID: 'scribe_v1',
      ELEVENLABS_TIMEOUT_MS: 20_000,
    });
  });

  it('accepts a key and overrides', () => {
    expect(
      problems({
        ELEVENLABS_API_KEY: 'k'.repeat(32),
        ELEVENLABS_TTS_MODEL_ID: 'eleven_flash_v2_5',
        ELEVENLABS_TIMEOUT_MS: '5000',
      }),
    ).toEqual([]);
  });

  it('refuses a key with spaces, odd model ids, other schemes and silly timeouts', () => {
    expect(problems({ ELEVENLABS_API_KEY: 'sk with spaces in the key value' })).toEqual([
      'ELEVENLABS_API_KEY',
    ]);
    expect(problems({ ELEVENLABS_STT_MODEL_ID: 'Scribe V1' })).toEqual(['ELEVENLABS_STT_MODEL_ID']);
    expect(problems({ ELEVENLABS_API_URL: 'ftp://api.elevenlabs.io' })).toEqual([
      'ELEVENLABS_API_URL',
    ]);
    expect(problems({ ELEVENLABS_TIMEOUT_MS: '10' })).toEqual(['ELEVENLABS_TIMEOUT_MS']);
  });
});
