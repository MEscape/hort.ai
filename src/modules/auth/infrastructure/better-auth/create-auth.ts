import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';

import { I18N_CONFIG } from '@i18n';

import { resolveMailLocale } from '@lib/mail/server';

import { AUTH_LINK_LIFETIME_SECONDS, CREDENTIAL_LIMITS } from '../../domain/models/credentials';
import { toActorId } from '../../domain/models/ids';

import { createSecurityAuditOptions } from './create-security-audit-options';
import { deliverAuthEmail } from './deliver-auth-email';

import type { TenantId } from '../../domain/models/ids';
import type { AuthMailer } from '../../domain/ports/auth-mailer.port';
import type { SecurityAuditLog } from '../../domain/ports/security-audit-log.port';
import type { BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';

/** What `createAuth` needs, already validated. The composition root maps env to this. */
export interface AuthSettings {
  /** The configured tenant every account belongs to; stamped on every audit event the hooks record. */
  readonly tenantId: TenantId;
  readonly baseUrl: string;
  readonly secret: string;
  readonly isProduction: boolean;
  readonly trustedProxies: readonly string[];
  readonly session: {
    readonly expiresInSeconds: number;
    readonly updateAgeSeconds: number;
    readonly freshAgeSeconds: number;
  };
}

export interface AuthDeps {
  readonly pool: Pool;
  readonly mailer: AuthMailer;
  readonly audit: SecurityAuditLog;
}

/**
 * Builds the Better Auth instance. This is the ONLY place allowed to call
 * `betterAuth(...)`, and `better-auth` may be imported only from
 * `modules/auth/infrastructure` (enforced by lint). Everything else
 * reaches authentication through the ports in `domain/ports`.
 *
 * It is a factory, not a module-level constant, so importing this file
 * has no side effects (no pool, no connection) and the pool, mailer and
 * audit log are injected instead of imported.
 *
 * `satisfies BetterAuthOptions` is the compile-time guard: unlike passing
 * the literal straight to `betterAuth<O>()`, which infers `O` and skips
 * excess-property checks, it rejects a misspelled or renamed security
 * option at any depth.
 *
 * Framework coupling, by necessity: `nextCookies()` loads `next/headers`
 * to copy Better Auth's `Set-Cookie` into Next's cookie store after a
 * sign-in from a Server Action. Two behaviors are easy to miss:
 *  - It swallows cookie-write failures, so a broken write does not throw;
 *    an integration test must assert the cookie actually lands.
 *  - It skips session REFRESH while rendering a Server Component, where
 *    cookies cannot be written. Reads work; extending the session happens
 *    on the next Server Action or Route Handler request.
 */
export function createAuth(settings: AuthSettings, deps: AuthDeps) {
  const options = {
    baseURL: settings.baseUrl, // Explicit: an unset baseURL is the basePath-poisoning DoS (GHSA-569q-mpph-wgww).
    secret: settings.secret,
    database: deps.pool,
    trustedOrigins: [settings.baseUrl],
    // Anyone may sign up, but only through the `SignUp` use case, which carries the
    // rate limits, the validation and the enumeration protection. The raw HTTP path stays disabled so that
    // nothing can bypass them: it answers 404 over HTTP and stays callable in-process.
    disabledPaths: ['/sign-up/email'],

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: CREDENTIAL_LIMITS.passwordMin,
      maxPasswordLength: CREDENTIAL_LIMITS.passwordMax,
      resetPasswordTokenExpiresIn: AUTH_LINK_LIFETIME_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const locale = await resolveMailLocale();
        return deliverAuthEmail(
          deps.mailer.sendPasswordReset({ to: user.email, url, locale, name: user.name }),
          'password_reset',
        );
      },
      onPasswordReset: ({ user }) => {
        deps.audit.record({
          type: 'authentication.password_reset_completed',
          actorId: toActorId(user.id),
          tenantId: settings.tenantId,
        });
        return Promise.resolve();
      },
      // Sign-up answers identically for known and unknown addresses, so
      // the real owner is told by email instead.
      // SECURITY: Always use the default locale here. If we used the request
      // locale, an attacker could spoof the email language by changing their
      // Accept-Language header to confuse the real owner.
      onExistingUserSignUp: async ({ user }) => {
        return deliverAuthEmail(
          deps.mailer.sendExistingAccountNotice({
            to: user.email,
            locale: I18N_CONFIG.defaultLocale,
          }),
          'existing_account',
        );
      },
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const locale = await resolveMailLocale();
        return deliverAuthEmail(
          deps.mailer.sendVerification({ to: user.email, url, locale, name: user.name }),
          'verification',
        );
      },
      sendOnSignUp: true,
      // Reached only after the password was verified, so it cannot be abused
      // to probe addresses, and it is the only way an unverified user learns what to do.
      sendOnSignIn: true,
      expiresIn: AUTH_LINK_LIFETIME_SECONDS,
    },

    session: {
      expiresIn: settings.session.expiresInSeconds,
      updateAge: settings.session.updateAgeSeconds,
      // Gates password/email changes; see AUTH_SESSION_FRESH_AGE_SECONDS.
      freshAge: settings.session.freshAgeSeconds,
      // Pinned off. A cookie cache would let a revoked session keep working
      // until the cache expires, which defeats logout and revocation.
      cookieCache: { enabled: false },
    },

    // Off. The platform's rate limiter (@lib/rate-limit) is the only one: the use cases spend its budgets
    // before they call `auth.api.*`, and the route handler spends one before it serves an emailed link
    // (create-auth-route-handlers.ts). A second limiter in the auth database would count the same
    // attempts twice, with different numbers and no shared store.
    rateLimit: { enabled: false },

    advanced: {
      useSecureCookies: settings.isProduction,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: {
        trustedProxies: [...settings.trustedProxies],
      },
    },

    ...createSecurityAuditOptions(deps.audit, settings.tenantId),

    // Must stay LAST: a plugin after it that sets cookies in an after-hook
    // would have those cookies dropped instead of forwarded to Next.
    plugins: [nextCookies()],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

export type BetterAuthInstance = ReturnType<typeof createAuth>;
