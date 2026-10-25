import type { AppResultAsync } from '@lib/result';

import type { AuthenticatorError } from './authenticator.port';
import type { PasswordChange } from '../models/credentials';

/** What a person sees of their own account. Never a password, hash, token or another person. */
export interface AccountProfile {
  readonly name: string;
  readonly email: string;
}

/**
 * The signed-in person's own account at the identity provider. Every call acts on the session's
 * account only; none takes an account id. The role is not reachable here: it is chosen once, at
 * registration, and no field list of this port can carry it.
 */
export interface AccountManager {
  currentProfile(): AppResultAsync<AccountProfile, AuthenticatorError>;
  /** Changes the display name and nothing else. */
  updateDisplayName(name: string): AppResultAsync<void, AuthenticatorError>;
  /**
   * The provider verifies `currentPassword` (a wrong one is `unauthorized`), stores the new one and
   * revokes the account's other sessions; this session continues.
   */
  changePassword(change: PasswordChange): AppResultAsync<void, AuthenticatorError>;
}
