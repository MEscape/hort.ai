import type { ZodType } from 'zod';

/**
 * Validates `source` against `schema` or throws one error listing the
 * variables that failed. configuration.md: "fail fast when required
 * configuration is missing" — callers run this at import time, so a bad
 * variable stops startup rather than failing deep in a request.
 *
 * Every variable that fails its own validation is listed. Rules that compare
 * several variables (production guards, "required when X is enabled") need
 * well-typed values, so they run once the individual variables are valid and
 * can surface in a second pass.
 *
 * The message carries variable names and the reason, never the offending value:
 * a rejected secret must not end up in logs.
 */
export function parseEnv<T>(label: 'server' | 'public', schema: ZodType<T>, source: unknown): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(configuration)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid ${label} environment configuration:\n${issues}`);
  }
  return result.data;
}
