import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import type { AppResultAsync } from '@lib/result';

import type { AuthEmailKind } from '../mail/auth-email-templates';

const mailLogger = logger.withContext({ module: 'auth.mail' });

/**
 * Delivers one email and reports failure exactly once, here. It never
 * throws: for password-reset and sign-up the response must be identical
 * whether or not the address exists, and a delivery error that surfaced
 * only for real accounts would reintroduce the enumeration oracle.
 *
 * Only the error is logged. The message itself carries a single-use link.
 */
export async function deliverAuthEmail(
  sending: AppResultAsync<void, InfrastructureAppError>,
  kind: AuthEmailKind,
): Promise<void> {
  const result = await sending;
  if (result.isErr()) {
    mailLogger.error('auth.email_delivery_failed', result.error, { kind });
  }
}
