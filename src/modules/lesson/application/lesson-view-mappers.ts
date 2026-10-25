import { LESSON_SCHEMA_VERSION } from '../domain/models/lesson-step';

import type { LessonView } from './contracts/lesson-views';
import type { Lesson } from '../domain/models/lesson-step';

/** Copies field by field, so feedback and anything added to a step later never leak by accident. */
export function toLessonView(lesson: Lesson): LessonView {
  return {
    lessonId: lesson.id,
    version: lesson.version,
    schemaVersion: LESSON_SCHEMA_VERSION,
    objectiveId: lesson.objectiveId,
    steps: lesson.steps.map((step) => ({
      id: step.id,
      scene: step.scene,
      narration: step.narration,
    })),
    conclusion: lesson.conclusion,
  };
}
