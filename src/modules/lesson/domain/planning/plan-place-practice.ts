import { isValidScene } from '../evaluation/evaluate-answer';
import { GROUPS_LIMITS, NUMBER_LINE_LIMITS } from '../models/lesson-step';

import type { Scene } from '../models/lesson-step';

/**
 * Island practice: what each place of a cleared island practises, as a template the backend fills
 * with numbers. The numbers are chosen by code within the grade's limits, so the answer is always
 * computed, never proposed by a model.
 */
type PracticeKind = 'count-on' | 'plus' | 'minus' | 'tens' | 'times' | 'share';

export const PRACTICE_PLACES = [
  { areaId: 'zahlenwald', placeId: 'zaehlbruecke', kind: 'count-on' },
  { areaId: 'zahlenwald', placeId: 'plus-mulde', kind: 'plus' },
  { areaId: 'zahlenwald', placeId: 'zahlenpfad', kind: 'tens' },
  { areaId: 'zahlenwald', placeId: 'minus-lichtung', kind: 'minus' },
  { areaId: 'malmuehle', placeId: 'einmaleins-feld', kind: 'times' },
  { areaId: 'malmuehle', placeId: 'kornspeicher', kind: 'times' },
  { areaId: 'malmuehle', placeId: 'teilkarren', kind: 'share' },
] as const satisfies ReadonlyArray<{
  readonly areaId: string;
  readonly placeId: string;
  readonly kind: PracticeKind;
}>;

/** Rounds until the numbers reach the grade's full range; the first rounds start gently. */
const ROUNDS_TO_FULL_RANGE = 6;
const FIRST_ROUND_SHARE = 2;
/** The smallest range a round draws from, so the first rounds are not trivial. */
const MIN_RANGE = 10;
/** Counting on: at most this many steps at once. */
const COUNT_ON_MAX_STEPS = 3;
/** Number range from grade 2 on: whole tens. */
const TENS = 10;

/** How far a grade reaches: the number range, the longest jump and the plates of dots. */
function gradeLimits(grade: number) {
  if (grade <= 1) {
    return { maxNumber: 20, maxJump: 5, maxGroups: 3, maxEach: 3 };
  }
  if (grade === 2) {
    return { maxNumber: NUMBER_LINE_LIMITS.max, maxJump: 10, maxGroups: 5, maxEach: 5 };
  }
  return {
    maxNumber: NUMBER_LINE_LIMITS.max,
    maxJump: NUMBER_LINE_LIMITS.maxJump,
    maxGroups: GROUPS_LIMITS.maxGroups,
    maxEach: GROUPS_LIMITS.maxEach,
  };
}

/** FNV-1a for the seed, mulberry32 for the steps: the published constants of both. */
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_MIX = 61;
const SHIFT_FIRST = 15;
const SHIFT_SECOND = 7;
const SHIFT_THIRD = 14;
const UINT32_RANGE = 4294967296;

/** A small deterministic generator: the same input, the same scene. */
function randomOf(text: string) {
  let state = FNV_OFFSET;
  for (const char of text) {
    state = Math.imul(state ^ (char.codePointAt(0) ?? 0), FNV_PRIME);
  }
  return (min: number, max: number): number => {
    state = (state + MULBERRY_INCREMENT) | 0;
    let t = Math.imul(state ^ (state >>> SHIFT_FIRST), 1 | state);
    t = (t + Math.imul(t ^ (t >>> SHIFT_SECOND), MULBERRY_MIX | t)) ^ t;
    const unit = ((t ^ (t >>> SHIFT_THIRD)) >>> 0) / UINT32_RANGE;
    return min + Math.floor(unit * (max - min + 1));
  };
}

export function hasPractice(areaId: string, placeId: string): boolean {
  return PRACTICE_PLACES.some((place) => place.areaId === areaId && place.placeId === placeId);
}

/**
 * The scene of one practice round at a place, or `undefined` when the place has no practice. It
 * depends only on its input, so the server plans it again to check an answer and nothing the client
 * sends is trusted. The child's grade bounds the numbers; each solved round reaches a little further.
 */
export function planPlacePractice({
  areaId,
  placeId,
  grade,
  round,
  seed,
}: {
  readonly areaId: string;
  readonly placeId: string;
  readonly grade: number;
  readonly round: number;
  /** Whose practice it is, so siblings do not get the same numbers. */
  readonly seed: string;
}): Scene | undefined {
  const place = PRACTICE_PLACES.find((p) => p.areaId === areaId && p.placeId === placeId);
  if (place === undefined) {
    return undefined;
  }
  const limits = gradeLimits(grade);
  const share = Math.min(1, (Math.max(0, round) + FIRST_ROUND_SHARE) / ROUNDS_TO_FULL_RANGE);
  const reach = (max: number, min = 1) => Math.max(min, Math.ceil(max * share));
  const random = randomOf(`${seed}:${areaId}:${placeId}:${String(round)}`);
  const top = reach(limits.maxNumber, MIN_RANGE);

  const scene = ((): Scene => {
    switch (place.kind) {
      case 'count-on': {
        const jump = random(1, Math.min(COUNT_ON_MAX_STEPS, limits.maxJump));
        return { template: 'number-line', sceneVersion: 1, start: random(0, top - jump), jump };
      }
      case 'plus': {
        const jump = random(1, Math.min(reach(limits.maxJump), top));
        return { template: 'number-line', sceneVersion: 1, start: random(0, top - jump), jump };
      }
      case 'minus': {
        const jump = random(1, Math.min(reach(limits.maxJump), top));
        return { template: 'number-line', sceneVersion: 1, start: random(jump, top), jump: -jump };
      }
      case 'tens': {
        // First graders step to the neighbour number; from grade 2 on, whole tens.
        const step = grade <= 1 ? 1 : TENS;
        const start = random(step, top - step);
        return {
          template: 'number-line',
          sceneVersion: 1,
          start,
          jump: random(0, 1) === 0 ? step : -step,
        };
      }
      case 'times':
      case 'share':
        return {
          template: 'groups',
          sceneVersion: 1,
          groups: random(2, reach(limits.maxGroups, 2)),
          each: random(1, reach(limits.maxEach)),
          ask: place.kind === 'times' ? 'total' : 'each',
        };
    }
  })();
  return isValidScene(scene) ? scene : undefined;
}
