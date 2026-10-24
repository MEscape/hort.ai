import type { InfrastructureAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mailerNotConfigured } from '../../domain/errors/auth-errors';

import type { AuthMailer } from '../../domain/ports/auth-mailer.port';

function notConfigured(): AppResultAsync<void, InfrastructureAppError> {
  return errAsync(mailerNotConfigured());
}

/**
 * Fallback while `MAIL_PROVIDER=none`. It fails on every send, and the
 * failure is logged at error level by `deliverAuthEmail`, so a missing
 * mailer is loud instead of silently making verification and password reset
 * appear to work. It never sees, and so never logs, the message whose URL
 * carries a single-use token.
 */
export class UnconfiguredAuthMailer implements AuthMailer {
  sendVerification = notConfigured;
  sendPasswordReset = notConfigured;
  sendExistingAccountNotice = notConfigured;
}
