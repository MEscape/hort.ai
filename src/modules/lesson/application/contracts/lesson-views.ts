import type { Outcome, Scene, StepFeedback } from '../../domain/models/lesson-step';
import type { TaskSceneKind } from '../../domain/planning/task-feedback';

/** A step as a client may see it: the scene and its narration, no feedback and no answer. */
export interface LessonStepView {
  readonly id: string;
  readonly scene: Scene;
  readonly narration: string;
}

export interface LessonView {
  readonly lessonId: string;
  readonly version: number;
  readonly schemaVersion: number;
  readonly objectiveId: string;
  readonly steps: readonly LessonStepView[];
  readonly conclusion: string;
}

/**
 * The scene for the child's open task: the same kind of problem with other numbers. `kind` names
 * its text family (`lesson.scenes.<kind>`); feedback comes per answer, as for a lesson step.
 */
export interface TaskSceneView {
  readonly sessionId: string;
  readonly kind: TaskSceneKind;
  readonly scene: Scene;
}

/**
 * The backend's judgement of one answer and what follows. `nextStepId` is `null` after the last
 * step. `unclear` is typed text that did not read as one answer: nothing was judged, the child is
 * asked to say it again, and the try does not count.
 */
export type SceneAnswerView =
  | {
      readonly outcome: Outcome;
      readonly feedback: StepFeedback;
      readonly nextStepId: string | null;
    }
  | { readonly outcome: 'unclear'; readonly feedback: null; readonly nextStepId: string };
