import type { DayKey } from './day';

export const DAILY_REWARD_XP = 5;

/**
 * XP per learning event. The KIND decides the amount: never a number from a caller, never text an
 * AI wrote. Closed on purpose; a new kind is a reviewed change here.
 */
export const LEARNING_EVENT_XP = {
  help_session_completed: 10,
  comprehension_check_passed: 5,
} as const;

export type LearningEventKind = keyof typeof LEARNING_EVENT_XP;

export const DAILY_KEY_PREFIX = 'daily:';
export const LEARNING_KEY_PREFIX = 'learning:';

/** The idempotency key of the daily reward of one Berlin day. */
export function dailyEventKey(dayKey: DayKey): string {
  return `${DAILY_KEY_PREFIX}${dayKey}`;
}

/** The stored key of a learning event; the prefix keeps it out of the daily key space. */
export function learningEventKey(callerKey: string): string {
  return `${LEARNING_KEY_PREFIX}${callerKey}`;
}

/** The `ProgressEvent.eventKey` column holds 64 characters; the prefix takes its share. */
const EVENT_KEY_COLUMN_LENGTH = 64;
export const LEARNING_EVENT_KEY_MAX_LENGTH = EVENT_KEY_COLUMN_LENGTH - LEARNING_KEY_PREFIX.length;

const LEARNING_EVENT_KEY_PATTERN = /^[A-Za-z0-9:_-]+$/;

export function isLearningEventKey(raw: string): boolean {
  return (
    raw.length >= 1 &&
    raw.length <= LEARNING_EVENT_KEY_MAX_LENGTH &&
    LEARNING_EVENT_KEY_PATTERN.test(raw)
  );
}

export function isLearningEventKind(raw: string): raw is LearningEventKind {
  return Object.hasOwn(LEARNING_EVENT_XP, raw);
}
