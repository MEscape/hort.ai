import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';

import type { ChildProfileAccess } from '../domain/ports/child-profile-access.port';
import type { CompetencyRetrieval } from '../domain/ports/competency-retrieval.port';
import type { GuidanceAuditLog } from '../domain/ports/guidance-audit-log.port';
import type { HelpSessionRepository } from '../domain/ports/help-session.repository';
import type { TopicClassifier } from '../domain/ports/topic-classifier.port';

/** What the help-session use cases are built from. */
export interface HelpSessionDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileAccess;
  readonly rateLimiter: RateLimiter;
  readonly sessions: HelpSessionRepository;
  readonly audit: GuidanceAuditLog;
  /** The candidates the topic classification picks from (#92). */
  readonly competencies: CompetencyRetrieval;
  /** Without one (no `TYPESAFE_API_KEY`) every task opens as homework without a competency. */
  readonly classifier?: TopicClassifier;
}
