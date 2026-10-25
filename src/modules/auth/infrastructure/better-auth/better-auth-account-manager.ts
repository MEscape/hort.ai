import { matchAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { providerFailed, unauthenticated } from '../../domain/errors/auth-errors';

import { mapBetterAuthError } from './map-better-auth-error';

import type { PasswordChange } from '../../domain/models/credentials';
import type { AccountManager, AccountProfile } from '../../domain/ports/account-manager.port';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';

/**
 * The provider calls the account settings need, as plain functions, so provider types stay in this
 * folder and tests pass a fake. The name update is the provider's `updateUser`, whose HTTP route
 * stays disabled (`create-auth.ts`): only this in-process call reaches it, with `name` alone.
 */
export interface AccountApi {
  getSession(input: {
    headers: Headers;
  }): Promise<{ user: { name: string; email: string } } | null>;
  updateUser(input: { body: { name: string }; headers: Headers }): Promise<unknown>;
  changePassword(input: {
    body: { currentPassword: string; newPassword: string; revokeOtherSessions: true };
    headers: Headers;
  }): Promise<unknown>;
}

export interface BetterAuthAccountManagerDeps {
  readonly api: AccountApi;
  /** Supplies the incoming request headers. Injected because `next/headers` is a framework import. */
  readonly getHeaders: () => Promise<Headers>;
}

/** Same contract as the authenticator: anything outside the port's kinds fails closed. */
function narrow(error: AppError): AuthenticatorError {
  const failClosed = (cause: AppError): AuthenticatorError => providerFailed(cause);
  return matchAppError<AuthenticatorError>(error, {
    unauthorized: (allowed) => allowed,
    forbidden: (allowed) => allowed,
    validation: (allowed) => allowed,
    infrastructure: (allowed) => allowed,
    not_found: failClosed,
    conflict: failClosed,
    rate_limited: failClosed,
    unexpected: failClosed,
  });
}

export class BetterAuthAccountManager implements AccountManager {
  constructor(private readonly deps: BetterAuthAccountManagerDeps) {}

  currentProfile(): AppResultAsync<AccountProfile, AuthenticatorError> {
    return this.call((api, headers) => api.getSession({ headers }))
      .andThen((session) =>
        session === null
          ? errAsync(unauthenticated())
          : okAsync({ name: session.user.name, email: session.user.email }),
      )
      .mapErr(narrow);
  }

  updateDisplayName(name: string): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) => api.updateUser({ body: { name }, headers }))
      .map(() => undefined)
      .mapErr(narrow);
  }

  changePassword(change: PasswordChange): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) =>
      api.changePassword({
        body: {
          currentPassword: change.currentPassword,
          newPassword: change.newPassword,
          revokeOtherSessions: true,
        },
        headers,
      }),
    )
      .map(() => undefined)
      .mapErr(narrow);
  }

  private call<T>(operation: (api: AccountApi, headers: Headers) => Promise<T>): AppResultAsync<T> {
    // `fromThrowableAsync` also catches a synchronous throw from `getHeaders`.
    return fromThrowableAsync(
      async () => operation(this.deps.api, await this.deps.getHeaders()),
      (thrown) => mapBetterAuthError(thrown, providerFailed),
    );
  }
}
