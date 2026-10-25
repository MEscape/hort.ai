import type { Clock } from '@lib/clock';
import { matchAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  sessionExpired,
  sessionLookupFailed,
  unauthenticated,
} from '../../domain/errors/auth-errors';
import { toActorId } from '../../domain/models/ids';
import { PLATFORM_ADMIN_ROLE, isRole } from '../../domain/models/role';
import { hasExceededMaxLifetime } from '../../domain/models/session-policy';

import { mapBetterAuthError } from './map-better-auth-error';

import type { SessionSnapshot, SessionSource } from './better-auth-session-source';
import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type {
  CurrentActorError,
  CurrentActorProvider,
} from '../../domain/ports/current-actor-provider.port';

export interface BetterAuthCurrentActorProviderDeps {
  readonly sessions: SessionSource;
  /** Supplies the incoming request headers. Injected because `next/headers` is a framework import. */
  readonly getHeaders: () => Promise<Headers>;
  readonly sessionMaxLifetimeMs: number;
  readonly clock: Clock;
  /**
   * The one tenant every account belongs to, from validated configuration. It is the only source of
   * the actor's tenant: nothing in the request (header, cookie, query) is read to choose one.
   */
  readonly tenantId: TenantId;
  /** Lower-cased addresses (validated configuration) whose confirmed accounts are also platform admins. */
  readonly platformAdminEmails: readonly string[];
}

/**
 * Turns the provider's session into the signed-in actor. There is no membership lookup: with one
 * configured tenant, every confirmed account belongs to it, with the one role stored on the account
 * at registration (parent or teacher). What an actor may touch is decided per resource by ownership
 * (`decide`), and the role only says which permissions they hold.
 */
export class BetterAuthCurrentActorProvider implements CurrentActorProvider {
  constructor(private readonly deps: BetterAuthCurrentActorProviderDeps) {}

  getCurrentActor(): AppResultAsync<Actor, CurrentActorError> {
    // `fromThrowableAsync` also catches a synchronous throw from `getHeaders`.
    return fromThrowableAsync(
      async () =>
        this.deps.sessions.getSession({
          headers: await this.deps.getHeaders(),
        }),
      (thrown) => narrowSessionLookupError(mapBetterAuthError(thrown, sessionLookupFailed)),
    ).andThen((session) => this.resolveActor(session));
  }

  private resolveActor(session: SessionSnapshot | null): AppResultAsync<Actor, CurrentActorError> {
    // No session is the normal "not signed in" outcome, not a failure of the provider.
    if (session === null) {
      return errAsync(unauthenticated());
    }

    // The provider issues no session for an unconfirmed address while verification is required; this
    // keeps that true if the provider is ever configured otherwise (fail closed).
    if (!session.user.emailVerified) {
      return errAsync(unauthenticated());
    }

    const isTooOld = hasExceededMaxLifetime(
      session.session.createdAt,
      this.deps.clock.now(),
      this.deps.sessionMaxLifetimeMs,
    );
    if (isTooOld) {
      return errAsync(sessionExpired());
    }

    // The role was chosen at registration and is read from the stored account only. An unknown or
    // missing value grants nothing: the session is treated as signed out (fail closed).
    const { role } = session.user;
    if (typeof role !== 'string' || !isRole(role)) {
      return errAsync(unauthenticated());
    }

    // Reached only for a confirmed address (above), so registering an admin's address first grants nothing.
    const isPlatformAdmin = this.deps.platformAdminEmails.includes(
      session.user.email.toLowerCase(),
    );

    return okAsync({
      id: toActorId(session.user.id),
      tenantId: this.deps.tenantId,
      roles: isPlatformAdmin ? [role, PLATFORM_ADMIN_ROLE] : [role],
    });
  }
}

/**
 * The port only allows unauthorized or infrastructure failures from a
 * session lookup. `mapBetterAuthError` can produce other kinds (a conflict
 * or validation error is meaningless for reading a session), and returning
 * one would break the port's contract. Anything outside the contract is
 * collapsed to an infrastructure error, which fails closed. The exhaustive
 * match forces a decision if `AppError` ever gains a kind.
 */
function narrowSessionLookupError(error: AppError): CurrentActorError {
  const failClosed = (cause: AppError): CurrentActorError => sessionLookupFailed(cause);

  return matchAppError<CurrentActorError>(error, {
    unauthorized: (allowed) => allowed,
    infrastructure: (allowed) => allowed,
    validation: failClosed,
    not_found: failClosed,
    conflict: failClosed,
    rate_limited: failClosed,
    forbidden: failClosed,
    unexpected: failClosed,
  });
}
