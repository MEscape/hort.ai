/**
 * Dot-path helpers: reading, writing and vetting paths like `"a.b.0.c"` into nested data.
 * Depends only on `./object`.
 *
 * Paths that come from data or configuration are untrusted: a segment such as `__proto__` would
 * reach `Object.prototype`. Reading only follows OWN properties, writing refuses unsafe segments,
 * and `hasUnsafePathSegment` lets a caller reject such a path up front.
 */

import { isPlainObject } from './object';

/**
 * Property names that must never be traversed or written by a path.
 * Writing through `__proto__` (or `constructor.prototype`) would mutate
 * `Object.prototype` for the whole process.
 */
const UNSAFE_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

/** True when a single path segment could reach or pollute a prototype. */
export function isUnsafePathSegment(segment: string): boolean {
  return UNSAFE_PATH_SEGMENTS.has(segment);
}

/**
 * Converts bracket indexes to dot form.
 *
 * @example normalizePath('items[0].name') // 'items.0.name'
 */
export function normalizePath(path: string): string {
  return path.replace(/\[(\d+)\]/g, '.$1');
}

/**
 * Splits a path into its segments, accepting bracket indexes; empty segments are dropped.
 *
 * @example pathSegments('a..b[2]') // ['a', 'b', '2']
 */
export function pathSegments(path: string): string[] {
  return normalizePath(path).split('.').filter(Boolean);
}

/**
 * True when any segment of the path is unsafe (see `isUnsafePathSegment`). A boolean check for
 * validating paths up front, unlike `setPath`, which throws. Accepts bracket indexes.
 *
 * @example hasUnsafePathSegment('a.__proto__.b') // true
 */
export function hasUnsafePathSegment(path: string): boolean {
  return pathSegments(path).some(isUnsafePathSegment);
}

/**
 * Reads a nested value by dot path (`"a.b.0.c"`). Returns `undefined` when any segment is missing
 * or is not an own property (so `"constructor"` finds nothing on a plain object), and never throws.
 * Array indexes are plain segments: `"items.0.name"`.
 *
 * @example getPath({ a: { b: [{ c: 1 }] } }, 'a.b.0.c') // 1
 */
export function getPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    if (!Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment]; // Own-key presence was checked above.
  }
  return current;
}

/**
 * Returns a copy of `obj` with the value at a dot path replaced. Never mutates the input. Missing
 * intermediate segments, and any that are not plain objects, are created as plain objects.
 *
 * @throws Error on a prototype-polluting segment; vet untrusted paths first with `hasUnsafePathSegment`
 * @example setPath({ a: 1 }, 'b.c', 2) // { a: 1, b: { c: 2 } }
 */
export function setPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown,
): T {
  const segments = path.split('.');
  if (segments.some(isUnsafePathSegment)) {
    throw new Error(`Unsafe path segment in "${path}"`);
  }

  const [head = '', ...rest] = segments; // `split` always yields one segment; `''` is the empty path.

  const next =
    rest.length === 0
      ? value
      : setPath(isPlainObject(obj[head]) ? obj[head] : {}, rest.join('.'), value);

  return { ...obj, [head]: next };
}
