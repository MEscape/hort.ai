import { z } from 'zod';

import { SECONDS_PER_MINUTE, slugify } from '@lib/utils';

import { booleanFlag, commaSeparatedList, integerSetting, postgresUrl } from './env-primitives';
import { refineEnv } from './env-rules';

import type { EnvRule } from './env-rules';

const SECONDS_PER_DAY = 24 * 60 * SECONDS_PER_MINUTE;

const DEFAULT_AUTH_ENABLED = true;
const DEFAULT_AUTH_DATABASE_POOL_SIZE = 5;

const DEFAULT_SESSION_EXPIRES_IN_SECONDS = 7 * SECONDS_PER_DAY;
const DEFAULT_SESSION_UPDATE_AGE_SECONDS = SECONDS_PER_DAY;
const DEFAULT_SESSION_FRESH_AGE_SECONDS = 15 * SECONDS_PER_MINUTE;
const DEFAULT_SESSION_MAX_LIFETIME_SECONDS = 30 * SECONDS_PER_DAY;

const DEFAULT_TENANT_ID = 'default';
const TENANT_ID_MAX_LENGTH = 64;

const MIN_AUTH_SECRET_LENGTH = 32;

const authEnvObjectSchema = z.object({
  /** `false` skips sign-in and acts as a fixed parent of the default tenant. Refused in production (see `env-schema.ts`). */
  AUTH_ENABLED: booleanFlag(DEFAULT_AUTH_ENABLED),

  /** Signs sessions and tokens. Required, at least `MIN_AUTH_SECRET_LENGTH` characters, once auth is enabled. */
  AUTH_SECRET: z.string().optional(),

  /** Database holding the authentication tables. Required once auth is enabled. */
  AUTH_DATABASE_URL: postgresUrl.optional(),

  AUTH_DATABASE_POOL_SIZE: integerSetting(DEFAULT_AUTH_DATABASE_POOL_SIZE),

  /** Session lifetime. */
  AUTH_SESSION_EXPIRES_IN_SECONDS: integerSetting(DEFAULT_SESSION_EXPIRES_IN_SECONDS),

  /** How often a session in use is extended. Not above the session lifetime. */
  AUTH_SESSION_UPDATE_AGE_SECONDS: integerSetting(DEFAULT_SESSION_UPDATE_AGE_SECONDS),

  /** How recent a sign-in must be for sensitive actions. Not above the session lifetime. */
  AUTH_SESSION_FRESH_AGE_SECONDS: integerSetting(DEFAULT_SESSION_FRESH_AGE_SECONDS),

  /** Hard cap on a session's total age, however often it is extended. Not below the session lifetime. */
  AUTH_SESSION_MAX_LIFETIME_SECONDS: integerSetting(DEFAULT_SESSION_MAX_LIFETIME_SECONDS),

  /** IPs or CIDR ranges of the reverse proxies in front of the app. Entries are checked by the rate-limit rules. */
  AUTH_TRUSTED_PROXIES: commaSeparatedList,

  /**
   * Confirmed accounts with these addresses are platform admins: every `learner.*` permission on any
   * parent's data in the tenant. The one bootstrap admin who can later promote others; revoking is
   * removing the address. Lower-cased so the comparison with a session is exact.
   */
  AUTH_PLATFORM_ADMIN_EMAILS: commaSeparatedList.pipe(
    z.array(z.email().transform((email) => email.toLowerCase())),
  ),

  /**
   * The one tenant every account belongs to. Lower-case letters, digits and single hyphens (the shape
   * of a slug), at most `TENANT_ID_MAX_LENGTH` characters; the auth module's `createTenantId` checks
   * the same rule. No request can choose another.
   */
  AUTH_DEFAULT_TENANT_ID: z
    .string()
    .min(1)
    .max(TENANT_ID_MAX_LENGTH)
    .refine((value) => slugify(value) === value, {
      error: 'Must be lower-case letters, digits and single hyphens.',
    })
    .default(DEFAULT_TENANT_ID),
});

export type AuthEnv = z.infer<typeof authEnvObjectSchema>;

/** Auth is off in development only, and then none of its settings matter. */
const whileEnabled = (breaks: (env: AuthEnv) => boolean) => (env: AuthEnv) =>
  env.AUTH_ENABLED && breaks(env);

/** What must hold once auth is enabled. */
export const authEnvRules: ReadonlyArray<EnvRule<AuthEnv>> = [
  {
    path: 'AUTH_SECRET',
    violated: whileEnabled((env) => (env.AUTH_SECRET?.length ?? 0) < MIN_AUTH_SECRET_LENGTH),
    message: `AUTH_SECRET is required and must be at least ${MIN_AUTH_SECRET_LENGTH} characters when auth is enabled.`,
  },
  {
    path: 'AUTH_DATABASE_URL',
    violated: whileEnabled((env) => !env.AUTH_DATABASE_URL),
    message: 'AUTH_DATABASE_URL is required when auth is enabled.',
  },
  {
    path: 'AUTH_SESSION_UPDATE_AGE_SECONDS',
    violated: whileEnabled(
      (env) => env.AUTH_SESSION_UPDATE_AGE_SECONDS > env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    ),
    message: 'Must not exceed AUTH_SESSION_EXPIRES_IN_SECONDS.',
  },
  {
    path: 'AUTH_SESSION_FRESH_AGE_SECONDS',
    violated: whileEnabled(
      (env) => env.AUTH_SESSION_FRESH_AGE_SECONDS > env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    ),
    message: 'Must not exceed AUTH_SESSION_EXPIRES_IN_SECONDS.',
  },
  {
    path: 'AUTH_SESSION_MAX_LIFETIME_SECONDS',
    violated: whileEnabled(
      (env) => env.AUTH_SESSION_MAX_LIFETIME_SECONDS < env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    ),
    message: 'Must be at least AUTH_SESSION_EXPIRES_IN_SECONDS.',
  },
];

export const authEnvSchema = authEnvObjectSchema.superRefine(refineEnv(authEnvRules));
