import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { authValidationFailed, AUTH_VALIDATION_CODES } from '../../domain/errors/auth-errors';
import { CREDENTIAL_LIMITS } from '../../domain/models/credentials';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceClientAndAccountLimits } from '../services/enforce-rate-limit';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { ParentAreaDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { RateLimitError } from '../services/enforce-rate-limit';

type OpenParentAreaError = AuthorizationError | AuthenticatorError | RateLimitError;

/**
 * Re-authenticate the current parent, never sign in to a client-selected account. Both outcomes are
 * audited: a failed attempt at the gate of a shared device is exactly what the trail is for. A
 * refusal by the rate limiter is logged by the limiter itself.
 */
export class OpenParentArea {
  constructor(private readonly deps: ParentAreaDependencies) {}
  execute(password: string): AppResultAsync<void, OpenParentAreaError> {
    return this.deps.authorization.requireInTenant('account.read').andThen((actor) => {
      if (!password || password.length > CREDENTIAL_LIMITS.passwordMax) {
        return errAsync(
          authValidationFailed({ password: [AUTH_VALIDATION_CODES.passwordRequired] }),
        );
      }
      return enforceClientAndAccountLimits(
        this.deps,
        { client: AUTH_RATE_LIMITS.signInClient, account: AUTH_RATE_LIMITS.signIn },
        actor.id,
      ).andThen(() =>
        this.deps.parentAccess
          .open(password)
          .map(() => {
            this.deps.audit.record({
              type: 'authentication.parent_area_opened',
              actorId: actor.id,
              tenantId: actor.tenantId,
            });
          })
          .mapErr((error) => {
            this.deps.audit.record({
              type: 'authentication.parent_area_open_failed',
              actorId: actor.id,
              tenantId: actor.tenantId,
              errorCode: error.code,
            });
            return error;
          }),
      );
    });
  }
}
