import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';

import type { AssignmentAccess } from '../domain/ports/assignment-access.port';
import type { ChildProfileAccess } from '../domain/ports/child-profile-access.port';
import type { GuidanceAuditLog } from '../domain/ports/guidance-audit-log.port';
import type { HelpSessionRepository } from '../domain/ports/help-session.repository';

/** What the help-session use cases are built from. */
export interface HelpSessionDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileAccess;
  readonly assignments: AssignmentAccess;
  readonly rateLimiter: RateLimiter;
  readonly sessions: HelpSessionRepository;
  readonly audit: GuidanceAuditLog;
}
