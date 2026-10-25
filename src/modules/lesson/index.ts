/**
 * Server-side public API of the lesson module: canvas-first lessons (R-021). A lesson is a series
 * of approved scene templates with bounded parameters; the child answers by acting on the scene and
 * the backend judges every answer from the scene's numbers. The authored lesson is complete on its
 * own, so it is also what a failed AI call falls back to. Every use case authorizes the signed-in
 * parent and only touches that parent's own child.
 */

export { getLessonQueries } from './composition';

export type { CheckSceneAnswerError } from './application/queries/check-scene-answer';
export type { CheckTaskSceneAnswerError } from './application/queries/check-task-scene-answer';
export type { GetTaskSceneError } from './application/queries/get-task-scene';
export type { GetLessonError } from './application/queries/get-lesson';
export {
  LESSON_ERROR_CODES,
  LESSON_SCHEMA_VERSION,
  LESSON_VALIDATION_CODES,
} from './application/contracts/lesson-constraints';
export type { LessonCode } from './application/contracts/lesson-constraints';
export type { CheckSceneAnswerInput, GetLessonInput } from './application/contracts/lesson-inputs';
export type {
  LessonStepView,
  LessonView,
  SceneAnswerView,
} from './application/contracts/lesson-views';

/** Framework entry point for pages: a lesson's scenes as plain values; a failure throws. */
export { loadLessonDto } from './presentation/guards/load-lesson-dto';
export { loadTaskSceneDto } from './presentation/guards/load-task-scene-dto';
export type { LessonDto, TaskSceneDto } from './presentation/dto/lesson-dto';

/** The module's message catalogs, registered in `src/i18n/locales`. */
export { default as enLesson } from './presentation/i18n/en.json';
export { default as deLesson } from './presentation/i18n/de.json';
