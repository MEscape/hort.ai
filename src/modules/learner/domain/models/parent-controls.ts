import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { LEARNER_VALIDATION_CODES, createLearnerErrorBag } from '../errors/learner-errors';

import { LEARNER_LIMITS } from './learner-limits';

const CODES = LEARNER_VALIDATION_CODES;

/**
 * The version of the guardian statement the parent confirmed, kept next to the confirmation time.
 * Change it when the wording of the statement changes, so earlier confirmations no longer count.
 */
export const GUARDIAN_CONSENT_VERSION = '2026-10-24';

/** The clock the allowed window is read in: the families this product serves live in Germany. */
export const LEARNER_TIME_ZONE = 'Europe/Berlin';

/** The daily limits a parent can pick, in minutes; `null` is "no limit". */
// eslint-disable-next-line no-magic-numbers -- the closed list of offered limits is the set itself
export const DAILY_LIMIT_MINUTES = [15, 30, 45, 60, 90] as const;

export type DailyLimitMinutes = (typeof DAILY_LIMIT_MINUTES)[number];

export function isDailyLimit(value: number): value is DailyLimitMinutes {
  return DAILY_LIMIT_MINUTES.some((limit) => limit === value);
}

/** The times of day learning is allowed, in minutes since midnight in `LEARNER_TIME_ZONE`. */
export interface AllowedWindow {
  readonly fromMinute: number;
  readonly untilMinute: number;
}

/** What the parent decides about how the child uses Hort. */
export interface ParentControls {
  readonly voiceEnabled: boolean;
  /** Stored only: nothing counts a child's usage yet, so nothing enforces it. */
  readonly dailyLimitMinutes: DailyLimitMinutes | null;
  /** `null`: any time of day. */
  readonly allowedWindow: AllowedWindow | null;
  /** The parent lets Hort note where the child needed help, for the parent summary. */
  readonly learningInsights: boolean;
}

/** Most private and restrictive: voice off, no limit, no window, no insights. */
export const DEFAULT_CONTROLS: ParentControls = {
  voiceEnabled: false,
  dailyLimitMinutes: null,
  allowedWindow: null,
  learningInsights: false,
};

/** Raw controls and the guardian confirmation, before validation. */
interface ControlsInput {
  readonly voiceEnabled: boolean;
  readonly dailyLimitMinutes: number | null;
  readonly allowedWindow: AllowedWindow | null;
  readonly learningInsights: boolean;
  readonly guardianConfirmed: boolean;
}

/** Exactly `true`: the input crosses a trust boundary, so a truthy string or a missing value is no confirmation. */
const isConfirmed = (value: unknown): boolean => value === true;

function isValidWindow({ fromMinute, untilMinute }: AllowedWindow): boolean {
  const { windowStepMinutes, windowMinWidthMinutes, dayMinutes } = LEARNER_LIMITS;
  return (
    Number.isInteger(fromMinute) &&
    Number.isInteger(untilMinute) &&
    fromMinute >= 0 &&
    untilMinute <= dayMinutes &&
    fromMinute % windowStepMinutes === 0 &&
    untilMinute % windowStepMinutes === 0 &&
    untilMinute - fromMinute >= windowMinWidthMinutes
  );
}

/**
 * The only way parent controls enter the system. Saving them requires the guardian's confirmation
 * (`guardianConfirmed` must be exactly `true`). Reports every invalid field at once.
 */
export function createParentControls(
  input: ControlsInput,
): AppResult<ParentControls, ValidationAppError> {
  const bag = createLearnerErrorBag();
  const { dailyLimitMinutes, allowedWindow } = input;

  if (dailyLimitMinutes !== null && !isDailyLimit(dailyLimitMinutes)) {
    bag.add('dailyLimitMinutes', CODES.dailyLimitInvalid);
  }
  if (allowedWindow !== null && !isValidWindow(allowedWindow)) {
    bag.add('allowedWindow', CODES.windowInvalid);
  }
  if (!isConfirmed(input.guardianConfirmed)) {
    bag.add('guardianConfirmed', CODES.guardianConfirmationRequired);
  }

  if (bag.hasErrors || (dailyLimitMinutes !== null && !isDailyLimit(dailyLimitMinutes))) {
    return err(bag.toError());
  }
  return ok({
    voiceEnabled: input.voiceEnabled,
    dailyLimitMinutes,
    allowedWindow:
      allowedWindow === null
        ? null
        : { fromMinute: allowedWindow.fromMinute, untilMinute: allowedWindow.untilMinute },
    learningInsights: input.learningInsights,
  });
}

const clockTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: LEARNER_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function minutesSinceMidnight(instant: Date): number {
  const part = (type: string) =>
    Number(clockTime.formatToParts(instant).find((entry) => entry.type === type)?.value);
  // eslint-disable-next-line no-magic-numbers -- minutes per hour
  return part('hour') * 60 + part('minute');
}

/**
 * Whether the allowed window permits learning at `now`, read as clock time in `LEARNER_TIME_ZONE`
 * (so it follows daylight saving). The window is `[from, until)`; no window means any time. The
 * daily limit is not part of this: nothing counts usage yet.
 */
export function isLearningAllowedNow(controls: ParentControls, now: Date): boolean {
  const { allowedWindow } = controls;
  if (allowedWindow === null) {
    return true;
  }
  const minute = minutesSinceMidnight(now);
  return minute >= allowedWindow.fromMinute && minute < allowedWindow.untilMinute;
}

/** Which controls a save changes, for the audit trail: flags and new flag values, never more. */
interface ControlsChange {
  /** The new value when the voice setting changed, else `null`. */
  readonly voiceEnabled: boolean | null;
  /** The new value when the insights setting changed, else `null`. */
  readonly learningInsights: boolean | null;
  readonly dailyLimitChanged: boolean;
  readonly allowedWindowChanged: boolean;
}

const sameWindow = (a: AllowedWindow | null, b: AllowedWindow | null) =>
  a === null || b === null
    ? a === b
    : a.fromMinute === b.fromMinute && a.untilMinute === b.untilMinute;

/** `null` when nothing differs. */
export function changedControls(
  before: ParentControls,
  after: ParentControls,
): ControlsChange | null {
  const change: ControlsChange = {
    voiceEnabled: before.voiceEnabled === after.voiceEnabled ? null : after.voiceEnabled,
    learningInsights:
      before.learningInsights === after.learningInsights ? null : after.learningInsights,
    dailyLimitChanged: before.dailyLimitMinutes !== after.dailyLimitMinutes,
    allowedWindowChanged: !sameWindow(before.allowedWindow, after.allowedWindow),
  };
  const isUnchanged =
    change.voiceEnabled === null &&
    change.learningInsights === null &&
    !change.dailyLimitChanged &&
    !change.allowedWindowChanged;
  return isUnchanged ? null : change;
}
