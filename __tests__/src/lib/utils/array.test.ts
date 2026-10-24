import { describe, expect, it } from 'vitest';

import {
  groupBy,
  insertItem,
  isDefined,
  keyBy,
  literalGuard,
  range,
  removeAt,
  replaceAt,
  unique,
} from '@lib/utils';

describe('isDefined', () => {
  it('removes null and undefined but keeps other falsy values', () => {
    expect([0, null, '', undefined, false].filter(isDefined)).toEqual([0, '', false]);
  });
});

describe('groupBy', () => {
  it('groups in first-seen key order and keeps item order inside groups', () => {
    const groups = groupBy([1, 2, 3, 4, 5], (n) => n % 2);
    expect([...groups.entries()]).toEqual([
      [1, [1, 3, 5]],
      [0, [2, 4]],
    ]);
  });

  it('survives prototype-like keys', () => {
    const groups = groupBy(['constructor', '__proto__', 'constructor'], (s) => s);
    expect(groups.get('constructor')).toEqual(['constructor', 'constructor']);
    expect(groups.get('__proto__')).toEqual(['__proto__']);
  });

  it('returns an empty map for no items', () => {
    expect(groupBy([], (n: number) => n).size).toBe(0);
  });
});

describe('keyBy', () => {
  it('indexes items and lets the last one win on a collision', () => {
    const map = keyBy(
      [
        { id: 'a', v: 1 },
        { id: 'b', v: 2 },
        { id: 'a', v: 3 },
      ],
      (x) => x.id,
    );
    expect(map.get('a')).toEqual({ id: 'a', v: 3 });
    expect(map.get('b')).toEqual({ id: 'b', v: 2 });
    expect(map.size).toBe(2);
  });
});

describe('unique', () => {
  it('removes duplicates by identity, keeping order', () => {
    expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });

  it('treats NaN as equal to NaN', () => {
    expect(unique([Number.NaN, Number.NaN])).toHaveLength(1);
  });

  it('removes duplicates by a derived key, first occurrence wins', () => {
    const items = [
      { id: 1, n: 'a' },
      { id: 1, n: 'b' },
      { id: 2, n: 'c' },
    ];
    expect(unique(items, (x) => x.id)).toEqual([
      { id: 1, n: 'a' },
      { id: 2, n: 'c' },
    ]);
  });
});

describe('range', () => {
  it('builds start..end-1', () => {
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  it('rounds a fractional end up', () => {
    expect(range(0, 2.5)).toEqual([0, 1, 2]);
  });

  it('is empty when end is not after start', () => {
    expect(range(5, 5)).toEqual([]);
    expect(range(5, 2)).toEqual([]);
  });
});

describe('literalGuard', () => {
  const isRole = literalGuard(['admin', 'viewer'] as const);

  it('accepts members and rejects everything else', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('viewer')).toBe(true);
    expect(isRole('root')).toBe(false);
  });
});

describe('insertItem', () => {
  it('inserts at the index without mutating the input', () => {
    const input = ['a', 'c'];
    expect(insertItem(input, 1, 'b')).toEqual(['a', 'b', 'c']);
    expect(input).toEqual(['a', 'c']);
  });

  it('clamps the index into range', () => {
    expect(insertItem(['a'], -3, 'x')).toEqual(['x', 'a']);
    expect(insertItem(['a'], 9, 'x')).toEqual(['a', 'x']);
  });

  it('appends for a non-integer index', () => {
    expect(insertItem(['a'], Number.NaN, 'x')).toEqual(['a', 'x']);
    expect(insertItem(['a'], Number.POSITIVE_INFINITY, 'x')).toEqual(['a', 'x']);
  });
});

describe('replaceAt', () => {
  it('replaces the item at the index', () => {
    expect(replaceAt(['a', 'b'], 1, 'x')).toEqual(['a', 'x']);
  });

  it('changes nothing for an out-of-range index', () => {
    expect(replaceAt(['a', 'b'], 5, 'x')).toEqual(['a', 'b']);
  });
});

describe('removeAt', () => {
  it('removes the item at the index', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('changes nothing for an out-of-range index', () => {
    expect(removeAt(['a', 'b'], -1)).toEqual(['a', 'b']);
  });
});
