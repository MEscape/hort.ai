import type { TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { db, createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { LEARNER_ERROR_CODES, childProfileNotFound } from '../../domain/errors/learner-errors';

import {
  CHILD_PROFILE_SELECT,
  toChildProfile,
  toChildProfileCreateData,
  toChildProfileUpdateData,
} from './child-profile-record-mapper';

import type { ChildProfile, ChildProfileChanges } from '../../domain/models/child-profile';
import type { ChildProfileId } from '../../domain/models/ids';
import type {
  NewChildProfile,
  ChildProfileRepository,
} from '../../domain/ports/child-profile.repository';

const failures = createPersistenceFailures({
  module: 'learner.persistence',
  code: LEARNER_ERROR_CODES.persistenceFailed,
  subject: 'ChildProfile',
});

const childProfiles = () => db.orm.public.ChildProfile.select(...CHILD_PROFILE_SELECT);

/**
 * Prisma 8 repository for child profiles.
 *
 * - Query results are awaitable but not `Promise`s, so each thunk is `async`
 *   and returns the query directly: the async wrapper awaits it.
 * Failure conventions (see `createPersistenceFailures`):
 * - reads and idempotent deletes -> `infraOnly`
 * - writes that can hit a unique constraint -> `orConflict`
 * - single-row writes -> `requireRow` (Prisma 8 `update()` resolves to `null` on a miss).
 */
export class PrismaChildProfileRepository implements ChildProfileRepository {
  constructor(private readonly clock: Clock) {}

  findById(
    id: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => childProfiles().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toChildProfile(record));
  }

  listByTenant(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ChildProfile[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        childProfiles()
          .where({ tenantId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(row) => row.updatedAt.desc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByTenant'),
    ).map((records) => records.map(toChildProfile));
  }

  create(input: NewChildProfile): AppResultAsync<ChildProfile, InfrastructureAppError> {
    const { tenantId, draft } = input;
    return fromThrowableAsync(
      async () => childProfiles().create({ tenantId, ...toChildProfileCreateData(draft) }),
      failures.infraOnly('create'),
    ).map(toChildProfile);
  }

  update(
    id: ChildProfileId,
    tenantId: TenantId,
    changes: ChildProfileChanges,
  ): AppResultAsync<ChildProfile, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        childProfiles()
          .where({ id, tenantId })
          .update(toChildProfileUpdateData(changes, this.clock.now())),
      failures.infraOnly('update'),
    )
      .andThen(failures.requireRow(childProfileNotFound))
      .map(toChildProfile);
  }

  deleteById(id: ChildProfileId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.ChildProfile.where({ id, tenantId }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}
