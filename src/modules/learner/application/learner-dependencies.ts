import type { AuthorizationService } from '@modules/auth';

import type { ChildProfileRepository } from '../domain/ports/child-profile.repository';
import type { LearnerAuditLog } from '../domain/ports/learner-audit-log.port';

/** What every protected learner use case is built from. */
export interface LearnerDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileRepository;
  readonly audit: LearnerAuditLog;
}
