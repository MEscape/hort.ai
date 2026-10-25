import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type {
  CompetencyLabels,
  InsightAssignments,
  LearningInsightsConsent,
} from '../domain/ports/insight-sources.port';
import type { LearningRecordRepository } from '../domain/ports/learning-record.repository';

/** What the learning summaries (#35) are built from. None of them calls an AI provider. */
export interface InsightDependencies {
  readonly authorization: AuthorizationService;
  readonly clock: Clock;
  readonly consent: LearningInsightsConsent;
  readonly assignments: InsightAssignments;
  readonly competencies: CompetencyLabels;
  readonly records: LearningRecordRepository;
}
