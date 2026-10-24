import { describe, expect, it } from 'vitest';

import { formatSort, resolveSort } from '@lib/pagination';

const allowed = ['name', 'createdAt'] as const;
const fallback = { field: 'createdAt', direction: 'desc' } as const;

describe('resolveSort', () => {
  it('reads an ascending field', () => {
    expect(resolveSort('name', allowed, fallback)).toEqual({ field: 'name', direction: 'asc' });
  });

  it('reads a descending field from the minus prefix', () => {
    expect(resolveSort('-name', allowed, fallback)).toEqual({ field: 'name', direction: 'desc' });
  });

  it.each([undefined, null, 42, ['name'], 'password', '-password', '', '-', 'NAME'])(
    'falls back for %j',
    (raw) => {
      expect(resolveSort(raw, allowed, fallback)).toBe(fallback);
    },
  );
});

describe('formatSort', () => {
  it('is the inverse of resolveSort', () => {
    expect(formatSort({ field: 'name', direction: 'asc' })).toBe('name');
    expect(formatSort({ field: 'name', direction: 'desc' })).toBe('-name');
    expect(resolveSort(formatSort(fallback), allowed, { field: 'name', direction: 'asc' })).toEqual(
      fallback,
    );
  });
});
