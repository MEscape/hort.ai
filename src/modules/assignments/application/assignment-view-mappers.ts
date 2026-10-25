import type {
  AssignmentFieldsInput,
  ChildAssignmentView,
  TeacherAssignmentView,
} from './contracts/assignment-views';
import type {
  Assignment,
  AssignmentDraftInput,
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

export function toDraftInput(input: AssignmentFieldsInput): AssignmentDraftInput {
  return {
    title: input.title,
    text: input.taskText,
    dueDate: input.dueDate,
    solutionKey: input.solutionKey,
  };
}
