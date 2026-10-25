import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { AuthenticatorError } from './authenticator.port';
import type { CurrentActorError } from './current-actor-provider.port';

/** A short-lived parent permission, bound to the current authenticated session. */
export interface ParentAccessPort {
  open(password: string): AppResultAsync<void, AuthenticatorError>;
  require(): AppResultAsync<void, CurrentActorError>;
  close(): AppResultAsync<void, InfrastructureAppError>;
}
