import 'server-only';
import { getAccessControl } from '@modules/auth';

import { serverEnv } from '@lib/config/server';
import { getRateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';
import { once } from '@lib/utils';

import { RequestHint } from './application/commands/request-hint';
import { HintOrchestrator } from './application/services/hint-orchestrator';
import { loggerGuidanceAuditLog } from './infrastructure/audit/logger-guidance-audit-log';
import { curriculumCompetencyRetrieval } from './infrastructure/curriculum/curriculum-competency-retrieval';
import { learnerChildProfileAccess } from './infrastructure/learner/learner-child-profile-access';
import { createServiceAccountTokenSource } from './infrastructure/vertex/service-account-token';
import { VertexGeminiProvider } from './infrastructure/vertex/vertex-gemini-provider';

import type { HintProvider } from './domain/ports/hint-provider.port';

/** While the AI is off, every call is "unavailable", so the child gets the predefined prompt. */
const switchedOffProvider: HintProvider = {
  suggest: () => errAsync({ kind: 'unavailable' }),
};

/**
 * Gemini on Vertex AI when `VERTEX_AI_ENABLED=true` (the configuration then guarantees a project
 * and a service account key), otherwise the switched-off provider. Built on first use.
 */
const getHintProvider = once((): HintProvider => {
  const env = serverEnv;
  if (!env.VERTEX_AI_ENABLED || !env.VERTEX_AI_PROJECT_ID || !env.VERTEX_AI_SERVICE_ACCOUNT_KEY) {
    return switchedOffProvider;
  }
  return new VertexGeminiProvider({
    projectId: env.VERTEX_AI_PROJECT_ID,
    location: env.VERTEX_AI_LOCATION,
    modelId: env.VERTEX_AI_MODEL_ID,
    timeoutMs: env.VERTEX_AI_TIMEOUT_MS,
    accessToken: createServiceAccountTokenSource(env.VERTEX_AI_SERVICE_ACCOUNT_KEY, {
      timeoutMs: env.VERTEX_AI_TIMEOUT_MS,
    }),
  });
});

/**
 * The module's composition root. Every answer of the provider is checked against the AI output
 * contract and the child-safety rules inside the orchestrator, so no caller can skip validation.
 */
export function createHintOrchestrator(provider: HintProvider): HintOrchestrator {
  return new HintOrchestrator({ provider, audit: loggerGuidanceAuditLog });
}

/** The guidance use cases, over the configured AI provider. */
export const getGuidanceCommands = once(() => ({
  requestHint: new RequestHint({
    authorization: getAccessControl(),
    childProfiles: learnerChildProfileAccess,
    competencies: curriculumCompetencyRetrieval,
    rateLimiter: getRateLimiter(),
    hints: createHintOrchestrator(getHintProvider()),
    audit: loggerGuidanceAuditLog,
  }),
}));
