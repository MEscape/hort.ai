import type { Actor } from '@modules/auth';

import { validationError } from '@lib/errors';
import type { ForbiddenAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { GUIDANCE_ERROR_CODES, learningPaused } from '../../domain/errors/guidance-errors';

import type { ChildProfileId } from '../../domain/models/ids';
import type {
  ChildProfileAccess,
  ChildProfileAccessError,
  OwnChildProfile,
} from '../../domain/ports/child-profile-access.port';
import type {
  HelpSessionOwner,
  HelpSessionRepository,
} from '../../domain/ports/help-session.repository';
import type { HelpSessionDependencies } from '../help-session-dependencies';

/**
 * The owner scope of a help session: the signed-in parent, once the learner module confirmed the
 * child is theirs. Another parent's child is "not found" before any session is read.
 */
export function ownChildScope(
  deps: Pick<HelpSessionDependencies, 'childProfiles'>,
  actor: Actor,
  childProfileId: ChildProfileId,
): AppResultAsync<
  {
    readonly owner: HelpSessionOwner;
    readonly childProfileId: ChildProfileId;
    readonly child: OwnChildProfile;
  },
  ChildProfileAccessError
> {
  return deps.childProfiles.findOwn(childProfileId).map((child) => ({
    owner: { tenantId: actor.tenantId, ownerId: actor.id },
    childProfileId: child.id,
    child,
  }));
}

/**
 * The child's own answer or reply looks like distress (#90): the trusted-adult notice instead of
 * help, with no AI call and nothing stored. The log names the child only once the learner module
 * confirmed it is the parent's own, and carries ids only.
 */
export function refuseChildInDistress(
  deps: Pick<HelpSessionDependencies, 'childProfiles' | 'audit'>,
  actor: Actor,
  at: {
    readonly childProfileId: ChildProfileId;
    readonly step: 'answer' | 'reply';
  },
): AppResultAsync<never, ValidationAppError | ChildProfileAccessError> {
  return deps.childProfiles.findOwn(at.childProfileId).andThen((child) => {
    deps.audit.record({
      type: 'guidance.child_distress_detected',
      tenantId: actor.tenantId,
      actorId: actor.id,
      childProfileId: child.id,
      // Only the child is verified here; the session id from the request is not, so it stays out.
      sessionId: null,
      step: at.step,
    });
    return errAsync(
      validationError(GUIDANCE_ERROR_CODES.childDistress, 'The child may be in danger.', {}),
    );
  });
}

interface LearningTimeDependencies {
  readonly childProfiles: ChildProfileAccess;
  readonly sessions: Pick<HelpSessionRepository, 'helpMinutesBetween'>;
}

/** Minutes the child spent in help sessions today (the learner's calendar day, server clock). */
export function todayHelpMinutes(
  { childProfiles, sessions }: LearningTimeDependencies,
  owner: HelpSessionOwner,
  childProfileId: ChildProfileId,
): AppResultAsync<number, InfrastructureAppError> {
  return sessions.helpMinutesBetween(owner, childProfileId, childProfiles.today());
}

/**
 * The parent's daily limit and allowed hours, enforced on the server: a closed day is
 * `guidance.learning_paused` before anything is stored or any AI is asked. Without a limit nothing
 * is measured, so only the allowed hours count.
 */
export function admitLearningTime(
  deps: LearningTimeDependencies,
  owner: HelpSessionOwner,
  child: OwnChildProfile,
): AppResultAsync<void, ForbiddenAppError | InfrastructureAppError> {
  const used =
    child.controls.dailyLimitMinutes === null
      ? okAsync<number | null, InfrastructureAppError>(null)
      : todayHelpMinutes(deps, owner, child.id);
  return used.andThen((usedMinutes) =>
    deps.childProfiles.isDayClosed(child, usedMinutes)
      ? errAsync(learningPaused())
      : okAsync(undefined),
  );
}
