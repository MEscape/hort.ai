import type { ActorId, TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Classroom, ClassroomDraft } from '../models/classroom';
import type { ChildProfileId, ClassMembershipId, ClassroomId } from '../models/ids';

export interface ClassroomOwnerScope {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

export interface NewClassroom {
  readonly tenantId: TenantId;
  /** The teacher creating the class: the authorized actor, never a request field. */
  readonly ownerId: ActorId;
  readonly draft: ClassroomDraft;
  readonly inviteCodeHash: string;
  /** The code sealed by `InviteCodeVault`, or `null`/absent when only the hash is kept. */
  readonly sealedInviteCode?: string | null;
}

/** A newly issued code as stored: its hash, and the code sealed by `InviteCodeVault` (or `null`). */
export interface StoredInviteCode {
  readonly hash: string;
  readonly sealed: string | null;
}

export interface NewMembership {
  readonly tenantId: TenantId;
  readonly classroomId: ClassroomId;
  readonly childProfileId: ChildProfileId;
  /** The hash of the code the parent entered; checked again under the class's row lock. */
  readonly inviteCodeHash: string;
}

/**
 * A child as its teacher sees it, for managing the class: display name and join date, nothing
 * else (#32; learning data only as class aggregates). `memberId` is the membership's own id, so
 * the child profile id never leaves the learner side.
 */
export interface ClassMember {
  readonly memberId: ClassMembershipId;
  readonly displayName: string;
  readonly joinedAt: Date;
}

export interface ChildMembership {
  readonly classroom: Classroom;
  readonly joinedAt: Date;
}

/**
 * Persistence for classes and their memberships. Every read and write takes the tenant and matches
 * on tenantId. Teacher reads and writes also constrain ownerId, so a foreign classroom behaves
 * like one that does not exist; use cases additionally requireOnResource on the stored record.
 * Parent membership operations requireOwnChild first; joining also requires the invite code.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is the use case's job.
 */
export interface ClassroomRepository {
  findById(
    id: ClassroomId,
    ownerId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<Classroom | null, InfrastructureAppError>;

  /**
   * The ACTIVE class whose current code has this hash and was issued at most
   * `INVITE_CODE_VALIDITY_DAYS` ago; an archived class, a replaced or an expired code is `null`.
   */
  findActiveByInviteCodeHash(
    inviteCodeHash: string,
    tenantId: TenantId,
  ): AppResultAsync<Classroom | null, InfrastructureAppError>;

  /** The owner's classes, newest first. Bounded: never more than `limit` (performance.md). */
  listByOwner(
    tenantId: TenantId,
    ownerId: ActorId,
    limit: number,
  ): AppResultAsync<readonly Classroom[], InfrastructureAppError>;

  create(input: NewClassroom): AppResultAsync<Classroom, InfrastructureAppError>;

  rename(
    id: ClassroomId,
    scope: ClassroomOwnerScope,
    name: string,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError>;

  /**
   * Stores the hash of a new code; the old code stops working with the same write. The sealed code
   * is replaced in the same write too, so an old code is never shown again.
   */
  replaceInviteCode(
    id: ClassroomId,
    scope: ClassroomOwnerScope,
    code: StoredInviteCode,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError>;

  /** The sealed current code of one of the owner's classes, or `null` (hash-only or not theirs). */
  findSealedInviteCode(
    id: ClassroomId,
    scope: ClassroomOwnerScope,
  ): AppResultAsync<string | null, InfrastructureAppError>;

  /** Marks the class archived and ends every membership, in one transaction. */
  archive(
    id: ClassroomId,
    tenantId: TenantId,
    ownerId: ActorId,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError>;

  findMembershipOfChild(
    childProfileId: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<ChildMembership | null, InfrastructureAppError>;

  /**
   * Adds the child and returns when it joined. Refused with `childAlreadyInClassroom` when the
   * child already has a class (unique key), which also settles two joins racing each other, and
   * with `inviteCodeInvalid` when, under the class's row lock, the class is no longer active or
   * its current code is no longer this unexpired one (a join racing an archive or a new code must
   * not admit the child).
   */
  addMember(
    input: NewMembership,
  ): AppResultAsync<Date, NotFoundAppError | ConflictAppError | InfrastructureAppError>;

  /** Idempotent: whether a membership was removed. */
  removeMemberOfChild(
    childProfileId: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** Display names and join dates only, oldest member first. Bounded. */
  listMembers(
    classroomId: ClassroomId,
    scope: ClassroomOwnerScope,
    limit: number,
  ): AppResultAsync<readonly ClassMember[], InfrastructureAppError>;
}
