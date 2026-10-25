import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lessonNotFound } from '../../domain/errors/lesson-errors';
import { parseChildProfileId } from '../../domain/models/ids';

import type { ChildProfileId } from '../../domain/models/ids';
import type { LessonDependencies } from '../lesson-dependencies';

/** Everything an operation on one child can fail with. */
export type LoadChildError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The shared first half of every lesson use case: the permission FIRST, so a caller without it
 * learns nothing about which ids exist; then the learner module says whether the signed-in parent
 * owns the child. Another parent's id, like an unknown one, is "not found".
 *
 * shortcut: lessons reuse `hint.request` ("use the AI companion for my own child"); add a
 * `lesson.*` permission to the auth role table once lessons and help sessions need different roles.
 */
export function loadAuthorizedChild(
  deps: LessonDependencies,
  rawId: string,
): AppResultAsync<ChildProfileId, LoadChildError> {
  const { authorization, children } = deps;

  return authorization
    .requireInTenant('hint.request')
    .andThen(() =>
      parseChildProfileId(rawId).asyncAndThen((childProfileId) =>
        children
          .ownsChild(childProfileId)
          .andThen((owns): AppResultAsync<ChildProfileId, NotFoundAppError> =>
            owns ? okAsync(childProfileId) : errAsync(lessonNotFound()),
          ),
      ),
    );
}
