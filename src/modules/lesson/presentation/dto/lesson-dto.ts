import type {
  LessonStepView,
  LessonView,
  SceneAnswerView,
  TaskSceneView,
} from '../../application/contracts/lesson-views';

/** What the browser gets of a lesson: scenes and narration keys, plain values, no answers. */
export type LessonStepDto = LessonStepView;

export interface LessonDto {
  readonly lessonId: string;
  readonly version: number;
  readonly schemaVersion: number;
  readonly objectiveId: string;
  readonly steps: readonly LessonStepDto[];
  readonly conclusion: string;
}

/** The backend's judgement of one answer. */
export type SceneAnswerDto = SceneAnswerView;

export function toLessonStepDto(view: LessonStepView): LessonStepDto {
  return { id: view.id, scene: view.scene, narration: view.narration };
}

export function toLessonDto(view: LessonView): LessonDto {
  return {
    lessonId: view.lessonId,
    version: view.version,
    schemaVersion: view.schemaVersion,
    objectiveId: view.objectiveId,
    steps: view.steps.map(toLessonStepDto),
    conclusion: view.conclusion,
  };
}

export function toSceneAnswerDto(view: SceneAnswerView): SceneAnswerDto {
  return view.outcome === 'unclear'
    ? { outcome: view.outcome, feedback: null, nextStepId: view.nextStepId }
    : { outcome: view.outcome, feedback: view.feedback, nextStepId: view.nextStepId };
}

/** The text family of a planned scene. */
export type TaskSceneKind = TaskSceneView['kind'];

/** The scene for the child's open task: a similar example, plain values. */
export type TaskSceneDto = TaskSceneView;

export function toTaskSceneDto(view: TaskSceneView): TaskSceneDto {
  return { sessionId: view.sessionId, kind: view.kind, scene: view.scene };
}
