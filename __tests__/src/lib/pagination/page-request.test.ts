import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE_LIMITS,
  PAGE_SIZE_OPTIONS,
  clampToLastPage,
  offsetOf,
  pageCountOf,
  resolvePageRequest,
  toPage,
} from '@lib/pagination';

describe('resolvePageRequest', () => {
  it('takes whole numbers, as numbers or text', () => {
    expect(resolvePageRequest({ page: 3, pageSize: 50 })).toEqual({ page: 3, pageSize: 50 });
    expect(resolvePageRequest({ page: '2', pageSize: ' 10 ' })).toEqual({ page: 2, pageSize: 10 });
  });

  it.each([undefined, null, '', '  ', 'abc', 0, -1, 1.5, '1.5', Number.NaN, 2 ** 60, {}])(
    'falls back to the defaults for %j',
    (junk) => {
      expect(resolvePageRequest({ page: junk, pageSize: junk })).toEqual({
        page: 1,
        pageSize: DEFAULT_PAGE_LIMITS.defaultPageSize,
      });
    },
  );

  it('never exceeds the maximum page size', () => {
    expect(resolvePageRequest({ pageSize: 10_000 }).pageSize).toBe(DEFAULT_PAGE_LIMITS.maxPageSize);
  });

  it('honours custom limits', () => {
    const limits = { defaultPageSize: 5, maxPageSize: 8 };

    expect(resolvePageRequest({}, limits)).toEqual({ page: 1, pageSize: 5 });
    expect(resolvePageRequest({ pageSize: 20 }, limits).pageSize).toBe(8);
  });

  it('offers only sizes within the default limit', () => {
    expect(Math.max(...PAGE_SIZE_OPTIONS)).toBeLessThanOrEqual(DEFAULT_PAGE_LIMITS.maxPageSize);
  });
});

describe('offsetOf', () => {
  it('skips the pages before', () => {
    expect(offsetOf({ page: 1, pageSize: 25 })).toBe(0);
    expect(offsetOf({ page: 3, pageSize: 25 })).toBe(50);
  });
});

describe('pageCountOf', () => {
  it.each([
    [0, 1],
    [1, 1],
    [25, 1],
    [26, 2],
    [100, 4],
  ])('needs %i items -> %i page(s) at 25 per page', (total, expected) => {
    expect(pageCountOf(total, 25)).toBe(expected);
  });
});

describe('toPage', () => {
  it('describes the slice with its totals', () => {
    expect(toPage(['a', 'b'], 7, { page: 2, pageSize: 5 })).toEqual({
      items: ['a', 'b'],
      page: 2,
      pageSize: 5,
      total: 7,
      pageCount: 2,
    });
  });
});

describe('clampToLastPage', () => {
  it('moves a page past the end back onto the last page', () => {
    expect(clampToLastPage({ page: 9, pageSize: 10 }, 25)).toEqual({ page: 3, pageSize: 10 });
  });

  it('keeps a page within range and the first page of an empty list', () => {
    expect(clampToLastPage({ page: 2, pageSize: 10 }, 25).page).toBe(2);
    expect(clampToLastPage({ page: 4, pageSize: 10 }, 0).page).toBe(1);
  });
});
