import { describe, expect, it } from 'vitest';

import { readMath } from '@modules/guidance/domain/solution-leak/read-math';
import {
  askedNumberOf,
  isValidScene,
  landingOf,
} from '@modules/lesson/domain/evaluation/evaluate-answer';
import type { Scene } from '@modules/lesson/domain/models/lesson-step';
import { planTaskScene } from '@modules/lesson/domain/planning/plan-task-scene';

const plan = (task: string) => planTaskScene(readMath(task));

/** The number the child's own task asks for, so a test can check the scene never shows it. */
function answerShown(scene: Scene): number | null {
  if (scene.template === 'number-line') {
    return landingOf(scene);
  }
  return scene.template === 'groups' ? askedNumberOf(scene) : null;
}

describe('planTaskScene', () => {
  it.each([
    ['Rechne 7 + 5', 12],
    ['Was ist 14 minus 6?', 8],
    ['acht plus neun', 17],
  ])('draws %j as a number-line jump that lands somewhere else than %d', (task, result) => {
    const scene = plan(task);

    expect(scene?.template).toBe('number-line');
    expect(scene && answerShown(scene)).not.toBe(result);
  });

  it('keeps the jump and moves the start, so it is the same kind of step', () => {
    expect(plan('7 + 5')).toEqual({ template: 'number-line', sceneVersion: 1, start: 8, jump: 5 });
    expect(plan('14 - 6')).toEqual({
      template: 'number-line',
      sceneVersion: 1,
      start: 15,
      jump: -6,
    });
  });

  it('draws times as plates of dots with another number per plate', () => {
    const scene = plan('Wie viel ist 3 · 4?');

    expect(scene).toEqual({
      template: 'groups',
      sceneVersion: 1,
      groups: 3,
      each: 5,
      ask: 'total',
    });
    expect(scene && answerShown(scene)).not.toBe(12);
  });

  it('draws divided-by as sharing onto plates, never with the task’s share', () => {
    const scene = plan('12 : 3');

    expect(scene).toEqual({ template: 'groups', sceneVersion: 1, groups: 3, each: 5, ask: 'each' });
    expect(scene && answerShown(scene)).not.toBe(4);
  });

  it('compares fractions with the same kind of pair, never the task’s own pair', () => {
    expect(plan('Was ist größer: 3/5 oder 2/5?')).toEqual({
      template: 'compare-bridges',
      sceneVersion: 1,
      top: { numerator: 3, denominator: 6 },
      bottom: { numerator: 2, denominator: 6 },
    });
    expect(plan('Vergleiche 1/3 und 1/6')).toMatchObject({
      top: { numerator: 2, denominator: 3 },
      bottom: { numerator: 2, denominator: 6 },
    });
    expect(plan('Ist 1/2 größer als 1/3?')).toMatchObject({
      top: { numerator: 2, denominator: 2 },
    });
  });

  it.each([
    'Schreibe einen Satz mit dem Wort Baum.',
    'Tom hat Äpfel und Birnen.',
    '250 + 400',
    '7 : 2',
    '12 · 12',
    '5 - 9',
  ])('draws nothing for %j (no math a template can draw)', (task) => {
    expect(plan(task)).toBeUndefined();
  });

  it('only ever plans scenes inside the template limits', () => {
    for (const task of ['99 + 1', '0 + 20', '100 - 20', '10 · 10', '100 : 10', '8/8 > 7/8']) {
      const scene = plan(task);
      if (scene !== undefined) {
        expect(isValidScene(scene), task).toBe(true);
      }
    }
  });
});
