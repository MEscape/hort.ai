import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfile, ChildProfileChanges, ChildProfileDraft } from '../models/child-profile';
import type { ChildProfileId } from '../models/ids';

export interface NewChildProfile {
  readonly tenantId: TenantId;
  readonly draft: ChildProfileDraft;
}

/**
 * Persistence for child profiles. Every read and write takes the tenant and
 * matches on (id, tenantId), so another tenant's id behaves exactly like
 * an id that does not exist.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
export interface ChildProfileRepository {
  findById(
    id: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /** Bounded: never returns more than `limit` items (performance.md). */
  listByTenant(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ChildProfile[], InfrastructureAppError>;

  create(input: NewChildProfile): AppResultAsync<ChildProfile, InfrastructureAppError>;

  update(
    id: ChildProfileId,
    tenantId: TenantId,
    changes: ChildProfileChanges,
  ): AppResultAsync<ChildProfile, NotFoundAppError | InfrastructureAppError>;

  /** Idempotent: deleting a child profile that is already gone succeeds. */
  deleteById(id: ChildProfileId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;
}
