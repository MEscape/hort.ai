import type {
  ChildClassroomView,
  ClassMemberView,
  ClassroomView,
} from './contracts/classroom-views';
import type { Classroom } from '../domain/models/classroom';
import type { ChildMembership, ClassMember } from '../domain/ports/classroom.repository';

export function toClassroomView(classroom: Classroom): ClassroomView {
  return {
    id: classroom.id,
    name: classroom.name,
    federalState: classroom.federalState,
    grade: classroom.grade,
    subject: classroom.subject,
    status: classroom.status,
    inviteCodeIssuedAt: classroom.inviteCodeIssuedAt,
    createdAt: classroom.createdAt,
    updatedAt: classroom.updatedAt,
  };
}

export function toClassMemberView(member: ClassMember): ClassMemberView {
  return {
    childProfileId: member.childProfileId,
    displayName: member.displayName,
    joinedAt: member.joinedAt,
  };
}

export function toChildClassroomView(membership: ChildMembership): ChildClassroomView {
  const { classroom } = membership;
  return {
    classroomId: classroom.id,
    name: classroom.name,
    federalState: classroom.federalState,
    grade: classroom.grade,
    subject: classroom.subject,
    joinedAt: membership.joinedAt,
  };
}
