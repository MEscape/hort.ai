import type { AppResultAsync } from '@lib/result';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthenticationDependencies } from '../auth-dependencies';

/**
 * Ends the current session. Idempotent: signing out while signed out succeeds.
 *
 * @authorization public Ends whatever session the request carries; without one it is a no-op.
 * @rate-limit none Ends the caller's own session and nothing else; there is no work to protect and nothing to guess.
 * @audit-exempt Outcomes are audited by the identity provider hooks (create-security-audit-options) where sessions and accounts change; the command itself changes nothing else.
 */
export class SignOut {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(): AppResultAsync<void, AuthenticatorError> {
    return this.deps.authenticator.signOut();
  }
}
