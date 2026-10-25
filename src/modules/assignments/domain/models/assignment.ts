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

/** Line and paragraph separators of word processors and PDFs: a line break for the child. */
/* eslint-disable no-control-regex -- matching control characters is the point of these checks */
const SEPARATORS = /[\u000B\u000C\u0085\u2028\u2029]/g;

/** Control, zero-width, soft-hyphen and direction characters that arrive with copied text and are invisible. */
const INVISIBLE =
  /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
/* eslint-enable no-control-regex -- end of the character checks */

/**
 * The task text as the child's help accepts it. Text pasted from a document or a PDF often carries
 * invisible characters; the help refuses those, so they are cleaned here rather than failing the
 * child's session later on a text the teacher could not see anything wrong with.
 */
function cleanTaskText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(SEPARATORS, '\n')
    .replace(INVISIBLE, '')
    .trim();
}

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

/**
 * An assignment as the help on it needs it (#33): its task text and the teacher's solution key.
 * Server-side only. It leaves this module only towards the guidance module, which compares the key
 * with the child's answer (#14) and the AI's text (#31) and never shows, stores or sends it on.
 */
export interface AssignmentForHelp {
  readonly id: AssignmentId;
  readonly text: string;
  readonly solutionKey: string | null;
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
  const text = cleanTaskText(input.text);
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
