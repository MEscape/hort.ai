import { describe, expect, it } from 'vitest';

import { helpMinutes } from '@modules/guidance/domain/models/help-minutes';

const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 9, 25, 8, minute, second));

describe('helpMinutes', () => {
  it('is zero without any session step', () => {
    expect(helpMinutes([])).toBe(0);
    expect(helpMinutes([[]])).toBe(0);
  });

  it('counts one minute for the first step of a session', () => {
    expect(helpMinutes([[at(0)]])).toBe(1);
  });

  it('adds the gaps between steps, in time order whatever order they come in', () => {
    expect(helpMinutes([[at(4), at(0), at(2)]])).toBe(5);
  });

  it('caps a gap at five minutes, so an idle open tab does not count', () => {
    expect(helpMinutes([[at(0), at(40), at(41)]])).toBe(7);
  });

  it('sums every session and rounds the total up to whole minutes', () => {
    expect(
      helpMinutes([
        [at(0), at(0, 20)],
        [at(10), at(10, 20)],
      ]),
    ).toBe(3);
  });
});
