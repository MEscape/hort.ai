import { formatDate, formatDateTime, formatRelativeTime, type DateInput } from '@lib/utils/date';
import { formatNumber, formatPercent, formatMoney, formatBytes } from '@lib/utils/number';

import { I18N_CONFIG, type Locale } from '../config';

export interface AppFormatters {
  readonly date: (input: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  readonly dateTime: (input: DateInput) => string;
  readonly relativeTime: (input: DateInput, now: DateInput) => string;
  readonly number: (value: number, options?: Intl.NumberFormatOptions) => string;
  readonly percent: (ratio: number, fractionDigits?: number) => string;
  readonly money: (minorUnits: number, currency: string) => string;
  readonly bytes: (bytes: number, fractionDigits?: number) => string;
}

/**
 * Locale- and time-zone-bound formatters. Components never pass a locale to
 * `@lib/utils` themselves: they read these through `getAppFormatters`
 * (`@i18n/server`) or `useAppFormatters` (`@i18n/client`), so every date and
 * number on a page follows the request locale.
 */
export function createAppFormatters(
  locale: Locale,
  timeZone: string = I18N_CONFIG.defaultTimeZone,
): AppFormatters {
  return {
    date: (input: DateInput, options?: Intl.DateTimeFormatOptions) =>
      formatDate(input, locale, timeZone, options),
    dateTime: (input: DateInput) => formatDateTime(input, locale, timeZone),
    relativeTime: (input: DateInput, now: DateInput) => formatRelativeTime(input, now, locale),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, locale, options),
    percent: (ratio: number, fractionDigits?: number) =>
      formatPercent(ratio, locale, fractionDigits),
    money: (minorUnits: number, currency: string) => formatMoney(minorUnits, currency, locale),
    bytes: (bytes: number, fractionDigits?: number) => formatBytes(bytes, locale, fractionDigits),
  };
}
