import type { ActorId, TenantId } from '@modules/auth';

import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { trimToNull } from '@lib/utils';

import {
  ASSIGNMENTS_VALIDATION_CODES as CODES,
  createAssignmentErrorBag,
} from '../errors/assignment-errors';

import type { AssignmentId, ClassroomId } from './ids';

/** Field bounds, repeated by the database checks (`Assignment_*_rule`). */
export const ASSIGNMENT_LIMITS = { title: 120, taskText: 4000, solutionKey: 4000 } as const;

/** `YYYY-MM-DD`, the shape `Assignment_due_date_rule` stores; the calendar check follows. */
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Internal teacher record. Never serialize this record into a child-facing response. */
export interface Assignment extends AssignmentDraft {
  readonly id: AssignmentId;
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly classroomId: ClassroomId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Validated by `createAssignmentDraft` before reaching the repository. Dates are ISO calendar dates. */
export interface AssignmentDraft {
  readonly title: string;
  readonly text: string;
  readonly dueDate: string | null;
  readonly solutionKey: string | null;
}

/** Raw teacher input, before validation. An empty due date or solution key means "none". */
export interface AssignmentDraftInput {
  readonly title: string;
  readonly text: string;
  readonly dueDate: string;
  readonly solutionKey: string;
}

/** What a child may see of an assignment. The solution key is not part of the type at all. */
export interface ChildAssignment {
  readonly id: AssignmentId;
  readonly classroomId: ClassroomId;
  readonly title: string;
  readonly text: string;
  readonly dueDate: string | null;
}

/** Allowlist projection: neither solutionKey nor account identifiers can escape by spreading. */
export function toChildAssignment(assignment: Assignment): ChildAssignment {
  return {
    id: assignment.id,
    classroomId: assignment.classroomId,
    title: assignment.title,
    text: assignment.text,
    dueDate: assignment.dueDate,
  };
}

/** A real calendar day: `2026-02-30` matches the pattern but is refused. */
function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value);
  if (match === null) {
    return false;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return date.toISOString().startsWith(value);
}

/** The only way teacher input becomes an assignment. Reports every invalid field. */
export function createAssignmentDraft(
  input: AssignmentDraftInput,
): AppResult<AssignmentDraft, ValidationAppError> {
  const bag = createAssignmentErrorBag();
  const title = input.title.trim();
  const text = input.text.trim();
  const dueDate = trimToNull(input.dueDate);
  const solutionKey = trimToNull(input.solutionKey);

  if (bag.expect(title.length > 0, 'title', CODES.titleRequired)) {
    bag.expect(title.length <= ASSIGNMENT_LIMITS.title, 'title', CODES.titleTooLong);
  }
  if (bag.expect(text.length > 0, 'taskText', CODES.taskRequired)) {
    bag.expect(text.length <= ASSIGNMENT_LIMITS.taskText, 'taskText', CODES.taskTooLong);
  }
  bag.expect(dueDate === null || isCalendarDate(dueDate), 'dueDate', CODES.dateInvalid);
  bag.expect(
    solutionKey === null || solutionKey.length <= ASSIGNMENT_LIMITS.solutionKey,
    'solutionKey',
    CODES.solutionTooLong,
  );

  return bag.hasErrors ? err(bag.toError()) : ok({ title, text, dueDate, solutionKey });
}
