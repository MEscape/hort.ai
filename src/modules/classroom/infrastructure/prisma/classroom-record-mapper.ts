import { toActorId, toTenantId } from '@modules/auth';

import { dateToInstant, instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { toChildProfileId, toClassroomId } from '../../domain/models/ids';

import type {
  Classroom,
  ClassroomDraft,
  ClassroomFederalState,
  ClassroomStatus,
  ClassroomSubject,
} from '../../domain/models/classroom';
import type { ClassMember } from '../../domain/ports/classroom.repository';

/**
 * Persistence shapes. Generated Prisma contract types never leave the persistence layer.
 * `inviteCodeHash` is written but never read back into the domain.
 */
export interface ClassroomRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly federalState: ClassroomFederalStateRecord;
  readonly grade: number;
  readonly subject: ClassroomSubjectRecord;
  readonly status: ClassroomStatusRecord;
  readonly inviteCodeIssuedAt: InstantRecord;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

/** Field list for `.select(...)`; spread at the call site. */
export const CLASSROOM_SELECT = [
  'id',
  'tenantId',
  'ownerId',
  'name',
  'federalState',
  'grade',
  'subject',
  'status',
  'inviteCodeIssuedAt',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof ClassroomRecord>;

/** Domain value -> stored enum member, and back. Both tables are exhaustive. */
export const CLASSROOM_FEDERAL_STATE_RECORD = {
  bw: 'BW',
  by: 'BY',
  be: 'BE',
  bb: 'BB',
  hb: 'HB',
  hh: 'HH',
  he: 'HE',
  mv: 'MV',
  ni: 'NI',
  nw: 'NW',
  rp: 'RP',
  sl: 'SL',
  sn: 'SN',
  st: 'ST',
  sh: 'SH',
  th: 'TH',
} as const satisfies Record<ClassroomFederalState, string>;

export type ClassroomFederalStateRecord =
  (typeof CLASSROOM_FEDERAL_STATE_RECORD)[ClassroomFederalState];

const CLASSROOM_FEDERAL_STATE_BY_RECORD = {
  BW: 'bw',
  BY: 'by',
  BE: 'be',
  BB: 'bb',
  HB: 'hb',
  HH: 'hh',
  HE: 'he',
  MV: 'mv',
  NI: 'ni',
  NW: 'nw',
  RP: 'rp',
  SL: 'sl',
  SN: 'sn',
  ST: 'st',
  SH: 'sh',
  TH: 'th',
} as const satisfies Record<ClassroomFederalStateRecord, ClassroomFederalState>;

export const CLASSROOM_SUBJECT_RECORD = {
  math: 'MATH',
  german: 'GERMAN',
  general_studies: 'GENERAL_STUDIES',
  english: 'ENGLISH',
} as const satisfies Record<ClassroomSubject, string>;

export type ClassroomSubjectRecord = (typeof CLASSROOM_SUBJECT_RECORD)[ClassroomSubject];

const CLASSROOM_SUBJECT_BY_RECORD = {
  MATH: 'math',
  GERMAN: 'german',
  GENERAL_STUDIES: 'general_studies',
  ENGLISH: 'english',
} as const satisfies Record<ClassroomSubjectRecord, ClassroomSubject>;

export const CLASSROOM_STATUS_RECORD = {
  active: 'ACTIVE',
  archived: 'ARCHIVED',
} as const satisfies Record<ClassroomStatus, string>;

export type ClassroomStatusRecord = (typeof CLASSROOM_STATUS_RECORD)[ClassroomStatus];

const CLASSROOM_STATUS_BY_RECORD = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const satisfies Record<ClassroomStatusRecord, ClassroomStatus>;

export function toClassroom(record: ClassroomRecord): Classroom {
  return {
    id: toClassroomId(record.id),
    tenantId: toTenantId(record.tenantId),
    ownerId: toActorId(record.ownerId),
    name: record.name,
    federalState: CLASSROOM_FEDERAL_STATE_BY_RECORD[record.federalState],
    grade: record.grade,
    subject: CLASSROOM_SUBJECT_BY_RECORD[record.subject],
    status: CLASSROOM_STATUS_BY_RECORD[record.status],
    inviteCodeIssuedAt: instantToDate(record.inviteCodeIssuedAt),
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

/** The columns written when a classroom is created (besides tenant, owner and code hash). */
export function toClassroomCreateData(draft: ClassroomDraft) {
  return {
    name: draft.name,
    federalState: CLASSROOM_FEDERAL_STATE_RECORD[draft.federalState],
    grade: draft.grade,
    subject: CLASSROOM_SUBJECT_RECORD[draft.subject],
  };
}

/** `updatedAt` is set by every write: Prisma 8 has no update hook. */
export function touched(now: Date) {
  return { updatedAt: dateToInstant(now) };
}

export function instantOf(now: Date) {
  return dateToInstant(now);
}

/** A membership row with only the child's display name: what a teacher may see (#32). */
export interface ClassMemberRecord {
  readonly childProfileId: string;
  readonly joinedAt: InstantRecord;
  readonly childProfile: { readonly displayName: string } | null;
}

export const CLASS_MEMBER_SELECT = ['id', 'childProfileId', 'joinedAt'] as const;
export const CHILD_DISPLAY_NAME_SELECT = ['displayName'] as const;

export function toClassMember(record: ClassMemberRecord): ClassMember {
  return {
    childProfileId: toChildProfileId(record.childProfileId),
    displayName: record.childProfile?.displayName ?? '',
    joinedAt: instantToDate(record.joinedAt),
  };
}
