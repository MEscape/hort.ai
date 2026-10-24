/**
 * Locale-aware date helpers. Zero dependencies.
 *
 * Dates are stored as UTC instants and converted to a time zone only at presentation (i18n.md),
 * so every formatter takes the zone explicitly. Components do not call these directly: they use
 * the formatters bound to the request locale and time zone (`getAppFormatters` /
 * `useAppFormatters`). An input that is not a valid date throws a `RangeError`: showing a wrong
 * date is worse than failing loudly.
 */

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

/** Anything `new Date()` takes: an instant, an ISO string or epoch milliseconds. */
export type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(input)}`);
  }
  return date;
}

/**
 * Formats a date for a locale and time zone; `medium` date style unless `options` say otherwise.
 *
 * @throws RangeError for an invalid date or an unknown time zone
 * @example formatDate('2026-01-05T23:30:00Z', 'de-DE', 'Europe/Berlin') // '06.01.2026'
 */
export function formatDate(
  input: DateInput,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(toDate(input));
}

/**
 * Formats a date and time (`medium` date, `short` time) for a locale and time zone.
 *
 * @throws RangeError for an invalid date or an unknown time zone
 */
export function formatDateTime(input: DateInput, locale: string, timeZone: string): string {
  return formatDate(input, locale, timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * MS_PER_DAY],
  ['month', 30 * MS_PER_DAY],
  ['week', 7 * MS_PER_DAY],
  ['day', MS_PER_DAY],
  ['hour', SECONDS_PER_HOUR * 1000],
  ['minute', MS_PER_MINUTE],
];

/**
 * Formats the distance between two instants as relative text ("vor 2 Tagen"), in the largest unit
 * that fits (a year is 365 days, a month 30: a reading aid, not calendar arithmetic). `now` is a
 * parameter, not read from the clock, so the function is pure and deterministic in tests
 * (architecture.md: domain and application code must not read the clock; injecting it here keeps
 * this helper usable from either layer).
 *
 * @throws RangeError for an invalid date
 * @example formatRelativeTime('2026-01-03', '2026-01-05', 'en') // '2 days ago'
 */
export function formatRelativeTime(input: DateInput, now: DateInput, locale: string): string {
  const differenceMs = toDate(input).getTime() - toDate(now).getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(differenceMs) >= unitMs) {
      return formatter.format(Math.round(differenceMs / unitMs), unit);
    }
  }
  return formatter.format(Math.round(differenceMs / 1000), 'second');
}

/**
 * A new `Date` that is `days` later (negative moves earlier). UTC arithmetic, so a daylight-saving
 * change never shifts the time of day.
 *
 * @throws RangeError for an invalid date
 * @example addDays('2026-01-31T10:00:00Z', 1) // 2026-02-01T10:00:00Z
 */
export function addDays(input: DateInput, days: number): Date {
  const result = new Date(toDate(input));
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
