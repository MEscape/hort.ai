import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { AssignmentId, ChildProfileId } from '../models/ids';

/**
 * A teacher's assignment as the help on it needs it (#33). The teacher wrote it; the software never
 * generates or changes it. `solutionKey` stays on the server: it is only compared with the child's
 * answer (#14) and with the AI's text (#31), never passed to the AI, stored in a session or shown.
 */
export interface AssignmentTask {
  readonly id: AssignmentId;
  readonly text: string;
  readonly solutionKey: string | null;
}

export type AssignmentAccessError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The assignments module, as guidance needs it. It decides membership against the stored records:
 * only an assignment of the class the signed-in parent's own child is in right now is found. Another
 * class's assignment, a deleted one, or any assignment while the child is in no class is "not found"
 * (`guidance.assignment_not_found`).
 */
export interface AssignmentAccess {
  findForChild(
    childProfileId: ChildProfileId,
    assignmentId: AssignmentId,
  ): AppResultAsync<AssignmentTask, AssignmentAccessError>;
}
