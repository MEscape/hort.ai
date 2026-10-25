import type { Scene, SceneReaction, StepFeedbackSet } from '../models/lesson-step';

/** The text family of a planned scene: one per template, and one per question for plates of dots. */
export type TaskSceneKind =
  'compare-bridges' | 'build-bridge' | 'number-line' | 'groups-total' | 'groups-each';

export function taskSceneKind(scene: Scene): TaskSceneKind {
  return scene.template === 'groups' ? `groups-${scene.ask}` : scene.template;
}

/** The second-miss help of each kind: the same idea shown another way. */
const HINT_REACTION: Readonly<Record<TaskSceneKind, SceneReaction>> = {
  'compare-bridges': 'line-up',
  'build-bridge': 'count-planks',
  'number-line': 'count-steps',
  'groups-total': 'count-steps',
  'groups-each': 'deal-out',
};

/**
 * Feedback for a planned scene. Its lines are keys under `lesson.scenes.<kind>` and are filled with
 * the scene's own numbers by the client, so a task scene needs no authored step.
 */
export function taskFeedback(scene: Scene): StepFeedbackSet {
  return {
    correct: { line: 'correct', reaction: 'celebrate', mascot: 'cheer' },
    notYet: { line: 'notYet', reaction: 'wobble', mascot: 'oops' },
    hint: { line: 'hint', reaction: HINT_REACTION[taskSceneKind(scene)], mascot: 'curious' },
  };
}
