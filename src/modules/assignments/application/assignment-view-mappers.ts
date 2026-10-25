import type {
  AssignmentFieldsInput,
  AssignmentForHelpView,
  ChildAssignmentView,
  TeacherAssignmentView,
} from './contracts/assignment-views';
import type {
  Assignment,
  AssignmentDraftInput,
  AssignmentForHelp,
  ChildAssignment,
} from '../domain/models/assignment';

export function toTeacherAssignmentView(assignment: Assignment): TeacherAssignmentView {
  return {
    id: assignment.id,
    title: assignment.title,
    taskText: assignment.text,
    dueDate: assignment.dueDate,
    solutionKey: assignment.solutionKey,
  };
}

/** Allowlist: built from the child projection, which has no solution key to copy. */
export function toChildAssignmentView(assignment: ChildAssignment): ChildAssignmentView {
  return {
    id: assignment.id,
    title: assignment.title,
    taskText: assignment.text,
    dueDate: assignment.dueDate,
  };
}

/** Server-side only (#33): the guidance module compares the key, never shows it. */
export function toAssignmentForHelpView(assignment: AssignmentForHelp): AssignmentForHelpView {
  return { id: assignment.id, taskText: assignment.text, solutionKey: assignment.solutionKey };
}

export function toDraftInput(input: AssignmentFieldsInput): AssignmentDraftInput {
  return {
    title: input.title,
    text: input.taskText,
    dueDate: input.dueDate,
    solutionKey: input.solutionKey,
  };
}
