import type { ActorId, TenantId } from '@modules/auth';

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
  ChildProfileOwner,
  ChildProfileRepository,
} from '../../domain/ports/child-profile.repository';

const failures = createPersistenceFailures({
  module: 'learner.persistence',
  code: LEARNER_ERROR_CODES.persistenceFailed,
  subject: 'ChildProfile',
});

/** @owner-scope builder Every method below pins ownerId, except `findById`, whose caller checks the stored owner. */
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

  /**
   * @owner-scope builder The use case compares the stored owner with the actor (`requireOnResource`), so
   * another parent is refused with `auth.permission_denied` rather than told the profile does not exist.
   */
  findById(
    id: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => childProfiles().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toChildProfile(record));
  }

  listByOwner(
    tenantId: TenantId,
    ownerId: ActorId,
    limit: number,
  ): AppResultAsync<readonly ChildProfile[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        childProfiles()
          .where({ tenantId, ownerId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(row) => row.updatedAt.desc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByOwner'),
    ).map((records) => records.map(toChildProfile));
  }

  create(input: NewChildProfile): AppResultAsync<ChildProfile, InfrastructureAppError> {
    const { tenantId, ownerId, draft } = input;
    return fromThrowableAsync(
      async () => childProfiles().create({ tenantId, ownerId, ...toChildProfileCreateData(draft) }),
      failures.infraOnly('create'),
    ).map(toChildProfile);
  }

  update(
    id: ChildProfileId,
    { tenantId, ownerId }: ChildProfileOwner,
    changes: ChildProfileChanges,
  ): AppResultAsync<ChildProfile, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        childProfiles()
          .where({ id, tenantId, ownerId })
          .update(toChildProfileUpdateData(changes, this.clock.now())),
      failures.infraOnly('update'),
    )
      .andThen(failures.requireRow(childProfileNotFound))
      .map(toChildProfile);
  }

  deleteById(
    id: ChildProfileId,
    tenantId: TenantId,
    ownerId: ActorId,
  ): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.ChildProfile.where({ id, tenantId, ownerId }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}
