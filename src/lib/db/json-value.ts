import { invariant, isJsonValue, parseJson, stringifyJson } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

/**
 * Plain, mutable JSON for a write to a JSON column. Domain values are
 * readonly and may carry `undefined` members; a round trip through JSON text
 * yields exactly what the database will hold (`Date` becomes its ISO text, `undefined` members
 * are dropped). Call it inside the repository's guarded thunk: a value with no JSON form (a
 * `bigint`, a cycle) throws `JsonStringifyError`, which then surfaces as a persistence failure
 * rather than a crash.
 *
 * @throws JsonStringifyError when the value cannot be written as JSON
 */
export function toJsonValue(value: unknown): JsonValue {
  const plain = parseJson(stringifyJson(value));
  invariant(isJsonValue(plain), 'Parsed JSON text is always JSON data.');
  return plain;
}
