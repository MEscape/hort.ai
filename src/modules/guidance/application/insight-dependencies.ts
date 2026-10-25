import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type {
  CompetencyLabels,
  InsightAssignments,
  LearningInsightsConsent,
} from '../domain/ports/insight-sources.port';
import type { LearningRecordStore } from '../domain/ports/learning-record-store.port';

/** What the learning summaries (#35) are built from. None of them calls an AI provider. */
export interface InsightDependencies {
  readonly authorization: AuthorizationService;
  readonly clock: Clock;
  readonly consent: LearningInsightsConsent;
  readonly assignments: InsightAssignments;
  readonly competencies: CompetencyLabels;
  readonly records: LearningRecordStore;
}
