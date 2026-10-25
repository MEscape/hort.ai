import type {
  ClassroomFederalState,
  ClassroomStatus,
  ClassroomSubject,
} from '../../application/contracts/classroom-constraints';
import type {
  ChildClassroomView,
  ClassroomView,
  ClassroomWithInviteCodeView,
} from '../../application/contracts/classroom-views';

/** The JSON-safe shapes Server Actions return: dates as ISO-8601 strings. */
export interface ClassroomDto {
  readonly id: string;
  readonly name: string;
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
  readonly subject: ClassroomSubject;
  readonly status: ClassroomStatus;
  readonly inviteCodeIssuedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClassroomWithInviteCodeDto {
  readonly classroom: ClassroomDto;
  readonly inviteCode: string;
}

export interface ChildClassroomDto {
  readonly classroomId: string;
  readonly name: string;
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
  readonly subject: ClassroomSubject;
  readonly joinedAt: string;
}

export function toClassroomDto(view: ClassroomView): ClassroomDto {
  return {
    id: view.id,
    name: view.name,
    federalState: view.federalState,
    grade: view.grade,
    subject: view.subject,
    status: view.status,
    inviteCodeIssuedAt: view.inviteCodeIssuedAt.toISOString(),
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function toClassroomWithInviteCodeDto(
  view: ClassroomWithInviteCodeView,
): ClassroomWithInviteCodeDto {
  return { classroom: toClassroomDto(view.classroom), inviteCode: view.inviteCode };
}

export function toChildClassroomDto(view: ChildClassroomView): ChildClassroomDto {
  return {
    classroomId: view.classroomId,
    name: view.name,
    federalState: view.federalState,
    grade: view.grade,
    subject: view.subject,
    joinedAt: view.joinedAt.toISOString(),
  };
}
