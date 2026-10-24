import { describe, expect, it } from 'vitest';

import {
  arrayOf,
  isBoolean,
  isFiniteNumber,
  isInteger,
  isString,
  nullable,
  objectOf,
  oneOf,
  optional,
} from '@lib/utils';

describe('primitive guards', () => {
  it('isString accepts strings including the empty one', () => {
    expect(isString('')).toBe(true);
    expect(isString('a')).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isString(null)).toBe(false);
  });

  it('isBoolean accepts only booleans', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean('')).toBe(false);
    expect(isBoolean(null)).toBe(false);
  });

  it('isFiniteNumber refuses NaN, infinities and numeric strings', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
  });

  it('isInteger refuses fractions, NaN, infinity and numeric strings', () => {
    expect(isInteger(3)).toBe(true);
    expect(isInteger(-0)).toBe(true);
    expect(isInteger(1.5)).toBe(false);
    expect(isInteger(Number.NaN)).toBe(false);
    expect(isInteger(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isInteger('1')).toBe(false);
  });
});

describe('arrayOf', () => {
  const strings = arrayOf(isString);

  it('accepts arrays whose every element passes, including the empty array', () => {
    expect(strings([])).toBe(true);
    expect(strings(['a', 'b'])).toBe(true);
  });

  it('rejects arrays with a failing element and non-arrays', () => {
    expect(strings(['a', 1])).toBe(false);
    expect(strings('ab')).toBe(false);
    expect(strings({ length: 0 })).toBe(false);
    expect(strings(null)).toBe(false);
  });
});

describe('nullable and optional', () => {
  it('nullable adds null but not undefined', () => {
    const guard = nullable(isString);
    expect(guard(null)).toBe(true);
    expect(guard('a')).toBe(true);
    expect(guard(undefined)).toBe(false);
    expect(guard(1)).toBe(false);
  });

  it('optional adds undefined but not null', () => {
    const guard = optional(isString);
    expect(guard(undefined)).toBe(true);
    expect(guard('a')).toBe(true);
    expect(guard(null)).toBe(false);
    expect(guard(1)).toBe(false);
  });
});

describe('oneOf', () => {
  const status = oneOf(['draft', 'live'] as const);

  it('accepts only the listed literals', () => {
    expect(status('draft')).toBe(true);
    expect(status('live')).toBe(true);
    expect(status('Live')).toBe(false);
    expect(status('')).toBe(false);
    expect(status(undefined)).toBe(false);
  });

  it('accepts nothing for an empty list', () => {
    expect(oneOf([] as const)('x')).toBe(false);
  });
});

describe('objectOf', () => {
  interface Row {
    id: string;
    n: number;
    note?: string | undefined;
  }
  const isRow = objectOf<Row>({ id: isString, n: isFiniteNumber, note: optional(isString) });

  it('accepts objects with every member matching and ignores extra members', () => {
    expect(isRow({ id: 'a', n: 1 })).toBe(true);
    expect(isRow({ id: 'a', n: 1, note: 'x', extra: true })).toBe(true);
  });

  it('rejects a missing or mismatching member', () => {
    expect(isRow({ id: 'a' })).toBe(false);
    expect(isRow({ id: 'a', n: '1' })).toBe(false);
    expect(isRow({ id: 'a', n: 1, note: 5 })).toBe(false);
  });

  it('rejects null and non-objects', () => {
    expect(isRow(null)).toBe(false);
    expect(isRow('row')).toBe(false);
    expect(isRow(undefined)).toBe(false);
  });

  it('accepts anything object-like for an empty member list', () => {
    expect(objectOf<object>({})({})).toBe(true);
    expect(objectOf<object>({})(null)).toBe(false);
  });

  it('counts a member inherited from the prototype chain', () => {
    const inheriting = Object.create({ id: 'a', n: 1 }) as unknown;
    expect(isRow(inheriting)).toBe(true);
  });
});
