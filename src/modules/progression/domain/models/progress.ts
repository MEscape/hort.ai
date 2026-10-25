import type { ChildProfileId } from './ids';

/** What the ledger says about one child; everything else (level, mood) is derived from it. */
export interface ProgressSummary {
  /** Sum of all stored rewards, never negative. */
  readonly totalXp: number;
  /** When the latest reward was recorded, `null` when there is none. */
  readonly lastEventAt: Date | null;
  /** Whether the daily reward of the asked-for day is already stored. */
  readonly dailyRewardClaimed: boolean;
}

export type ProgressEventKind = 'daily_reward' | 'learning';

/** One reward to store. `xp` always comes from the rules table, `occurredAt` from the clock. */
export interface NewProgressEvent {
  readonly childProfileId: ChildProfileId;
  readonly kind: ProgressEventKind;
  readonly eventKey: string;
  readonly xp: number;
  readonly occurredAt: Date;
}
