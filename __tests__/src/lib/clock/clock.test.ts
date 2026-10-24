import { afterEach, describe, expect, it, vi } from 'vitest';

import { systemClock } from '@lib/clock';

afterEach(() => {
  vi.useRealTimers();
});

describe('systemClock', () => {
  it('reports the current instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T10:30:00.123Z'));

    expect(systemClock.now().toISOString()).toBe('2026-01-05T10:30:00.123Z');

    vi.advanceTimersByTime(1000);

    expect(systemClock.now().toISOString()).toBe('2026-01-05T10:30:01.123Z');
  });

  it('hands out a new Date each time, so a caller cannot change the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T10:30:00.000Z'));

    systemClock.now().setFullYear(1999);

    expect(systemClock.now().getUTCFullYear()).toBe(2026);
  });
});
