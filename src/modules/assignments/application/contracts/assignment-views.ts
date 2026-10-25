/** An assignment for the teacher who posted it. Tenant and owner are internal and not exposed. */
export interface TeacherAssignmentView {
  readonly id: string;
  readonly title: string;
  readonly taskText: string;
  /** An ISO calendar date (`YYYY-MM-DD`), not an instant. */
  readonly dueDate: string | null;
  readonly solutionKey: string | null;
}

/** One of the teacher's active classes, to choose where assignments are posted. */
export interface TeacherClassroomView {
  readonly id: string;
  readonly name: string;
  readonly grade: number;
}

/**
 * The teacher's assignment screen. `selectedClassroomId` is `null` only when the teacher has no
 * active class yet; then `assignments` is empty.
 */
export interface TeacherAssignmentOverview {
  readonly classrooms: readonly TeacherClassroomView[];
  readonly selectedClassroomId: string | null;
  readonly assignments: readonly TeacherAssignmentView[];
}

/** An assignment as a child sees it. Teacher-only fields are deliberately absent. */
export interface ChildAssignmentView {
  readonly id: string;
  readonly title: string;
  readonly taskText: string;
  readonly dueDate: string | null;
}

/** Teacher input. An empty due date or solution key means "none". */
export interface AssignmentFieldsInput {
  readonly title: string;
  readonly taskText: string;
  readonly dueDate: string;
  readonly solutionKey: string;
}

export interface CreateAssignmentInput extends AssignmentFieldsInput {
  readonly classroomId: string;
}

export interface UpdateAssignmentInput extends AssignmentFieldsInput {
  readonly id: string;
}

export interface AssignmentIdInput {
  readonly id: string;
}
