import { z } from 'zod';

import { aiEnvSchema } from './ai-env-schema';
import { authEnvSchema } from './auth-env-schema';
import { booleanFlag, integerSetting, postgresUrl } from './env-primitives';
import { refineEnv } from './env-rules';
import { mailEnvSchema } from './mail-env-schema';
import { rateLimitEnvRules, rateLimitEnvSchema } from './rate-limit-env-schema';
import { speechEnvSchema } from './speech-env-schema';
import { storageEnvSchema } from './storage-env-schema';

import type { AiEnv } from './ai-env-schema';
import type { AuthEnv } from './auth-env-schema';
import type { EnvRule } from './env-rules';
import type { MailEnv } from './mail-env-schema';
import type { RateLimitEnv } from './rate-limit-env-schema';
import type { SpeechEnv } from './speech-env-schema';
import type { StorageEnv } from './storage-env-schema';

const DEFAULT_NODE_ENV = 'development' as const;
const DEFAULT_DATABASE_POOL_SIZE = 10;
const DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS = 10;
const DEFAULT_LOG_LEVEL = 'info' as const;
/** Max, the dog: the first tutor of the catalog. */
const DEFAULT_ALEXA_TUTOR_ID = 'max';
const DEFAULT_AUDIT_RETENTION_DAYS = 365;

const serverEnvBaseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default(DEFAULT_NODE_ENV),

  DATABASE_URL: postgresUrl,

  // Missing configuration disables the endpoint (503), never disables authenticity checks.
  ALEXA_SKILL_ID: z
    .string()
    .regex(/^amzn1\.ask\.skill\.[a-zA-Z0-9-]+$/)
    .optional(),

  /** `false` keeps Alexa's standard voice for every answer; `true` speaks tutor answers in a tutor's voice. */
  ALEXA_TUTOR_VOICE: booleanFlag(true),

  /** Catalog id of the tutor whose voice Alexa uses. An id without a voice falls back to Alexa's voice. */
  ALEXA_TUTOR_ID: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,30}$/)
    .default(DEFAULT_ALEXA_TUTOR_ID),

  DATABASE_POOL_SIZE: integerSetting(DEFAULT_DATABASE_POOL_SIZE),

  DATABASE_POOL_TIMEOUT_SECONDS: integerSetting(DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(DEFAULT_LOG_LEVEL),

  /** How many days the audit trail keeps an entry before the daily retention sweep deletes it. */
  AUDIT_RETENTION_DAYS: integerSetting(DEFAULT_AUDIT_RETENTION_DAYS),
});

/** Everything the server schema validates, as one value: what the rules below read. */
type ServerEnvShape = z.infer<typeof serverEnvBaseSchema> &
  AuthEnv &
  MailEnv &
  RateLimitEnv &
  StorageEnv &
  SpeechEnv &
  AiEnv;

const isProduction = (env: ServerEnvShape) => env.NODE_ENV === 'production';

/** What production demands of the domains together; a domain's own requirements stay in its file. */
const productionRules: ReadonlyArray<EnvRule<ServerEnvShape>> = [
  {
    path: 'AUTH_ENABLED',
    violated: (env) => isProduction(env) && !env.AUTH_ENABLED,
    message: 'AUTH_ENABLED=false is not allowed when NODE_ENV=production.',
  },
  {
    path: 'RATE_LIMIT_ENABLED',
    violated: (env) => isProduction(env) && !env.RATE_LIMIT_ENABLED,
    message: 'RATE_LIMIT_ENABLED=false is not allowed when NODE_ENV=production.',
  },
  {
    path: 'MAIL_PROVIDER',
    violated: (env) => isProduction(env) && env.MAIL_PROVIDER === 'none',
    message: 'MAIL_PROVIDER must be "smtp" or "resend" in production: sign-in sends e-mail.',
  },
  {
    path: 'MAIL_PROVIDER',
    violated: (env) => !isProduction(env) && env.MAIL_PROVIDER === 'resend',
    message: 'MAIL_PROVIDER must be "none" or "smtp" outside production.',
  },
  {
    path: 'MAIL_API_URL',
    // Every request carries MAIL_API_KEY as a bearer credential.
    violated: (env) =>
      isProduction(env) &&
      env.MAIL_PROVIDER === 'resend' &&
      new URL(env.MAIL_API_URL).protocol !== 'https:',
    message: 'MAIL_API_URL must be an https URL in production.',
  },
  {
    path: 'GEMINI_API_URL',
    // Every request carries GEMINI_API_KEY and a child's task text.
    violated: (env) => isProduction(env) && new URL(env.GEMINI_API_URL).protocol !== 'https:',
    message: 'GEMINI_API_URL must be an https URL in production.',
  },
  {
    path: 'ELEVENLABS_API_URL',
    // Every request carries ELEVENLABS_API_KEY and a child's recorded voice.
    violated: (env) => isProduction(env) && new URL(env.ELEVENLABS_API_URL).protocol !== 'https:',
    message: 'ELEVENLABS_API_URL must be an https URL in production.',
  },
  ...(['STORAGE_AZURE_BLOB_ENDPOINT', 'STORAGE_PUBLIC_BASE_URL'] as const).map(
    (name): EnvRule<ServerEnvShape> => ({
      path: name,
      // Signed upload and read URLs (bearer credentials) and public delivery must not travel over plain HTTP.
      violated: (env) => {
        const value = env[name];
        return isProduction(env) && value !== undefined && new URL(value).protocol !== 'https:';
      },
      message: `${name} must be an https URL in production.`,
    }),
  ),
];

/**
 * Server-only configuration.
 *
 * Authentication, mail, rate-limit, storage, speech and AI configuration are composed into the
 * server schema so the application has one validated server configuration
 * object. Rules internal to one domain live in that domain's file and are
 * attached there (authentication, mail) or here (rate limit, which reads
 * `NODE_ENV` and the authentication secret); rules that span the domains are
 * `productionRules`.
 */
export const serverEnvSchema = serverEnvBaseSchema
  .and(authEnvSchema)
  .and(mailEnvSchema)
  .and(rateLimitEnvSchema)
  .and(storageEnvSchema)
  .and(speechEnvSchema)
  .and(aiEnvSchema)
  .superRefine(refineEnv<ServerEnvShape>(rateLimitEnvRules, productionRules));

export type ServerEnv = z.infer<typeof serverEnvSchema>;
