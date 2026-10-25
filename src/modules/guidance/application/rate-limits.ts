import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

const GUIDANCE_WINDOW_MINUTES = 10;
const GUIDANCE_WINDOW_SECONDS = GUIDANCE_WINDOW_MINUTES * SECONDS_PER_MINUTE;

/**
 * Budgets for asking the AI companion (#11) and for starting help sessions (#17).
 *
 * Counted per child profile, not per parent: siblings work at the same time and must not use up
 * each other's help. Hints and checks call an external system, so each budget denies when the
 * store is down.
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
   * Starting costs no AI call, but each new task stores a session and abandons the open one. Thirty
   * starts in ten minutes leaves room for a child typing and correcting tasks while a script cannot
   * fill the store. Denies when the store is down: without the budgets above the session is no use.
   */
  sessionStart: {
    id: 'guidance.session-start',
    limit: 30,
    windowSeconds: GUIDANCE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
