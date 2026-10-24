import { describe, expect, it } from 'vitest';

import { clamp, formatBytes, formatMoney, formatNumber, formatPercent } from '@lib/utils';

describe('clamp', () => {
  it.each([
    [15, 0, 10, 10],
    [-5, 0, 10, 0],
    [5, 0, 10, 5],
    [0, 0, 10, 0],
    [10, 0, 10, 10],
    [3, 3, 3, 3],
  ])('clamp(%d, %d, %d) is %d', (value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });

  it('throws a RangeError when min is greater than max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});

describe('formatNumber', () => {
  it('uses the locale separators', () => {
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
  });

  it('passes Intl options through', () => {
    expect(formatNumber(1.23456, 'en-US', { maximumFractionDigits: 2 })).toBe('1.23');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percent by default', () => {
    expect(formatPercent(0.256, 'en-US')).toBe('26%');
  });

  it('uses a fixed number of decimals', () => {
    expect(formatPercent(0.256, 'en-US', 1)).toBe('25.6%');
    expect(formatPercent(0.5, 'en-US', 2)).toBe('50.00%');
  });
});

describe('formatMoney', () => {
  it('converts minor units to a currency string', () => {
    expect(formatMoney(123456, 'EUR', 'en-US')).toBe('€1,234.56');
  });

  it('respects currencies without minor units', () => {
    expect(formatMoney(1234, 'JPY', 'en-US')).toBe('¥1,234');
  });

  it('formats negative and zero amounts', () => {
    expect(formatMoney(-5, 'EUR', 'en-US')).toBe('-€0.05');
    expect(formatMoney(0, 'EUR', 'en-US')).toBe('€0.00');
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'refuses %s, which is not a safe integer',
    (value) => {
      expect(() => formatMoney(value, 'EUR', 'en-US')).toThrow(RangeError);
    },
  );
});

describe('formatBytes', () => {
  it('formats zero and whole bytes without decimals', () => {
    expect(formatBytes(0, 'en')).toBe('0 byte');
    expect(formatBytes(512, 'en')).toBe('512 byte');
  });

  it('steps in binary units', () => {
    expect(formatBytes(1024, 'en')).toBe('1 kB');
    expect(formatBytes(1_572_864, 'en')).toBe('1.5 MB');
    expect(formatBytes(1024 ** 3, 'en')).toBe('1 GB');
  });

  it('honours the number of fraction digits', () => {
    expect(formatBytes(1_500_000, 'en', 3)).toBe('1.431 MB');
    expect(formatBytes(1_500_000, 'en', 0)).toBe('1 MB');
  });

  it('keeps the sign of negative counts', () => {
    expect(formatBytes(-1_572_864, 'en')).toBe('-1.5 MB');
  });

  it('stays in terabytes for larger counts', () => {
    expect(formatBytes(1024 ** 4 * 2048, 'en')).toBe('2,048 TB');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'refuses %s, which is not finite',
    (value) => {
      expect(() => formatBytes(value, 'en')).toThrow(RangeError);
    },
  );
});
