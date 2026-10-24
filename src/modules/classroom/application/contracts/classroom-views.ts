import type {
  ClassroomDraftInput,
  ClassroomFederalState,
  ClassroomStatus,
  ClassroomSubject,
} from '../../domain/models/classroom';

/** A class for its teacher. Tenant and owner are internal and not exposed; the code is never stored. */
export interface ClassroomView {
  readonly id: string;
  readonly name: string;
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
  readonly subject: ClassroomSubject;
  readonly status: ClassroomStatus;
  readonly inviteCodeIssuedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Right after creating a class or replacing its code: the only time the code can be shown. */
export interface ClassroomWithInviteCodeView {
  readonly classroom: ClassroomView;
  /** `ABCD-EFGH`. */
  readonly inviteCode: string;
}

/** A child as its teacher sees it: the display name only (#32). */
export interface ClassMemberView {
  readonly childProfileId: string;
  readonly displayName: string;
  readonly joinedAt: Date;
}

/** The class a child is in, for its parent (and, later, the child's own screens: #29, #33). */
export interface ChildClassroomView {
  readonly classroomId: string;
  readonly name: string;
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
  readonly subject: ClassroomSubject;
  readonly joinedAt: Date;
}

export type CreateClassroomInput = ClassroomDraftInput;

export interface ClassroomIdInput {
  readonly id: string;
}

export interface RenameClassroomInput extends ClassroomIdInput {
  readonly name: string;
}

export interface JoinClassroomInput {
  readonly childProfileId: string;
  readonly inviteCode: string;
}

export interface ChildProfileIdInput {
  readonly childProfileId: string;
}
