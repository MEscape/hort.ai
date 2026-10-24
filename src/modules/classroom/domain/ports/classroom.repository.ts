import type { ActorId, TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Classroom, ClassroomDraft } from '../models/classroom';
import type { ChildProfileId, ClassroomId } from '../models/ids';

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
}

export interface NewMembership {
  readonly tenantId: TenantId;
  readonly classroomId: ClassroomId;
  readonly childProfileId: ChildProfileId;
}

/** A child as its teacher sees it: the display name and nothing else (#32). */
export interface ClassMember {
  readonly childProfileId: ChildProfileId;
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

  /** The ACTIVE class whose current code has this hash; an archived class or a replaced code is `null`. */
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

  /** Stores the hash of a new code; the old code stops working with the same write. */
  replaceInviteCode(
    id: ClassroomId,
    scope: ClassroomOwnerScope,
    inviteCodeHash: string,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError>;

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
   * with `classroomArchived` when the class is no longer active at that moment (a join racing an
   * archive must not leave a member in an archived class).
   */
  addMember(input: NewMembership): AppResultAsync<Date, ConflictAppError | InfrastructureAppError>;

  /** Idempotent: whether a membership was removed. */
  removeMemberOfChild(
    childProfileId: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** Display names only, oldest member first. Bounded. */
  listMembers(
    classroomId: ClassroomId,
    scope: ClassroomOwnerScope,
    limit: number,
  ): AppResultAsync<readonly ClassMember[], InfrastructureAppError>;
}
