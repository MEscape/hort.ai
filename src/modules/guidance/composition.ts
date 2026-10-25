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
import { GeminiProvider } from './infrastructure/gemini/gemini-provider';
import { learnerChildProfileAccess } from './infrastructure/learner/learner-child-profile-access';

import type { HintProvider } from './domain/ports/hint-provider.port';

/** While the AI is off, every call is "unavailable", so the child gets the predefined prompt. */
const switchedOffProvider: HintProvider = {
  suggest: () => errAsync({ kind: 'unavailable' }),
};

/** Gemini when `GEMINI_API_KEY` is set, otherwise the switched-off provider. Built on first use. */
const getHintProvider = once((): HintProvider => {
  const env = serverEnv;
  if (env.GEMINI_API_KEY === undefined) {
    return switchedOffProvider;
  }
  return new GeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    apiUrl: env.GEMINI_API_URL,
    modelId: env.GEMINI_MODEL_ID,
    timeoutMs: env.GEMINI_TIMEOUT_MS,
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
