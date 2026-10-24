import { createAuthMiddleware, isAPIError } from 'better-auth/api';

import { providerFailed } from '../../domain/errors/auth-errors';
import { toActorId } from '../../domain/models/ids';

import { mapBetterAuthError } from './map-better-auth-error';

import type { TenantId } from '../../domain/models/ids';
import type { SecurityAuditLog } from '../../domain/ports/security-audit-log.port';
import type { BetterAuthOptions } from 'better-auth';

const SIGN_IN_PATH_PREFIX = '/sign-in';

/**
 * A sign-in that the provider refused is a security signal. Only OUR error code is recorded, so
 * neither the address that was tried nor the provider's message reaches the trail; a result that
 * is not a provider error (a success) records nothing.
 */
export function recordFailedSignIn(
  audit: SecurityAuditLog,
  tenantId: TenantId,
  returned: unknown,
): void {
  if (!isAPIError(returned)) {
    return;
  }
  audit.record({
    type: 'authentication.sign_in_failed',
    tenantId,
    errorCode: mapBetterAuthError(returned, providerFailed).code,
  });
}

/**
 * Feeds the security audit log from Better Auth's lifecycle. These hooks
 * fire for BOTH the HTTP handler and direct `auth.api.*` calls from Server
 * Actions, so nothing here depends on which entry point was used.
 *
 * Only ids and our own error codes are recorded: never the email (PII, and
 * an enumeration aid in logs), never a token, never the provider's message.
 * A hook that throws would break the sign-in it observes, so `record` is
 * the port's non-throwing call and nothing else happens here.
 */
export function createSecurityAuditOptions(
  audit: SecurityAuditLog,
  tenantId: TenantId,
): Pick<BetterAuthOptions, 'databaseHooks' | 'hooks'> {
  return {
    databaseHooks: {
      user: {
        create: {
          after: (user) => {
            audit.record({
              type: 'authentication.account_created',
              actorId: toActorId(user.id),
              tenantId,
            });
            return Promise.resolve();
          },
        },
      },
      session: {
        create: {
          after: (session) => {
            audit.record({
              type: 'authentication.session_created',
              actorId: toActorId(session.userId),
              tenantId,
            });
            return Promise.resolve();
          },
        },
        delete: {
          after: (session) => {
            audit.record({
              type: 'authentication.session_revoked',
              actorId: toActorId(session.userId),
              tenantId,
            });
            return Promise.resolve();
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware((ctx) => {
        if (!ctx.path.startsWith(SIGN_IN_PATH_PREFIX)) {
          return Promise.resolve();
        }
        recordFailedSignIn(audit, tenantId, ctx.context.returned);
        return Promise.resolve();
      }),
    },
  };
}
