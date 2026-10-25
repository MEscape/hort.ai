import type { ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  LESSON_VALIDATION_CODES,
  childDistress,
  fieldValidationFailed,
} from '../../domain/errors/lesson-errors';
import { evaluateAnswer } from '../../domain/evaluation/evaluate-answer';
import { readTextAnswer } from '../../domain/evaluation/read-text-answer';
import { HINT_FROM_ATTEMPT } from '../contracts/lesson-constraints';

import type { ChildInput, Scene, StepFeedbackSet } from '../../domain/models/lesson-step';
import type { SceneAnswerView } from '../contracts/lesson-views';
import type { LessonDependencies } from '../lesson-dependencies';

interface Judged {
  readonly scene: Scene;
  readonly feedback: StepFeedbackSet;
  /** Where a correct answer leads; a miss stays on `stayOn`. */
  readonly nextStepId: string | null;
  readonly stayOn: string;
  readonly input: ChildInput;
  /** 1 for the first try; picks between "not yet" and the hint. */
  readonly attempt: number;
}

/**
 * The one judgement for every scene, authored or planned: typed text is checked for distress (#90)
 * before anything else and then read by fixed rules; a tap is judged as it is. Text that reads as
 * no single answer is `unclear` (asked again, not counted); a malformed tap is invalid. From the
 * second miss on, the reaction is the hint.
 */
export function judgeChildInput(
  deps: Pick<LessonDependencies, 'safety'>,
  { scene, feedback, nextStepId, stayOn, input, attempt }: Judged,
): AppResultAsync<SceneAnswerView, ValidationAppError> {
  if (input.kind === 'text' && deps.safety.detectsDistress(input.message)) {
    return errAsync(childDistress());
  }
  const answer = input.kind === 'text' ? readTextAnswer(scene, input.message) : input;
  const outcome = answer === undefined ? 'mismatch' : evaluateAnswer(scene, answer);
  if (outcome === 'mismatch') {
    return input.kind === 'text'
      ? okAsync({ outcome: 'unclear' as const, feedback: null, nextStepId: stayOn })
      : errAsync(fieldValidationFailed('answer', LESSON_VALIDATION_CODES.answerInvalid));
  }
  if (outcome === 'correct') {
    return okAsync({ outcome, feedback: feedback.correct, nextStepId });
  }
  return okAsync({
    outcome,
    feedback: attempt >= HINT_FROM_ATTEMPT ? feedback.hint : feedback.notYet,
    nextStepId: stayOn,
  });
}
