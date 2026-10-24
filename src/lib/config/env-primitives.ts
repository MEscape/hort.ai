import { z } from 'zod';

/**
 * Building blocks shared by the per-domain env schemas.
 *
 * Environment values are strings (or absent), so each primitive states how a
 * string becomes a typed value. Pure Zod, no Node built-ins and no server
 * dependency: it is imported by the public schema too, which can sit in a
 * browser bundle.
 */

export const SENSITIVE_PLACEHOLDER = '[SENSITIVE]';

/**
 * An environment flag is exactly the boolean `true`/`false` or the text `"true"`/`"false"`;
 * absent means `defaultValue`. `z.coerce.boolean()` is not used: it turns every non-empty
 * string, including "false", into `true`.
 */
export const booleanFlag = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return defaultValue;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      if (value === SENSITIVE_PLACEHOLDER) {
        ctx.addIssue({
          code: 'custom',
          message: 'Must not be a [SENSITIVE] placeholder.',
        });
        return z.NEVER;
      }
      ctx.addIssue({
        code: 'custom',
        message: 'Must be "true" or "false".',
      });
      return z.NEVER;
    });

/** A comma-separated list. Entries are trimmed, empty entries dropped; absent means `[]`. */
export const commaSeparatedList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

interface IntegerSettingBounds {
  /** Inclusive lower bound. Defaults to 1: every numeric setting here is a count, size or duration. */
  readonly min?: number;
  /** Inclusive upper bound. Unbounded when omitted. */
  readonly max?: number;
}

/** An integer within `[min, max]`; `defaultValue` when the variable is absent. */
export const integerSetting = (
  defaultValue: number,
  { min = 1, max }: IntegerSettingBounds = {},
) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return defaultValue;
      }
      if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
          ctx.addIssue({ code: 'custom', message: 'Must be an integer.' });
          return z.NEVER;
        }
        if (min !== undefined && value < min) {
          ctx.addIssue({ code: 'custom', message: `Must be at least ${min}.` });
          return z.NEVER;
        }
        if (max !== undefined && value > max) {
          ctx.addIssue({ code: 'custom', message: `Must be at most ${max}.` });
          return z.NEVER;
        }
        return value;
      }
      if (value === SENSITIVE_PLACEHOLDER) {
        ctx.addIssue({
          code: 'custom',
          message: 'Must not be a [SENSITIVE] placeholder.',
        });
        return z.NEVER;
      }
      if (!/^-?\d+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: 'Must be an integer.' });
        return z.NEVER;
      }
      const parsed = parseInt(value, 10);
      if (min !== undefined && parsed < min) {
        ctx.addIssue({ code: 'custom', message: `Must be at least ${min}.` });
        return z.NEVER;
      }
      if (max !== undefined && parsed > max) {
        ctx.addIssue({ code: 'custom', message: `Must be at most ${max}.` });
        return z.NEVER;
      }
      return parsed;
    });

/** An http(s) URL. Other schemes (`javascript:`, `file:`, `ftp:`) are never a valid endpoint here. */
export const httpUrl = z
  .string()
  .refine((val) => val !== SENSITIVE_PLACEHOLDER, {
    message: 'Must not be a [SENSITIVE] placeholder.',
  })
  .pipe(z.url({ protocol: /^https?$/, error: 'Must be an http(s) URL.' }));

/**
 * A PostgreSQL connection URL. A password containing reserved characters
 * (`@ : / ? # %`) must be percent-encoded.
 */
export const postgresUrl = z
  .string()
  .refine((val) => val !== SENSITIVE_PLACEHOLDER, {
    message: 'Must not be a [SENSITIVE] placeholder.',
  })
  .pipe(
    z.url({
      protocol: /^postgres(ql)?$/,
      error: 'Must be a PostgreSQL connection URL: postgresql://user:password@host:5432/database.',
    }),
  );

/** A required string that cannot be a [SENSITIVE] placeholder. */
export const nonSensitiveString = z
  .string()
  .refine((val) => val !== SENSITIVE_PLACEHOLDER, {
    message: 'Must not be a [SENSITIVE] placeholder.',
  });
