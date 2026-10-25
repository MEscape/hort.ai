import type { AssignmentLearningStats } from '../../domain/insights/class-overview';
import type { LearningSummary } from '../../domain/insights/learning-summary';

/** The parent's summary (#35): nothing while learning notes are off. */
export type LearningSummaryView =
  { readonly kind: 'off' } | { readonly kind: 'on'; readonly summary: LearningSummary };

/**
 * The teacher's class overview (#35): numbers per assignment over the class, never per child. It
 * carries no child id, name or text.
 */
export interface ClassLearningOverviewView {
  readonly assignments: readonly AssignmentLearningStats[];
}
