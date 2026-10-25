import { clamp } from '@lib/utils';

import { HINT_LEVELS } from '../models/hint-level';

import type { GivenHint, HintLadderState } from '../models/help-session-state';
import type { HintLevel } from '../models/hint-level';

const TOP = HINT_LEVELS.length - 1;

/** A partly correct answer shows the child understood the task, so the ladder starts one rung higher. */
const UNDERSTOOD_FLOOR = HINT_LEVELS.indexOf('activate_prior_knowledge');

function highestOf(hints: readonly GivenHint[]): number {
  return Math.max(-1, ...hints.map((hint) => HINT_LEVELS.indexOf(hint.level)));
}

/** The AI could not be reached, so the child only got the rung's predefined prompt: try it again. */
const isUnreachedRung = (hint: GivenHint) =>
  hint.kind === 'fallback' && (hint.reason === 'timeout' || hint.reason === 'provider_unavailable');

/**
 * The level of the next hint, decided by the backend alone (#30): one rung above the highest hint
 * already given, starting at "understand the task". Asking again is never a failure, it is simply
 * the next rung; at the top the child gets another worked example on a similar problem, because no
 * rung reveals the solution. Once an answer was partly correct, "understand the task" is skipped.
 * A rung whose hint fell back because the AI timed out or was unavailable is offered once more;
 * after a second try (or any other fallback, a rejected answer) it is used up, so a long outage
 * still walks the child up the ladder of predefined prompts instead of repeating one.
 */
export function nextHintLevel(state: HintLadderState): HintLevel {
  const floor = state.answers.includes('partly_correct') ? UNDERSTOOD_FLOOR : 0;
  const triesAt = (level: HintLevel) => state.hints.filter((hint) => hint.level === level).length;
  const used = state.hints.filter((hint) => !isUnreachedRung(hint) || triesAt(hint.level) > 1);
  const next = clamp(highestOf(used) + 1, floor, TOP);
  return HINT_LEVELS[next] ?? 'similar_example';
}

/** The rung the child is on: the highest hint given so far, "understand the task" before any. */
export function currentHintLevel(state: HintLadderState): HintLevel {
  return HINT_LEVELS[highestOf(state.hints)] ?? 'understand_task';
}
