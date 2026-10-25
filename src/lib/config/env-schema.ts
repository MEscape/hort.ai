import { z } from 'zod';

import { aiEnvSchema } from './ai-env-schema';
import { authEnvSchema } from './auth-env-schema';
import { booleanFlag, integerSetting, postgresUrl } from './env-primitives';
import { refineEnv } from './env-rules';
import { mailEnvSchema } from './mail-env-schema';
import {
  effectiveClientAddress,
  rateLimitEnvRules,
  rateLimitEnvSchema,
} from './rate-limit-env-schema';
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
const DEMO_ID_MAX_LENGTH = 128;

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

  /** Catalog id of the tutor whose voice speaks Alexa tutor replies (launch greetings use each tutor's own). */
  ALEXA_TUTOR_ID: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,30}$/)
    .default(DEFAULT_ALEXA_TUTOR_ID),

  /**
   * Alexa demo coupling: the guardian (user id) and the one child profile of that guardian the skill
   * speaks for. Both or neither; unset keeps the anonymous channel (tutor introductions, test sentence).
   */
  ALEXA_DEMO_GUARDIAN_ID: z.string().trim().min(1).max(DEMO_ID_MAX_LENGTH).optional(),
  ALEXA_DEMO_CHILD_PROFILE_ID: z.string().trim().min(1).max(DEMO_ID_MAX_LENGTH).optional(),

  DATABASE_POOL_SIZE: integerSetting(DEFAULT_DATABASE_POOL_SIZE),

  DATABASE_POOL_TIMEOUT_SECONDS: integerSetting(DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(DEFAULT_LOG_LEVEL),

  /** How many days the audit trail keeps an entry before the daily retention sweep deletes it. */
  AUDIT_RETENTION_DAYS: integerSetting(DEFAULT_AUDIT_RETENTION_DAYS),

  /**
   * 32 random bytes, base64 (`openssl rand -base64 32`), that encrypt classroom invite codes at rest
   * (AES-256-GCM) so a teacher can see their class's code again. Unset: codes are stored as a hash
   * only, as before, and a teacher must replace a code to see one. Server-only; never log it.
   * Changing it makes the stored codes unreadable (they show as unavailable until replaced).
   */
  CLASSROOM_INVITE_CODE_KEY: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/, { error: 'Must be 32 random bytes, base64-encoded.' })
    .optional(),
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
    path: 'ALEXA_DEMO_CHILD_PROFILE_ID',
    violated: (env) =>
      (env.ALEXA_DEMO_GUARDIAN_ID === undefined) !==
      (env.ALEXA_DEMO_CHILD_PROFILE_ID === undefined),
    message: 'ALEXA_DEMO_GUARDIAN_ID and ALEXA_DEMO_CHILD_PROFILE_ID must be set together.',
  },
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
    path: 'TYPESAFE_API_URL',
    // Every request carries TYPESAFE_API_KEY and AI text meant for a child.
    violated: (env) => isProduction(env) && new URL(env.TYPESAFE_API_URL).protocol !== 'https:',
    message: 'TYPESAFE_API_URL must be an https URL in production.',
  },
  {
    path: 'TYPESAFE_API_KEY',
    // The word lists alone are not enough for generated text a child reads.
    violated: (env) =>
      isProduction(env) && env.GEMINI_API_KEY !== undefined && env.TYPESAFE_API_KEY === undefined,
    message:
      'TYPESAFE_API_KEY is required in production when GEMINI_API_KEY is set: every AI text needs the second safety check.',
  },
  {
    path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
    // Unset on an unknown platform resolves no address, which would skip every per-address budget.
    violated: (env) => isProduction(env) && !effectiveClientAddress(env).configured,
    message:
      'Set RATE_LIMIT_CLIENT_ADDRESS_SOURCE (or AUTH_TRUSTED_PROXIES) in production; otherwise every budget per client address is silently off.',
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
