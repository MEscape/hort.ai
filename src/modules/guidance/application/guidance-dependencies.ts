import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';

import type { AnswerCoach } from './services/answer-coach';
import type { HintOrchestrator } from './services/hint-orchestrator';
import type { ChildProfileAccess } from '../domain/ports/child-profile-access.port';
import type { CompetencyRetrieval } from '../domain/ports/competency-retrieval.port';
import type { GuidanceAuditLog } from '../domain/ports/guidance-audit-log.port';

/** What every guidance use case about one child's task is built from. */
export interface ChildTaskDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileAccess;
  readonly competencies: CompetencyRetrieval;
  readonly rateLimiter: RateLimiter;
  readonly audit: GuidanceAuditLog;
}

export interface RequestHintDependencies extends ChildTaskDependencies {
  readonly hints: HintOrchestrator;
}

export interface CheckAnswerDependencies extends ChildTaskDependencies {
  readonly answers: AnswerCoach;
}
