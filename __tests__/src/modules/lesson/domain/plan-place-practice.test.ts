import { describe, expect, it } from 'vitest';

import {
  askedNumberOf,
  isValidScene,
  landingOf,
} from '@modules/lesson/domain/evaluation/evaluate-answer';
import type { Scene } from '@modules/lesson/domain/models/lesson-step';
import {
  PRACTICE_PLACES,
  hasPractice,
  planPlacePractice,
} from '@modules/lesson/domain/planning/plan-place-practice';

const ROUNDS = Array.from({ length: 12 }, (_, round) => round);
const GRADES = [1, 2, 3, 4] as const;

/** The number the child has to find. */
function asked(scene: Scene): number {
  if (scene.template === 'number-line') {
    return landingOf(scene);
  }
  if (scene.template === 'groups') {
    return askedNumberOf(scene);
  }
  throw new Error(`unexpected ${scene.template}`);
}

const plan = (areaId: string, placeId: string, grade: number, round: number) =>
  planPlacePractice({ areaId, placeId, grade, round, seed: 'child-1' });

describe('planPlacePractice', () => {
  it('gives every practice place a drawable scene in every grade and round', () => {
    for (const { areaId, placeId } of PRACTICE_PLACES) {
      for (const grade of GRADES) {
        for (const round of ROUNDS) {
          const scene = plan(areaId, placeId, grade, round);
          expect(scene, `${areaId}/${placeId} grade ${grade} round ${round}`).toBeDefined();
          expect(isValidScene(scene!)).toBe(true);
        }
      }
    }
  });

  it('practises what the place stands for', () => {
    const plus = plan('zahlenwald', 'plus-mulde', 2, 3);
    const minus = plan('zahlenwald', 'minus-lichtung', 2, 3);
    const times = plan('malmuehle', 'einmaleins-feld', 3, 3);
    const share = plan('malmuehle', 'teilkarren', 3, 3);

    expect(plus).toMatchObject({ template: 'number-line' });
    expect(plus?.template === 'number-line' && plus.jump).toBeGreaterThan(0);
    expect(minus?.template === 'number-line' && minus.jump).toBeLessThan(0);
    expect(times).toMatchObject({ template: 'groups', ask: 'total' });
    expect(share).toMatchObject({ template: 'groups', ask: 'each' });
  });

  it('keeps a first grader within 20 and lets older children reach further', () => {
    const firstGrade = ROUNDS.map((round) => asked(plan('zahlenwald', 'plus-mulde', 1, round)!));
    const fourthGrade = ROUNDS.map((round) => asked(plan('zahlenwald', 'plus-mulde', 4, round)!));

    expect(Math.max(...firstGrade)).toBeLessThanOrEqual(20);
    expect(Math.max(...fourthGrade)).toBeGreaterThan(20);
  });

  it('starts gently and grows with the rounds the child solved', () => {
    const early = asked(plan('zahlenwald', 'plus-mulde', 3, 0)!);
    const later = Math.max(
      ...[8, 9, 10, 11].map((round) => asked(plan('zahlenwald', 'plus-mulde', 3, round)!)),
    );
    expect(later).toBeGreaterThan(early);
  });

  it('plans the same scene again for the same child, place and round, so the server can check it', () => {
    expect(plan('zahlenwald', 'minus-lichtung', 2, 4)).toEqual(
      plan('zahlenwald', 'minus-lichtung', 2, 4),
    );
    expect(plan('zahlenwald', 'minus-lichtung', 2, 4)).not.toEqual(
      plan('zahlenwald', 'minus-lichtung', 2, 5),
    );
  });

  it('has no practice for a place without a template, nor for a place of another island', () => {
    expect(hasPractice('maerchenwald', 'leselichtung')).toBe(false);
    expect(hasPractice('malmuehle', 'plus-mulde')).toBe(false);
    expect(plan('maerchenwald', 'leselichtung', 2, 0)).toBeUndefined();
    expect(hasPractice('zahlenwald', 'plus-mulde')).toBe(true);
  });
});
