import 'server-only';

import { logger } from '@lib/logger';

import type { AppError } from './app-error';

/**
 * Server-only: it logs, and the logger reads server configuration. Import it as
 * `@lib/errors/escalate`; the `@lib/errors` barrel stays free of server code so
 * Client Components can import error types and factories.
 *
 * Logged once, here, then handed to the nearest `error.tsx` boundary.
 */
export function escalate(error: AppError): never {
  logger.error('route.failed', error, { code: error.code });
  throw new Error(error.code, { cause: error });
}
