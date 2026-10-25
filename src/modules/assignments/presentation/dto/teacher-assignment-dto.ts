import type { TeacherAssignmentView } from '../../application/contracts/assignment-views';

/** The JSON-safe shape the teacher's Server Actions return. Only the teacher's own screen gets it. */
export interface TeacherAssignmentDto {
  readonly id: string;
  readonly title: string;
  readonly taskText: string;
  readonly dueDate: string | null;
  readonly solutionKey: string | null;
}

export function toTeacherAssignmentDto(view: TeacherAssignmentView): TeacherAssignmentDto {
  return {
    id: view.id,
    title: view.title,
    taskText: view.taskText,
    dueDate: view.dueDate,
    solutionKey: view.solutionKey,
  };
}
