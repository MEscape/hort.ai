import { toActorId, toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { toAssignmentId, toClassroomId } from '../../domain/models/ids';

import type { Assignment, AssignmentDraft, ChildAssignment } from '../../domain/models/assignment';

export interface AssignmentRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly classroomId: string;
  readonly title: string;
  readonly taskText: string;
  readonly dueDate: string | null;
  readonly solutionKey: string | null;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

export const ASSIGNMENT_SELECT = [
  'id',
  'tenantId',
  'ownerId',
  'classroomId',
  'title',
  'taskText',
  'dueDate',
  'solutionKey',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof AssignmentRecord>;

export function toAssignment(record: AssignmentRecord): Assignment {
  return {
    id: toAssignmentId(record.id),
    tenantId: toTenantId(record.tenantId),
    ownerId: toActorId(record.ownerId),
    classroomId: toClassroomId(record.classroomId),
    title: record.title,
    text: record.taskText,
    dueDate: record.dueDate,
    solutionKey: record.solutionKey,
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

/** The child read selects only these columns: the solution key is never even loaded. */
export const CHILD_ASSIGNMENT_SELECT = [
  'id',
  'classroomId',
  'title',
  'taskText',
  'dueDate',
] as const satisfies ReadonlyArray<keyof AssignmentRecord>;

export type ChildAssignmentRecord = Pick<
  AssignmentRecord,
  (typeof CHILD_ASSIGNMENT_SELECT)[number]
>;

export function toChildAssignmentRecord(record: ChildAssignmentRecord): ChildAssignment {
  return {
    id: toAssignmentId(record.id),
    classroomId: toClassroomId(record.classroomId),
    title: record.title,
    text: record.taskText,
    dueDate: record.dueDate,
  };
}

export function toAssignmentCreateData(draft: AssignmentDraft) {
  return {
    title: draft.title,
    taskText: draft.text,
    dueDate: draft.dueDate,
    solutionKey: draft.solutionKey,
  };
}
