import { z } from 'zod';

import { httpUrl } from './env-primitives';

const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3000';

/**
 * Public configuration.
 *
 * Only values explicitly intended for the client belong here. This file has
 * no server dependency so it can sit in a browser bundle.
 */
export const publicEnvSchema = z.object({
  /** Origin the app is served from. */
  NEXT_PUBLIC_APP_URL: httpUrl.default(DEFAULT_PUBLIC_APP_URL),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
