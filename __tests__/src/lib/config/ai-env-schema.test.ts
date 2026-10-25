import { describe, expect, it } from 'vitest';

import { aiEnvSchema } from '@lib/config/ai-env-schema';

const KEY = JSON.stringify({
  type: 'service_account',
  client_email: 'hortai@hortai-eu.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
});

function problems(env: Record<string, string | undefined>): string[] {
  const result = aiEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('aiEnvSchema', () => {
  it('keeps the AI off by default, with Gemini 3.8 Flash in the EU', () => {
    expect(aiEnvSchema.parse({})).toEqual({
      VERTEX_AI_ENABLED: false,
      VERTEX_AI_LOCATION: 'eu',
      VERTEX_AI_MODEL_ID: 'gemini-3.8-flash',
      VERTEX_AI_TIMEOUT_MS: 8000,
    });
  });

  it('switches on with a project and a service account key, keeping only email and key', () => {
    const env = aiEnvSchema.parse({
      VERTEX_AI_ENABLED: 'true',
      VERTEX_AI_PROJECT_ID: 'hortai-eu',
      VERTEX_AI_LOCATION: 'europe-west4',
      VERTEX_AI_SERVICE_ACCOUNT_KEY: KEY,
    });

    expect(env.VERTEX_AI_SERVICE_ACCOUNT_KEY).toEqual({
      clientEmail: 'hortai@hortai-eu.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    });
    expect(env.VERTEX_AI_LOCATION).toBe('europe-west4');
  });

  it('refuses to switch on without a project or a key', () => {
    expect(problems({ VERTEX_AI_ENABLED: 'true' })).toEqual([
      'VERTEX_AI_PROJECT_ID',
      'VERTEX_AI_SERVICE_ACCOUNT_KEY',
    ]);
  });

  it('refuses a key that is not JSON or lacks the email or the private key', () => {
    expect(problems({ VERTEX_AI_SERVICE_ACCOUNT_KEY: 'not json' })).toEqual([
      'VERTEX_AI_SERVICE_ACCOUNT_KEY',
    ]);
    expect(
      problems({ VERTEX_AI_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'a@b.de' }) }),
    ).toEqual(['VERTEX_AI_SERVICE_ACCOUNT_KEY']);
  });

  it('never echoes the key in a refusal', () => {
    const result = aiEnvSchema.safeParse({
      VERTEX_AI_SERVICE_ACCOUNT_KEY: JSON.stringify({ private_key: 'secret-key-material' }),
    });

    expect(JSON.stringify(result.error?.issues)).not.toContain('secret-key-material');
  });

  it('refuses odd project ids, locations, model ids and timeouts', () => {
    expect(problems({ VERTEX_AI_PROJECT_ID: 'Hort AI' })).toEqual(['VERTEX_AI_PROJECT_ID']);
    expect(problems({ VERTEX_AI_LOCATION: 'eu/../us' })).toEqual(['VERTEX_AI_LOCATION']);
    expect(problems({ VERTEX_AI_MODEL_ID: 'gemini 3.8' })).toEqual(['VERTEX_AI_MODEL_ID']);
    expect(problems({ VERTEX_AI_TIMEOUT_MS: '10' })).toEqual(['VERTEX_AI_TIMEOUT_MS']);
  });
});
