import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lessonNotFound } from '../../domain/errors/lesson-errors';
import { findLesson } from '../../domain/lessons/lesson-catalog';
import { judgeChildInput } from '../services/judge-child-input';
import { loadAuthorizedChild } from '../services/load-authorized-child';

import type { CheckSceneAnswerInput } from '../contracts/lesson-inputs';
import type { SceneAnswerView } from '../contracts/lesson-views';
import type { LessonDependencies } from '../lesson-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type CheckSceneAnswerError = LoadChildError;

/**
 * Judges one answer to an authored lesson step on the backend (R-006) and answers with the step's
 * reaction and the step that follows (`judgeChildInput`). A miss never costs anything.
 *
 * shortcut: nothing is stored yet, so a lesson does not resume and earns no XP; make this a command
 * with a lesson-progress repository and an idempotent XP grant for R-007/R-008. A distress hit is
 * not audited yet either; add an audit port when this becomes a command.
 */
export class CheckSceneAnswer {
  constructor(private readonly deps: LessonDependencies) {}

  execute(input: CheckSceneAnswerInput): AppResultAsync<SceneAnswerView, CheckSceneAnswerError> {
    return loadAuthorizedChild(this.deps, input.childProfileId).andThen(() => {
      const steps = findLesson(input.lessonId)?.steps ?? [];
      const index = steps.findIndex((step) => step.id === input.stepId);
      const step = steps[index];
      if (step === undefined) {
        return errAsync(lessonNotFound());
      }
      return judgeChildInput(this.deps, {
        scene: step.scene,
        feedback: step.feedback,
        nextStepId: steps[index + 1]?.id ?? null,
        stayOn: step.id,
        input: input.answer,
        attempt: input.attempt,
      });
    });
  }
}
