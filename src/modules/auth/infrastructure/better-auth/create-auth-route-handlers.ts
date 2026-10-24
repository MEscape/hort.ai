import { toNextJsHandler } from 'better-auth/next-js';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { once } from '@lib/utils';

import type { BetterAuthInstance } from './create-auth';

type RouteHandler = (request: Request) => Promise<Response>;

export interface AuthRouteHandlers {
  readonly GET: RouteHandler;
  readonly POST: RouteHandler;
}

const NOT_FOUND_STATUS = 404;
const RATE_LIMITED_STATUS = 429;
const UNAVAILABLE_STATUS = 503;

/**
 * The only requests that have a consumer here: the emailed links, opened by a browser. Everything else
 * Better Auth could serve (sign-in, sign-up, session reads) is reached in-process by the use cases, which
 * carry the budgets and the audit trail, so over HTTP it does not exist.
 */
const LINK_PATHS: readonly RegExp[] = [
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/reset-password\/[^/]+$/,
];

const isLink = (request: Request) =>
  request.method === 'GET' && LINK_PATHS.some((path) => path.test(new URL(request.url).pathname));

/**
 * Handlers for `app/api/auth/[...all]/route.ts`. This is a Route Handler with a real HTTP consumer: the
 * emailed verification and reset links are opened by a browser and land here. A link is served only after
 * `admit` (the platform's rate limiter, in the module's own use case) lets it through; the token checks
 * run inside Better Auth, whose own limiter is switched off so there is one budget, not two.
 *
 * The instance is created on the first request, not at import, so a build that imports the route does not
 * need auth configuration. While auth is disabled the endpoint answers 404 instead of throwing.
 */
export function createAuthRouteHandlers(options: {
  readonly isEnabled: boolean;
  readonly getAuth: () => BetterAuthInstance;
  readonly admit: () => AppResultAsync<void, RateLimitedAppError | InfrastructureAppError>;
}): AuthRouteHandlers {
  const getHandlers = once(() => toNextJsHandler(options.getAuth()));
  const status = (code: number, headers?: Record<string, string>) =>
    new Response(null, { status: code, ...(headers === undefined ? {} : { headers }) });

  const handle: RouteHandler = async (request) => {
    if (!options.isEnabled || !isLink(request)) {
      return status(NOT_FOUND_STATUS);
    }
    const admitted = await options.admit();
    if (admitted.isErr()) {
      const { error } = admitted;
      return error.kind === 'rate_limited'
        ? status(RATE_LIMITED_STATUS, { 'Retry-After': String(error.retryAfterSeconds) })
        : status(UNAVAILABLE_STATUS);
    }
    return getHandlers().GET(request);
  };

  return { GET: handle, POST: handle };
}
