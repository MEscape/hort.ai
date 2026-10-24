import { describe, expect, it } from 'vitest';

import {
  getPath,
  hasUnsafePathSegment,
  isUnsafePathSegment,
  normalizePath,
  pathSegments,
  setPath,
} from '@lib/utils';

describe('isUnsafePathSegment', () => {
  it.each(['__proto__', 'prototype', 'constructor'])('flags %s', (segment) => {
    expect(isUnsafePathSegment(segment)).toBe(true);
  });

  it.each(['name', '0', '', '__proto', 'Constructor'])('allows %j', (segment) => {
    expect(isUnsafePathSegment(segment)).toBe(false);
  });
});

describe('normalizePath', () => {
  it('turns bracket indexes into dot form', () => {
    expect(normalizePath('items[0].name')).toBe('items.0.name');
    expect(normalizePath('a[1][22]')).toBe('a.1.22');
  });

  it('leaves dot paths and non-numeric brackets alone', () => {
    expect(normalizePath('a.b')).toBe('a.b');
    expect(normalizePath('a[x]')).toBe('a[x]');
  });
});

describe('pathSegments', () => {
  it('splits dots and bracket indexes, dropping empty segments', () => {
    expect(pathSegments('a..b[2]')).toEqual(['a', 'b', '2']);
    expect(pathSegments('.a.')).toEqual(['a']);
  });

  it('is empty for the empty path', () => {
    expect(pathSegments('')).toEqual([]);
  });
});

describe('hasUnsafePathSegment', () => {
  it('detects unsafe segments anywhere in the path', () => {
    expect(hasUnsafePathSegment('a.__proto__.b')).toBe(true);
    expect(hasUnsafePathSegment('constructor.prototype.x')).toBe(true);
    expect(hasUnsafePathSegment('a..constructor')).toBe(true);
  });

  it('accepts safe paths, bracket indexes and the empty path', () => {
    expect(hasUnsafePathSegment('a.b[0].c')).toBe(false);
    expect(hasUnsafePathSegment('')).toBe(false);
  });
});

describe('getPath', () => {
  const data = { a: { b: [{ c: 1 }, { c: 2 }] }, flag: false, nothing: null };

  it('reads nested values and array indexes', () => {
    expect(getPath(data, 'a.b.0.c')).toBe(1);
    expect(getPath(data, 'a.b.1')).toEqual({ c: 2 });
    expect(getPath(data, 'flag')).toBe(false);
  });

  it('returns undefined for missing segments', () => {
    expect(getPath(data, 'a.x.y')).toBeUndefined();
    expect(getPath(data, 'a.b.5.c')).toBeUndefined();
  });

  it('returns undefined when it hits a primitive or null on the way', () => {
    expect(getPath(data, 'flag.deeper')).toBeUndefined();
    expect(getPath(data, 'nothing.deeper')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
    expect(getPath('text', 'length')).toBeUndefined();
  });

  it('only follows own properties', () => {
    expect(getPath({}, 'constructor')).toBeUndefined();
    expect(getPath({}, '__proto__')).toBeUndefined();
    expect(getPath({ a: {} }, 'a.toString')).toBeUndefined();
  });

  it('can read through functions-as-objects only when typeof is object', () => {
    expect(getPath({ fn: () => 1 }, 'fn.name')).toBeUndefined();
  });
});

describe('setPath', () => {
  it('sets a value and creates missing intermediate objects', () => {
    expect(setPath({ a: 1 }, 'b.c', 2)).toEqual({ a: 1, b: { c: 2 } });
    expect(setPath({}, 'x.y.z', true)).toEqual({ x: { y: { z: true } } });
  });

  it('replaces an existing value and keeps siblings', () => {
    expect(setPath({ a: { b: 1, c: 2 } }, 'a.b', 9)).toEqual({ a: { b: 9, c: 2 } });
  });

  it('replaces intermediate values that are not plain objects', () => {
    expect(setPath({ a: 5 }, 'a.b', 1)).toEqual({ a: { b: 1 } });
    expect(setPath({ a: [1, 2] }, 'a.b', 1)).toEqual({ a: { b: 1 } });
    expect(setPath({ a: null }, 'a.b', 1)).toEqual({ a: { b: 1 } });
  });

  it('writes the empty path as an empty key', () => {
    expect(setPath({}, '', 1)).toEqual({ '': 1 });
  });

  it('never mutates the input', () => {
    const input = { a: { b: 1 } };
    const output = setPath(input, 'a.c', 2);
    expect(input).toEqual({ a: { b: 1 } });
    expect(output).not.toBe(input);
    expect(output.a).not.toBe(input.a);
  });

  it.each([
    '__proto__.polluted',
    'a.__proto__.polluted',
    'constructor.prototype.polluted',
    'prototype',
  ])('throws on the unsafe path %s and pollutes nothing', (path) => {
    expect(() => setPath({}, path, true)).toThrow(`Unsafe path segment in "${path}"`);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
