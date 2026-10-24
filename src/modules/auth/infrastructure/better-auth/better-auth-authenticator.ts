import { matchAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { providerFailed } from '../../domain/errors/auth-errors';

import { mapBetterAuthError } from './map-better-auth-error';

import type { AuthenticationApi } from './better-auth-authentication-api';
import type {
  PasswordResetDraft,
  PasswordResetRequest,
  SignInCredentials,
  SignUpDraft,
} from '../../domain/models/credentials';
import type { Authenticator, AuthenticatorError } from '../../domain/ports/authenticator.port';

export interface BetterAuthAuthenticatorDeps {
  readonly api: AuthenticationApi;
  /** Supplies the incoming request headers. Injected because `next/headers` is a framework import. */
  readonly getHeaders: () => Promise<Headers>;
  /** Where emailed links lead. Injected so this adapter does not know the app's routes. */
  readonly paths: {
    readonly afterEmailVerification: string;
    readonly passwordReset: string;
  };
}

/**
 * The port only allows unauthorized, forbidden, validation or infrastructure
 * failures. `mapBetterAuthError` can produce other kinds (not found, a
 * conflict, unexpected), and returning one would break the port's contract.
 * Anything outside it is collapsed to an infrastructure error, which fails
 * closed. The exhaustive match forces a decision if `AppError` gains a kind.
 */
function narrowAuthenticatorError(error: AppError): AuthenticatorError {
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

export class BetterAuthAuthenticator implements Authenticator {
  constructor(private readonly deps: BetterAuthAuthenticatorDeps) {}

  signIn(credentials: SignInCredentials): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) =>
      api.signInEmail({
        ...credentials,
        callbackURL: this.deps.paths.afterEmailVerification,
        headers,
      }),
    ).mapErr(narrowAuthenticatorError);
  }

  /**
   * An address that already has an account is reported as success. With
   * `requireEmailVerification` the provider already answers that way, so a
   * conflict only reaches us if that changes, and surfacing it would turn
   * sign-up into an enumeration oracle.
   */
  signUp(draft: SignUpDraft): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) =>
      api.signUpEmail({
        ...draft,
        callbackURL: this.deps.paths.afterEmailVerification,
        headers,
      }),
    )
      .orElse((error): AppResultAsync<void> =>
        error.kind === 'conflict' ? okAsync(undefined) : errAsync(error),
      )
      .mapErr(narrowAuthenticatorError);
  }

  /** Signing out while signed out is a no-op, not a failure. */
  signOut(): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) => api.signOut({ headers }))
      .orElse((error): AppResultAsync<void> =>
        error.kind === 'unauthorized' ? okAsync(undefined) : errAsync(error),
      )
      .mapErr(narrowAuthenticatorError);
  }

  /** The provider answers identically for unknown addresses, so this cannot enumerate. */
  requestPasswordReset(request: PasswordResetRequest): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) =>
      api.requestPasswordReset({
        email: request.email,
        redirectTo: this.deps.paths.passwordReset,
        headers,
      }),
    ).mapErr(narrowAuthenticatorError);
  }

  resetPassword(draft: PasswordResetDraft): AppResultAsync<void, AuthenticatorError> {
    return this.call((api, headers) => api.resetPassword({ ...draft, headers })).mapErr(
      narrowAuthenticatorError,
    );
  }

  private call(
    operation: (api: AuthenticationApi, headers: Headers) => Promise<unknown>,
  ): AppResultAsync<void> {
    // `fromThrowableAsync` also catches a synchronous throw from `getHeaders`.
    return fromThrowableAsync(
      async () => {
        await operation(this.deps.api, await this.deps.getHeaders());
      },
      (thrown) => mapBetterAuthError(thrown, providerFailed),
    );
  }
}
