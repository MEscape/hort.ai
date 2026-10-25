import { describe, expect, it } from 'vitest';

import { companionMoodOf } from '@modules/progression/domain/models/companion-mood';
import { daysBetween, dayKeyOf } from '@modules/progression/domain/models/day';
import { LEVEL_THRESHOLDS, MAX_LEVEL, levelOf } from '@modules/progression/domain/models/level';
import {
  DAILY_REWARD_XP,
  LEARNING_EVENT_XP,
  dailyEventKey,
  learningEventKey,
} from '@modules/progression/domain/models/xp-rules';

describe('levelOf', () => {
  it('has six levels starting at the agreed cumulative XP', () => {
    expect(LEVEL_THRESHOLDS).toEqual([0, 20, 50, 90, 140, 200]);
    expect(MAX_LEVEL).toBe(6);
  });

  it.each([
    [0, 1],
    [19, 1],
    [20, 2],
    [49, 2],
    [50, 3],
    [89, 3],
    [90, 4],
    [139, 4],
    [140, 5],
    [199, 5],
    [200, 6],
    [5000, 6],
  ])('puts %i XP on level %i', (xp, level) => {
    expect(levelOf(xp).level).toBe(level);
  });

  it('reports the position inside the level', () => {
    expect(levelOf(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 20, fraction: 0 });
    expect(levelOf(35)).toEqual({ level: 2, xpIntoLevel: 15, xpForNextLevel: 30, fraction: 0.5 });
    expect(levelOf(19)).toMatchObject({ level: 1, xpIntoLevel: 19, xpForNextLevel: 20 });
  });

  it('is full and has no next step at the top level, however much XP there is', () => {
    expect(levelOf(200)).toEqual({ level: 6, xpIntoLevel: 0, xpForNextLevel: null, fraction: 1 });
    expect(levelOf(260)).toEqual({ level: 6, xpIntoLevel: 60, xpForNextLevel: null, fraction: 1 });
  });

  it('never reports a negative or fractional amount for bad input', () => {
    expect(levelOf(-5)).toEqual(levelOf(0));
    expect(levelOf(20.9).level).toBe(2);
  });
});

describe('XP rules', () => {
  it('fixes the amounts per event kind, with no caller-supplied number', () => {
    expect(DAILY_REWARD_XP).toBe(5);
    expect(LEARNING_EVENT_XP).toEqual({
      help_session_completed: 10,
      comprehension_check_passed: 5,
    });
  });

  it('keeps the two key spaces apart, so a learning key can never be a daily key', () => {
    expect(dailyEventKey('2026-10-25')).toBe('daily:2026-10-25');
    expect(learningEventKey('daily:2026-10-25')).toBe('learning:daily:2026-10-25');
    expect(learningEventKey('x').startsWith('daily:')).toBe(false);
  });
});

describe('dayKeyOf (Europe/Berlin calendar day)', () => {
  it('uses the Berlin day, not the UTC day', () => {
    // 23:30 UTC on 24 Oct is 01:30 on 25 Oct in Berlin (summer time, UTC+2).
    expect(dayKeyOf(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25');
    expect(dayKeyOf(new Date('2026-10-24T21:59:59Z'))).toBe('2026-10-24');
    expect(dayKeyOf(new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25');
  });

  it('follows winter time (UTC+1) after the change on 2026-10-25 at 03:00', () => {
    // 25 Oct is 25 hours long: summer time ends at 01:00 UTC.
    expect(dayKeyOf(new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-25');
    expect(dayKeyOf(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
    // Between 22:00 and 23:00 UTC the old (summer time) offset would already say 26 Oct.
    expect(dayKeyOf(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25');
  });

  it('follows the spring change (a 23 hour day)', () => {
    expect(dayKeyOf(new Date('2026-03-28T22:59:59Z'))).toBe('2026-03-28');
    expect(dayKeyOf(new Date('2026-03-28T23:00:00Z'))).toBe('2026-03-29');
    expect(dayKeyOf(new Date('2026-03-29T21:59:59Z'))).toBe('2026-03-29');
    expect(dayKeyOf(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
  });

  it('handles the turn of the year', () => {
    expect(dayKeyOf(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
  });
});

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-10-25', '2026-10-25')).toBe(0);
    expect(daysBetween('2026-10-24', '2026-10-25')).toBe(1);
    expect(daysBetween('2026-10-25', '2026-10-24')).toBe(-1);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('is not thrown off by the 25 hour and 23 hour days', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('companionMoodOf', () => {
  const now = new Date('2026-10-25T10:00:00Z'); // 11:00 in Berlin, 25 Oct

  it('is new when there was never an event', () => {
    expect(companionMoodOf({ lastEventAt: null, now })).toEqual({
      mood: 'new',
      boredomLevel: 0,
      daysAway: 0,
    });
  });

  it('is cheerful on the same Berlin calendar day', () => {
    expect(companionMoodOf({ lastEventAt: new Date('2026-10-24T22:00:00Z'), now })).toEqual({
      mood: 'cheerful',
      boredomLevel: 0,
      daysAway: 0,
    });
    expect(companionMoodOf({ lastEventAt: now, now })).toEqual({
      mood: 'cheerful',
      boredomLevel: 0,
      daysAway: 0,
    });
  });

  it('counts calendar days, not 24 hours: one minute past midnight is yesterday', () => {
    const lateEvent = new Date('2026-10-24T21:59:00Z'); // 24 Oct, 23:59 Berlin
    expect(
      companionMoodOf({ lastEventAt: lateEvent, now: new Date('2026-10-24T22:01:00Z') }),
    ).toEqual({ mood: 'calm', boredomLevel: 1, daysAway: 1 });
  });

  it('gets more bored by the calendar day: calm, sleepy, bored, very bored', () => {
    const at = (iso: string) => companionMoodOf({ lastEventAt: new Date(iso), now });
    expect(at('2026-10-24T12:00:00Z')).toEqual({ mood: 'calm', boredomLevel: 1, daysAway: 1 });
    expect(at('2026-10-23T12:00:00Z')).toEqual({ mood: 'sleepy', boredomLevel: 2, daysAway: 2 });
    expect(at('2026-10-22T12:00:00Z')).toEqual({ mood: 'bored', boredomLevel: 3, daysAway: 3 });
    expect(at('2026-10-21T12:00:00Z')).toEqual({ mood: 'bored', boredomLevel: 4, daysAway: 4 });
    expect(at('2026-09-01T12:00:00Z')).toMatchObject({ mood: 'bored', boredomLevel: 4 });
  });

  it('is correct across the daylight saving change of 2026-10-25', () => {
    // 23 Oct 12:00 Berlin to 26 Oct 00:30 Berlin: 3 calendar days, 61.5 hours (less than 3 x 24).
    const lastEventAt = new Date('2026-10-23T10:00:00Z');
    expect(companionMoodOf({ lastEventAt, now: new Date('2026-10-25T23:30:00Z') })).toEqual({
      mood: 'bored',
      boredomLevel: 3,
      daysAway: 3,
    });
    // 24 Oct 00:30 Berlin to 25 Oct 23:30 Berlin: 1 calendar day, 48 hours.
    expect(
      companionMoodOf({
        lastEventAt: new Date('2026-10-23T22:30:00Z'),
        now: new Date('2026-10-25T22:30:00Z'),
      }),
    ).toEqual({ mood: 'calm', boredomLevel: 1, daysAway: 1 });
    // 24 Oct 12:00 Berlin to 25 Oct 00:30 Berlin: already the next day, though only 12.5 hours later.
    expect(
      companionMoodOf({
        lastEventAt: new Date('2026-10-24T10:00:00Z'),
        now: new Date('2026-10-24T22:30:00Z'),
      }),
    ).toEqual({ mood: 'calm', boredomLevel: 1, daysAway: 1 });
  });

  it('never goes negative when the last event looks like it is in the future', () => {
    expect(companionMoodOf({ lastEventAt: new Date('2026-10-26T12:00:00Z'), now })).toEqual({
      mood: 'cheerful',
      boredomLevel: 0,
      daysAway: 0,
    });
  });
});
