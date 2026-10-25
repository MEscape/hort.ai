import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@lib/utils';

const GUIDANCE_WINDOW_MINUTES = 10;
const GUIDANCE_WINDOW_SECONDS = GUIDANCE_WINDOW_MINUTES * SECONDS_PER_MINUTE;
const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = HOURS_PER_DAY * SECONDS_PER_HOUR;

/**
 * Budgets for asking the AI companion (#11) and for starting help sessions (#17).
 *
 * Counted per child profile, not per parent: siblings work at the same time and must not use up
 * each other's help. Every operation calls an external system, so each budget denies when the
 * store is down. Each ten-minute window has a daily one next to it (a ten-minute window alone lets
 * a script spend 144 windows a day), and all of them share one global hourly budget for AI calls.
 * `services/child-budget.ts` spends the daily and the global budget with the ten-minute one, so
 * a use case names only the ten-minute policy.
 */
export const GUIDANCE_RATE_LIMITS = {
  /**
   * Twenty hints in ten minutes is far more than a child working through homework asks for, but
   * stops a stuck loop or a script from running up AI costs.
   */
  hintRequest: {
    id: 'guidance.hint-request',
    limit: 20,
    windowSeconds: GUIDANCE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
  /**
   * One check costs up to three AI calls (assessment, praise, comprehension question), so its own,
   * smaller budget: ten answers in ten minutes is plenty for one homework sitting.
   */
  answerCheck: {
    id: 'guidance.answer-check',
    limit: 10,
    windowSeconds: GUIDANCE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
  /**
   * Each new task is classified by the topic classifier (one AI call), stores a session and
   * abandons the open one. Thirty starts in ten minutes leaves room for a child typing and
   * correcting tasks while a script cannot fill the store or run up classifier costs.
   */
  sessionStart: {
    id: 'guidance.session-start',
    limit: 30,
    windowSeconds: GUIDANCE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
  /** A long homework afternoon asks for a few dozen hints; a hundred is the day's ceiling. */
  hintRequestDaily: {
    id: 'guidance.hint-request-daily',
    limit: 100,
    windowSeconds: SECONDS_PER_DAY,
    onBackendFailure: 'deny',
  },
  answerCheckDaily: {
    id: 'guidance.answer-check-daily',
    limit: 50,
    windowSeconds: SECONDS_PER_DAY,
    onBackendFailure: 'deny',
  },
  sessionStartDaily: {
    id: 'guidance.session-start-daily',
    limit: 100,
    windowSeconds: SECONDS_PER_DAY,
    onBackendFailure: 'deny',
  },
  /**
   * Every start, hint and check of one parent account's children, per hour. Spent before the
   * global budget, so a script with many child profiles is stopped before it can use up the help
   * of every other family; 150 leaves room for three siblings working at full speed.
   */
  aiCallsPerAccountHourly: {
    id: 'guidance.ai-calls-account-hourly',
    limit: 150,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  /**
   * Every start, hint and check of every child, per hour: the AI providers bill per call, and the
   * per-child budgets alone let many accounts (or many profiles) multiply the spend. 1,200 an hour
   * is twenty a minute, far above a classroom pilot.
   */
  aiCallsHourly: {
    id: 'guidance.ai-calls-hourly',
    limit: 1200,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
