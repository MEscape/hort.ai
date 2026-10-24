import { describe, expect, it } from 'vitest';

import { unexpectedError } from '@lib/errors';
import { loadClampedPage, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

/** A list of `total` numbers that serves any requested page, and remembers what was asked. */
function listOf(total: number) {
  const requests: PageRequest[] = [];
  const load = (request: PageRequest): AppResultAsync<Page<number>, never> => {
    requests.push(request);
    const start = (request.page - 1) * request.pageSize;
    const items = Array.from({ length: total }, (_, index) => index).slice(
      start,
      start + request.pageSize,
    );
    return okAsync(toPage(items, total, request));
  };
  return { load, requests };
}

describe('loadClampedPage', () => {
  it('reads once when the page exists', async () => {
    const list = listOf(25);
    const result = await loadClampedPage({ page: 2, pageSize: 10 }, list.load);

    expect(result._unsafeUnwrap()).toMatchObject({
      page: 2,
      items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    });
    expect(list.requests).toHaveLength(1);
  });

  it('answers the last page when the request points past the end', async () => {
    const list = listOf(25);
    const result = await loadClampedPage({ page: 9, pageSize: 10 }, list.load);

    expect(result._unsafeUnwrap()).toMatchObject({ page: 3, items: [20, 21, 22, 23, 24] });
    expect(list.requests.map((request) => request.page)).toEqual([9, 3]);
  });

  it('answers the first, empty page of an empty list', async () => {
    const result = await loadClampedPage({ page: 5, pageSize: 10 }, listOf(0).load);

    expect(result._unsafeUnwrap()).toMatchObject({ page: 1, items: [], total: 0 });
  });

  it('passes a failed read through', async () => {
    const failure = unexpectedError('read.failed', 'Failed.');
    const result = await loadClampedPage({ page: 1, pageSize: 10 }, () => errAsync(failure));

    expect(result._unsafeUnwrapErr()).toBe(failure);
  });
});
