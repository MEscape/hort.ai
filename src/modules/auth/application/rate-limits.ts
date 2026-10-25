import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@lib/utils';

const SIGN_IN_WINDOW_MINUTES = 15;
const SIGN_IN_WINDOW_SECONDS = SIGN_IN_WINDOW_MINUTES * SECONDS_PER_MINUTE;

/**
 * Budgets for the operations that run without a signed-in actor.
 *
 * Each unauthenticated flow has an account budget (keyed by the email address, so a script cannot
 * guess passwords or flood one inbox) and a client budget (keyed by the caller's address, so one
 * client cannot spread its attempts across many accounts). The client budget comes first when both
 * are applied. It is skipped when the address cannot be determined, because the account budget
 * still protects the flow; the reset-password link carries 256 random bits, so its client budget
 * only bounds how much work one client can ask for.
 *
 * The account budgets deny when the store is down: a flood of sign-in attempts is exactly what the
 * limiter exists to stop. The sign-in window is short because a stranger can use up one address's
 * budget and so lock that person out for the rest of it.
 */
export const AUTH_RATE_LIMITS = {
  signIn: {
    id: 'auth.sign-in',
    limit: 10,
    windowSeconds: SIGN_IN_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
  signInClient: {
    id: 'auth.sign-in-client',
    limit: 30,
    windowSeconds: SIGN_IN_WINDOW_SECONDS,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  signUp: {
    id: 'auth.sign-up',
    limit: 5,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  signUpClient: {
    id: 'auth.sign-up-client',
    limit: 10,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  passwordResetRequest: {
    id: 'auth.password-reset-request',
    limit: 5,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  passwordResetRequestClient: {
    id: 'auth.password-reset-request-client',
    limit: 10,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  passwordResetClient: {
    id: 'auth.password-reset-client',
    limit: 20,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  /**
   * Opening an emailed link (verify an address, start a password reset) over HTTP. The link's token is
   * the credential, so the budget only bounds how much work one client can ask for; a person opens a
   * link once or twice. It is the only budget the HTTP endpoint has: Better Auth's own limiter is off.
   */
  /**
   * Changing one's password while signed in. The current password is the credential being tested,
   * so this bounds guessing it from a stolen session; a person needs it once or twice. Counted
   * against the signed-in actor; denies while the store is down.
   */
  passwordChange: {
    id: 'auth.password-change',
    limit: 5,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  linkClient: {
    id: 'auth.link-client',
    limit: 20,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
} as const satisfies Record<string, RateLimitPolicy>;
