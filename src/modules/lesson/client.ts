/** Browser-safe vocabulary and interactions of the lesson module. No composition or provider imports. */
export { checkSceneAnswerAction } from './presentation/actions/check-scene-answer-action';
export { checkTaskSceneAnswerAction } from './presentation/actions/check-task-scene-answer-action';
export { LESSON_ERROR_CODES } from './application/contracts/lesson-constraints';
export type { LessonDto, SceneAnswerDto, TaskSceneDto } from './presentation/dto/lesson-dto';
export { SceneCard } from './presentation/components/scene-card';
export type { SceneCardProps, SceneCheck } from './presentation/components/scene-card';
export { TaskScene } from './presentation/components/task-scene';
export type { TaskSceneProps } from './presentation/components/task-scene';
export { LessonPlayer } from './presentation/components/lesson-player';
export type { LessonPlayerProps } from './presentation/components/lesson-player';
export { lessonRoutes } from './presentation/routes';
