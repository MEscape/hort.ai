/**
 * Guards and measurements for plain JSON data. Zero dependencies on any
 * domain concept; the limits are parameters, never hard-coded here.
 *
 * Kept apart from `json.ts` (parse/stringify) because these never throw:
 * they answer "is this JSON?" and "how big is it?" for untrusted values.
 */
import { isPlainObject } from './object';

import type { JsonValue } from './json';

function checkJsonValue(value: unknown, depth: number, maxDepth: number): boolean {
  if (depth > maxDepth) {
    return false;
  }
  if (value === null) {
    return true;
  }
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      if (Array.isArray(value)) {
        return value.every((item: unknown) => checkJsonValue(item, depth + 1, maxDepth));
      }
      return (
        isPlainObject(value) &&
        Object.values(value).every((item) => checkJsonValue(item, depth + 1, maxDepth))
      );
    default:
      return false;
  }
}

/**
 * True when `value` is JSON data: `null`, strings, booleans, finite numbers,
 * arrays and plain objects of those. `maxDepth` bounds nesting; the value
 * itself is level 1, so a scalar needs `maxDepth >= 1`.
 */
export function isJsonValue(
  value: unknown,
  maxDepth = Number.POSITIVE_INFINITY,
): value is JsonValue {
  return checkJsonValue(value, 1, maxDepth);
}

/**
 * True for a plain object whose values are all JSON. The record itself is
 * not counted as a level: its values are level 1, like a top-level value
 * passed to `isJsonValue`.
 */
export function isJsonRecord(
  value: unknown,
  maxDepth = Number.POSITIVE_INFINITY,
): value is Record<string, JsonValue> {
  return (
    isPlainObject(value) && Object.values(value).every((item) => checkJsonValue(item, 1, maxDepth))
  );
}

/** Every scalar, entry and container weighs one, plus its characters. */
const VALUE_WEIGHT = 1;

/**
 * Approximates serialized size by counting characters, so nothing has to be
 * serialized to be measured. Only the order of magnitude matters: use it to
 * bound untrusted input, not to predict exact byte counts.
 */
export function jsonWeight(value: JsonValue): number {
  if (typeof value === 'string') {
    return VALUE_WEIGHT + value.length;
  }
  if (value === null || typeof value !== 'object') {
    return VALUE_WEIGHT;
  }
  if (Array.isArray(value)) {
    return value.reduce((total: number, item) => total + jsonWeight(item), VALUE_WEIGHT);
  }
  return Object.entries(value).reduce(
    (total, [key, item]) => total + key.length + jsonWeight(item),
    VALUE_WEIGHT,
  );
}
