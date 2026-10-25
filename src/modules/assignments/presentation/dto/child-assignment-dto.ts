import type { AssignmentDraft } from '../schemas/assignment-draft-schema';

/** The complete child-facing surface. Teacher-only fields are deliberately absent. */
export interface ChildAssignmentView {
  readonly title: string;
  readonly taskText: string;
  /** A validated ISO calendar date, not an instant. */
  readonly dueDate: string | null;
}

/** Explicit projection prevents additional teacher fields from leaking through object spreading. */
export function toChildAssignmentView(draft: AssignmentDraft): ChildAssignmentView {
  return {
    title: draft.title,
    taskText: draft.taskText,
    dueDate: draft.dueDate === '' ? null : draft.dueDate,
  };
}
