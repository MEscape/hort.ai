import type { ChildInput } from '../../domain/models/lesson-step';

export interface GetLessonInput {
  readonly childProfileId: string;
  readonly lessonId: string;
}

export interface GetTaskSceneInput {
  readonly childProfileId: string;
}

/** An answer to the scene of the child's open task; `sessionId` must still be the open one. */
export interface CheckTaskSceneAnswerInput {
  readonly childProfileId: string;
  readonly sessionId: string;
  readonly attempt: number;
  readonly answer: ChildInput;
}

export interface CheckSceneAnswerInput {
  readonly childProfileId: string;
  readonly lessonId: string;
  readonly stepId: string;
  /** 1 for the first try at this step; only picks between "not yet" and the hint. */
  readonly attempt: number;
  /** A scene event, or typed text the backend reads into one. */
  readonly answer: ChildInput;
}
