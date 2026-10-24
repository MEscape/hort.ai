import type {
  ForbiddenAppError,
  InfrastructureAppError,
  UnauthorizedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type {
  PasswordResetDraft,
  PasswordResetRequest,
  SignInCredentials,
  SignUpDraft,
} from '../models/credentials';

/**
 * Failures the port may report; nothing provider-specific. `forbidden`
 * means "email not verified", `unauthorized` covers bad credentials and
 * bad or expired tokens.
 */
export type AuthenticatorError =
  UnauthorizedAppError | ForbiddenAppError | ValidationAppError | InfrastructureAppError;

/**
 * The authentication flows, expressed without a provider. Inputs are
 * already validated and normalised by the domain. Session cookies are a
 * side effect of the adapter; callers never see a token.
 *
 * Enumeration protection is part of the contract:
 * - `signUp` succeeds for an address that already has an account.
 * - `requestPasswordReset` succeeds for an address that has none.
 * - `signOut` succeeds when nobody is signed in.
 */
export interface Authenticator {
  signIn(credentials: SignInCredentials): AppResultAsync<void, AuthenticatorError>;
  signUp(draft: SignUpDraft): AppResultAsync<void, AuthenticatorError>;
  signOut(): AppResultAsync<void, AuthenticatorError>;
  requestPasswordReset(request: PasswordResetRequest): AppResultAsync<void, AuthenticatorError>;
  resetPassword(draft: PasswordResetDraft): AppResultAsync<void, AuthenticatorError>;
}
