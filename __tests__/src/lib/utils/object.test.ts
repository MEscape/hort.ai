import { describe, expect, it } from 'vitest';

import { definedKeys, hasOwnKey, isPlainObject, omit, pick } from '@lib/utils';

describe('isPlainObject', () => {
  it('accepts object literals, new Object() and null-prototype objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(new Object())).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a Date', new Date()],
    ['a Map', new Map()],
    ['a string', 'text'],
    ['a number', 1],
    ['a function', () => 1],
  ])('rejects %s', (_label, value) => {
    expect(isPlainObject(value)).toBe(false);
  });

  it('rejects class instances', () => {
    class Point {}
    expect(isPlainObject(new Point())).toBe(false);
  });
});

describe('hasOwnKey', () => {
  it('is true for own keys only, ignoring the prototype chain', () => {
    const obj = { a: 1 };
    expect(hasOwnKey(obj, 'a')).toBe(true);
    expect(hasOwnKey(obj, 'toString')).toBe(false);
    expect(hasOwnKey(obj, 'missing')).toBe(false);
  });

  it('accepts symbol keys', () => {
    const key = Symbol('k');
    expect(hasOwnKey({ [key]: 1 }, key)).toBe(true);
  });
});

describe('pick', () => {
  it('keeps only the listed keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('skips listed keys the object does not own', () => {
    const source: { a?: number; toString?: unknown } = { a: 1 };
    expect(pick(source, ['a', 'toString'])).toEqual({ a: 1 });
  });

  it('keeps an own key whose value is undefined', () => {
    expect(Object.keys(pick({ a: undefined, b: 1 }, ['a']))).toEqual(['a']);
  });

  it('does not mutate the input', () => {
    const source = { a: 1, b: 2 };
    pick(source, ['a']);
    expect(source).toEqual({ a: 1, b: 2 });
  });
});

describe('omit', () => {
  it('drops the listed keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ b: 2 });
  });

  it('returns a copy when nothing is listed', () => {
    const source = { a: 1 };
    const result = omit(source, []);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
  });

  it('keeps a __proto__ key from data as an ordinary key', () => {
    const polluted: Record<string, unknown> = JSON.parse('{"__proto__": {"x": 1}, "a": 1}');
    const result = omit(polluted, ['a']);

    expect(Object.keys(result)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('definedKeys', () => {
  it('lists keys whose value is not undefined, counting null as a value', () => {
    expect(definedKeys({ a: 1, b: undefined, c: null, d: 0, e: '' })).toEqual(['a', 'c', 'd', 'e']);
  });

  it('is empty for an empty object', () => {
    expect(definedKeys({})).toEqual([]);
  });
});
