import { createPersistenceFailures, dateToInstant, db, instantToDate } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { ACTIVITY_SESSION_LIMIT, ACTIVITY_STEP_LIMIT } from '../../application/guidance-limits';
import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';


import type { ChildProfileId } from '../../domain/models/ids';
import type { HelpSessionOwner } from '../../domain/ports/help-session.repository';

/**
 * The instants of the child's stored steps since `since`: session starts, hints, answer checks and
 * comprehension replies (#88). Owner-scoped, bounded, and without any task or answer text.
 */
const failures = createPersistenceFailures({
  module: 'guidance.persistence',
  code: GUIDANCE_ERROR_CODES.sessionStoreFailed,
  subject: 'HelpSession',
});

async function read(
  owner: HelpSessionOwner,
  childProfileId: ChildProfileId,
  since: Date,
): Promise<Date[]> {
  const from = dateToInstant(since);
  // Every step touches its session, so a session untouched since `since` has no step in range.
  // @owner-scope actor Exact tenant, parent and child.
  const sessions = await db.orm.public.HelpSession.where({
    tenantId: owner.tenantId,
    ownerId: owner.ownerId,
    childProfileId,
  })
    .select('id', 'startedAt')
    .where((row) => row.updatedAt.gte(from))
    .limit(ACTIVITY_SESSION_LIMIT)
    .all();
  const ids = sessions.map(({ id }) => id);
  if (ids.length === 0) {
    return [];
  }
  const [hints, answers, replies] = await Promise.all([
    // @owner-scope derived Sessions were read above with tenant, owner and child.
    db.orm.public.HintEvent.where((row) => row.sessionId.in(ids))
      .select('occurredAt')
      .where((row) => row.occurredAt.gte(from))
      .limit(ACTIVITY_STEP_LIMIT)
      .all(),
    // @owner-scope derived Sessions were read above with tenant, owner and child.
    db.orm.public.ChildAnswer.where((row) => row.sessionId.in(ids))
      .select('occurredAt')
      .where((row) => row.occurredAt.gte(from))
      .limit(ACTIVITY_STEP_LIMIT)
      .all(),
    // @owner-scope derived Sessions were read above with tenant, owner and child.
    db.orm.public.ComprehensionQuestion.where((row) => row.sessionId.in(ids))
      .select('repliedAt')
      .where((row) => row.repliedAt.gte(from))
      .limit(ACTIVITY_STEP_LIMIT)
      .all(),
  ]);
  const instants: Date[] = [];
  for (const { startedAt } of sessions) {
    instants.push(instantToDate(startedAt));
  }
  for (const { occurredAt } of [...hints, ...answers]) {
    instants.push(instantToDate(occurredAt));
  }
  for (const { repliedAt } of replies) {
    if (repliedAt !== null) {
      instants.push(instantToDate(repliedAt));
    }
  }
  return instants;
}

export const loadLearningActivity = (
  owner: HelpSessionOwner,
  childProfileId: ChildProfileId,
  since: Date,
): AppResultAsync<Date[], InfrastructureAppError> =>
  fromThrowableAsync(
    () => read(owner, childProfileId, since),
    failures.infraOnly('learningActivity'),
  );
