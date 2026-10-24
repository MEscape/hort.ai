import type { AppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { clampToLastPage } from './page-request';

import type { Page, PageRequest } from './page-request';

/**
 * Loads the page asked for. A page past the end (items were removed since the
 * address was made) answers the last page instead, in a second read.
 */
export function loadClampedPage<P extends Page<unknown>, E extends AppError>(
  requested: PageRequest,
  load: (request: PageRequest) => AppResultAsync<P, E>,
): AppResultAsync<P, E> {
  return load(requested).andThen((first) => {
    const request = clampToLastPage(requested, first.total);
    return request.page === first.page ? okAsync(first) : load(request);
  });
}
