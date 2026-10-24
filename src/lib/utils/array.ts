/**
 * Array helpers. Zero dependencies, no knowledge of any domain concept.
 *
 * Every function returns a new array (or `Map`) and leaves its input alone: the domain models
 * built on them are immutable.
 */

/**
 * Type predicate that removes `null` and `undefined` in `.filter()` without a cast.
 *
 * @example [0, null, 'a', undefined].filter(isDefined) // [0, 'a']
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Groups items into a `Map` keyed by the selector result, keeping first-seen key order and the
 * original order inside each group. A `Map` keeps key types honest and avoids the prototype-key
 * collisions a plain object has (`constructor`, `__proto__`).
 *
 * @example groupBy([1, 2, 3], (n) => n % 2) // Map { 1 => [1, 3], 0 => [2] }
 */
export function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = result.get(key);
    if (group) {
      group.push(item);
    } else {
      result.set(key, [item]);
    }
  }
  return result;
}

/**
 * Indexes items by a unique key. When keys collide the last item wins, so use it only when the
 * caller guarantees uniqueness; use `groupBy` when it cannot.
 *
 * @example keyBy([{ id: 'a' }, { id: 'b' }], (x) => x.id).get('b') // { id: 'b' }
 */
export function keyBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T> {
  const result = new Map<K, T>();
  for (const item of items) {
    result.set(keyFn(item), item);
  }
  return result;
}

/**
 * Removes duplicates, optionally comparing by a derived key (`Map` equality, so `NaN` equals
 * `NaN`). The first occurrence wins and order is kept.
 *
 * @example unique([{ id: 1 }, { id: 1 }, { id: 2 }], (x) => x.id) // [{ id: 1 }, { id: 2 }]
 */
export function unique<T>(items: readonly T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) {
    return Array.from(new Set(items));
  }
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Builds `[start, start + 1, ..., end - 1]`; a fractional `end` rounds the length up. Empty when
 * `end <= start`.
 *
 * @example range(2, 5) // [2, 3, 4]
 */
export function range(start: number, end: number): number[] {
  const length = Math.max(0, Math.ceil(end - start));
  return Array.from({ length }, (_, index) => start + index);
}

/**
 * Builds a type guard for a closed set of string literals. `list.includes` rejects a plain
 * `string` argument, which is why such guards are otherwise hand-written with `.some`.
 *
 * @example
 * const isRole = literalGuard(['admin', 'viewer'] as const);
 * isRole('admin'); // true, and narrows to 'admin' | 'viewer'
 */
export function literalGuard<T extends readonly string[]>(
  allowed: T,
): (value: string) => value is T[number] {
  const set: ReadonlySet<string> = new Set(allowed);
  return (value): value is T[number] => set.has(value);
}

/**
 * Returns a copy with `item` inserted at `index`. The index is clamped into `[0, items.length]`;
 * a non-integer index (`NaN`, `Infinity`) appends.
 *
 * @example insertItem(['a', 'c'], 1, 'b') // ['a', 'b', 'c']
 */
export function insertItem<T>(items: readonly T[], index: number, item: T): T[] {
  const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), items.length) : items.length;
  return [...items.slice(0, at), item, ...items.slice(at)];
}

/**
 * Returns a copy with the item at `index` replaced; an index outside the list changes nothing.
 *
 * @example replaceAt(['a', 'b'], 1, 'x') // ['a', 'x']
 */
export function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return items.map((existing, position) => (position === index ? item : existing));
}

/**
 * Returns a copy without the item at `index`; an index outside the list changes nothing.
 *
 * @example removeAt(['a', 'b', 'c'], 1) // ['a', 'c']
 */
export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}
