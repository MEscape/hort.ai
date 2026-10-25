import { z } from 'zod';

import { MS_PER_MINUTE } from '@lib/utils';

import { booleanFlag, integerSetting } from './env-primitives';
import { refineEnv } from './env-rules';

import type { EnvRule } from './env-rules';

/** Gemini 3.8 Flash, the model the team chose for hints and feedback (#10). */
const DEFAULT_VERTEX_AI_MODEL_ID = 'gemini-3.8-flash';
/** The EU multi-region: requests are served by Google's European endpoint. */
const DEFAULT_VERTEX_AI_LOCATION = 'eu';
/** A child waits for the answer; a slower call falls back to the predefined prompt. */
const DEFAULT_VERTEX_AI_TIMEOUT_MS = 8000;
const MIN_VERTEX_AI_TIMEOUT_MS = 1000;
const MAX_VERTEX_AI_TIMEOUT_MS = MS_PER_MINUTE;

/** A Google Cloud project id: 6-30 lower-case letters, digits and hyphens, starting with a letter. */
const projectId = z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, {
  error: 'Must be a Google Cloud project id.',
});

/** A location such as `eu`, `global` or `europe-west4`. */
const location = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/, {
  error: 'Must be a Vertex AI location such as "eu" or "europe-west4".',
});

/** A publisher model id such as `gemini-3.8-flash`. */
const modelId = z.string().regex(/^[a-z0-9][a-z0-9.-]{0,63}$/, {
  error: 'Must be a Vertex AI model id such as "gemini-3.8-flash".',
});

const serviceAccountShape = z.object({
  client_email: z.email(),
  private_key: z.string().startsWith('-----BEGIN PRIVATE KEY-----'),
});

/** The service account's JSON key file, as one value. Only the email and the private key are kept. */
const serviceAccountKey = z.string().transform((raw, context) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    context.addIssue({
      code: 'custom',
      message: 'Must be the JSON key file of a service account.',
    });
    return z.NEVER;
  }
  const key = serviceAccountShape.safeParse(parsed);
  if (!key.success) {
    context.addIssue({
      code: 'custom',
      message: 'The service account key needs "client_email" and "private_key".',
    });
    return z.NEVER;
  }
  return { clientEmail: key.data.client_email, privateKey: key.data.private_key };
});

const aiEnvObjectSchema = z.object({
  /**
   * Off by default: the AI companion is only switched on once the provider's terms for an app used
   * by children are cleared (#10). While off, every hint is the predefined prompt of its level.
   */
  VERTEX_AI_ENABLED: booleanFlag(false),
  VERTEX_AI_PROJECT_ID: projectId.optional(),
  VERTEX_AI_LOCATION: location.default(DEFAULT_VERTEX_AI_LOCATION),
  VERTEX_AI_MODEL_ID: modelId.default(DEFAULT_VERTEX_AI_MODEL_ID),
  /** How long one model call may take before it counts as a timeout. */
  VERTEX_AI_TIMEOUT_MS: integerSetting(DEFAULT_VERTEX_AI_TIMEOUT_MS, {
    min: MIN_VERTEX_AI_TIMEOUT_MS,
    max: MAX_VERTEX_AI_TIMEOUT_MS,
  }),
  /** Server-only secret. Never logged, never shipped to the browser. */
  VERTEX_AI_SERVICE_ACCOUNT_KEY: serviceAccountKey.optional(),
});

export type AiEnv = z.infer<typeof aiEnvObjectSchema>;

/** What switching the AI on requires. */
export const aiEnvRules: ReadonlyArray<EnvRule<AiEnv>> = [
  {
    path: 'VERTEX_AI_PROJECT_ID',
    violated: (env) => env.VERTEX_AI_ENABLED && env.VERTEX_AI_PROJECT_ID === undefined,
    message: 'VERTEX_AI_PROJECT_ID is required when VERTEX_AI_ENABLED=true.',
  },
  {
    path: 'VERTEX_AI_SERVICE_ACCOUNT_KEY',
    violated: (env) => env.VERTEX_AI_ENABLED && env.VERTEX_AI_SERVICE_ACCOUNT_KEY === undefined,
    message: 'VERTEX_AI_SERVICE_ACCOUNT_KEY is required when VERTEX_AI_ENABLED=true.',
  },
];

/**
 * The AI model behind hints and answer feedback (#10, #14): Gemini on Vertex AI (Google Cloud),
 * authenticated as a service account. Vertex AI and not the Gemini API, whose terms exclude apps
 * likely to be used by people under 18.
 */
export const aiEnvSchema = aiEnvObjectSchema.superRefine(refineEnv(aiEnvRules));
