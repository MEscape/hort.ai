import { authRouteHandlers } from '@modules/auth';

/**
 * The emailed verification and password-reset links are opened by a browser and land here. Only
 * those two GET paths are served, after a rate-limit budget is spent; every other path answers 404
 * (sign-in, sign-up and session reads are reached in-process by the use cases).
 *
 * @authorization public The single-use token in the link is the credential; the module's rate limiter gates it.
 */
export const { GET, POST } = authRouteHandlers;
