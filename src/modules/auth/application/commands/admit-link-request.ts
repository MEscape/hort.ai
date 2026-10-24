import type { AppResultAsync } from '@lib/result';

import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceClientLimit } from '../services/enforce-rate-limit';

import type { AuthenticationDependencies } from '../auth-dependencies';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type AdmitLinkRequestError = RateLimitError;

/**
 * Whether the emailed link being opened over HTTP (verifying an address, starting a password reset) may
 * be served now. It spends one attempt from the caller's address budget and nothing else: the link's
 * token is checked by the identity provider, and the provider's own limiter is switched off, so this is
 * the one budget that bounds how much of that work a client can ask for.
 *
 * @authorization public Opening an emailed link needs no session; the single-use token in the link is the credential.
 * @audit-exempt Nothing changes here and the token's outcome is audited by the identity provider hooks (create-security-audit-options); a refusal by the rate limiter is logged by the limiter itself.
 */
export class AdmitLinkRequest {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(): AppResultAsync<void, AdmitLinkRequestError> {
    return enforceClientLimit(this.deps, AUTH_RATE_LIMITS.linkClient);
  }
}
