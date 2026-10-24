/**
 * Numeric helpers and locale-aware number formatting. Zero dependencies.
 *
 * Display formatting takes an explicit locale and uses `Intl`, never hand-built strings (i18n.md).
 * Components do not call these directly: they use the formatters bound to the request locale
 * (`getAppFormatters` / `useAppFormatters`).
 */

import { invariant } from './assert';

const BYTES_PER_STEP = 1024;
const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/**
 * Clamps `value` into `[min, max]`, inclusive.
 *
 * @throws RangeError when `min > max`
 * @example clamp(15, 0, 10) // 10
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not be greater than max');
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats a number for a locale.
 *
 * @example formatNumber(1234.5, 'de-DE') // '1.234,5'
 */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Formats a ratio as a percentage with a fixed number of decimals.
 *
 * @example formatPercent(0.256, 'de-DE') // '26 %'
 */
export function formatPercent(ratio: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

/**
 * Formats an amount held in integer minor units (cents) as currency. Money is never handled as
 * floating point (persistence.md), so the conversion to major units happens only here, at the
 * presentation edge, and only for a whole number of minor units.
 *
 * @throws RangeError when `minorUnits` is not a safe integer
 * @example formatMoney(123456, 'EUR', 'de-DE') // '1.234,56 €'
 */
export function formatMoney(minorUnits: number, currency: string, locale: string): string {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError('formatMoney: minorUnits must be a safe integer');
  }
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const { maximumFractionDigits } = formatter.resolvedOptions();
  invariant(maximumFractionDigits !== undefined, 'A currency format always has a fraction size.');
  return formatter.format(minorUnits / 10 ** maximumFractionDigits);
}

/**
 * Formats a byte count with `Intl` units in binary (1024) steps; whole bytes, `fractionDigits`
 * decimals above that. Negative counts keep their sign.
 *
 * @throws RangeError when `bytes` is not finite
 * @example formatBytes(1_572_864, 'en') // '1.5 MB'
 */
export function formatBytes(bytes: number, locale: string, fractionDigits = 1): string {
  if (!Number.isFinite(bytes)) {
    throw new RangeError('formatBytes: bytes must be finite');
  }
  const sign = bytes < 0 ? -1 : 1;
  const absolute = Math.abs(bytes);

  const exponent =
    absolute === 0
      ? 0
      : Math.min(Math.floor(Math.log(absolute) / Math.log(BYTES_PER_STEP)), BYTE_UNITS.length - 1);

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: BYTE_UNITS[exponent],
    unitDisplay: 'short',
    maximumFractionDigits: exponent === 0 ? 0 : fractionDigits,
  }).format((sign * absolute) / BYTES_PER_STEP ** exponent);
}
