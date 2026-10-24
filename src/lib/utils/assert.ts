/**
 * Exhaustiveness and invariant helpers. Zero dependencies.
 *
 * Both throw: they signal programmer errors, never expected failures (errors.md). Anything that
 * can fail because of input or the outside world is a `Result` instead.
 */

/** The value for an error message; never throws, whatever the value is (a `bigint`, a cycle). */
function describeValue(value: unknown): string {
  try {
    const text = JSON.stringify(value) as string | undefined; // `undefined` for a value with no JSON form
    return text ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Marks a code path as unreachable. Placing it in the `default` branch of a `switch` over a union
 * turns a forgotten variant into a compile-time error (typescript.md: exhaustive checks); if the
 * branch is reached anyway at runtime (data from outside the type system), it throws.
 *
 * @throws Error always
 * @example
 * switch (shape.kind) {
 *   case 'circle': return area(shape);
 *   default: return assertNever(shape);
 * }
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${describeValue(value)}`);
}

/**
 * Asserts a condition that must hold if the program is correct, and narrows the type from it.
 * Never use it to validate external input; use a schema for that (validation.md).
 *
 * @throws Error `Invariant violation: <message>` when the condition is falsy
 * @example invariant(isDefined(from), 'MAIL_FROM is required when a provider is set.');
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
