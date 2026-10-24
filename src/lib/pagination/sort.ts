export type SortDirection = 'asc' | 'desc';

export interface SortSpec<Field extends string> {
  readonly field: Field;
  readonly direction: SortDirection;
}

/**
 * Reads `field` or `-field` (descending) from untrusted text, accepting only
 * the fields the list can actually sort by (an allowlist, so a query value
 * never becomes a column name). Anything else yields `fallback`.
 */
export function resolveSort<Field extends string>(
  raw: unknown,
  allowed: readonly Field[],
  fallback: SortSpec<Field>,
): SortSpec<Field> {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const direction: SortDirection = raw.startsWith('-') ? 'desc' : 'asc';
  const name = raw.startsWith('-') ? raw.slice(1) : raw;
  const field = allowed.find((candidate) => candidate === name);
  return field === undefined ? fallback : { field, direction };
}

/** The inverse of `resolveSort`, for building a link that sorts by `field`. */
export function formatSort<Field extends string>(spec: SortSpec<Field>): string {
  return spec.direction === 'desc' ? `-${spec.field}` : spec.field;
}
