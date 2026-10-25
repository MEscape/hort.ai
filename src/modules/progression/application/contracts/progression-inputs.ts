import type { LearningEventKind } from '../../domain/models/xp-rules';

export interface GetProgressInput {
  readonly childProfileId: string;
}

export interface ClaimDailyRewardInput {
  readonly childProfileId: string;
}

export interface AwardLearningXpInput {
  readonly childProfileId: string;
  /** The kind decides the amount; there is no way to pass a number. */
  readonly event: LearningEventKind;
  /** The caller's idempotency key (for example the help session id): the same key rewards once. */
  readonly eventKey: string;
}
