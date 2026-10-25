import { FRACTION_LIMITS, GROUPS_LIMITS, NUMBER_LINE_LIMITS } from '../models/lesson-step';

import type {
  CompareChoice,
  Fraction,
  GroupsScene,
  NumberLineScene,
  Outcome,
  Scene,
  SceneAnswer,
} from '../models/lesson-step';

/** A fraction the bridges can draw: whole planks between the limits, none more laid than exist. */
export function isDrawableFraction({ numerator, denominator }: Fraction): boolean {
  return (
    Number.isInteger(numerator) &&
    Number.isInteger(denominator) &&
    denominator >= FRACTION_LIMITS.minParts &&
    denominator <= FRACTION_LIMITS.maxParts &&
    numerator >= 0 &&
    numerator <= denominator
  );
}

const isWhole = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Where the number line's jump lands. */
export function landingOf({ start, jump }: NumberLineScene): number {
  return start + jump;
}

/** The number a groups scene asks for: all dots, or the dots on one plate. */
export function askedNumberOf({ groups, each, ask }: GroupsScene): number {
  return ask === 'total' ? groups * each : each;
}

/** Whether a scene stays inside its template's limits; the gate for authored and generated scenes alike. */
export function isValidScene(scene: Scene): boolean {
  switch (scene.template) {
    case 'compare-bridges':
      return isDrawableFraction(scene.top) && isDrawableFraction(scene.bottom);
    case 'build-bridge':
      return isDrawableFraction(scene.target) && scene.target.numerator > 0;
    case 'number-line':
      return (
        isWhole(scene.start, 0, NUMBER_LINE_LIMITS.max) &&
        isWhole(Math.abs(scene.jump), 1, NUMBER_LINE_LIMITS.maxJump) &&
        isWhole(landingOf(scene), 0, NUMBER_LINE_LIMITS.max)
      );
    case 'groups':
      return (
        isWhole(scene.groups, 2, GROUPS_LIMITS.maxGroups) &&
        isWhole(scene.each, 1, GROUPS_LIMITS.maxEach)
      );
  }
}

function largerOf(top: Fraction, bottom: Fraction): CompareChoice {
  const difference = top.numerator * bottom.denominator - bottom.numerator * top.denominator;
  if (difference === 0) {
    return 'same';
  }
  return difference > 0 ? 'top' : 'bottom';
}

function judgeNumber(answer: SceneAnswer, expected: number, max: number): Outcome | 'mismatch' {
  if (answer.kind !== 'number' || !isWhole(answer.value, 0, max)) {
    return 'mismatch';
  }
  return answer.value === expected ? 'correct' : 'not_yet';
}

/**
 * Judges the child's answer on the scene alone, deterministically (R-006): the scene's numbers are
 * the answer key, so there is nothing for a client to read and nothing for a model to decide.
 * `mismatch` is an answer the step does not ask for (a fill on a compare scene, a plank count the
 * bridge does not have): the request is invalid, not the child's thinking.
 */
export function evaluateAnswer(scene: Scene, answer: SceneAnswer): Outcome | 'mismatch' {
  switch (scene.template) {
    case 'compare-bridges':
      if (answer.kind !== 'choose') {
        return 'mismatch';
      }
      return answer.choice === largerOf(scene.top, scene.bottom) ? 'correct' : 'not_yet';
    case 'build-bridge':
      if (answer.kind !== 'fill' || !isWhole(answer.laid, 0, scene.target.denominator)) {
        return 'mismatch';
      }
      return answer.laid === scene.target.numerator ? 'correct' : 'not_yet';
    case 'number-line':
      return judgeNumber(answer, landingOf(scene), NUMBER_LINE_LIMITS.max);
    case 'groups':
      return judgeNumber(
        answer,
        askedNumberOf(scene),
        GROUPS_LIMITS.maxGroups * GROUPS_LIMITS.maxEach,
      );
  }
}
