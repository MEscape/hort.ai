import type { AuthorizationError } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';

/** Failures of the private upload lifecycle and its storage/classroom collaborators. */
export type MaterialError =
  | AuthorizationError
  | ConflictAppError
  | InfrastructureAppError
  | NotFoundAppError
  | RateLimitedAppError
  | UnexpectedAppError
  | ValidationAppError;
