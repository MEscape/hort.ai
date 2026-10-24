import { describe, expect, it } from 'vitest';

import { isJsonRecord, isJsonValue, jsonWeight } from '@lib/utils';

describe('isJsonValue', () => {
  it.each([null, 'a', true, 0, -1.5, [], {}, [1, 'a', null, { b: [false] }], { a: { b: 'c' } }])(
    'accepts %j',
    (value) => {
      expect(isJsonValue(value)).toBe(true);
    },
  );

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    () => 1,
    Symbol('s'),
    new Date(),
    new Map(),
    [undefined],
    { a: undefined },
    { a: [new Date()] },
  ])('rejects %s', (value) => {
    expect(isJsonValue(value)).toBe(false);
  });

  it('counts the value itself as level 1', () => {
    expect(isJsonValue('a', 1)).toBe(true);
    expect(isJsonValue('a', 0)).toBe(false);
    expect(isJsonValue([1], 2)).toBe(true);
    expect(isJsonValue([1], 1)).toBe(false);
    expect(isJsonValue({ a: { b: 1 } }, 3)).toBe(true);
    expect(isJsonValue({ a: { b: 1 } }, 2)).toBe(false);
  });
});

describe('isJsonRecord', () => {
  it('accepts a plain object of JSON values', () => {
    expect(isJsonRecord({})).toBe(true);
    expect(isJsonRecord({ a: 1, b: [null, 'x'] })).toBe(true);
  });

  it.each([null, 'a', 1, [], [1], new Date(), { a: undefined }, { a: Number.NaN }])(
    'rejects %s',
    (value) => {
      expect(isJsonRecord(value)).toBe(false);
    },
  );

  it('does not count the record as a level', () => {
    expect(isJsonRecord({ a: 1 }, 1)).toBe(true);
    expect(isJsonRecord({ a: [1] }, 1)).toBe(false);
    expect(isJsonRecord({ a: [1] }, 2)).toBe(true);
  });
});

describe('jsonWeight', () => {
  it('weighs scalars one, strings one plus their length', () => {
    expect(jsonWeight(null)).toBe(1);
    expect(jsonWeight(true)).toBe(1);
    expect(jsonWeight(42)).toBe(1);
    expect(jsonWeight('')).toBe(1);
    expect(jsonWeight('abc')).toBe(4);
  });

  it('weighs an array as one plus its items', () => {
    expect(jsonWeight([])).toBe(1);
    expect(jsonWeight([1, 'ab'])).toBe(1 + 1 + 3);
  });

  it('weighs an object as one plus key lengths and values', () => {
    expect(jsonWeight({})).toBe(1);
    expect(jsonWeight({ ab: 'c', d: [1] })).toBe(1 + (2 + 2) + (1 + 2));
  });
});
