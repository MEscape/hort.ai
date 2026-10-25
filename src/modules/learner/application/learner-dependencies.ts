import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type { ChildProfileRepository } from '../domain/ports/child-profile.repository';
import type { LearnerAuditLog } from '../domain/ports/learner-audit-log.port';
import type { ParentLearningRepository } from '../domain/ports/parent-learning.repository';
import type { TutorCatalogPort } from '../domain/ports/tutor-catalog.port';

/** What every protected learner use case is built from. */
export interface LearnerDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileRepository;
  readonly audit: LearnerAuditLog;
  readonly tutors: TutorCatalogPort;
  /** Whether the development-only onboarding reset may run (never in production). */
  readonly isDevResetAllowed: boolean;
  readonly clock: Clock;
}

/** The parent-area reads: the same use-case base plus the minimized learning read model. */
export interface ParentLearnerDependencies extends LearnerDependencies {
  readonly learning: ParentLearningRepository;
}
