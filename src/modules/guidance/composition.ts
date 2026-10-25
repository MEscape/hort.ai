import 'server-only';
import { getAccessControl } from '@modules/auth';

import { getRateLimiter } from '@lib/rate-limit';

import { RequestHint } from './application/commands/request-hint';
import { HintOrchestrator } from './application/services/hint-orchestrator';
import { loggerGuidanceAuditLog } from './infrastructure/audit/logger-guidance-audit-log';
import { curriculumCompetencyRetrieval } from './infrastructure/curriculum/curriculum-competency-retrieval';
import { learnerChildProfileAccess } from './infrastructure/learner/learner-child-profile-access';

import type { HintProvider } from './domain/ports/hint-provider.port';

/**
 * The module's composition root. There is no AI provider adapter yet, so the
 * caller hands one in; every answer it gives is checked against the AI output
 * contract and the child-safety rules inside the orchestrator, so no caller
 * can skip validation.
 */
export function createHintOrchestrator(provider: HintProvider): HintOrchestrator {
  return new HintOrchestrator({ provider, audit: loggerGuidanceAuditLog });
}

/** The guidance use cases over a provider; the composition of the real provider follows (#10). */
export function createGuidanceCommands(provider: HintProvider) {
  return {
    requestHint: new RequestHint({
      authorization: getAccessControl(),
      childProfiles: learnerChildProfileAccess,
      competencies: curriculumCompetencyRetrieval,
      rateLimiter: getRateLimiter(),
      hints: createHintOrchestrator(provider),
      audit: loggerGuidanceAuditLog,
    }),
  } as const;
}
