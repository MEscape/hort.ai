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

/**
 * A child as its teacher sees it, for managing the class: display name and join date (#32).
 * `memberId` names the membership, never the child profile.
 */
export interface ClassMemberView {
  readonly memberId: string;
  readonly displayName: string;
  readonly joinedAt: Date;
}

/**
 * One of the teacher's own classes with what its details dialog shows. `inviteCode` is `null` when
 * only its hash is stored (a class from before codes were sealed, or no key configured): such a code
 * cannot be recovered, only replaced.
 */
export interface ClassroomDetailsView {
  readonly classroom: ClassroomView;
  /** `ABCD-EFGH`, or `null` when unavailable. */
  readonly inviteCode: string | null;
  /** When the current code stops admitting children, whether or not it can be shown. */
  readonly inviteCodeExpiresAt: Date;
  /** Whether the current code no longer admits children (`INVITE_CODE_VALIDITY_DAYS`). */
  readonly isInviteCodeExpired: boolean;
  readonly members: readonly ClassMemberView[];
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
