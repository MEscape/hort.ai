import type { ValidationAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { parseAssignmentTaskText, parseChildTaskText } from '../../domain/models/child-task-text';
import { parseAssignmentId } from '../../domain/models/ids';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { HelpSessionSource } from '../../domain/models/help-session';
import type { HintSubject } from '../../domain/models/hint-subject';
import type { AssignmentId, ChildProfileId } from '../../domain/models/ids';
import type { AssignmentAccessError } from '../../domain/ports/assignment-access.port';
import type { StartHelpSessionInput } from '../contracts/help-session-inputs';
import type { HelpSessionDependencies } from '../help-session-dependencies';

/** What a start names, checked for shape only: the child's own text, or an assignment's id. */
export type RequestedTask =
  | { readonly kind: 'own'; readonly task: ChildTaskText }
  | { readonly kind: 'assignment'; readonly assignmentId: AssignmentId };

/** An assignment id wins over a sent text, so the client cannot replace the teacher's wording. */
export function parseRequestedTask(
  input: StartHelpSessionInput,
): AppResult<RequestedTask, ValidationAppError> {
  return input.assignmentId === undefined
    ? parseChildTaskText(input.task ?? '').map((task) => ({ kind: 'own', task }))
    : parseAssignmentId(input.assignmentId).map((assignmentId) => ({
        kind: 'assignment',
        assignmentId,
      }));
}

/**
 * The session's source. An assignment is looked up through the assignments module, which finds it
 * only in the class the child is in now (#33); its text becomes the session's task. The solution
 * key is not part of the source: a session never stores it, each step reads it anew.
 */
export function resolveSessionSource(
  { assignments }: Pick<HelpSessionDependencies, 'assignments'>,
  {
    childProfileId,
    requested,
    subject,
  }: {
    readonly childProfileId: ChildProfileId;
    readonly requested: RequestedTask;
    readonly subject: HintSubject;
  },
): AppResultAsync<HelpSessionSource, AssignmentAccessError> {
  if (requested.kind === 'own') {
    return okAsync({ assignmentId: null, task: requested.task, subject });
  }
  return assignments.findForChild(childProfileId, requested.assignmentId).andThen((assignment) =>
    parseAssignmentTaskText(assignment.text).map((task) => ({
      assignmentId: assignment.id,
      task,
      subject,
    })),
  );
}
