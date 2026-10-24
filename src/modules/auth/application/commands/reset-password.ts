import type { AppResultAsync } from '@lib/result';

import { createPasswordResetDraft } from '../../domain/models/credentials';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceClientLimit } from '../services/enforce-rate-limit';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthenticationDependencies } from '../auth-dependencies';
import type { PasswordResetInput } from '../contracts/auth-inputs';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type ResetPasswordError = AuthenticatorError | RateLimitError;

/**
 * Sets a new password from an emailed token. The token is single-use,
 * high-entropy and short-lived, so guessing is not a practical attack; the
 * caller's address is still limited, to bound the work one client can ask
 * for. Existing sessions are revoked by the provider.
 *
 * @authorization public The emailed single-use token is the credential; the rate limiter gates it.
 * @audit-exempt Outcomes are audited by the identity provider hooks (create-security-audit-options) where sessions and accounts change; a refusal by the rate limiter is logged by the limiter itself.
 */
export class ResetPassword {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(input: PasswordResetInput): AppResultAsync<void, ResetPasswordError> {
    return createPasswordResetDraft(input).asyncAndThen((draft) =>
      enforceClientLimit(this.deps, AUTH_RATE_LIMITS.passwordResetClient).andThen(() =>
        this.deps.authenticator.resetPassword(draft),
      ),
    );
  }
}
