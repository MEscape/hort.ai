import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';

import type { HintOrchestrator } from './services/hint-orchestrator';
import type { ChildProfileAccess } from '../domain/ports/child-profile-access.port';
import type { GuidanceAuditLog } from '../domain/ports/guidance-audit-log.port';

/** What every guidance use case is built from. */
export interface GuidanceDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileAccess;
  readonly rateLimiter: RateLimiter;
  readonly hints: HintOrchestrator;
  readonly audit: GuidanceAuditLog;
}
