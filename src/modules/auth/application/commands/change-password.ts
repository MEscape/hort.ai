import type { ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createPasswordChange } from '../../domain/models/credentials';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceActorLimit } from '../services/enforce-rate-limit';

import type { PasswordChangeInput } from '../../domain/models/credentials';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AccountDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type ChangePasswordError =
  AuthorizationError | ValidationAppError | RateLimitError | AuthenticatorError;

/**
 * The signed-in person changes their own password. The new one meets the sign-up policy; the
 * provider verifies the current one (a wrong one is `auth.invalid_credentials`) and revokes the
 * account's other sessions. Every attempt spends the actor's budget, so a stolen session cannot be
 * used to guess the current password.
 */
export class ChangePassword {
  constructor(private readonly deps: AccountDependencies) {}

  execute(input: PasswordChangeInput): AppResultAsync<void, ChangePasswordError> {
    const { authorization, accounts, audit } = this.deps;

    return authorization.requireInTenant('account.update').andThen((actor) =>
      createPasswordChange(input).asyncAndThen((change) =>
        enforceActorLimit(this.deps, AUTH_RATE_LIMITS.passwordChange, actor)
          .andThen(() => accounts.changePassword(change))
          .map(() => {
            audit.record({
              type: 'account.password_changed',
              actorId: actor.id,
              tenantId: actor.tenantId,
            });
          }),
      ),
    );
  }
}
