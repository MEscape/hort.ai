import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type {
  ProgressionAuditLog,
  ProgressionEvent,
} from '../../domain/ports/progression-audit-log.port';

/** All ordinary lifecycle events, so `info`. Exhaustive: a new event type does not compile until it has a level. */
export const LEVEL_BY_EVENT = {
  'progression.daily_reward_claimed': 'info',
  'progression.xp_awarded': 'info',
} as const satisfies Record<ProgressionEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `progression.audit`; never throws. */
export const loggerProgressionAuditLog: ProgressionAuditLog = createAuditLog(
  'progression.audit',
  LEVEL_BY_EVENT,
);

/**
 * Which events the durable trail keeps, and the kind of actor behind each. Both name the parent
 * whose child earned the reward and its tenant. Exhaustive per event type.
 */
export const TRAIL_BY_EVENT = {
  'progression.daily_reward_claimed': 'member',
  'progression.xp_awarded': 'member',
} as const satisfies AuditTrailPolicy<ProgressionEvent['type']>;
