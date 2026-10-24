import 'server-only';

import { HintOrchestrator } from './application/services/hint-orchestrator';
import { loggerGuidanceAuditLog } from './infrastructure/audit/logger-guidance-audit-log';

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
