import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { AuthorizationService } from './authorization-service';
import type { AccountManager } from '../domain/ports/account-manager.port';
import type { Authenticator } from '../domain/ports/authenticator.port';
import type { CurrentActorProvider } from '../domain/ports/current-actor-provider.port';
import type { ParentAccessPort } from '../domain/ports/parent-access.port';
import type { SecurityAuditLog } from '../domain/ports/security-audit-log.port';

/**
 * What every unauthenticated flow (sign-in, sign-up, password reset) is built from. They have no
 * actor, so there is no authorization service; the rate limiter, counting against the caller's
 * address and the account the flow names, takes its place as the gate. Their outcomes reach the
 * audit trail from the identity provider's own hooks (see `create-security-audit-options`), which
 * share this port's sink, so no use case records twice.
 */
export interface AuthenticationDependencies {
  readonly authenticator: Authenticator;
  readonly rateLimiter: RateLimiter;
  readonly clientAddress: ClientAddressProvider;
  readonly audit: SecurityAuditLog;
}

export interface CurrentActorDependencies {
  readonly currentActor: CurrentActorProvider;
}

/** The temporary parent permission is separate from account sign-in. */
export interface ParentAreaDependencies extends Pick<
  AuthenticationDependencies,
  'rateLimiter' | 'clientAddress'
> {
  readonly authorization: AuthorizationService;
  readonly parentAccess: ParentAccessPort;
  readonly audit: SecurityAuditLog;
}

/**
 * The signed-in person's own account (settings page). Authorized like any protected use case
 * (`account.*`), so the actor comes from the session; the rate limiter counts against that actor.
 * Their outcomes are audited by the use cases, since the provider has no hook for them.
 */
export interface AccountDependencies {
  readonly authorization: AuthorizationService;
  readonly accounts: AccountManager;
  readonly rateLimiter: RateLimiter;
  readonly audit: SecurityAuditLog;
}
