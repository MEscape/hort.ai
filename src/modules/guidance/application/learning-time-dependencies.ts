import type { Clock } from '@lib/clock';

import type { LearningTimePolicy } from '../domain/ports/learning-time-policy.port';

/** What reading the parent's learning window and daily limit needs (#88). */
export interface LearningTimeDependencies {
  /** The server's clock, never the device's. */
  readonly clock: Clock;
  readonly learningTime: LearningTimePolicy;
}
