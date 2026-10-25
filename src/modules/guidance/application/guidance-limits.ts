import type { InsightReadBounds } from '../domain/ports/learning-record.repository';

/**
 * Bounds of the learning-summary reads (#35, performance.md): far above one child's 14 days or one
 * class's sessions on its assignments.
 */
export const INSIGHT_READ_BOUNDS = {
  sessions: 2000,
  steps: 20000,
} as const satisfies InsightReadBounds;
