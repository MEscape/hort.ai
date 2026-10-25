import 'server-only';
import { cache } from 'react';

import { headers } from 'next/headers';
import { connection } from 'next/server';

import { withAuditTrail } from '@modules/audit';

import { systemClock } from '@lib/clock';
import { APP_IDENTITY, publicEnv } from '@lib/config';
import { serverEnv } from '@lib/config/server';
import type { ServerEnv } from '@lib/config/server';
import { getMailTransport } from '@lib/mail/server';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { ResultAsync } from '@lib/result';
import { toLocalizedPath } from '@lib/seo';
import { invariant, isDefined, once } from '@lib/utils';

import { createAuthorizationService } from './application/authorization-service';
import { AdmitLinkRequest } from './application/commands/admit-link-request';
import { ChangePassword } from './application/commands/change-password';
import { RequestPasswordReset } from './application/commands/request-password-reset';
import { ResetPassword } from './application/commands/reset-password';
import { SignIn } from './application/commands/sign-in';
import { SignOut } from './application/commands/sign-out';
import { SignUp } from './application/commands/sign-up';
import { UpdateDisplayName } from './application/commands/update-display-name';
import { GetAccount } from './application/queries/get-account';
import { GetCurrentActor } from './application/queries/get-current-actor';
import { createTenantId } from './domain/models/tenant';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerSecurityAuditLog,
} from './infrastructure/audit/logger-security-audit-log';
import { accountApiFrom } from './infrastructure/better-auth/better-auth-account-api';
import { BetterAuthAccountManager } from './infrastructure/better-auth/better-auth-account-manager';
import { authenticationApiFrom } from './infrastructure/better-auth/better-auth-authentication-api';
import { BetterAuthAuthenticator } from './infrastructure/better-auth/better-auth-authenticator';
import { BetterAuthCurrentActorProvider } from './infrastructure/better-auth/better-auth-current-actor-provider';
import { sessionSourceFrom } from './infrastructure/better-auth/better-auth-session-source';
import { createAuth } from './infrastructure/better-auth/create-auth';
import { createAuthRouteHandlers } from './infrastructure/better-auth/create-auth-route-handlers';
import { DevCurrentActorProvider } from './infrastructure/dev/dev-current-actor-provider';
import { TransactionalAuthMailer } from './infrastructure/mail/transactional-auth-mailer';
import { UnconfiguredAuthMailer } from './infrastructure/mail/unconfigured-auth-mailer';
import { getAuthPool } from './infrastructure/pg/auth-pool';
import { authRoutes } from './presentation/routes';

import type {
  AccountDependencies,
  AuthenticationDependencies,
} from './application/auth-dependencies';
import type { AuthorizationService } from './application/authorization-service';
import type { TenantId } from './domain/models/ids';
import type { AuthMailer } from './domain/ports/auth-mailer.port';
import type { CurrentActorProvider } from './domain/ports/current-actor-provider.port';
import type { AuthSettings, BetterAuthInstance } from './infrastructure/better-auth/create-auth';

/**
 * Composition root for authentication and access control, at the framework
 * boundary. It is the ONLY file that knows which authentication
 * implementation runs, and the only place that branches on `AUTH_ENABLED`;
 * every other file receives a port or an application service and cannot
 * tell which. Everything is built lazily (`once`), so importing this file
 * during `next build` needs no auth configuration.
 *
 * `server-only` makes an accidental import from a Client Component a
 * build error.
 */

const MILLISECONDS_PER_SECOND = 1000;

/**
 * The one tenant of this deployment, from configuration. The environment schema has already
 * checked it; `createTenantId` is the domain's own check, so a wiring mistake stops here with the
 * variable's name instead of putting an unchecked value into every actor.
 */
const getTenantId = once((): TenantId => {
  const tenant = createTenantId(serverEnv.AUTH_DEFAULT_TENANT_ID);
  if (tenant.isErr()) {
    throw new Error('AUTH_DEFAULT_TENANT_ID is not a valid tenant id.');
  }
  return tenant.value;
});

function requireAuthCredentials(env: ServerEnv): {
  readonly secret: string;
  readonly databaseUrl: string;
} {
  const { AUTH_SECRET: secret, AUTH_DATABASE_URL: databaseUrl } = env;
  // The env schema guarantees both when AUTH_ENABLED=true; this narrows the
  // type and fails fast if that guarantee is ever removed.
  invariant(
    isDefined(secret) && isDefined(databaseUrl),
    'AUTH_SECRET and AUTH_DATABASE_URL are required when AUTH_ENABLED=true.',
  );
  return { secret, databaseUrl };
}

function toAuthSettings(env: ServerEnv): AuthSettings {
  return {
    tenantId: getTenantId(),
    baseUrl: publicEnv.NEXT_PUBLIC_APP_URL,
    secret: requireAuthCredentials(env).secret,
    isProduction: env.NODE_ENV === 'production',
    trustedProxies: env.AUTH_TRUSTED_PROXIES,
    session: {
      expiresInSeconds: env.AUTH_SESSION_EXPIRES_IN_SECONDS,
      updateAgeSeconds: env.AUTH_SESSION_UPDATE_AGE_SECONDS,
      freshAgeSeconds: env.AUTH_SESSION_FRESH_AGE_SECONDS,
    },
  };
}

function buildMailer(): AuthMailer {
  const transport = getMailTransport();
  return transport === null
    ? new UnconfiguredAuthMailer()
    : new TransactionalAuthMailer(transport, {
        appName: APP_IDENTITY.name,
        signInLink: (locale) =>
          new URL(
            toLocalizedPath(locale, authRoutes.signIn()),
            publicEnv.NEXT_PUBLIC_APP_URL,
          ).toString(),
      });
}

const getMailer = once<AuthMailer>(buildMailer);

const getPool = once(() =>
  getAuthPool({
    databaseUrl: requireAuthCredentials(serverEnv).databaseUrl,
    maxConnections: serverEnv.AUTH_DATABASE_POOL_SIZE,
    reuseAcrossReloads: serverEnv.NODE_ENV !== 'production',
  }),
);

/** Whether real authentication runs. Pages for sign-in and sign-up use it to answer 404 when it does not. */
export const isAuthEnabled: boolean = serverEnv.AUTH_ENABLED;

/**
 * The module's audit port: its log lines, and the durable trail through the audit module. The
 * trail write is best-effort and never throws (see `AuditTrailRecorder`): auditing is never the
 * reason a sign-in or an authorization fails.
 */
const auditLog = withAuditTrail(loggerSecurityAuditLog, {
  source: 'auth',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

/**
 * The Better Auth instance. Throws when auth is disabled: there is nothing
 * to hand out.
 */
const getAuth = once<BetterAuthInstance>(() => {
  if (!serverEnv.AUTH_ENABLED) {
    throw new Error('Better Auth is not available while AUTH_ENABLED=false.');
  }
  return createAuth(toAuthSettings(serverEnv), {
    pool: getPool(),
    mailer: getMailer(),
    audit: auditLog,
  });
});

/**
 * Resolving the actor costs a session lookup. React's `cache` collapses repeats within ONE server
 * render or action into a single lookup, and never outlives the request, so a revoked session is
 * refused on the next request. Do not swap it for a longer-lived cache (caching.md: authorization
 * decisions need an explicit identity boundary).
 */
function memoizePerRequest(provider: CurrentActorProvider): CurrentActorProvider {
  const resolve = cache(() => provider.getCurrentActor());
  return { getCurrentActor: () => resolve() };
}

/**
 * Knowing the actor is request-time work. A real session lookup reads
 * `headers()`, which keeps everything that depends on the actor out of
 * prerendering; the fixed dev actor reads nothing, so without this a protected
 * page would prerender and run its database queries at build time.
 */
function requestScoped(provider: CurrentActorProvider): CurrentActorProvider {
  return {
    getCurrentActor: () =>
      ResultAsync.fromSafePromise(connection()).andThen(() => provider.getCurrentActor()),
  };
}

function buildCurrentActorProvider(): CurrentActorProvider {
  if (!serverEnv.AUTH_ENABLED) {
    return requestScoped(
      new DevCurrentActorProvider({
        tenantId: getTenantId(),
        nodeEnv: serverEnv.NODE_ENV,
        appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      }),
    );
  }
  return new BetterAuthCurrentActorProvider({
    sessions: sessionSourceFrom(getAuth),
    getHeaders: () => headers(),
    sessionMaxLifetimeMs: serverEnv.AUTH_SESSION_MAX_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND,
    clock: systemClock,
    tenantId: getTenantId(),
    platformAdminEmails: serverEnv.AUTH_PLATFORM_ADMIN_EMAILS,
  });
}

/** One memoized provider per process, shared by authorization and the actor query. */
const getCurrentActorProvider = once(() => memoizePerRequest(buildCurrentActorProvider()));

/** What use cases of other modules receive. Per-request state lives in `headers()`. */
export const getAccessControl = once<AuthorizationService>(() =>
  createAuthorizationService({
    currentActor: getCurrentActorProvider(),
    audit: auditLog,
  }),
);

/**
 * The signed-in person's own account (header, settings page). Built without touching the provider,
 * so the queries below can be built with authentication off; calling them then fails closed.
 */
const getAccountDependencies = once((): AccountDependencies => ({
  authorization: getAccessControl(),
  accounts: new BetterAuthAccountManager({
    api: accountApiFrom(getAuth),
    getHeaders: () => headers(),
  }),
  rateLimiter: getRateLimiter(),
  audit: auditLog,
}));

export const getAuthQueries = once(
  () =>
    ({
      getCurrentActor: new GetCurrentActor({ currentActor: getCurrentActorProvider() }),
      getAccount: new GetAccount(getAccountDependencies()),
    }) as const,
);

/**
 * Sign-in, sign-up, sign-out and password reset. Only meaningful while
 * AUTH_ENABLED=true; the pages that host them answer 404 otherwise, and
 * calling this with auth disabled is a programmer error that throws.
 */
const getAuthenticationDependencies = once((): AuthenticationDependencies => ({
  authenticator: new BetterAuthAuthenticator({
    api: authenticationApiFrom(getAuth()),
    getHeaders: () => headers(),
    paths: {
      afterEmailVerification: authRoutes.emailVerified(),
      passwordReset: authRoutes.resetPassword(),
    },
  }),
  rateLimiter: getRateLimiter(),
  clientAddress: getClientAddressProvider(() => headers()),
  audit: auditLog,
}));

export const getAuthCommands = once(() => {
  const dependencies = getAuthenticationDependencies();
  return {
    signIn: new SignIn(dependencies),
    signUp: new SignUp(dependencies),
    signOut: new SignOut(dependencies),
    requestPasswordReset: new RequestPasswordReset(dependencies),
    resetPassword: new ResetPassword(dependencies),
    admitLinkRequest: new AdmitLinkRequest(dependencies),
    updateDisplayName: new UpdateDisplayName(getAccountDependencies()),
    changePassword: new ChangePassword(getAccountDependencies()),
  } as const;
});

/** For `app/api/auth/[...all]/route.ts`: the emailed links are the HTTP consumer. */
export const authRouteHandlers = createAuthRouteHandlers({
  isEnabled: serverEnv.AUTH_ENABLED,
  getAuth,
  admit: () => getAuthCommands().admitLinkRequest.execute(),
});
