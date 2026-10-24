import type { ChildAssignmentView } from '../../application/contracts/assignment-views';
import type { AssignmentDraft } from '../schemas/assignment-draft-schema';

/** What the child card shows: the child view without its id. Teacher-only fields are absent. */
export type ChildAssignmentContent = Omit<ChildAssignmentView, 'id'>;

/** Explicit projection prevents additional teacher fields from leaking through object spreading. */
export function toChildAssignmentContent(draft: AssignmentDraft): ChildAssignmentContent {
  return {
    title: draft.title,
    taskText: draft.taskText,
    dueDate: draft.dueDate === '' ? null : draft.dueDate,
  };
}
