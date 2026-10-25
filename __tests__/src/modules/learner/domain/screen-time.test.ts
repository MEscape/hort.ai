import { describe, expect, it } from 'vitest';

import type {
  AllowedWindow,
  DailyLimitMinutes,
} from '@modules/learner/domain/models/parent-controls';
import { computeScreenTime, nextDayOpening } from '@modules/learner/domain/models/screen-time';

/** 11:00 in Berlin (winter time, UTC+1). */
const ELEVEN = new Date('2026-01-15T10:00:00Z');

function at(berlinHour: number, berlinMinute = 0): Date {
  return new Date(Date.UTC(2026, 0, 15, berlinHour - 1, berlinMinute));
}

const afternoon: AllowedWindow = { fromMinute: 15 * 60, untilMinute: 18 * 60 };

function build(overrides: {
  readonly dailyLimitMinutes?: DailyLimitMinutes | null;
  readonly allowedWindow?: AllowedWindow | null;
  readonly usedMinutes?: number | null;
  readonly now?: Date;
}) {
  return computeScreenTime({
    controls: {
      dailyLimitMinutes: overrides.dailyLimitMinutes ?? null,
      allowedWindow: overrides.allowedWindow ?? null,
    },
    usedMinutes: overrides.usedMinutes ?? null,
    now: overrides.now ?? ELEVEN,
  });
}

describe('computeScreenTime', () => {
  it('is open without limit and window, and says nothing about time left', () => {
    expect(build({})).toEqual({
      status: 'open',
      usage: { kind: 'unlimited', usedMinutes: null },
      minutesLeft: null,
      reopensAt: null,
    });
  });

  it('reports the minutes learned today when there is no limit', () => {
    expect(build({ usedMinutes: 12 }).usage).toEqual({ kind: 'unlimited', usedMinutes: 12 });
  });

  it('is open with the minutes left under a limit', () => {
    expect(build({ dailyLimitMinutes: 30, usedMinutes: 5 })).toEqual({
      status: 'open',
      usage: { kind: 'limited', limitMinutes: 30, usedMinutes: 5, remainingMinutes: 25 },
      minutesLeft: 25,
      reopensAt: null,
    });
  });

  it('turns low with five minutes or fewer left, never earlier', () => {
    expect(build({ dailyLimitMinutes: 30, usedMinutes: 24 }).status).toBe('open');
    expect(build({ dailyLimitMinutes: 30, usedMinutes: 25 }).status).toBe('low');
    expect(build({ dailyLimitMinutes: 30, usedMinutes: 29 }).status).toBe('low');
  });

  it('closes when the limit is reached or passed', () => {
    expect(build({ dailyLimitMinutes: 30, usedMinutes: 30 }).status).toBe('closed_limit_reached');
    expect(build({ dailyLimitMinutes: 30, usedMinutes: 41 }).usage).toMatchObject({
      remainingMinutes: 0,
    });
  });

  it('says the time is unavailable instead of unlimited when a limit is set but nothing is measured', () => {
    const result = build({ dailyLimitMinutes: 30, usedMinutes: null });
    expect(result.usage).toEqual({ kind: 'unavailable', limitMinutes: 30 });
    expect(result.status).toBe('open');
    expect(result.minutesLeft).toBeNull();
  });

  it('is open inside the window and counts the time to its end', () => {
    const result = build({ allowedWindow: afternoon, now: at(16, 0) });
    expect(result.status).toBe('open');
    expect(result.minutesLeft).toBe(120);
  });

  it('turns low in the last five minutes of the window', () => {
    expect(build({ allowedWindow: afternoon, now: at(17, 54) }).status).toBe('open');
    expect(build({ allowedWindow: afternoon, now: at(17, 54) }).minutesLeft).toBe(6);
    expect(build({ allowedWindow: afternoon, now: at(17, 55) }).status).toBe('low');
  });

  it('uses whichever ends first: the limit or the window', () => {
    const result = build({
      dailyLimitMinutes: 30,
      usedMinutes: 0,
      allowedWindow: afternoon,
      now: at(17, 40),
    });
    expect(result.minutesLeft).toBe(20);
  });

  it('is closed before the window and reopens at its start, the same day', () => {
    const result = build({ allowedWindow: afternoon, now: at(11, 0) });
    expect(result.status).toBe('closed_outside_window');
    expect(result.reopensAt).toEqual(at(15, 0));
  });

  it('is closed after the window and reopens at its start, the next day', () => {
    const result = build({ allowedWindow: afternoon, now: at(18, 0) });
    expect(result.status).toBe('closed_outside_window');
    expect(result.reopensAt).toEqual(new Date(at(15, 0).getTime() + 24 * 60 * 60 * 1000));
  });

  it('closes exactly when the window opens and ends (from inclusive, until exclusive)', () => {
    expect(build({ allowedWindow: afternoon, now: at(15, 0) }).status).toBe('open');
    expect(build({ allowedWindow: afternoon, now: at(17, 59) }).status).toBe('low');
    expect(build({ allowedWindow: afternoon, now: at(18, 0) }).status).toBe(
      'closed_outside_window',
    );
  });

  it('names the window before the limit when both close the day', () => {
    const result = build({
      dailyLimitMinutes: 15,
      usedMinutes: 20,
      allowedWindow: afternoon,
      now: at(11, 0),
    });
    expect(result.status).toBe('closed_outside_window');
  });

  it('follows the Berlin clock across the switch to summer time', () => {
    const summer = new Date('2026-07-15T13:00:00Z'); // 15:00 in Berlin (UTC+2)
    expect(build({ allowedWindow: afternoon, now: summer }).status).toBe('open');
  });

  it('reopens at the first existing minute after the swallowed hour of the spring clock change', () => {
    const night: AllowedWindow = { fromMinute: 2 * 60 + 30, untilMinute: 4 * 60 };
    // 2026-03-29: 02:00 -> 03:00 in Berlin, so 02:30 does not exist; 03:00 CEST is the first open minute.
    const result = build({ allowedWindow: night, now: new Date('2026-03-28T23:00:00Z') });
    expect(result.status).toBe('closed_outside_window');
    expect(result.reopensAt).toEqual(new Date('2026-03-29T01:00:00Z'));
  });

  describe('nextDayOpening', () => {
    const controls = (allowedWindow: AllowedWindow | null) => ({
      dailyLimitMinutes: 15 as const,
      allowedWindow,
    });

    it('is the window start of the next Berlin day', () => {
      expect(nextDayOpening(controls(afternoon), at(16, 0))).toEqual(
        new Date(at(15, 0).getTime() + 24 * 60 * 60 * 1000),
      );
    });

    it('is midnight of the next Berlin day without a window', () => {
      expect(nextDayOpening(controls(null), at(16, 0))).toEqual(new Date('2026-01-15T23:00:00Z'));
    });

    it('does not open earlier the same day when the limit is reached before the window ends', () => {
      expect(nextDayOpening(controls(afternoon), at(15, 30)).getTime()).toBeGreaterThan(
        at(23, 59).getTime(),
      );
    });
  });
});
