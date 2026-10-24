import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfile, ChildProfileChanges, ChildProfileDraft } from '../models/child-profile';
import type { ChildProfileId } from '../models/ids';

export interface NewChildProfile {
  readonly tenantId: TenantId;
  /** The parent creating the profile: the authorized actor, never a request field. */
  readonly ownerId: ActorId;
  readonly draft: ChildProfileDraft;
}

/**
 * Persistence for child profiles. Every read and write takes the tenant and
 * matches on (id, tenantId), so another tenant's id behaves exactly like
 * an id that does not exist. Whether the parent owns the profile is checked by the use case on the
 * loaded record (`requireOnResource`); the list is pinned to the owner.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
/** The tenant and parent a write is pinned to. */
export interface ChildProfileOwner {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

export interface ChildProfileRepository {
  findById(
    id: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /** The owner's profiles. Bounded: never returns more than `limit` items (performance.md). */
  listByOwner(
    tenantId: TenantId,
    ownerId: ActorId,
    limit: number,
  ): AppResultAsync<readonly ChildProfile[], InfrastructureAppError>;

  create(input: NewChildProfile): AppResultAsync<ChildProfile, InfrastructureAppError>;

  /** Pinned to the owner: a write never reaches another parent's profile. */
  update(
    id: ChildProfileId,
    owner: ChildProfileOwner,
    changes: ChildProfileChanges,
  ): AppResultAsync<ChildProfile, NotFoundAppError | InfrastructureAppError>;

  /** Idempotent: deleting a child profile that is already gone succeeds. */
  deleteById(
    id: ChildProfileId,
    tenantId: TenantId,
    ownerId: ActorId,
  ): AppResultAsync<void, InfrastructureAppError>;
}
