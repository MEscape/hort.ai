/**
 * JSON helpers: parsing, serializing and canonical serialization.
 * Pure utilities. Depends only on `./object`.
 */

import { isPlainObject } from './object';

export class JsonParseError extends Error {
  constructor(public override readonly cause: unknown) {
    super('Failed to parse JSON');
    this.name = 'JsonParseError';
  }
}

export class JsonStringifyError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`Failed to stringify JSON: ${message}`);
    this.name = 'JsonStringifyError';
  }
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Parses JSON. Returns `unknown` instead of `any` to force caller validation.
 * Throws `JsonParseError` on malformed input so it can be distinguished
 * from other SyntaxErrors in the call stack.
 */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new JsonParseError(error);
  }
}

/**
 * Serializes to JSON. Throws `JsonStringifyError` on cycles, `BigInt`,
 * or unserializable values (like `undefined` or functions) instead of
 * failing silently.
 */
export function stringifyJson(value: unknown, space?: number): string {
  let text: string | undefined;

  try {
    text = JSON.stringify(value, null, space);
  } catch (error) {
    // Catches cycles and BigInts
    throw new JsonStringifyError('Exception during serialization', error);
  }

  if ((text as string | undefined) === undefined) {
    // Catches values JSON.stringify silently ignores
    throw new JsonStringifyError('Value is not serializable');
  }

  return text;
}

/**
 * JSON with plain-object keys sorted, so two structurally equal values always
 * serialise identically. Use it to derive hashes and ids from content.
 *
 * The output is a persisted contract: ids derived from it are stored, so
 * changing it changes those ids. Pin it with tests before touching it.
 *
 * Follows `JSON.stringify` for everything except key order:
 * - `undefined` object entries are omitted; inside arrays they become `null`.
 * - Non-plain objects (`Date`, `Map`, class instances) are delegated to
 *   `JSON.stringify`, so a `Date` becomes its ISO string and a `Map` or `Set`
 *   becomes `{}`. Different contents of those collide.
 * - Not safe for untrusted input: unlike `stringifyJson`, a `BigInt` or a
 *   cycle throws a raw error (`TypeError`, or a stack overflow for cycles).
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const entry = value[key];
        return entry === undefined ? [] : [`${JSON.stringify(key)}:${stableStringify(entry)}`];
      });
    return `{${entries.join(',')}}`;
  }

  const result = JSON.stringify(value) as string | undefined;
  return result ?? 'null';
}
