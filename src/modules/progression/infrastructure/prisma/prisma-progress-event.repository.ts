import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import { conflictError } from '@lib/errors';
import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { PROGRESSION_ERROR_CODES } from '../../domain/errors/progression-errors';

import { LATEST_EVENT_SELECT, toLastEventAt, toXp } from './progress-event-record-mapper';

import type { ChildProfileId } from '../../domain/models/ids';
import type { NewProgressEvent, ProgressSummary } from '../../domain/models/progress';
import type {
  ProgressEventRepository,
  ProgressOwner,
} from '../../domain/ports/progress-event.repository';

const failures = createPersistenceFailures({
  module: 'progression.persistence',
  code: PROGRESSION_ERROR_CODES.persistenceFailed,
  subject: 'ProgressEvent',
});

/** Only seen inside this file: the unique (child, key) index refused a repeat, which is an expected outcome. */
const alreadyStored = () => conflictError('progression.event_already_stored', 'Already stored.');

/** Every query names the tenant, the owner and the child, so another parent's child has no rows. */
const eventsOf = ({ tenantId, ownerId }: ProgressOwner, childProfileId: ChildProfileId) =>
  db.orm.public.ProgressEvent.where({ tenantId, ownerId, childProfileId });

/**
 * Prisma-backed XP ledger, the only place that touches `db` for it. Append-only: this class has no
 * update and no delete. Failures are infrastructure only and logged once, here.
 */
export class PrismaProgressEventRepository implements ProgressEventRepository {
  summarize(
    owner: ProgressOwner,
    childProfileId: ChildProfileId,
    dailyEventKey: string,
  ): AppResultAsync<ProgressSummary, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const totals = await eventsOf(owner, childProfileId).aggregate((aggregate) => ({
        totalXp: aggregate.sum('xp'),
      }));
      const latest = await eventsOf(owner, childProfileId)
        .select(...LATEST_EVENT_SELECT)
        .orderBy((row) => row.occurredAt.desc())
        .first();
      const daily = await eventsOf(owner, childProfileId)
        .select('id')
        .where({ eventKey: dailyEventKey })
        .first();
      return { totals, latest, daily };
    }, failures.infraOnly('summarize')).map(({ totals, latest, daily }) => ({
      totalXp: toXp(totals.totalXp),
      lastEventAt: toLastEventAt(latest),
      dailyRewardClaimed: daily !== null,
    }));
  }

  insertOnce(
    owner: ProgressOwner,
    event: NewProgressEvent,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.ProgressEvent.select('id').create({
          tenantId: owner.tenantId,
          ownerId: owner.ownerId,
          childProfileId: event.childProfileId,
          kind: event.kind,
          eventKey: event.eventKey,
          xp: event.xp,
          occurredAt: dateToInstant(event.occurredAt),
        }),
      failures.orConflict('insertOnce', alreadyStored),
    )
      .map(() => true)
      .orElse((error) => (error.kind === 'conflict' ? okAsync(false) : errAsync(error)));
  }
}
