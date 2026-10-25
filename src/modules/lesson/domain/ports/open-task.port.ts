import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId, HelpSessionId } from '../models/ids';

/** The child's open homework task: the session it belongs to and its text (never a solution key). */
export interface OpenTask {
  readonly sessionId: HelpSessionId;
  readonly task: string;
}

/**
 * The child's open help session and the arithmetic of its task. Both belong to the guidance
 * module; this module only asks, to draw a scene for the task.
 */
export interface OpenTaskPort {
  openTask(
    childProfileId: ChildProfileId,
  ): AppResultAsync<
    OpenTask | null,
    AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  >;
  /** The task's math in one notation (`+ - * /`, digits), as the guidance module reads it. */
  readMath(task: string): string;
}
