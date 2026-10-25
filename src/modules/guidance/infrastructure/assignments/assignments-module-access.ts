import type { AssignmentForHelpView } from '@modules/assignments';

import type { AppResultAsync } from '@lib/result';

import { assignmentNotFound } from '../../domain/errors/guidance-errors';
import { toAssignmentId } from '../../domain/models/ids';

import type {
  AssignmentAccess,
  AssignmentAccessError,
} from '../../domain/ports/assignment-access.port';

/** The assignments query this module needs, as the assignments module's public API offers it. */
export interface AssignmentForHelpQuery {
  execute(input: {
    readonly childProfileId: string;
    readonly assignmentId: string;
  }): AppResultAsync<AssignmentForHelpView, AssignmentAccessError>;
}

/**
 * `AssignmentAccess` over the assignments module's `getAssignmentForHelp`, which authorizes the
 * signed-in parent on the stored child (`learner.read`) and finds the assignment only in the child's
 * current class. Its "not found" becomes this module's own code; the key crosses back untouched and
 * goes no further than the orchestrator's and the coach's comparisons.
 */
export class AssignmentsModuleAccess implements AssignmentAccess {
  constructor(private readonly query: AssignmentForHelpQuery) {}

  findForChild: AssignmentAccess['findForChild'] = (childProfileId, assignmentId) =>
    this.query
      .execute({ childProfileId, assignmentId })
      .map((view) => ({
        id: toAssignmentId(view.id),
        text: view.taskText,
        solutionKey: view.solutionKey,
      }))
      .mapErr((error) => (error.kind === 'not_found' ? assignmentNotFound() : error));
}
