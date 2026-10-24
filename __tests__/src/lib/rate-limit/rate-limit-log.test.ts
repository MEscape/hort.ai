import { describe, expect, it } from 'vitest';

import { createLogThrottle } from '@lib/rate-limit/rate-limit-log';

import { createFakeClock } from './fakes';

const INTERVAL_MS = 1000;

describe('createLogThrottle', () => {
  it('writes the first event of a key', () => {
    const throttle = createLogThrottle(createFakeClock(), INTERVAL_MS);

    expect(throttle.admit('a')).toEqual({ write: true, suppressed: 0 });
  });

  it('suppresses repeats inside the interval', () => {
    const clock = createFakeClock();
    const throttle = createLogThrottle(clock, INTERVAL_MS);
    throttle.admit('a');
    clock.advance(INTERVAL_MS - 1);

    expect(throttle.admit('a')).toEqual({ write: false, suppressed: 0 });
  });

  it('reports how many were dropped once the interval has passed', () => {
    const clock = createFakeClock();
    const throttle = createLogThrottle(clock, INTERVAL_MS);
    throttle.admit('a');
    throttle.admit('a');
    throttle.admit('a');
    clock.advance(INTERVAL_MS);

    expect(throttle.admit('a')).toEqual({ write: true, suppressed: 2 });
    expect(throttle.admit('a')).toEqual({ write: false, suppressed: 0 });
  });

  it('counts the next write from zero again', () => {
    const clock = createFakeClock();
    const throttle = createLogThrottle(clock, INTERVAL_MS);
    throttle.admit('a');
    throttle.admit('a');
    clock.advance(INTERVAL_MS);
    throttle.admit('a');
    clock.advance(INTERVAL_MS);

    expect(throttle.admit('a')).toEqual({ write: true, suppressed: 0 });
  });

  it('throttles each key on its own', () => {
    const throttle = createLogThrottle(createFakeClock(), INTERVAL_MS);
    throttle.admit('a');

    expect(throttle.admit('b').write).toBe(true);
    expect(throttle.admit('a').write).toBe(false);
  });

  it('stays bounded: a flood of distinct keys forgets old ones instead of growing', () => {
    const throttle = createLogThrottle(createFakeClock(), INTERVAL_MS);
    throttle.admit('first');

    for (let index = 0; index < 600; index += 1) {
      throttle.admit(`key-${index}`);
    }

    // 'first' was dropped by the clean-up, so it is written again rather than suppressed.
    expect(throttle.admit('first').write).toBe(true);
  });
});
