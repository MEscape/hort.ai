import { describe, expect, it } from 'vitest';

import {
  addDays,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  MS_PER_DAY,
  MS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@lib/utils';

const NOW = '2026-01-05T12:00:00Z';
const shift = (ms: number): number => Date.parse(NOW) + ms;

describe('time constants', () => {
  it('are consistent', () => {
    expect(MS_PER_MINUTE).toBe(SECONDS_PER_MINUTE * 1000);
    expect(MS_PER_DAY).toBe(SECONDS_PER_HOUR * 24 * 1000);
  });
});

describe('formatDate', () => {
  it('formats in the given zone, medium style by default', () => {
    expect(formatDate('2026-01-05T23:30:00Z', 'de-DE', 'Europe/Berlin')).toBe('06.01.2026');
    expect(formatDate('2026-01-05T23:30:00Z', 'de-DE', 'UTC')).toBe('05.01.2026');
  });

  it('accepts Date and epoch inputs and custom options', () => {
    const instant = new Date('2026-01-05T10:00:00Z');
    expect(formatDate(instant, 'en-US', 'UTC', { dateStyle: 'short' })).toBe('1/5/26');
    expect(formatDate(instant.getTime(), 'en-US', 'UTC', { dateStyle: 'short' })).toBe('1/5/26');
  });

  it('throws a RangeError for an invalid date', () => {
    expect(() => formatDate('nope', 'en', 'UTC')).toThrow(RangeError);
    expect(() => formatDate(new Date(Number.NaN), 'en', 'UTC')).toThrow('Invalid date');
  });

  it('throws a RangeError for an unknown time zone', () => {
    expect(() => formatDate(NOW, 'en', 'Not/AZone')).toThrow(RangeError);
  });
});

describe('formatDateTime', () => {
  it('includes the time in the given zone', () => {
    const text = formatDateTime('2026-01-05T23:30:00Z', 'en-US', 'UTC');
    expect(text).toContain('Jan 5, 2026');
    expect(text).toMatch(/11:30\sPM/);
  });
});

describe('formatRelativeTime', () => {
  it.each([
    [-2 * 365 * MS_PER_DAY, '2 years ago'],
    [-60 * MS_PER_DAY, '2 months ago'],
    [-14 * MS_PER_DAY, '2 weeks ago'],
    [-2 * MS_PER_DAY, '2 days ago'],
    [3 * 3_600_000, 'in 3 hours'],
    [-5 * MS_PER_MINUTE, '5 minutes ago'],
    [30_000, 'in 30 seconds'],
    [0, 'now'],
  ])('offset %d ms reads %s', (offset, expected) => {
    expect(formatRelativeTime(shift(offset), NOW, 'en')).toBe(expected);
  });

  it('uses the locale and accepts ISO strings and Dates', () => {
    expect(formatRelativeTime('2026-01-03T12:00:00Z', new Date(NOW), 'de')).toBe('vorgestern');
  });

  it('throws a RangeError for an invalid date', () => {
    expect(() => formatRelativeTime('nope', NOW, 'en')).toThrow(RangeError);
    expect(() => formatRelativeTime(NOW, 'nope', 'en')).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('moves forward across a month boundary keeping the time of day', () => {
    expect(addDays('2026-01-31T10:00:00Z', 1).toISOString()).toBe('2026-02-01T10:00:00.000Z');
  });

  it('moves backward with a negative count', () => {
    expect(addDays('2026-03-01T10:00:00Z', -1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });

  it('does not mutate a Date input', () => {
    const input = new Date(NOW);
    addDays(input, 3);
    expect(input.toISOString()).toBe('2026-01-05T12:00:00.000Z');
  });

  it('throws a RangeError for an invalid date', () => {
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });
});

describe('calendarDayIn', () => {
  it('names the day in the given zone, not in UTC', async () => {
    const { calendarDayIn } = await import('@lib/utils/date');
    const instant = new Date('2026-10-24T22:30:00Z');
    expect(calendarDayIn(instant, 'UTC')).toBe('2026-10-24');
    expect(calendarDayIn(instant, 'Europe/Berlin')).toBe('2026-10-25');
  });
});
