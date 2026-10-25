import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lessonNotFound } from '../../domain/errors/lesson-errors';
import { parseHelpSessionId } from '../../domain/models/ids';
import { taskFeedback } from '../../domain/planning/task-feedback';
import { judgeChildInput } from '../services/judge-child-input';
import { loadAuthorizedTaskScene } from '../services/load-authorized-task-scene';

import type { CheckTaskSceneAnswerInput } from '../contracts/lesson-inputs';
import type { SceneAnswerView } from '../contracts/lesson-views';
import type { LessonDependencies } from '../lesson-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type CheckTaskSceneAnswerError = LoadChildError;

/**
 * Judges an answer to the scene of the child's open task: the scene is planned again from the
 * stored task (nothing from the client is trusted), so a session that was closed or replaced in the
 * meantime is "not found". Solving the scene is practice on a similar example; the child's own
 * answer to the task is still checked by the guidance module. Nothing is stored.
 */
export class CheckTaskSceneAnswer {
  constructor(private readonly deps: LessonDependencies) {}

  execute(
    input: CheckTaskSceneAnswerInput,
  ): AppResultAsync<SceneAnswerView, CheckTaskSceneAnswerError> {
    return loadAuthorizedTaskScene(this.deps, input.childProfileId).andThen((view) =>
      parseHelpSessionId(input.sessionId).asyncAndThen(
        (sessionId): AppResultAsync<SceneAnswerView, CheckTaskSceneAnswerError> => {
          if (view?.sessionId !== sessionId) {
            return errAsync(lessonNotFound());
          }
          return judgeChildInput(this.deps, {
            scene: view.scene,
            feedback: taskFeedback(view.scene),
            nextStepId: null,
            stayOn: view.sessionId,
            input: input.answer,
            attempt: input.attempt,
          });
        },
      ),
    );
  }
}
