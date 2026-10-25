import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lessonNotFound } from '../../domain/errors/lesson-errors';
import { findLesson } from '../../domain/lessons/lesson-catalog';
import { toLessonView } from '../lesson-view-mappers';
import { loadAuthorizedChild } from '../services/load-authorized-child';

import type { GetLessonInput } from '../contracts/lesson-inputs';
import type { LessonView } from '../contracts/lesson-views';
import type { LessonDependencies } from '../lesson-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type GetLessonError = LoadChildError;

/**
 * A lesson's scenes for the signed-in parent's own child. The view carries scenes and narration
 * only: what each answer earns is decided per answer by `CheckSceneAnswer`, never in the browser.
 */
export class GetLesson {
  constructor(private readonly deps: LessonDependencies) {}

  execute(input: GetLessonInput): AppResultAsync<LessonView, GetLessonError> {
    return loadAuthorizedChild(this.deps, input.childProfileId).andThen(() => {
      const lesson = findLesson(input.lessonId);
      return lesson === undefined ? errAsync(lessonNotFound()) : okAsync(toLessonView(lesson));
    });
  }
}
