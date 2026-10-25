import { describe, expect, it } from 'vitest';

import { evaluateAnswer, isValidScene } from '@modules/lesson/domain/evaluation/evaluate-answer';
import { allLessons } from '@modules/lesson/domain/lessons/lesson-catalog';
import type { Scene } from '@modules/lesson/domain/models/lesson-step';

const compare = (top: [number, number], bottom: [number, number]): Scene => ({
  template: 'compare-bridges',
  sceneVersion: 1,
  top: { numerator: top[0], denominator: top[1] },
  bottom: { numerator: bottom[0], denominator: bottom[1] },
});

const build = (numerator: number, denominator: number): Scene => ({
  template: 'build-bridge',
  sceneVersion: 1,
  target: { numerator, denominator },
});

describe('evaluateAnswer', () => {
  it.each([
    [compare([1, 2], [1, 4]), 'top'],
    [compare([2, 5], [4, 5]), 'bottom'],
    [compare([1, 3], [1, 6]), 'top'],
    [compare([2, 4], [1, 2]), 'same'],
  ] as const)('judges a comparison from the scene numbers alone', (scene, larger) => {
    expect(evaluateAnswer(scene, { kind: 'choose', choice: larger })).toBe('correct');
    const other = larger === 'same' ? 'top' : 'same';
    expect(evaluateAnswer(scene, { kind: 'choose', choice: other })).toBe('not_yet');
  });

  it('counts laid planks for a build scene', () => {
    expect(evaluateAnswer(build(3, 4), { kind: 'fill', laid: 3 })).toBe('correct');
    expect(evaluateAnswer(build(3, 4), { kind: 'fill', laid: 2 })).toBe('not_yet');
    expect(evaluateAnswer(build(3, 4), { kind: 'fill', laid: 4 })).toBe('not_yet');
  });

  it('rejects an answer the step does not ask for', () => {
    expect(evaluateAnswer(build(3, 4), { kind: 'choose', choice: 'top' })).toBe('mismatch');
    expect(evaluateAnswer(compare([1, 2], [1, 4]), { kind: 'fill', laid: 1 })).toBe('mismatch');
    expect(evaluateAnswer(build(3, 4), { kind: 'fill', laid: 5 })).toBe('mismatch');
    expect(evaluateAnswer(build(3, 4), { kind: 'fill', laid: -1 })).toBe('mismatch');
    expect(evaluateAnswer(build(3, 4), { kind: 'fill', laid: 1.5 })).toBe('mismatch');
  });
});

describe('isValidScene', () => {
  it('keeps every template inside its limits', () => {
    expect(isValidScene(compare([1, 2], [1, 8]))).toBe(true);
    expect(isValidScene(compare([1, 1], [1, 4]))).toBe(false);
    expect(isValidScene(compare([1, 9], [1, 4]))).toBe(false);
    expect(isValidScene(compare([3, 2], [1, 4]))).toBe(false);
    expect(isValidScene(build(0, 4))).toBe(false);
    expect(isValidScene(build(2.5, 4))).toBe(false);
  });

  it('accepts every authored scene, so the fallback lesson always draws', () => {
    for (const lesson of allLessons()) {
      for (const step of lesson.steps) {
        expect(isValidScene(step.scene), `${lesson.id}/${step.id}`).toBe(true);
      }
    }
  });

  it('gives every lesson unique step ids', () => {
    for (const lesson of allLessons()) {
      const ids = lesson.steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
