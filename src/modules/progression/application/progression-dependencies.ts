import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type { ChildAccessPort } from '../domain/ports/child-access.port';
import type { ProgressEventRepository } from '../domain/ports/progress-event.repository';
import type { ProgressionAuditLog } from '../domain/ports/progression-audit-log.port';

/** What every protected progression use case is built from. */
export interface ProgressionDependencies {
  readonly authorization: AuthorizationService;
  readonly progress: ProgressEventRepository;
  readonly children: ChildAccessPort;
  readonly audit: ProgressionAuditLog;
  readonly clock: Clock;
}
