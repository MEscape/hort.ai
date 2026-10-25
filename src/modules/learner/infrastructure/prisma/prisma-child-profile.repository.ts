import { conflictConstraint, createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined } from '@lib/utils';

import { LEARNER_ERROR_CODES } from '../../domain/errors/learner-errors';
import { stepsBefore } from '../../domain/models/setup-step';

import { CHILD_PROFILE_SELECT, toChildProfile } from './child-profile-record-mapper';

import type { ChildProfileRecord } from './child-profile-record-mapper';
import type { ChildProfile } from '../../domain/models/child-profile';
import type { ActorId, ChildProfileId, TenantId } from '../../domain/models/ids';
import type { SetupStep } from '../../domain/models/setup-step';
import type {
  ChildProfileRepository,
  ClassroomSettings,
  ProfileOwner,
  ProfilePatch,
  SavedProfile,
  UnfinishedProfileInput,
} from '../../domain/ports/child-profile.repository';

const failures = createPersistenceFailures({
  module: 'learner.persistence',
  code: LEARNER_ERROR_CODES.persistenceFailed,
  subject: 'ChildProfile',
});

/** The partial unique index that allows a parent one unfinished profile (see prisma/schema.prisma). */
const ONE_UNFINISHED_PER_OWNER = 'ChildProfile_one_unfinished_per_owner';

interface Owner {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

/** @owner-scope builder Every caller below pins `tenantId` and `ownerId` (or sets them on create). */
const profiles = () => db.orm.public.ChildProfile.select(...CHILD_PROFILE_SELECT);

/** The parent's unfinished profile: at most one row, by the partial unique index. */
const unfinishedOf = ({ tenantId, ownerId }: Owner) =>
  db.orm.public.ChildProfile.where({ tenantId, ownerId, setupCompletedAt: null });

/** One conditional UPDATE: only a profile that is still unfinished takes new details. */
async function replaceDetails(input: UnfinishedProfileInput): Promise<boolean> {
  const { displayName, federalState, grade } = input.details;
  const changed = await unfinishedOf(input).updateAndCount({ displayName, federalState, grade });
  return changed > 0;
}

/** The columns a step's patch writes; a part the patch leaves out is not touched. */
function columnsOf({ interests, tutorId, controls, guardian }: ProfilePatch) {
  return {
    ...(interests === undefined ? {} : { interests: [...interests] }),
    ...(tutorId === undefined ? {} : { tutorId }),
    ...(controls === undefined
      ? {}
      : {
          voiceConsent: controls.voiceEnabled,
          dailyLimitMinutes: controls.dailyLimitMinutes,
          allowedFromMinute: controls.allowedWindow?.fromMinute ?? null,
          allowedUntilMinute: controls.allowedWindow?.untilMinute ?? null,
          learningInsights: controls.learningInsights,
        }),
    ...(guardian === undefined
      ? {}
      : {
          guardianConfirmedAt: dateToInstant(guardian.confirmedAt),
          guardianConsentVersion: guardian.consentVersion,
        }),
  };
}

/**
 * Writes the patch and advances the step in one conditional UPDATE that only matches while the
 * stored step is still before `reaches`. When it matches nothing (the step is there already, or
 * ahead), a second UPDATE writes the patch alone. The step can only move forward, so no ordering
 * of concurrent calls can move it back. `false` when the profile is finished or gone.
 */
async function writePatch(
  { id, ownerId, tenantId }: ChildProfile,
  patch: ProfilePatch,
  reaches: SetupStep,
): Promise<boolean> {
  const columns = columnsOf(patch);
  const unfinished = () =>
    db.orm.public.ChildProfile.where({ id, ownerId, tenantId, setupCompletedAt: null });
  const advanced = await unfinished()
    .where((row) => row.setupStep.in([...stepsBefore(reaches)]))
    .updateAndCount({ ...columns, setupStep: reaches });
  return advanced > 0 || (await unfinished().updateAndCount(columns)) > 0;
}

function saved(record: ChildProfileRecord, isNew: boolean): SavedProfile | null {
  const profile = toChildProfile(record);
  return profile === null ? null : { profile, isNew };
}

async function readUnfinished({ tenantId, ownerId }: Owner): Promise<SavedProfile | null> {
  const record = await profiles().where({ tenantId, ownerId, setupCompletedAt: null }).first();
  return record === null ? null : saved(record, false);
}

/**
 * Replace the details of the existing unfinished profile, else insert one. Two submits at once can
 * both find none and both insert; the partial unique index refuses the second, which then replaces
 * the details of the first's row. `null` when the profile was finished in the meantime.
 */
async function saveUnfinished(input: UnfinishedProfileInput): Promise<SavedProfile | null> {
  if (await replaceDetails(input)) {
    return readUnfinished(input);
  }
  try {
    const { tenantId, ownerId, details } = input;
    return saved(
      await profiles().create({ tenantId, ownerId, setupStep: 'interests', ...details }),
      true,
    );
  } catch (thrown) {
    if (!conflictConstraint(thrown)?.startsWith(ONE_UNFINISHED_PER_OWNER)) {
      throw thrown;
    }
    return (await replaceDetails(input)) ? readUnfinished(input) : null;
  }
}

/**
 * Prisma-backed profiles, the only place that touches `db` for them. Every query is bound to the
 * parent's own id and tenant; failures are infrastructure only and logged once, here.
 */
export class PrismaChildProfileRepository implements ChildProfileRepository {
  findOwned(
    id: ChildProfileId,
    ownerId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => profiles().where({ id, ownerId, tenantId }).first(),
      failures.infraOnly('findOwned'),
    ).map((record) => (record === null ? null : toChildProfile(record)));
  }

  listByOwner(
    ownerId: ActorId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ChildProfile[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        profiles()
          .where({ ownerId, tenantId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(row) => row.createdAt.asc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByOwner'),
    ).map((records) => records.map(toChildProfile).filter(isDefined));
  }

  saveUnfinished(
    input: UnfinishedProfileInput,
  ): AppResultAsync<SavedProfile | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => saveUnfinished(input),
      failures.infraOnly('saveUnfinished'),
    );
  }

  updateUnfinished(
    profile: ChildProfile,
    patch: ProfilePatch,
    reaches: SetupStep,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError> {
    const { id, ownerId, tenantId } = profile;
    return fromThrowableAsync(
      async () =>
        (await writePatch(profile, patch, reaches))
          ? profiles().where({ id, ownerId, tenantId }).first()
          : null,
      failures.infraOnly('updateUnfinished'),
    ).map((record) => (record === null ? null : toChildProfile(record)));
  }

  deleteAllOwned({
    tenantId,
    ownerId,
  }: ProfileOwner): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.ChildProfile.where({ tenantId, ownerId }).deleteAndCount(),
      failures.infraOnly('deleteAllOwned'),
    );
  }

  adoptClassroomSettings(
    { id, ownerId, tenantId }: ChildProfile,
    { federalState, grade }: ClassroomSettings,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        (await db.orm.public.ChildProfile.where({ id, ownerId, tenantId }).updateAndCount({
          federalState,
          grade,
        })) > 0
          ? profiles().where({ id, ownerId, tenantId }).first()
          : null,
      failures.infraOnly('adoptClassroomSettings'),
    ).map((record) => (record === null ? null : toChildProfile(record)));
  }

  markSetupCompleted(
    profile: ChildProfile,
    completedAt: Date,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    const { id, ownerId, tenantId } = profile;
    return fromThrowableAsync(
      async () =>
        db.orm.public.ChildProfile.where({
          id,
          ownerId,
          tenantId,
          setupStep: 'review',
          setupCompletedAt: null,
        }).updateAndCount({ setupStep: 'done', setupCompletedAt: dateToInstant(completedAt) }),
      failures.infraOnly('markSetupCompleted'),
    ).map((changed) => changed > 0);
  }
}
