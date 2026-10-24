/** Which slice of a list is wanted. Pages count from 1. */
export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PageLimits {
  readonly defaultPageSize: number;
  /** The most one request may ask for: a list is never unbounded, whatever the URL says. */
  readonly maxPageSize: number;
}

export const DEFAULT_PAGE_LIMITS: PageLimits = { defaultPageSize: 25, maxPageSize: 100 };

/** The page sizes a user can choose in the interface (all within `DEFAULT_PAGE_LIMITS`). */
// eslint-disable-next-line no-magic-numbers -- the choices themselves are the definition
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** One slice of a list, with what a page control needs to draw itself. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /** Every item that matches the filters, not only this page. */
  readonly total: number;
  readonly pageCount: number;
}

function toPositiveInteger(raw: unknown): number | null {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * The slice a request asks for, from untrusted values (the page and size
 * query parameters): anything that is not a whole number of at least 1 falls
 * back to the default, and the size never exceeds the limit. Never throws,
 * so a hand-edited URL shows the first page instead of an error.
 */
export function resolvePageRequest(
  raw: { readonly page?: unknown; readonly pageSize?: unknown },
  limits: PageLimits = DEFAULT_PAGE_LIMITS,
): PageRequest {
  const size = toPositiveInteger(raw.pageSize) ?? limits.defaultPageSize;
  return {
    page: toPositiveInteger(raw.page) ?? 1,
    pageSize: Math.min(size, limits.maxPageSize),
  };
}

/** How many rows a repository skips for this page. */
export function offsetOf(request: PageRequest): number {
  return (request.page - 1) * request.pageSize;
}

/** Pages needed for `total` items; an empty list still has one (empty) page. */
export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The page of `items` that a repository read for `request`. */
export function toPage<T>(items: readonly T[], total: number, request: PageRequest): Page<T> {
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    total,
    pageCount: pageCountOf(total, request.pageSize),
  };
}

/** A request moved back onto the last page when it points past the end (items were deleted meanwhile). */
export function clampToLastPage(request: PageRequest, total: number): PageRequest {
  return { ...request, page: Math.min(request.page, pageCountOf(total, request.pageSize)) };
}
