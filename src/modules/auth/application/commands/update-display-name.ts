import type { ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createDisplayName } from '../../domain/models/credentials';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AccountDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type UpdateDisplayNameError = AuthorizationError | ValidationAppError | AuthenticatorError;

/**
 * The signed-in person renames themselves: the only account field anyone may change. The role,
 * the address and everything else stay out of reach (`AccountManager` carries the name alone).
 *
 * @rate-limit none Acts on the caller's own account only and changes nothing anyone else sees; a
 * renaming loop costs the caller alone.
 */
export class UpdateDisplayName {
  constructor(private readonly deps: AccountDependencies) {}

  execute(input: { readonly name: string }): AppResultAsync<void, UpdateDisplayNameError> {
    const { authorization, accounts, audit } = this.deps;

    return authorization.requireInTenant('account.update').andThen((actor) =>
      createDisplayName(input.name).asyncAndThen((name) =>
        accounts.updateDisplayName(name).map(() => {
          audit.record({
            type: 'account.display_name_changed',
            actorId: actor.id,
            tenantId: actor.tenantId,
          });
        }),
      ),
    );
  }
}
