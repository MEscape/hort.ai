import { clamp } from '@lib/utils';

import { HINT_LEVELS } from '../models/hint-level';

import type { HintLadderState } from '../models/help-session-state';
import type { HintLevel } from '../models/hint-level';

const TOP = HINT_LEVELS.length - 1;

/** A partly correct answer shows the child understood the task, so the ladder starts one rung higher. */
const UNDERSTOOD_FLOOR = HINT_LEVELS.indexOf('activate_prior_knowledge');

function highestGiven(state: HintLadderState): number {
  return Math.max(-1, ...state.hints.map((hint) => HINT_LEVELS.indexOf(hint.level)));
}

/**
 * The level of the next hint, decided by the backend alone (#30): one rung above the highest hint
 * already given, starting at "understand the task". Asking again is never a failure, it is simply
 * the next rung; at the top the child gets another worked example on a similar problem, because no
 * rung reveals the solution. Once an answer was partly correct, "understand the task" is skipped.
 */
export function nextHintLevel(state: HintLadderState): HintLevel {
  const floor = state.answers.includes('partly_correct') ? UNDERSTOOD_FLOOR : 0;
  const next = clamp(highestGiven(state) + 1, floor, TOP);
  return HINT_LEVELS[next] ?? 'similar_example';
}

/** The rung the child is on: the highest hint given so far, "understand the task" before any. */
export function currentHintLevel(state: HintLadderState): HintLevel {
  return HINT_LEVELS[highestGiven(state)] ?? 'understand_task';
}
