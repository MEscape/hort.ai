import type { BetterAuthInstance } from './create-auth';

/**
 * The five provider calls the authenticator needs, as plain functions.
 * Same idea as `SessionSource`: tests pass a fake, and provider types stay
 * inside the adapter files. Results are discarded on purpose; cookies are
 * set by the `nextCookies` plugin, and no token may reach the application.
 */
export interface AuthenticationApi {
  signInEmail(input: {
    email: string;
    password: string;
    callbackURL: string;
    headers: Headers;
  }): Promise<unknown>;
  signUpEmail(input: {
    name: string;
    email: string;
    password: string;
    callbackURL: string;
    headers: Headers;
  }): Promise<unknown>;
  signOut(input: { headers: Headers }): Promise<unknown>;
  requestPasswordReset(input: {
    email: string;
    redirectTo: string;
    headers: Headers;
  }): Promise<unknown>;
  resetPassword(input: { token: string; newPassword: string; headers: Headers }): Promise<unknown>;
}

/** Adapts a Better Auth instance to the narrow `AuthenticationApi`. */
export function authenticationApiFrom(instance: BetterAuthInstance): AuthenticationApi {
  return {
    signInEmail: async ({ headers, ...body }) => instance.api.signInEmail({ body, headers }),
    signUpEmail: async ({ headers, ...body }) => instance.api.signUpEmail({ body, headers }),
    signOut: async ({ headers }) => instance.api.signOut({ headers }),
    requestPasswordReset: async ({ headers, ...body }) =>
      instance.api.requestPasswordReset({ body, headers }),
    resetPassword: async ({ headers, ...body }) => instance.api.resetPassword({ body, headers }),
  };
}
