import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';

import type { LearningTimeDependencies } from './learning-time-dependencies';
import type { AnswerCoach } from './services/answer-coach';
import type { HintOrchestrator } from './services/hint-orchestrator';
import type { AssignmentAccess } from '../domain/ports/assignment-access.port';
import type { ChildProfileAccess } from '../domain/ports/child-profile-access.port';
import type { CompetencyRetrieval } from '../domain/ports/competency-retrieval.port';
import type { GuidanceAuditLog } from '../domain/ports/guidance-audit-log.port';
import type { HintSessionStore } from '../domain/ports/hint-session-store.port';

/** What every guidance use case about one step of a child's help session is built from. */
export interface SessionStepDependencies extends LearningTimeDependencies {
  readonly authorization: AuthorizationService;
  readonly childProfiles: ChildProfileAccess;
  /** The teacher's solution key of a session on an assignment (#33). */
  readonly assignments: AssignmentAccess;
  readonly competencies: CompetencyRetrieval;
  readonly rateLimiter: RateLimiter;
  readonly sessions: HintSessionStore;
  readonly audit: GuidanceAuditLog;
}

export interface RequestHintDependencies extends SessionStepDependencies {
  readonly hints: HintOrchestrator;
}

export interface CheckAnswerDependencies extends SessionStepDependencies {
  readonly answers: AnswerCoach;
}
