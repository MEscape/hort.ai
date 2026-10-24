import type { Clock } from '@lib/clock';

/** How long a failed build is remembered before another is attempted. */
export const BUILD_RETRY_INTERVAL_MS = 5000;

export interface LazyFailure {
  readonly atMs: number;
  readonly error: unknown;
}

/**
 * Where a lazily built value lives. Access is encapsulated behind methods so callers
 * can host storage anywhere (module scope, local closure, or `globalThis` to survive hot reload).
 */
export interface LazyCell<T> {
  get(): T | undefined;
  set(value: T): void;
  getFailure(): LazyFailure | undefined;
  setFailure(failure: LazyFailure | undefined): void;
}

export type LazyResult<T> =
  | { readonly isReady: true; readonly value: T }
  | { readonly isReady: false; readonly error: unknown };

export function createLazyCell<T>(): LazyCell<T> {
  let value: T | undefined;
  let failure: LazyFailure | undefined;
  return {
    get: () => value,
    set: (v) => {
      value = v;
      failure = undefined;
    },
    getFailure: () => failure,
    setFailure: (f) => {
      failure = f;
    },
  };
}

export interface ResolveLazyDeps<T> {
  readonly cell: LazyCell<T>;
  readonly build: () => T;
  readonly clock: Clock;
  readonly onFailure?: (thrown: unknown) => void;
}

/**
 * Builds the value on first use and keeps it. A build that throws is remembered for a few seconds
 * instead of being repeated: the inputs are configuration, so retrying on every request would
 * repeat the same failure, re-read the environment each time, and write one error line per request
 * (a log flood is its own denial of service). `onFailure` runs once per real attempt, never for a
 * remembered failure. Never throws.
 */
export function resolveLazy<T>(deps: ResolveLazyDeps<T>): LazyResult<T> {
  const current = deps.cell.get();
  if (current !== undefined) {
    return { isReady: true, value: current };
  }

  const nowMs = deps.clock.now().getTime();
  const failure = deps.cell.getFailure();
  if (
    failure !== undefined &&
    nowMs - failure.atMs >= 0 &&
    nowMs - failure.atMs < BUILD_RETRY_INTERVAL_MS
  ) {
    return { isReady: false, error: failure.error };
  }

  try {
    const built = deps.build();
    deps.cell.set(built);
    return { isReady: true, value: built };
  } catch (thrown) {
    deps.cell.setFailure({ atMs: nowMs, error: thrown });
    try {
      deps.onFailure?.(thrown);
    } catch {
      // A failing logger must not turn a refusal into a rejected promise.
    }
    return { isReady: false, error: thrown };
  }
}
