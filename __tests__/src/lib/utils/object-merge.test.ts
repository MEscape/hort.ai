import { describe, expect, it } from 'vitest';

import { changedKeys, deepEqual, deepMerge } from '@lib/utils';

describe('deepEqual', () => {
  it('compares primitives with Object.is semantics', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(deepEqual(0, -0)).toBe(false);
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('compares arrays element by element', () => {
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('compares plain objects by own keys regardless of key order', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('does not treat a missing key as equal to a different key of the same count', () => {
    expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false);
  });

  it('does not confuse an inherited key with an own one', () => {
    const inheriting = Object.create({ a: 1 }) as Record<string, unknown>;
    expect(deepEqual({ a: 1 }, inheriting)).toBe(false);
  });

  it('does not equate different kinds of container', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({}, [])).toBe(false);
    expect(deepEqual(new Date(0), new Date(0))).toBe(false);
  });
});

describe('deepMerge', () => {
  it('merges nested plain objects, with the source winning', () => {
    expect(deepMerge({ a: { x: 1 }, b: 1 }, { a: { y: 2 }, c: 3 })).toEqual({
      a: { x: 1, y: 2 },
      b: 1,
      c: 3,
    });
    expect(deepMerge({ a: { x: 1 } }, { a: { x: 2 } })).toEqual({ a: { x: 2 } });
  });

  it('replaces arrays and non-plain values instead of merging them', () => {
    expect(deepMerge({ a: [1, 2], b: { c: 1 } }, { a: [3], b: 'text' })).toEqual({
      a: [3],
      b: 'text',
    });
  });

  it('replaces a non-object target value with an object from the source', () => {
    expect(deepMerge({ a: 1 }, { a: { b: 2 } })).toEqual({ a: { b: 2 } });
  });

  it('never mutates its inputs', () => {
    const target = { a: { x: 1 } };
    const source = { a: { y: 2 } };
    deepMerge(target, source);
    expect(target).toEqual({ a: { x: 1 } });
    expect(source).toEqual({ a: { y: 2 } });
  });

  it('merges a __proto__ key from data as an ordinary key without polluting anything', () => {
    const source: Record<string, unknown> = JSON.parse('{"__proto__": {"polluted": true}}');

    const result = deepMerge({ a: 1 }, source);

    expect(Object.keys(result)).toEqual(['a', '__proto__']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });

  it('merges nested __proto__ payloads without reaching the prototype', () => {
    const target: Record<string, unknown> = { a: {} };
    const source: Record<string, unknown> = JSON.parse(
      '{"a": {"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}}}',
    );

    deepMerge(target, source);

    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('changedKeys', () => {
  it('lists differing keys, including keys on only one side', () => {
    expect(changedKeys({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toEqual(['b', 'c']);
    expect(changedKeys({ a: 1, gone: 2 }, { a: 1 })).toEqual(['gone']);
  });

  it('compares deeply', () => {
    expect(changedKeys({ a: { x: [1] } }, { a: { x: [1] } })).toEqual([]);
    expect(changedKeys({ a: { x: [1] } }, { a: { x: [2] } })).toEqual(['a']);
  });

  it('treats a missing key and an undefined value as unchanged', () => {
    expect(changedKeys({ a: undefined }, {})).toEqual([]);
    expect(changedKeys({}, { a: undefined })).toEqual([]);
  });

  it('ignores inherited properties', () => {
    const before = Object.create({ a: 1 }) as Record<string, unknown>;
    expect(changedKeys(before, { b: 1 })).toEqual(['b']);
    expect(changedKeys({ toString: undefined }, {})).toEqual([]);
  });
});
