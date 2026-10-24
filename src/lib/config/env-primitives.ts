import { z } from 'zod';

/**
 * Building blocks shared by the per-domain env schemas.
 *
 * Environment values are strings (or absent), so each primitive states how a
 * string becomes a typed value. Pure Zod, no Node built-ins and no server
 * dependency: it is imported by the public schema too, which can sit in a
 * browser bundle.
 */

/**
 * An environment flag is exactly the text `true` or `false`; absent means
 * `defaultValue`. `z.coerce.boolean()` is not used: it turns every non-empty
 * string, including "false", into `true`.
 */
export const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true'));

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
) => {
  const bounded = z.coerce.number().int().min(min);
  return (max === undefined ? bounded : bounded.max(max)).default(defaultValue);
};

/** An http(s) URL. Other schemes (`javascript:`, `file:`, `ftp:`) are never a valid endpoint here. */
export const httpUrl = z.url({ protocol: /^https?$/, error: 'Must be an http(s) URL.' });

/**
 * A PostgreSQL connection URL. A password containing reserved characters
 * (`@ : / ? # %`) must be percent-encoded.
 */
export const postgresUrl = z.url({
  protocol: /^postgres(ql)?$/,
  error: 'Must be a PostgreSQL connection URL: postgresql://user:password@host:5432/database.',
});
