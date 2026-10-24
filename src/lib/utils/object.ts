/**
 * Object helpers. Zero dependencies.
 *
 * They read and write only OWN properties, and build their results so that a key taken from data
 * (`__proto__`, `constructor`) stays an ordinary key instead of reaching the prototype chain.
 * Everything returns a new object; the inputs are never mutated.
 */

/**
 * True for objects created by `{}`, `new Object()` or `Object.create(null)`; false for arrays,
 * `Date`, `Map`, class instances and `null`. The test that decides whether a value is "data" that
 * may be walked, merged or compared key by key.
 *
 * @example isPlainObject({}) // true
 * @example isPlainObject(new Map()) // false
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Own-property check that narrows the key. Unlike `in`, it ignores the prototype chain, so
 * `hasOwnKey(obj, 'toString')` is false.
 */
export function hasOwnKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return Object.hasOwn(obj, key);
}

/**
 * A new object with only the listed keys, those the object has as its own.
 *
 * @example pick({ a: 1, b: 2 }, ['a']) // { a: 1 }
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>; // Filled below for exactly the keys in Pick<T, K>.
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * A new object without the listed keys.
 *
 * @example omit({ a: 1, b: 2 }, ['a']) // { b: 2 }
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const excluded = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !excluded.has(key))) as Omit<
    T,
    K
  >; // Object.fromEntries widens the key type to string.
}

/**
 * Structural equality for plain JSON-shaped values: primitives (`Object.is`, so `NaN` equals
 * `NaN`), arrays and plain objects, compared by own keys. Not for `Map`, `Set`, `Date` (these
 * compare by identity) or cyclic structures (these recurse without end).
 *
 * @example deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }) // true
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) {
      return false;
    }
    return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Recursively merges plain objects into a new one; `source` wins. Arrays and non-plain values from
 * `source` replace those in `target` instead of being merged. A key named `__proto__` in the data
 * is merged as an ordinary key: it never changes the prototype of the result.
 *
 * @example deepMerge({ a: { x: 1 }, b: 1 }, { a: { y: 2 } }) // { a: { x: 1, y: 2 }, b: 1 }
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  // A `Map`, then `Object.fromEntries`: assigning `result['__proto__'] = value` would set the
  // prototype, while `fromEntries` always defines an own property.
  const merged = new Map<string, unknown>(Object.entries(target));
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = merged.get(key);
    merged.set(
      key,
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue,
    );
  }
  return Object.fromEntries(merged) as T; // The merge preserves T's top-level keys by construction.
}

/**
 * Keys whose value is not `undefined`; `null` counts as a value.
 *
 * @example definedKeys({ a: 1, b: undefined, c: null }) // ['a', 'c']
 */
export function definedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.entries(obj)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key) as Array<keyof T>; // Object.entries widens the key type to string.
}

/** The own value at `key`, or `undefined`: never one inherited from the prototype chain. */
function ownValue(record: Readonly<Record<string, unknown>>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Keys whose value differs between two records (compared with `deepEqual`), including keys
 * present on only one side. A key that is missing on one side and `undefined` on the other counts
 * as unchanged.
 *
 * @example changedKeys({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 }) // ['b', 'c']
 */
export function changedKeys(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !deepEqual(ownValue(before, key), ownValue(after, key)));
}
