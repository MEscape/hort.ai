import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { ProgressionDependencies } from '@modules/progression/application/progression-dependencies';
import { dayKeyOf } from '@modules/progression/domain/models/day';
import type { ChildProfileId } from '@modules/progression/domain/models/ids';
import type {
  NewProgressEvent,
  ProgressSummary,
} from '@modules/progression/domain/models/progress';
import { dailyEventKey } from '@modules/progression/domain/models/xp-rules';
import type { ChildAccessPort } from '@modules/progression/domain/ports/child-access.port';
import type {
  ProgressEventRepository,
  ProgressOwner,
} from '@modules/progression/domain/ports/progress-event.repository';
import type {
  ProgressionAuditLog,
  ProgressionEvent,
} from '@modules/progression/domain/ports/progression-audit-log.port';

import type { Clock } from '@lib/clock';
import { okAsync } from '@lib/result';

import { parent, recordingAudit, signedInAs } from '../auth/fakes';

export const PARENT_A = parent();
export const PARENT_B = parent({ id: toActorId('parent-2') });

/** 25 Oct 2026, 11:00 in Berlin: the day summer time ends. */
export const NOW = new Date('2026-10-25T10:00:00.000Z');

interface StoredEvent extends NewProgressEvent, ProgressOwner {}

/**
 * The repository's contract in memory: owner-scoped reads, one row per (child, key) and nothing
 * ever updated or removed. `insertAttempts` counts calls, `rows` is what was stored.
 */
export class InMemoryProgressEvents implements ProgressEventRepository {
  readonly rows: StoredEvent[] = [];
  insertAttempts = 0;

  summarize(owner: ProgressOwner, childProfileId: ChildProfileId, dailyKey: string) {
    const own = this.rows.filter(
      (row) =>
        row.childProfileId === childProfileId &&
        row.ownerId === owner.ownerId &&
        row.tenantId === owner.tenantId,
    );
    const latest = own.reduce<Date | null>(
      (max, row) => (max === null || row.occurredAt > max ? row.occurredAt : max),
      null,
    );
    const summary: ProgressSummary = {
      totalXp: own.reduce((sum, row) => sum + row.xp, 0),
      lastEventAt: latest,
      dailyRewardClaimed: own.some((row) => row.eventKey === dailyKey),
    };
    return okAsync(summary);
  }

  insertOnce(owner: ProgressOwner, event: NewProgressEvent) {
    this.insertAttempts += 1;
    const exists = this.rows.some(
      (row) => row.childProfileId === event.childProfileId && row.eventKey === event.eventKey,
    );
    if (!exists) {
      this.rows.push({ ...owner, ...event });
    }
    return okAsync(!exists);
  }
}

/** The learner module's answer for the signed-in parent: these are their children, no others. */
export function ownsChildren(...ids: string[]): ChildAccessPort {
  return { ownsChild: (id) => okAsync(ids.includes(id)) };
}

export function recordingProgressionAudit(): ProgressionAuditLog & {
  readonly events: ProgressionEvent[];
} {
  const events: ProgressionEvent[] = [];
  return {
    events,
    record: (event) => {
      events.push(event);
    },
  };
}

/** A clock a test can move. */
export function movableClock(start: Date = NOW): Clock & { set(next: Date): void } {
  let current = start;
  return {
    now: () => current,
    set: (next) => {
      current = next;
    },
  };
}

/** A stored reward of parent A's child `child-1`; override what a test is about. */
export function storedEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  const occurredAt = overrides.occurredAt ?? NOW;
  return {
    tenantId: PARENT_A.tenantId,
    ownerId: PARENT_A.id,
    childProfileId: 'child-1' as ChildProfileId,
    kind: 'daily_reward',
    eventKey: dailyEventKey(dayKeyOf(occurredAt)),
    xp: 5,
    occurredAt,
    ...overrides,
  };
}

/** Everything a progression use case needs, with the signed-in parent and their children chosen by the test. */
export function build(actor: Actor = PARENT_A, children: string[] = ['child-1']) {
  const progress = new InMemoryProgressEvents();
  const audit = recordingProgressionAudit();
  const securityAudit = recordingAudit();
  const clock = movableClock();
  const deps: ProgressionDependencies = {
    authorization: createAuthorizationService({
      currentActor: signedInAs(actor),
      audit: securityAudit,
    }),
    progress,
    children: ownsChildren(...children),
    audit,
    clock,
  };
  return { deps, progress, audit, securityAudit, clock };
}
