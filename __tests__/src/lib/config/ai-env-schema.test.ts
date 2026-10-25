import { describe, expect, it } from 'vitest';

import { aiEnvSchema } from '@lib/config/ai-env-schema';

function problems(env: Record<string, string | undefined>): string[] {
  const result = aiEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('aiEnvSchema', () => {
  it('turns the AI off without a key and fills in Gemini 3.8 Flash', () => {
    expect(aiEnvSchema.parse({})).toEqual({
      GEMINI_API_URL: 'https://generativelanguage.googleapis.com',
      GEMINI_MODEL_ID: 'gemini-3.8-flash',
      GEMINI_TIMEOUT_MS: 8000,
      TYPESAFE_API_URL: 'https://api.typesafe.ai',
      TYPESAFE_MODEL_ID: 'jev-1.14.0',
      TYPESAFE_TIMEOUT_MS: 3000,
    });
  });

  it('accepts a key and overrides', () => {
    expect(
      problems({
        GEMINI_API_KEY: 'k'.repeat(39),
        GEMINI_MODEL_ID: 'gemini-3.6-flash',
        GEMINI_TIMEOUT_MS: '5000',
        TYPESAFE_API_KEY: 't'.repeat(40),
        TYPESAFE_MODEL_ID: 'jev-1.13.0',
      }),
    ).toEqual([]);
  });

  it('refuses a key with spaces, odd model ids, other schemes and silly timeouts', () => {
    expect(problems({ GEMINI_API_KEY: 'key with spaces in the value' })).toEqual([
      'GEMINI_API_KEY',
    ]);
    expect(problems({ GEMINI_MODEL_ID: 'Gemini 3.8' })).toEqual(['GEMINI_MODEL_ID']);
    expect(problems({ GEMINI_API_URL: 'ftp://generativelanguage.googleapis.com' })).toEqual([
      'GEMINI_API_URL',
    ]);
    expect(problems({ GEMINI_TIMEOUT_MS: '10' })).toEqual(['GEMINI_TIMEOUT_MS']);
    expect(problems({ TYPESAFE_API_KEY: 'short' })).toEqual(['TYPESAFE_API_KEY']);
    expect(problems({ TYPESAFE_MODEL_ID: 'gpt-5' })).toEqual(['TYPESAFE_MODEL_ID']);
    expect(problems({ TYPESAFE_TIMEOUT_MS: '100' })).toEqual(['TYPESAFE_TIMEOUT_MS']);
  });
});
