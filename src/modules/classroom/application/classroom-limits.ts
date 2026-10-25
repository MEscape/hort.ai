/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const DEFAULT_CLASSROOM_LIST_LIMIT = 50;
export const MIN_CLASSROOM_LIST_LIMIT = 1;
export const MAX_CLASSROOM_LIST_LIMIT = 100;

/** A primary-school class has far fewer children; the bound only stops an unbounded read. */
export const MAX_CLASS_MEMBER_LIST_LIMIT = 100;
