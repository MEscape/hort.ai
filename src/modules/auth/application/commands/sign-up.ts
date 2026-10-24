import type { AppResultAsync } from '@lib/result';

import { createSignUpDraft } from '../../domain/models/credentials';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceClientAndAccountLimits } from '../services/enforce-rate-limit';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthenticationDependencies } from '../auth-dependencies';
import type { SignUpInput } from '../contracts/auth-inputs';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type SignUpError = AuthenticatorError | RateLimitError;

/**
 * Opens an account for anyone who asks. Validates first, then spends one attempt from the
 * caller's and the address's budgets, and only then touches the provider, so a throttled caller
 * learns nothing about which addresses are registered.
 *
 * The account does nothing until its address is confirmed (the provider refuses to sign in an
 * unconfirmed address). Once confirmed it is a parent of the configured tenant and nothing else:
 * the tenant is deployment configuration, so no request chooses it. The answer is the same for an
 * address that already has an account: its owner is told by email instead (`sendExistingAccountNotice`).
 *
 * @authorization public Creating an account is how an actor comes to exist; the rate limiter gates it.
 * @audit-exempt The account's creation is audited by the identity provider hook (create-security-audit-options); an attempt on an existing address only sends a notice to its owner; a refusal by the rate limiter is logged by the limiter itself.
 */
export class SignUp {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(input: SignUpInput): AppResultAsync<void, SignUpError> {
    return createSignUpDraft(input).asyncAndThen((draft) =>
      enforceClientAndAccountLimits(
        this.deps,
        { client: AUTH_RATE_LIMITS.signUpClient, account: AUTH_RATE_LIMITS.signUp },
        draft.email,
      ).andThen(() => this.deps.authenticator.signUp(draft)),
    );
  }
}
