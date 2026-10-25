import { describe, expect, it } from 'vitest';

import {
  learningPauseOf,
  openingTime,
} from '@modules/guidance/presentation/components/learning-pause';

function pauseOf(...args: Parameters<typeof learningPauseOf>) {
  const pause = learningPauseOf(...args);
  if (pause === null) {
    throw new Error('expected a pause');
  }
  return pause;
}

const NOW = new Date('2026-10-25T18:00:00Z'); // 19:00 in Berlin (CET)

describe('learningPauseOf (#88)', () => {
  it('names the opening time in Berlin time, tomorrow when it is on the next day', () => {
    const pause = pauseOf(
      { code: 'guidance.learning_window_closed', retryAfterSeconds: 19 * 3600 },
      NOW,
    );
    expect(pause).toMatchObject({ reason: 'window', day: 'tomorrow', anyTime: false });
    expect(openingTime(pause)).toBe('14:00');
  });

  it('says today when the window opens later the same Berlin day', () => {
    const pause = pauseOf(
      { code: 'guidance.learning_window_closed', retryAfterSeconds: 3600 },
      NOW,
    );
    expect(pause).toMatchObject({ reason: 'window', day: 'today' });
    expect(openingTime(pause)).toBe('20:00');
  });

  it('is the daily limit for its code, and names no time when tomorrow starts at midnight', () => {
    const pause = learningPauseOf(
      { code: 'guidance.daily_limit_reached', retryAfterSeconds: 5 * 3600 },
      NOW,
    );
    expect(pause).toMatchObject({ reason: 'limit', day: 'tomorrow', anyTime: true });
  });

  it('is nothing for any other failure, so the usual retry message stays', () => {
    expect(
      learningPauseOf({ code: 'guidance.rate_limited', retryAfterSeconds: 60 }, NOW),
    ).toBeNull();
    expect(learningPauseOf({ code: 'guidance.learning_window_closed' }, NOW)).toBeNull();
    expect(learningPauseOf(undefined, NOW)).toBeNull();
  });
});
