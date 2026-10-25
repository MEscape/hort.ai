import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { unauthenticated } from '../../domain/errors/auth-errors';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AccountDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { AccountView } from '../contracts/auth-views';

export type GetAccountError = AuthorizationError | AuthenticatorError;

/**
 * The signed-in person's own name, address and role, for the header and the settings page. It reads
 * the session's account only; there is no account id to ask about anyone else.
 */
export class GetAccount {
  constructor(private readonly deps: AccountDependencies) {}

  execute(): AppResultAsync<AccountView, GetAccountError> {
    const { authorization, accounts } = this.deps;

    return authorization.requireInTenant('account.read').andThen((actor) => {
      const [role] = actor.roles;
      if (role === undefined) {
        return errAsync(unauthenticated());
      }
      return accounts
        .currentProfile()
        .map((profile) => ({ name: profile.name, email: profile.email, role }));
    });
  }
}
