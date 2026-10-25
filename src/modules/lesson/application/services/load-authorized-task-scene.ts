import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { planTaskScene } from '../../domain/planning/plan-task-scene';
import { taskSceneKind } from '../../domain/planning/task-feedback';

import { loadAuthorizedChild } from './load-authorized-child';

import type { TaskSceneView } from '../contracts/lesson-views';
import type { LessonDependencies } from '../lesson-dependencies';
import type { LoadChildError } from './load-authorized-child';

/**
 * The authorized child's open task and its planned scene, or `null` when there is no open task or
 * its math has no scene. Planned again on every request: the same task always gets the same scene.
 */
export function loadAuthorizedTaskScene(
  deps: LessonDependencies,
  childProfileId: string,
): AppResultAsync<TaskSceneView | null, LoadChildError> {
  return loadAuthorizedChild(deps, childProfileId).andThen((child) =>
    deps.tasks.openTask(child).andThen((open) => {
      const scene = open === null ? undefined : planTaskScene(deps.tasks.readMath(open.task));
      return okAsync(
        open === null || scene === undefined
          ? null
          : { sessionId: open.sessionId, kind: taskSceneKind(scene), scene },
      );
    }),
  );
}
