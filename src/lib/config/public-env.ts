import { parseEnv } from './parse-env';
import { publicEnvSchema, type PublicEnv } from './public-env-schema';

/**
 * The configuration safe to reach from Client Components. Each variable is
 * named literally because the bundler inlines `process.env.NEXT_PUBLIC_*`
 * per reference; reading the whole object would be empty in the browser.
 *
 * Secrets live in `./server` instead, which refuses to enter a client bundle.
 */
export const publicEnv: PublicEnv = parseEnv('public', publicEnvSchema, {
  NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
});
