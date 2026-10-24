/**
 * Prisma 8 reads and writes `DateTime` columns as `Temporal.Instant`, not
 * `Date`. Only the member the read side needs is declared, so mappers do
 * not depend on the global `Temporal` type being available.
 */
export interface InstantRecord {
  readonly epochMilliseconds: number;
}

/** Converts a column read from Prisma 8 into the `Date` the domain uses. */
export function instantToDate(instant: InstantRecord): Date {
  return new Date(instant.epochMilliseconds);
}

/** What a `DateTime` column accepts on a write: a `Temporal.Instant`, or ISO-8601 text. */
export type InstantInput = string | object;

/** A `Temporal.Instant` for the ISO text, or `null` when the runtime has no global `Temporal`. */
function instantFrom(iso: string): object | null {
  const temporal: unknown = Reflect.get(globalThis, 'Temporal');
  if (typeof temporal !== 'object' || temporal === null) {
    return null;
  }
  const factory: unknown = Reflect.get(temporal, 'Instant');
  if (typeof factory !== 'function') {
    return null;
  }
  const from: unknown = Reflect.get(factory, 'from');
  if (typeof from !== 'function') {
    return null;
  }
  const instant: unknown = Reflect.apply(from, factory, [iso]);
  return typeof instant === 'object' ? instant : null;
}

/**
 * Converts a `Date` into the value Prisma 8 expects when WRITING a
 * `DateTime` column. A `Date` is not accepted as-is. A column authored as a
 * Temporal type (the default) takes only a `Temporal.Instant`, so one is
 * built whenever the runtime has a global `Temporal`; a column authored as a
 * string type takes ISO-8601 text, which is what is returned when there is
 * no `Temporal` to build from.
 */
export function dateToInstant(date: Date): InstantInput {
  const iso = date.toISOString();
  return instantFrom(iso) ?? iso;
}
