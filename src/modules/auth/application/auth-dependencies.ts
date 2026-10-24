import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { Authenticator } from '../domain/ports/authenticator.port';
import type { CurrentActorProvider } from '../domain/ports/current-actor-provider.port';
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
