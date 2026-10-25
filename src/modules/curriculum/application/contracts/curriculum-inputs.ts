/**
 * What retrieval is asked (#28). The caller takes the federal state and grade from the child's
 * profile it has already authorized, never from the request, and `classroomId` from the child's
 * one active class membership.
 */
export interface RelevantCompetenciesRequest {
  readonly federalState: string;
  readonly grade: number;
  readonly subject: string;
  /** The child's task text; only the first `TASK_TEXT_MAX` characters are read. */
  readonly task: string;
  /** The child's class: its teacher's material may ground the child too (#29). */
  readonly classroomId?: string | null;
  /** How many competencies to return, 1 to 5 (default 3). */
  readonly limit?: number;
}
