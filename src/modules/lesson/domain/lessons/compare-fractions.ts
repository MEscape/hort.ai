import type { Lesson, StepFeedbackSet } from '../models/lesson-step';

/** Correct cheers and names the idea; a miss wobbles; the hint lines the bridges up. */
function compareFeedback(): StepFeedbackSet {
  return {
    correct: { line: 'correct', reaction: 'celebrate', mascot: 'cheer' },
    notYet: { line: 'notYet', reaction: 'wobble', mascot: 'oops' },
    hint: { line: 'hint', reaction: 'line-up', mascot: 'curious' },
  };
}

/**
 * The authored vertical slice (R-004): comparing fractions on bridges over a river, grades 3 and 4.
 * Show it (two bridges), let them do it (pick, then build), then name it (the labels appear after a
 * correct answer, the rule at the end). Every step is complete without a model: this is the lesson
 * a failed or slow AI call falls back to (R-009), not a stand-in.
 */
export const COMPARE_FRACTIONS_LESSON: Lesson = {
  id: 'compare-fractions',
  version: 1,
  objectiveId: 'math.fractions.compare',
  conclusion: 'conclusion',
  steps: [
    {
      id: 'halfOrQuarter',
      narration: 'narration',
      scene: {
        template: 'compare-bridges',
        sceneVersion: 1,
        top: { numerator: 1, denominator: 2 },
        bottom: { numerator: 1, denominator: 4 },
      },
      feedback: compareFeedback(),
    },
    {
      id: 'sameParts',
      narration: 'narration',
      scene: {
        template: 'compare-bridges',
        sceneVersion: 1,
        top: { numerator: 2, denominator: 5 },
        bottom: { numerator: 4, denominator: 5 },
      },
      feedback: compareFeedback(),
    },
    {
      id: 'buildThreeQuarters',
      narration: 'narration',
      scene: {
        template: 'build-bridge',
        sceneVersion: 1,
        target: { numerator: 3, denominator: 4 },
      },
      feedback: {
        correct: { line: 'correct', reaction: 'celebrate', mascot: 'cheer' },
        notYet: { line: 'notYet', reaction: 'wobble', mascot: 'oops' },
        hint: { line: 'hint', reaction: 'count-planks', mascot: 'curious' },
      },
    },
    {
      id: 'moreParts',
      narration: 'narration',
      scene: {
        template: 'compare-bridges',
        sceneVersion: 1,
        top: { numerator: 1, denominator: 3 },
        bottom: { numerator: 1, denominator: 6 },
      },
      feedback: compareFeedback(),
    },
    {
      id: 'twoQuartersHalf',
      narration: 'narration',
      scene: {
        template: 'compare-bridges',
        sceneVersion: 1,
        top: { numerator: 2, denominator: 4 },
        bottom: { numerator: 1, denominator: 2 },
      },
      feedback: compareFeedback(),
    },
  ],
};
