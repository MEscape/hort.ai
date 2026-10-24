/**
 * Function combinators. Zero dependencies.
 */

/**
 * Delays calls until `waitMs` has passed without another call; only the last call's arguments
 * are used. `cancel()` drops a pending call.
 *
 * @example const save = debounce(persist, 300); save(a); save(b); // persist(b) once, after 300 ms
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = undefined;
  };

  return debounced;
}

/**
 * Runs `fn` at most once and returns the cached result on every later call. A call that throws
 * caches nothing, so the next call tries again: use it for lazily built singletons, where a
 * failed build should be retried rather than remembered.
 *
 * @example const getTransport = once(() => createTransport(env));
 */
export function once<T>(fn: () => T): () => T {
  let called = false;
  let result: T;
  return () => {
    if (!called) {
      result = fn();
      called = true;
    }
    return result;
  };
}

/** Returns its argument unchanged. Useful as a default transform. */
export function identity<T>(value: T): T {
  return value;
}

/** Does nothing. Useful as a default callback. */
export function noop(): void {
  // Intentionally empty.
}
