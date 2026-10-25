import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedTaskScene } from '../services/load-authorized-task-scene';

import type { GetTaskSceneInput } from '../contracts/lesson-inputs';
import type { TaskSceneView } from '../contracts/lesson-views';
import type { LessonDependencies } from '../lesson-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type GetTaskSceneError = LoadChildError;

/**
 * The canvas for the signed-in parent's child's open homework task: a scene of the same kind with
 * other numbers, never the task itself, or `null` (no open task, or nothing a template can draw).
 */
export class GetTaskScene {
  constructor(private readonly deps: LessonDependencies) {}

  execute(input: GetTaskSceneInput): AppResultAsync<TaskSceneView | null, GetTaskSceneError> {
    return loadAuthorizedTaskScene(this.deps, input.childProfileId);
  }
}
