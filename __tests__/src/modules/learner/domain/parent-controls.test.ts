import { describe, expect, it } from 'vitest';

import { createInterests, INTERESTS } from '@modules/learner/domain/models/interests';
import {
  changedControls,
  createParentControls,
  DAILY_LIMIT_MINUTES,
  DEFAULT_CONTROLS,
  isLearningAllowedNow,
  LEARNER_TIME_ZONE,
} from '@modules/learner/domain/models/parent-controls';
import type { ParentControls } from '@modules/learner/domain/models/parent-controls';
import { SETUP_STEPS, stepsBefore } from '@modules/learner/domain/models/setup-step';

const VALID = {
  voiceEnabled: true,
  dailyLimitMinutes: 30,
  allowedWindow: { fromMinute: 540, untilMinute: 1080 },
  learningInsights: true,
  guardianConfirmed: true,
};

function fieldErrorsOf(overrides: Partial<Parameters<typeof createParentControls>[0]>) {
  const result = createParentControls({ ...VALID, ...overrides });
  return result.isErr() ? result.error.fieldErrors : {};
}

describe('createParentControls', () => {
  it('accepts valid controls with a confirmed guardian', () => {
    expect(createParentControls(VALID)._unsafeUnwrap()).toEqual({
      voiceEnabled: true,
      dailyLimitMinutes: 30,
      allowedWindow: { fromMinute: 540, untilMinute: 1080 },
      learningInsights: true,
    });
  });

  it('accepts no limit and no window (any time)', () => {
    const controls = createParentControls({
      ...VALID,
      dailyLimitMinutes: null,
      allowedWindow: null,
    })._unsafeUnwrap();

    expect(controls).toMatchObject({ dailyLimitMinutes: null, allowedWindow: null });
  });

  it.each(DAILY_LIMIT_MINUTES)('accepts the daily limit %s', (dailyLimitMinutes) => {
    expect(createParentControls({ ...VALID, dailyLimitMinutes }).isOk()).toBe(true);
  });

  it.each([0, 10, 20, 120, -15, 15.5, Number.NaN])('refuses the daily limit %s', (limit) => {
    expect(fieldErrorsOf({ dailyLimitMinutes: limit })).toEqual({
      dailyLimitMinutes: ['learner.validation.daily_limit_invalid'],
    });
  });

  it.each([
    [0, 1440],
    [0, 30],
    [1410, 1440],
    [450, 1200],
  ])('accepts the window %s to %s', (fromMinute, untilMinute) => {
    expect(
      createParentControls({ ...VALID, allowedWindow: { fromMinute, untilMinute } }).isOk(),
    ).toBe(true);
  });

  it.each([
    ['from not before until', 600, 600],
    ['from after until', 900, 600],
    ['narrower than 30 minutes', 600, 615],
    ['not a multiple of 15 (from)', 610, 700],
    ['not a multiple of 15 (until)', 600, 710],
    ['before midnight', -15, 600],
    ['after the end of the day', 1380, 1455],
    ['fractional', 600.5, 700],
    ['not a number', Number.NaN, 700],
  ])('refuses a window that is %s', (_reason, fromMinute, untilMinute) => {
    expect(fieldErrorsOf({ allowedWindow: { fromMinute, untilMinute } })).toEqual({
      allowedWindow: ['learner.validation.window_invalid'],
    });
  });

  it('requires the guardian confirmation to be exactly true', () => {
    expect(fieldErrorsOf({ guardianConfirmed: false })).toEqual({
      guardianConfirmed: ['learner.validation.guardian_confirmation_required'],
    });
    expect(fieldErrorsOf({ guardianConfirmed: undefined as unknown as boolean })).toEqual({
      guardianConfirmed: ['learner.validation.guardian_confirmation_required'],
    });
    expect(fieldErrorsOf({ guardianConfirmed: 'true' as unknown as boolean })).toEqual({
      guardianConfirmed: ['learner.validation.guardian_confirmation_required'],
    });
  });

  it('reports every invalid field at once', () => {
    const errors = fieldErrorsOf({
      dailyLimitMinutes: 1,
      allowedWindow: { fromMinute: 5, untilMinute: 6 },
      guardianConfirmed: false,
    });

    expect(Object.keys(errors).sort()).toEqual([
      'allowedWindow',
      'dailyLimitMinutes',
      'guardianConfirmed',
    ]);
  });

  it('defaults to the most private and restrictive controls', () => {
    expect(DEFAULT_CONTROLS).toEqual({
      voiceEnabled: false,
      dailyLimitMinutes: null,
      allowedWindow: null,
      learningInsights: false,
    });
  });
});

describe('isLearningAllowedNow', () => {
  const windowed = (fromMinute: number, untilMinute: number): ParentControls => ({
    ...DEFAULT_CONTROLS,
    allowedWindow: { fromMinute, untilMinute },
  });

  it('allows any time when there is no window', () => {
    expect(isLearningAllowedNow(DEFAULT_CONTROLS, new Date('2026-10-24T03:00:00Z'))).toBe(true);
  });

  it('reads the window as Berlin clock time in summer (UTC+2)', () => {
    const afternoon = windowed(15 * 60, 18 * 60);

    expect(isLearningAllowedNow(afternoon, new Date('2026-07-15T13:00:00Z'))).toBe(true); // 15:00
    expect(isLearningAllowedNow(afternoon, new Date('2026-07-15T12:59:00Z'))).toBe(false); // 14:59
    expect(isLearningAllowedNow(afternoon, new Date('2026-07-15T15:59:00Z'))).toBe(true); // 17:59
    expect(isLearningAllowedNow(afternoon, new Date('2026-07-15T16:00:00Z'))).toBe(false); // 18:00
  });

  it('reads the window as Berlin clock time in winter (UTC+1)', () => {
    const afternoon = windowed(15 * 60, 18 * 60);

    expect(isLearningAllowedNow(afternoon, new Date('2026-01-15T14:00:00Z'))).toBe(true); // 15:00
    expect(isLearningAllowedNow(afternoon, new Date('2026-01-15T13:59:00Z'))).toBe(false); // 14:59
  });

  it('follows the switch to summer time on 2026-03-29 (02:00 jumps to 03:00)', () => {
    const fromThree = windowed(3 * 60, 4 * 60);

    expect(isLearningAllowedNow(fromThree, new Date('2026-03-29T00:59:00Z'))).toBe(false); // 01:59 CET
    expect(isLearningAllowedNow(fromThree, new Date('2026-03-29T01:00:00Z'))).toBe(true); // 03:00 CEST
    expect(isLearningAllowedNow(fromThree, new Date('2026-03-29T01:59:00Z'))).toBe(true); // 03:59 CEST
    expect(isLearningAllowedNow(fromThree, new Date('2026-03-29T02:00:00Z'))).toBe(false); // 04:00 CEST
  });

  it('follows the switch back to winter time on 2026-10-25 (03:00 falls back to 02:00)', () => {
    const fromThree = windowed(3 * 60, 4 * 60);

    expect(isLearningAllowedNow(fromThree, new Date('2026-10-25T01:00:00Z'))).toBe(false); // 02:00 CET
    expect(isLearningAllowedNow(fromThree, new Date('2026-10-25T01:59:00Z'))).toBe(false); // 02:59 CET
    expect(isLearningAllowedNow(fromThree, new Date('2026-10-25T02:00:00Z'))).toBe(true); // 03:00 CET
    expect(isLearningAllowedNow(fromThree, new Date('2026-10-25T03:00:00Z'))).toBe(false); // 04:00 CET
  });

  it('allows the whole day with the window from midnight to the end of the day', () => {
    const wholeDay = windowed(0, 1440);

    expect(isLearningAllowedNow(wholeDay, new Date('2026-07-15T21:59:00Z'))).toBe(true); // 23:59
    expect(isLearningAllowedNow(wholeDay, new Date('2026-07-15T22:00:00Z'))).toBe(true); // 00:00
  });

  it('reads the time zone from the constant', () => {
    expect(LEARNER_TIME_ZONE).toBe('Europe/Berlin');
  });
});

describe('changedControls', () => {
  it('is null when nothing differs', () => {
    expect(changedControls(DEFAULT_CONTROLS, { ...DEFAULT_CONTROLS })).toBeNull();
  });

  it('names what changed: new flag values, and whether the limit and the window changed', () => {
    const after: ParentControls = {
      voiceEnabled: true,
      dailyLimitMinutes: 45,
      allowedWindow: { fromMinute: 0, untilMinute: 60 },
      learningInsights: false,
    };

    expect(changedControls(DEFAULT_CONTROLS, after)).toEqual({
      voiceEnabled: true,
      learningInsights: null,
      dailyLimitChanged: true,
      allowedWindowChanged: true,
    });
  });

  it('treats an equal window as unchanged', () => {
    const window = { fromMinute: 0, untilMinute: 60 };

    expect(
      changedControls(
        { ...DEFAULT_CONTROLS, allowedWindow: { ...window } },
        { ...DEFAULT_CONTROLS, allowedWindow: { ...window } },
      ),
    ).toBeNull();
  });
});

describe('createInterests', () => {
  it('accepts none, one and four values', () => {
    expect(createInterests([])._unsafeUnwrap()).toEqual([]);
    expect(createInterests(['art'])._unsafeUnwrap()).toEqual(['art']);
    expect(createInterests(['history', 'nature', 'music', 'art'])._unsafeUnwrap()).toEqual([
      'nature',
      'art',
      'music',
      'history',
    ]);
  });

  it.each(INTERESTS)('accepts %s', (interest) => {
    expect(createInterests([interest]).isOk()).toBe(true);
  });

  it('refuses a fifth value as too many, even when it is a duplicate or unknown', () => {
    const tooMany = { interests: ['learner.validation.interests_too_many'] };

    expect(
      createInterests(['nature', 'animals', 'science', 'art', 'music'])._unsafeUnwrapErr(),
    ).toMatchObject({ fieldErrors: tooMany });
    expect(createInterests(['art', 'art', 'art', 'art', 'art'])._unsafeUnwrapErr()).toMatchObject({
      fieldErrors: tooMany,
    });
  });

  it.each([[['art', 'art']], [['football']], [['']], [['Art']], [['__proto__']]])(
    'refuses %j as invalid',
    (raw) => {
      expect(createInterests(raw)._unsafeUnwrapErr()).toMatchObject({
        fieldErrors: { interests: ['learner.validation.interests_invalid'] },
      });
    },
  );
});

describe('setup steps', () => {
  it('are walked in order up to done', () => {
    expect(SETUP_STEPS).toEqual(['child', 'interests', 'tutor', 'controls', 'review', 'done']);
  });

  it('lists the steps before a step, the ones from which it is an advance', () => {
    expect(stepsBefore('child')).toEqual([]);
    expect(stepsBefore('tutor')).toEqual(['child', 'interests']);
    expect(stepsBefore('done')).toEqual(['child', 'interests', 'tutor', 'controls', 'review']);
  });
});
