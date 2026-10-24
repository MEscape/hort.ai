import 'server-only';

import { logger } from '@lib/logger';

import type { RateLimitLog } from './rate-limit-log';

/** Adapts `@lib/logger` (free-form contexts) to the limiter's narrow, safe-to-log contexts. */
export function createRateLimitLog(): RateLimitLog {
  const base = logger.withContext({ module: 'rate-limit' });
  return {
    info: (message, context) => {
      base.info(message, { ...context });
    },
    warn: (message, context) => {
      base.warn(message, { ...context });
    },
    error: (message, error, context) => {
      base.error(message, error, { ...context });
    },
  };
}
