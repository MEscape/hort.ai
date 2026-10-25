import type { Clock } from '@lib/clock';
import { dateToInstant, db, rollbackWith, rollbackable } from '@lib/db';
import type { Rollbackable } from '@lib/db';
import { infrastructureError, notFoundError } from '@lib/errors';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined } from '@lib/utils';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';

import { STATUS_RECORD } from './help-session-record-mapper';

import type { LevelValue } from './help-session-record-mapper';
import type { ChildProfileId } from '../../domain/models/ids';
import type { HelpSessionOwner } from '../../domain/ports/help-session.repository';
import type {
  HelpSessionRef,
  HintSessionStoreError as HelpSessionLoadError,
  RecordOutcome as StepOutcome,
} from '../../domain/ports/hint-session-store.port';

type Database = Pick<typeof db, 'orm'>;

/** The one active session `ref` names, pinned to its tenant, owner and child. */
const activeSession = (database: Database, ref: HelpSessionRef) =>
  database.orm.public.HelpSession.where({
    id: ref.sessionId,
    tenantId: ref.tenantId,
    ownerId: ref.ownerId,
    childProfileId: ref.childProfileId,
    status: STATUS_RECORD.active,
  });

/** The session columns a step reads once the session is locked. */
const LOCKED_SELECT = ['version', 'currentHintLevel', 'competencyCode'] as const;

/** What a step writes, given the locked session; it returns the session columns it moves on. */
type StepWrite = (
  tx: Database,
  locked: {
    readonly version: number;
    readonly currentHintLevel: LevelValue | null;
    readonly competencyCode: string | null;
  },
) => Promise<Record<string, unknown>>;

/**
 * How a step's transaction ended. Rolled back: `duplicate` (the step is already there) or `lost`
 * (the locked session could not be read or moved on, a store fault).
 */
type StepEnd = Rollbackable<'recorded' | 'missing', 'duplicate' | 'lost'>;

/**
 * One step in one transaction: lock the active session (an ended or foreign one is not found),
 * write the step, then move the session on with what the step returns and a new version. A
 * repeated request id hits the unique index, so the whole transaction rolls back and the caller
 * maps the conflict to `duplicate`.
 *
 * The lock is ONE `UPDATE … WHERE status = 'ACTIVE'`: Postgres re-checks the WHERE on the newest
 * row version, so a session ended by a concurrent request either commits first (count 0, not
 * found) or waits for this step. `update()` would read first and write by key, past an end.
 */
export function runStep(clock: Clock, ref: HelpSessionRef, write: StepWrite): Promise<StepEnd> {
  return rollbackable(() =>
    db.transaction(async (tx) => {
      const locking = await activeSession(tx, ref).updateAndCount({
        updatedAt: dateToInstant(clock.now()),
      });
      if (locking === 0) {
        return 'missing' as const;
      }
      const locked = await activeSession(tx, ref)
        .select(...LOCKED_SELECT)
        .first();
      if (locked === null) {
        return rollbackWith('lost');
      }
      const moved = await write(tx, locked);
      const advanced = await activeSession(tx, ref).updateAndCount({
        ...moved,
        version: locked.version + 1,
      });
      if (advanced !== 1) {
        rollbackWith('lost');
      }
      return 'recorded' as const;
    }),
  );
}

export const sessionNotFound = () =>
  notFoundError(GUIDANCE_ERROR_CODES.sessionNotFound, 'The help session was not found.');

/** Rows that break the contract, or a session that vanished mid-operation: logged, never shown half. */
export const storeFailed = (operation: string): InfrastructureAppError =>
  infrastructureError(
    GUIDANCE_ERROR_CODES.sessionStoreFailed,
    `HelpSession persistence failed during ${operation}.`,
    undefined,
  );

/** A repeat (`conflict`) is the duplicate outcome; anything else stays a failure. */
export const duplicateOnConflict = (
  error: HelpSessionLoadError | ConflictAppError,
): AppResultAsync<StepOutcome, HelpSessionLoadError> =>
  error.kind === 'conflict' ? okAsync('duplicate') : errAsync(error);

export const settleStep = (ended: StepEnd): AppResultAsync<StepOutcome, HelpSessionLoadError> => {
  if (ended.kind === 'rolled-back') {
    return ended.refusal === 'lost' ? errAsync(storeFailed('step')) : okAsync(ended.refusal);
  }
  return ended.value === 'missing' ? errAsync(sessionNotFound()) : okAsync('recorded');
};

/**
 * The distinct islands of the child's sessions that opened as help (no opening), any status, at
 * most `limit`. The database refuses an island id that is not a slug, so none needs mapping.
 */
export async function findHomeworkAreaIds(
  owner: HelpSessionOwner,
  childProfileId: ChildProfileId,
  limit: number,
): Promise<readonly string[]> {
  // @owner-scope child Exact tenant, parent and child.
  const rows = await db.orm.public.HelpSession.where({
    tenantId: owner.tenantId,
    ownerId: owner.ownerId,
    childProfileId,
  })
    .where((row) => row.areaId.isNotNull())
    .where((row) => row.opening.isNull())
    .distinct('areaId')
    .select('areaId')
    .limit(limit)
    .all();
  return rows.map(({ areaId }) => areaId).filter(isDefined);
}
