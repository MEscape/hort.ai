import type { ActorId, TenantId } from '@modules/auth';

import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { createClassroomErrorBag, CLASSROOM_VALIDATION_CODES } from '../errors/classroom-errors';

import type { ClassroomId } from './ids';

const CODES = CLASSROOM_VALIDATION_CODES;

/** Field bounds, repeated by the database checks (`Classroom_*_rule`). */
export const CLASSROOM_LIMITS = {
  /** The database allows up to 80 characters (older classes); new names are `3b`: 2 (#124). */
  nameMax: 80,
  nameLength: 2,
  gradeMin: 1,
  gradeMax: 4,
} as const;

export const CLASSROOM_FEDERAL_STATES = [
  'bw',
  'by',
  'be',
  'bb',
  'hb',
  'hh',
  'he',
  'mv',
  'ni',
  'nw',
  'rp',
  'sl',
  'sn',
  'st',
  'sh',
  'th',
] as const;
export type ClassroomFederalState = (typeof CLASSROOM_FEDERAL_STATES)[number];
const isClassroomFederalState = literalGuard(CLASSROOM_FEDERAL_STATES);

export const CLASSROOM_SUBJECTS = ['math', 'german', 'general_studies', 'english'] as const;
export type ClassroomSubject = (typeof CLASSROOM_SUBJECTS)[number];
const isClassroomSubject = literalGuard(CLASSROOM_SUBJECTS);

export const CLASSROOM_STATUSES = ['active', 'archived'] as const;
export type ClassroomStatus = (typeof CLASSROOM_STATUSES)[number];

/**
 * A teacher's class. `ownerId` is the teacher; tenant and owner are internal and never leave the
 * module's views. The invite code itself is never stored, only its hash (see `invite-code.ts`).
 */
export interface Classroom {
  readonly id: ClassroomId;
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly name: string;
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
  readonly subject: ClassroomSubject;
  readonly status: ClassroomStatus;
  readonly inviteCodeIssuedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Raw input for a new classroom, before validation. */
export interface ClassroomDraftInput {
  readonly name: string;
  readonly federalState: string;
  readonly grade: number;
  readonly subject: string;
}

/** A validated classroom, ready to be stored. */
export interface ClassroomDraft {
  readonly name: string;
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
  readonly subject: ClassroomSubject;
}

/** Primary school: grades 1 to 4 (#5), a whole number. */
function isValidGrade(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CLASSROOM_LIMITS.gradeMin &&
    value <= CLASSROOM_LIMITS.gradeMax
  );
}

/** A primary-school class is named by its grade and a letter: `3b` (#124). */
export const CLASSROOM_NAME_PATTERN = /^[1-4][a-z]$/;

/** `3B` and `3b` are the same class: the name is stored in lower case. */
function normalizeName(raw: string): string {
  return raw.trim().toLowerCase();
}

function nameProblem(value: string): typeof CODES.required | typeof CODES.nameInvalid | null {
  if (value.length === 0) {
    return CODES.required;
  }
  return CLASSROOM_NAME_PATTERN.test(value) ? null : CODES.nameInvalid;
}

/** The only way a new classroom enters the system. Reports every invalid field. */
export function createClassroomDraft(
  input: ClassroomDraftInput,
): AppResult<ClassroomDraft, ValidationAppError> {
  const bag = createClassroomErrorBag();
  const name = normalizeName(input.name);
  const problem = nameProblem(name);
  if (problem !== null) {
    bag.add('name', problem);
  }
  if (!isValidGrade(input.grade)) {
    bag.add('grade', CODES.numberInvalid);
  }
  const { federalState, subject } = input;
  if (!isClassroomFederalState(federalState)) {
    bag.add('federalState', CODES.optionUnknown);
  }
  if (!isClassroomSubject(subject)) {
    bag.add('subject', CODES.optionUnknown);
  }
  if (bag.hasErrors || !isClassroomFederalState(federalState) || !isClassroomSubject(subject)) {
    return err(bag.toError());
  }
  return ok({ name, federalState, grade: input.grade, subject });
}

/** Validates a new name for a class. */
export function parseClassroomName(raw: string): AppResult<string, ValidationAppError> {
  const name = normalizeName(raw);
  const problem = nameProblem(name);
  if (problem === null) {
    return ok(name);
  }
  const bag = createClassroomErrorBag();
  bag.add('name', problem);
  return err(bag.toError());
}
