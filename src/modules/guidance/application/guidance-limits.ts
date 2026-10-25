import type { InsightReadBounds } from '../domain/ports/learning-record.repository';

/** Bounds of the day's activity read for the daily limit (#88): more than a child produces in 26 hours. */
export const ACTIVITY_SESSION_LIMIT = 500;
export const ACTIVITY_STEP_LIMIT = 2000;

/**
 * Bounds of the learning-summary reads (#35, performance.md): far above one child's 14 days or one
 * class's sessions on its assignments.
 */
export const INSIGHT_READ_BOUNDS = {
  sessions: 2000,
  steps: 20000,
} as const satisfies InsightReadBounds;
