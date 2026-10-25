import type { OwnChildProfile } from './child-profile-access.port';

/** Where the child's day stands against what the parent set (#88). */
export interface LearningDay {
  readonly status: 'open' | 'window_closed' | 'limit_reached';
  /** When learning is allowed again; set whenever the status is not `open`. */
  readonly reopensAt: Date | null;
}

/**
 * The parent's learning window and daily limit read on the server's clock. Implemented over the
 * learner module's one rule, so the enforcing use cases and the child's home screen agree.
 */
export interface LearningTimePolicy {
  /** Names the parent's calendar day of an instant, e.g. `2026-10-25`; equal names, same day. */
  calendarDay(instant: Date): string;
  /** `usedMinutes` is `null` when only the window matters (no daily limit is set). */
  assess(controls: OwnChildProfile['controls'], usedMinutes: number | null, now: Date): LearningDay;
}
