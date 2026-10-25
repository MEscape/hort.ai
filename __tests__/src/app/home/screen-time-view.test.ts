import { describe, expect, it } from 'vitest';

import type { ScreenTime } from '@modules/learner/client';

import {
  CLOSED_KEEPS_COMPANION_AND_WORLD,
  closedReasonOf,
  stripTimeOf,
} from '@/app/[locale]/(app)/home/_components/screen-time-view';

const open: ScreenTime = {
  status: 'open',
  usage: { kind: 'unlimited', usedMinutes: null },
  minutesLeft: null,
  reopensAt: null,
};

describe('stripTimeOf', () => {
  it('shows nothing when no limit is set and nothing is measured', () => {
    expect(stripTimeOf(open)).toEqual({ kind: 'hidden' });
  });

  it('shows what was learned today when there is no limit', () => {
    expect(stripTimeOf({ ...open, usage: { kind: 'unlimited', usedMinutes: 12 } })).toEqual({
      kind: 'learned',
      minutes: 12,
    });
  });

  it('shows the minutes left and the share of the limit as a ring', () => {
    const time: ScreenTime = {
      ...open,
      usage: { kind: 'limited', limitMinutes: 30, usedMinutes: 5, remainingMinutes: 25 },
      minutesLeft: 25,
    };
    expect(stripTimeOf(time)).toEqual({
      kind: 'left',
      minutes: 25,
      fraction: 25 / 30,
      isLow: false,
    });
  });

  it('shows a window that ends as minutes left without a ring', () => {
    expect(stripTimeOf({ ...open, minutesLeft: 90 })).toEqual({
      kind: 'left',
      minutes: 90,
      fraction: null,
      isLow: false,
    });
  });

  it('marks the last minutes as a heads-up', () => {
    expect(stripTimeOf({ ...open, status: 'low', minutesLeft: 4 })).toMatchObject({ isLow: true });
  });

  it('says the time is not available instead of unlimited when a limit cannot be counted', () => {
    expect(stripTimeOf({ ...open, usage: { kind: 'unavailable', limitMinutes: 30 } })).toEqual({
      kind: 'unavailable',
    });
  });

  it('does not let an uncounted limit hide the end of the window', () => {
    expect(
      stripTimeOf({
        ...open,
        status: 'low',
        usage: { kind: 'unavailable', limitMinutes: 30 },
        minutesLeft: 3,
      }),
    ).toMatchObject({ kind: 'left', minutes: 3, isLow: true });
  });

  it('names the reason when closed', () => {
    const reopensAt = new Date('2026-01-15T14:00:00Z');
    expect(stripTimeOf({ ...open, status: 'closed_outside_window', reopensAt })).toEqual({
      kind: 'closed',
      reason: 'window',
      reopensAt,
    });
    expect(stripTimeOf({ ...open, status: 'closed_limit_reached' })).toEqual({
      kind: 'closed',
      reason: 'limit',
      reopensAt: null,
    });
  });
});

describe('closedReasonOf', () => {
  it('is null while open or low: the child may still start a task', () => {
    expect(closedReasonOf(open)).toBeNull();
    expect(closedReasonOf({ ...open, status: 'low' })).toBeNull();
  });

  it('carries the reason and the reopening time when closed', () => {
    const reopensAt = new Date('2026-01-15T14:00:00Z');
    expect(closedReasonOf({ ...open, status: 'closed_outside_window', reopensAt })).toEqual({
      reason: 'window',
      reopensAt,
    });
    expect(closedReasonOf({ ...open, status: 'closed_limit_reached' })).toEqual({
      reason: 'limit',
      reopensAt: null,
    });
  });
});

describe('the closed policy', () => {
  it('keeps feeding the companion and visiting the world open by default', () => {
    expect(CLOSED_KEEPS_COMPANION_AND_WORLD).toBe(true);
  });
});
