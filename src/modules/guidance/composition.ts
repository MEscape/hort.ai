import 'server-only';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { getRateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';
import { once } from '@lib/utils';

import { CheckAnswer } from './application/commands/check-answer';
import { ReplyToComprehensionQuestion } from './application/commands/reply-to-comprehension-question';
import { RequestHint } from './application/commands/request-hint';
import { StartHelpSession } from './application/commands/start-help-session';
import { GetOpenHelpSession } from './application/queries/get-open-help-session';
import { AnswerCoach } from './application/services/answer-coach';
import { HintOrchestrator } from './application/services/hint-orchestrator';
import { loggerGuidanceAuditLog } from './infrastructure/audit/logger-guidance-audit-log';
import { curriculumCompetencyRetrieval } from './infrastructure/curriculum/curriculum-competency-retrieval';
import { GeminiProvider } from './infrastructure/gemini/gemini-provider';
import { learnerChildProfileAccess } from './infrastructure/learner/learner-child-profile-access';
import { PrismaHelpSessionRepository } from './infrastructure/prisma/prisma-help-session.repository';
import { progressionSessionReward } from './infrastructure/progression/progression-session-reward';
import { JevSafetyClassifier } from './infrastructure/typesafe/jev-safety-classifier';

import type { HelpSessionDependencies } from './application/help-session-dependencies';
import type { FeedbackProvider } from './domain/ports/feedback-provider.port';
import type { HintProvider } from './domain/ports/hint-provider.port';
import type { SafetyClassifier } from './domain/ports/safety-classifier.port';

/** One AI model words both the hints and the feedback on the child's answer. */
type AiProvider = HintProvider & FeedbackProvider;

/** While the AI is off, every call is "unavailable", so the child gets the predefined text. */
const switchedOffProvider: AiProvider = {
  suggest: () => errAsync({ kind: 'unavailable' }),
  word: () => errAsync({ kind: 'unavailable' }),
};

/** Gemini when `GEMINI_API_KEY` is set, otherwise the switched-off provider. Built on first use. */
const getAiProvider = once((): AiProvider => {
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

/** Jev as the second safety check when `TYPESAFE_API_KEY` is set; otherwise only the word lists. */
const getSafetyClassifier = once((): SafetyClassifier | undefined => {
  const env = serverEnv;
  return env.TYPESAFE_API_KEY === undefined
    ? undefined
    : new JevSafetyClassifier({
        apiKey: env.TYPESAFE_API_KEY,
        apiUrl: env.TYPESAFE_API_URL,
        modelId: env.TYPESAFE_MODEL_ID,
        timeoutMs: env.TYPESAFE_TIMEOUT_MS,
      });
});

/**
 * The module's composition root. Every answer of the provider is checked against the AI output
 * contract and the child-safety rules inside the orchestrator, so no caller can skip validation.
 */
export function createHintOrchestrator(
  provider: HintProvider,
  safety?: SafetyClassifier,
): HintOrchestrator {
  return new HintOrchestrator({
    provider,
    audit: loggerGuidanceAuditLog,
    ...(safety === undefined ? {} : { safety }),
  });
}

/**
 * The server-side store of help sessions (#17). One instance, so the hint ladder (#30) and the
 * session use cases share it.
 */
const getHelpSessionRepository = once(() => new PrismaHelpSessionRepository(systemClock));

/** The guidance use cases, over the configured AI provider and safety classifier. */
export const getGuidanceCommands = once(() => {
  const safety = getSafetyClassifier();
  const deps = {
    authorization: getAccessControl(),
    childProfiles: learnerChildProfileAccess,
    competencies: curriculumCompetencyRetrieval,
    rateLimiter: getRateLimiter(),
    sessions: getHelpSessionRepository(),
    hints: createHintOrchestrator(getAiProvider(), safety),
    answers: new AnswerCoach({
      provider: getAiProvider(),
      audit: loggerGuidanceAuditLog,
      ...(safety === undefined ? {} : { safety }),
    }),
    audit: loggerGuidanceAuditLog,
  };
  return { requestHint: new RequestHint(deps), checkAnswer: new CheckAnswer(deps) };
});

const getHelpSessionDependencies = once((): HelpSessionDependencies => ({
  authorization: getAccessControl(),
  childProfiles: learnerChildProfileAccess,
  sessions: getHelpSessionRepository(),
  audit: loggerGuidanceAuditLog,
  reward: progressionSessionReward,
}));

/** Starting a help session and the comprehension reply (#17, #78). */
export const getHelpSessionCommands = once(() => ({
  startHelpSession: new StartHelpSession(getHelpSessionDependencies()),
  replyToComprehensionQuestion: new ReplyToComprehensionQuestion(getHelpSessionDependencies()),
}));

/** "Continue": the child's open help session (#17). */
export const getHelpSessionQueries = once(() => ({
  getOpenHelpSession: new GetOpenHelpSession(getHelpSessionDependencies()),
}));
