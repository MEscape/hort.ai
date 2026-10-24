/**
 * Structural type guards for untrusted data read back from storage or an
 * external library. Zod is for the presentation boundary (validation.md);
 * below it, data of unknown shape is checked with these small guards, which
 * check SHAPE only. The rules a value must satisfy belong to the domain.
 * Zero dependencies.
 */

/** A type predicate over `unknown`. */
export type Guard<T> = (value: unknown) => value is T;

/** A string (including the empty one). */
export const isString: Guard<string> = (value): value is string => typeof value === 'string';

/** A boolean; `0`, `''` and `null` are not booleans. */
export const isBoolean: Guard<boolean> = (value): value is boolean => typeof value === 'boolean';

/** A finite number; `NaN` and the infinities are not numbers worth storing. */
export const isFiniteNumber: Guard<number> = (value): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A whole number (`Number.isInteger`): `1.5`, `NaN`, `Infinity` and `'1'` are not. */
export const isInteger: Guard<number> = (value): value is number => Number.isInteger(value);

/**
 * An array whose every element passes `guard`.
 *
 * @example arrayOf(isString)(['a', 'b']) // true
 */
export function arrayOf<T>(guard: Guard<T>): Guard<T[]> {
  return (value): value is T[] => Array.isArray(value) && value.every((item) => guard(item));
}

/** Accepts `null` as well as a value that passes `guard`. */
export function nullable<T>(guard: Guard<T>): Guard<T | null> {
  return (value): value is T | null => value === null || guard(value);
}

/** Accepts an absent (`undefined`) member as well as one that passes `guard`. */
export function optional<T>(guard: Guard<T>): Guard<T | undefined> {
  return (value): value is T | undefined => value === undefined || guard(value);
}

/**
 * One of the listed literals.
 *
 * @example oneOf(['draft', 'live'] as const)('live') // true
 */
export function oneOf<const T extends readonly string[]>(values: T): Guard<T[number]> {
  return (value): value is T[number] => values.some((candidate) => candidate === value);
}

/**
 * An object that has every listed member with a matching value. Members not
 * listed are ignored, like a database row with more columns than the reader
 * needs. Give an optional member the `optional` guard. A member is read as a property, so one
 * inherited from the prototype chain counts too.
 *
 * @example objectOf<{ id: string; n: number }>({ id: isString, n: isFiniteNumber })(row)
 */
export function objectOf<T extends object>(members: {
  readonly [K in keyof T]-?: Guard<T[K]>;
}): Guard<T> {
  const entries: ReadonlyArray<readonly [string, Guard<unknown>]> = Object.entries(members);
  return (value): value is T =>
    typeof value === 'object' &&
    value !== null &&
    entries.every(([key, guard]) => guard(Reflect.get(value, key)));
}
