import { z } from 'zod';

import { serverEnvSchema } from '@lib/config/env-schema';
import { publicEnvSchema } from '@lib/config/public-env-schema';

/**
 * The environment every unit test starts from. It runs before `vitest.setup.ts` and before any
 * test imports `@lib/config`, which validates the server environment the first time it loads.
 *
 * A Vercel build exports the project's own settings (and `VERCEL`), which would change what that
 * validation sees, so every variable the schemas declare is dropped first. The variables to drop
 * come from the schemas, so a new setting is covered without touching this file.
 */
const declaredKeys = (schema: z.ZodType): string[] => {
  const keys: string[] = [];
  const collect = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) {
      return;
    }
    const { properties } = node as { properties?: Record<string, unknown> };
    keys.push(...Object.keys(properties ?? {}));
    Object.values(node).forEach(collect);
  };
  collect(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));
  return keys;
};

for (const key of [...declaredKeys(serverEnvSchema), ...declaredKeys(publicEnvSchema)]) {
  Reflect.deleteProperty(process.env, key);
}

// Placeholders, not services: nothing here connects to a database.
Object.assign(process.env, {
  // Vercel builds run with NODE_ENV=production; React then has no `act` and config validation is strict.
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test_auth',
  AUTH_SECRET: 'test-secret-test-secret-test-secret-test-secret',
  // Rate limiting always uses the Upstash store, so its settings are required too.
  UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
});
