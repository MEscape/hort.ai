import { describe, expect, it } from 'vitest';

import { readTextAnswer } from '@modules/lesson/domain/evaluation/read-text-answer';
import type { Scene } from '@modules/lesson/domain/models/lesson-step';

const COMPARE: Scene = {
  template: 'compare-bridges',
  sceneVersion: 1,
  top: { numerator: 1, denominator: 2 },
  bottom: { numerator: 1, denominator: 4 },
};

const BUILD: Scene = {
  template: 'build-bridge',
  sceneVersion: 1,
  target: { numerator: 3, denominator: 4 },
};

describe('readTextAnswer', () => {
  it.each([
    ['oben', 'top'],
    ['Die OBERE!', 'top'],
    ['the upper one', 'top'],
    ['unten', 'bottom'],
    ['ich glaube die untere', 'bottom'],
    ['gleich', 'same'],
    ['beide gleich viel', 'same'],
    ['same', 'same'],
  ] as const)('reads %j on a comparison as %s', (message, choice) => {
    expect(readTextAnswer(COMPARE, message)).toEqual({ kind: 'choose', choice });
  });

  it.each(['oben oder unten', 'nicht oben', 'keine Ahnung', 'weiß nicht', '', 'not the top one'])(
    'does not guess on %j',
    (message) => {
      expect(readTextAnswer(COMPARE, message)).toBeUndefined();
    },
  );

  it.each([
    ['3', 3],
    ['drei', 3],
    ['drei Bretter', 3],
    ['3 von 4', 3],
    ['three of four', 3],
    ['vier', 4],
    ['2', 2],
  ] as const)('reads %j on a build as %d planks', (message, laid) => {
    expect(readTextAnswer(BUILD, message)).toEqual({ kind: 'fill', laid });
  });

  it.each(['2 oder 3', 'viele', 'nicht drei', 'oben'])(
    'does not guess a count from %j',
    (message) => {
      expect(readTextAnswer(BUILD, message)).toBeUndefined();
    },
  );
});
