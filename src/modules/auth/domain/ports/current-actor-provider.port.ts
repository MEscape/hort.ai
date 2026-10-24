import type { InfrastructureAppError, UnauthorizedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Actor } from '../models/actor';

/**
 * Failures the port may report. Only our own error kinds appear here: an
 * adapter must translate provider failures before returning them
 * (errors.md: "infrastructure errors must be mapped before crossing the
 * infrastructure boundary").
 */
export type CurrentActorError = UnauthorizedAppError | InfrastructureAppError;

/**
 * Resolves who is making the current request from the server-side
 * authentication context. There is no parameter to pass an id or tenant
 * into: identity is derived, never accepted from a caller.
 */
export interface CurrentActorProvider {
  getCurrentActor(): AppResultAsync<Actor, CurrentActorError>;
}
