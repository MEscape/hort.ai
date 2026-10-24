/**
 * The only way code that must stay deterministic learns the time: domain and
 * application code never read the system clock themselves, they are handed a
 * `Clock` (architecture rule). Tests pass a fixed one.
 *
 * `now()` is an absolute instant. Anything that persists or compares it as
 * text uses `now().toISOString()`, which is always UTC with millisecond
 * precision: the one canonical instant form across modules.
 */
export interface Clock {
  now(): Date;
}

/** The real clock. Created once per process and shared by `composition.ts` files. */
export const systemClock: Clock = {
  now: () => new Date(),
};
