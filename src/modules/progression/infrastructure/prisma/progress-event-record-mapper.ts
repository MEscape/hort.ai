import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

/** The one column the module reads from a stored event row, and nothing else, so no generated database type leaves this layer. */
export const LATEST_EVENT_SELECT = ['occurredAt'] as const;

export interface LatestEventRecord {
  readonly occurredAt: InstantRecord;
}

/** When the latest reward was stored, `null` for a child without one. */
export function toLastEventAt(record: LatestEventRecord | null): Date | null {
  return record === null ? null : instantToDate(record.occurredAt);
}

/** A SUM over integers can reach the driver as a number, a bigint or text, and as null over no rows. */
export function toXp(sum: unknown): number {
  return typeof sum === 'number' ? sum : Number(sum ?? 0);
}
