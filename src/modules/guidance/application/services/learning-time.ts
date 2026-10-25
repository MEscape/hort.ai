import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { MS_PER_MINUTE, SECONDS_PER_MINUTE } from '@lib/utils';

import { GUIDANCE_ERROR_CODES, learningTimeClosed } from '../../domain/errors/guidance-errors';
import { LEARNING_LOOKBACK_MS, countLearningMinutes } from '../../domain/models/learning-time';

import type { OwnChildProfile } from '../../domain/ports/child-profile-access.port';
import type {
  HelpSessionOwner,
  HelpSessionRepository,
} from '../../domain/ports/help-session.repository';
import type { LearningDay } from '../../domain/ports/learning-time-policy.port';
import type { LearningTimeDependencies } from '../learning-time-dependencies';

const MS_PER_SECOND = MS_PER_MINUTE / SECONDS_PER_MINUTE;

export type LearningTimeRefusal = RateLimitedAppError;

/** Why learning is paused and for how long, or `null` while the day is open. */
export function refusalOf(day: LearningDay, now: Date): LearningTimeRefusal | null {
  if (day.status === 'open' || day.reopensAt === null) {
    return null;
  }
  const seconds = (day.reopensAt.getTime() - now.getTime()) / MS_PER_SECOND;
  return learningTimeClosed(
    day.status === 'window_closed'
      ? GUIDANCE_ERROR_CODES.learningWindowClosed
      : GUIDANCE_ERROR_CODES.dailyLimitReached,
    seconds,
  );
}

/**
 * The parent's learning window (#88): a help session neither starts nor goes on outside it. Read
 * fresh from the child's stored controls on every call, so a change the parent just saved applies
 * to the very next start or step.
 */
export function requireWindowOpen(
  { clock, learningTime }: LearningTimeDependencies,
  child: OwnChildProfile,
): AppResult<undefined, LearningTimeRefusal> {
  const now = clock.now();
  const refusal = refusalOf(learningTime.assess(child.controls, null, now), now);
  return refusal === null ? ok(undefined) : err(refusal);
}

/**
 * Today's help time in whole minutes, counted from the steps the backend stored; `null` when the
 * child has no daily limit, so nothing is read and nothing can block.
 */
export function usedMinutesToday(
  { clock, learningTime }: LearningTimeDependencies,
  sessions: Pick<HelpSessionRepository, 'learningActivity'>,
  owner: HelpSessionOwner,
  child: OwnChildProfile,
): AppResultAsync<number | null, InfrastructureAppError> {
  if (child.controls.dailyLimitMinutes === null) {
    return okAsync(null);
  }
  const now = clock.now();
  return sessions
    .learningActivity(owner, child.id, new Date(now.getTime() - LEARNING_LOOKBACK_MS))
    .map((instants) => countLearningMinutes(instants, now, (instant) => learningTime.calendarDay(instant)));
}

/**
 * The daily limit (#88): once the day's help time reaches it, no new task starts that day. Only a
 * new task asks; the one the child is in the middle of may be finished.
 */
export function requireDailyBudget(
  deps: LearningTimeDependencies,
  sessions: Pick<HelpSessionRepository, 'learningActivity'>,
  owner: HelpSessionOwner,
  child: OwnChildProfile,
): AppResultAsync<undefined, LearningTimeRefusal | InfrastructureAppError> {
  return usedMinutesToday(deps, sessions, owner, child).andThen((used) => {
    const now = deps.clock.now();
    const refusal = refusalOf(deps.learningTime.assess(child.controls, used, now), now);
    return refusal === null
      ? okAsync<undefined, LearningTimeRefusal>(undefined)
      : errAsync<undefined, LearningTimeRefusal>(refusal);
  });
}
